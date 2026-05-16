import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import {
  Braces,
  ChevronDown,
  Download,
  FolderOpen,
  Info,
  PackageOpen,
  Plus,
  RefreshCw,
  ShieldCheck,
  TerminalSquare,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PluginLogsDialog } from '@/components/settings/PluginLogsDialog';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { localizeUnknownError } from '@/lib/backend-error';
import { saveEnabledPostDownloadPlugins } from '@/lib/post-download-plugins';
import type {
  LogEntry,
  PluginCompatibilitySpec,
  PluginExecutionStatusEvent,
  PluginPackageInspection,
  PluginPermissionApproval,
  PluginProvider,
  PluginRuntimeLanguage,
  PluginSummary,
  RuntimeProviderStatus,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { SettingsCard } from './SettingsSection';

type InstallPluginSourceInput = {
  kind: 'app-scaffold' | 'local-folder' | 'local-zip';
  value: string;
};

const PROVIDER_LABELS: Record<PluginProvider, string> = {
  deno: 'Deno',
  node: 'Node',
  bun: 'Bun',
  python: 'Python',
};

const LANGUAGE_LABELS: Record<PluginRuntimeLanguage, string> = {
  javascript: 'JavaScript',
  python: 'Python',
};

function summarizeRequestedPermissions(
  plugin: PluginSummary | PluginPackageInspection,
  t: (key: string, opts?: Record<string, unknown>) => string,
) {
  const permissions = plugin.manifest.permissions;
  const entries: string[] = [];
  if (permissions.network) entries.push(t('download.pluginPermissionNetwork'));
  if (permissions.readPaths.length > 0) {
    entries.push(
      t('download.pluginPermissionReadPathsCount', { count: permissions.readPaths.length }),
    );
  }
  if (permissions.writePaths.length > 0) {
    entries.push(
      t('download.pluginPermissionWritePathsCount', {
        count: permissions.writePaths.length,
      }),
    );
  }
  if (permissions.env.length > 0) {
    entries.push(t('download.pluginPermissionEnvCount', { count: permissions.env.length }));
  }
  return entries;
}

function currentProvider(plugin: PluginSummary) {
  return (
    plugin.installation.selectedProvider ??
    plugin.manifest.runtime.preferredProvider ??
    plugin.manifest.runtime.supportedProviders[0]
  );
}

function summarizeCompatibility(
  compatibility: PluginCompatibilitySpec | null | undefined,
  t: (key: string, opts?: Record<string, unknown>) => string,
) {
  const entries: string[] = [];
  if (compatibility?.appVersion) {
    entries.push(`${t('download.pluginCompatibilityApp')}: ${compatibility.appVersion}`);
  }
  if (compatibility?.sdkVersion) {
    entries.push(`${t('download.pluginCompatibilitySdk')}: ${compatibility.sdkVersion}`);
  }
  return entries;
}

function formatPluginIdentifier(pluginId: string, slug: string) {
  const shortId = pluginId.slice(0, 8);
  return `${shortId} • ${slug}`;
}

function formatChecksum(checksum: string) {
  if (checksum.length <= 20) return checksum;
  return `${checksum.slice(0, 8)}...${checksum.slice(-8)}`;
}

function formatSourceKind(
  kind: PluginSummary['installation']['source']['kind'] | PluginPackageInspection['source']['kind'],
  t: (key: string, opts?: Record<string, unknown>) => string,
) {
  switch (kind) {
    case 'app-scaffold':
      return t('download.pluginSourceAppScaffold');
    case 'local-folder':
      return t('download.pluginSourceLocalFolder');
    case 'local-zip':
      return t('download.pluginSourceLocalZip');
    case 'remote-url':
      return t('download.pluginSourceRemoteUrl');
    default:
      return kind;
  }
}

function formatRuntimeStatusBadge(
  status: string | undefined,
  t: (key: string, opts?: Record<string, unknown>) => string,
) {
  if (status === 'running') return t('download.pluginStatusRunning');
  if (status === 'success') return t('download.pluginStatusSuccess');
  if (status === 'error') return t('download.pluginStatusError');
  return status;
}

export function PostDownloadPluginsCard() {
  const { t } = useTranslation('settings');
  const [plugins, setPlugins] = useState<PluginSummary[]>([]);
  const [providers, setProviders] = useState<RuntimeProviderStatus[]>([]);
  const [defaultProviders, setDefaultProviders] = useState<
    Partial<Record<PluginRuntimeLanguage, PluginProvider>>
  >({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [runtimeGuideOpen, setRuntimeGuideOpen] = useState(false);
  const [expandedPluginId, setExpandedPluginId] = useState<string | null>(null);
  const [newPluginName, setNewPluginName] = useState('');
  const [newPluginSlug, setNewPluginSlug] = useState('');
  const [inspection, setInspection] = useState<PluginPackageInspection | null>(null);
  const [installSource, setInstallSource] = useState<InstallPluginSourceInput | null>(null);
  const [installAcknowledged, setInstallAcknowledged] = useState(false);
  const [envDrafts, setEnvDrafts] = useState<Record<string, string>>({});
  const [runtimeStatuses, setRuntimeStatuses] = useState<
    Record<string, { status: string; message?: string | null }>
  >({});
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [pluginLogs, setPluginLogs] = useState<LogEntry[]>([]);
  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null);
  const [pluginLogsError, setPluginLogsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPlugins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pluginResult, providerResult] = await Promise.all([
        invoke<PluginSummary[]>('list_plugins'),
        invoke<RuntimeProviderStatus[]>('list_runtime_providers'),
      ]);
      setPlugins(pluginResult);
      setProviders(providerResult);

      const defaults: Partial<Record<PluginRuntimeLanguage, PluginProvider>> = {};
      const statuses: Record<string, { status: string; message?: string | null }> = {};
      for (const plugin of pluginResult) {
        const language = plugin.manifest.runtime.language;
        if (!defaults[language]) {
          defaults[language] = currentProvider(plugin);
        }
        if (plugin.installation.lastExecutionStatus || plugin.installation.lastError) {
          statuses[plugin.manifest.pluginId] = {
            status: plugin.installation.lastExecutionStatus ?? 'idle',
            message: plugin.installation.lastError,
          };
        }
      }
      setDefaultProviders(defaults);
      setRuntimeStatuses(statuses);
      saveEnabledPostDownloadPlugins(
        pluginResult
          .filter((plugin) => plugin.installation.enabled)
          .map((plugin) => plugin.manifest.pluginId),
      );
    } catch (err) {
      console.error('Failed to load plugins:', err);
      setError(t('download.pluginLoadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadPlugins();
  }, [loadPlugins]);

  useEffect(() => {
    let isMounted = true;

    const setup = async () => {
      const unlisten = await listen<PluginExecutionStatusEvent>(
        'plugin-execution-status',
        (event) => {
          if (!isMounted) return;
          setRuntimeStatuses((current) => ({
            ...current,
            [event.payload.pluginId]: {
              status: event.payload.status,
              message: event.payload.message,
            },
          }));
        },
      );

      if (!isMounted) {
        unlisten();
      }

      return unlisten;
    };

    let cleanup: (() => void) | undefined;
    setup().then((unlisten) => {
      cleanup = unlisten;
    });

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, []);

  const updatePluginList = (updater: (items: PluginSummary[]) => PluginSummary[]) => {
    setPlugins((current) => {
      const next = updater(current);
      saveEnabledPostDownloadPlugins(
        next
          .filter((plugin) => plugin.installation.enabled)
          .map((plugin) => plugin.manifest.pluginId),
      );
      return next;
    });
  };

  const inspectSource = async (source: InstallPluginSourceInput, command: string, key: string) => {
    setInspecting(true);
    setError(null);
    try {
      const result = await invoke<PluginPackageInspection>(command, { [key]: source.value });
      setInspection(result);
      setInstallSource(source);
      setInstallAcknowledged(false);
    } catch (err) {
      console.error('Failed to inspect plugin package:', err);
      setError(localizeUnknownError(err));
      setInspection(null);
      setInstallSource(null);
    } finally {
      setInspecting(false);
    }
  };

  const handleImportFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: t('download.pluginImportFolder'),
    });
    if (typeof selected !== 'string') return;
    await inspectSource({ kind: 'local-folder', value: selected }, 'inspect_plugin_folder', 'path');
  };

  const handleImportZip = async () => {
    const selected = await open({
      directory: false,
      multiple: false,
      title: t('download.pluginImportZip'),
      filters: [{ name: 'ZIP', extensions: ['zip'] }],
    });
    if (typeof selected !== 'string') return;
    await inspectSource({ kind: 'local-zip', value: selected }, 'inspect_plugin_zip', 'path');
  };

  const handleInstallInspection = async () => {
    if (!inspection || !installSource) return;
    setInstalling(true);
    setError(null);
    try {
      await invoke<PluginSummary>('install_plugin', {
        source: installSource,
        trusted: true,
      });
      setInspection(null);
      setInstallSource(null);
      setInstallAcknowledged(false);
      await loadPlugins();
    } catch (err) {
      console.error('Failed to install plugin:', err);
      setError(localizeUnknownError(err));
    } finally {
      setInstalling(false);
    }
  };

  const handleTogglePlugin = async (plugin: PluginSummary, enabled: boolean) => {
    try {
      await invoke('update_plugin_state', { pluginId: plugin.manifest.pluginId, enabled });
      updatePluginList((items) =>
        items.map((item) =>
          item.manifest.pluginId === plugin.manifest.pluginId
            ? {
                ...item,
                installation: { ...item.installation, enabled },
              }
            : item,
        ),
      );
    } catch (err) {
      console.error('Failed to update plugin state:', err);
      setError(t('download.pluginStateError'));
    }
  };

  const handleApprovePermissions = async (
    plugin: PluginSummary,
    permissions: PluginPermissionApproval,
  ) => {
    try {
      await invoke('approve_plugin_permissions', {
        pluginId: plugin.manifest.pluginId,
        permissions,
      });
      updatePluginList((items) =>
        items.map((item) =>
          item.manifest.pluginId === plugin.manifest.pluginId
            ? {
                ...item,
                installation: { ...item.installation, approvedPermissions: permissions },
              }
            : item,
        ),
      );
    } catch (err) {
      console.error('Failed to approve plugin permissions:', err);
      setError(t('download.pluginPermissionError'));
    }
  };

  const handleCreatePlugin = async () => {
    const trimmedName = newPluginName.trim();
    if (!trimmedName) return;

    setCreating(true);
    setError(null);
    try {
      await invoke<PluginSummary>('create_plugin_scaffold', {
        input: {
          name: trimmedName,
          slug: newPluginSlug.trim() || null,
        },
      });
      setNewPluginName('');
      setNewPluginSlug('');
      setCreateOpen(false);
      await loadPlugins();
    } catch (err) {
      console.error('Failed to create plugin:', err);
      setError(localizeUnknownError(err));
    } finally {
      setCreating(false);
    }
  };

  const handleOpenPluginDirectory = async (pluginId: string) => {
    try {
      await invoke('open_plugin_directory', { pluginId });
    } catch (err) {
      console.error('Failed to open plugin directory:', err);
      setError(t('download.pluginOpenDirError'));
    }
  };

  const handleRefreshPlugin = async (pluginId: string) => {
    try {
      const refreshed = await invoke<PluginSummary>('get_plugin_details', { pluginId });
      updatePluginList((items) =>
        items.map((item) => (item.manifest.pluginId === pluginId ? refreshed : item)),
      );
      setRuntimeStatuses((current) => ({
        ...current,
        [pluginId]: {
          status: refreshed.installation.lastExecutionStatus ?? current[pluginId]?.status ?? 'idle',
          message: refreshed.installation.lastError ?? current[pluginId]?.message ?? null,
        },
      }));
    } catch (err) {
      console.error('Failed to refresh plugin details:', err);
      setError(localizeUnknownError(err));
    }
  };

  const handleSetPluginProvider = async (plugin: PluginSummary, provider: PluginProvider) => {
    try {
      await invoke('set_plugin_provider', { pluginId: plugin.manifest.pluginId, provider });
      updatePluginList((items) =>
        items.map((item) =>
          item.manifest.pluginId === plugin.manifest.pluginId
            ? {
                ...item,
                installation: { ...item.installation, selectedProvider: provider },
              }
            : item,
        ),
      );
    } catch (err) {
      console.error('Failed to set plugin provider:', err);
      setError(t('download.pluginProviderError'));
    }
  };

  const setEnvDraftValue = (pluginId: string, key: string, value: string) => {
    setEnvDrafts((current) => ({
      ...current,
      [`${pluginId}:${key}`]: value,
    }));
  };

  const getEnvDraftValue = (pluginId: string, key: string) => envDrafts[`${pluginId}:${key}`] ?? '';

  const handleSavePluginEnv = async (plugin: PluginSummary, key: string) => {
    const value = getEnvDraftValue(plugin.manifest.pluginId, key);
    try {
      await invoke('update_plugin_env_values', {
        pluginId: plugin.manifest.pluginId,
        input: {
          values: {
            [key]: value.trim() ? value : null,
          },
        },
      });
      updatePluginList((items) =>
        items.map((item) =>
          item.manifest.pluginId === plugin.manifest.pluginId
            ? {
                ...item,
                installation: {
                  ...item.installation,
                  envValueStatus: {
                    ...item.installation.envValueStatus,
                    [key]: value.trim().length > 0,
                  },
                },
              }
            : item,
        ),
      );
      setEnvDraftValue(plugin.manifest.pluginId, key, '');
    } catch (err) {
      console.error('Failed to update plugin env values:', err);
      setError(t('download.pluginEnvSaveError'));
    }
  };

  const handleClearPluginEnv = async (plugin: PluginSummary, key: string) => {
    try {
      await invoke('update_plugin_env_values', {
        pluginId: plugin.manifest.pluginId,
        input: {
          values: {
            [key]: null,
          },
        },
      });
      updatePluginList((items) =>
        items.map((item) =>
          item.manifest.pluginId === plugin.manifest.pluginId
            ? {
                ...item,
                installation: {
                  ...item.installation,
                  envValueStatus: {
                    ...item.installation.envValueStatus,
                    [key]: false,
                  },
                },
              }
            : item,
        ),
      );
      setEnvDraftValue(plugin.manifest.pluginId, key, '');
    } catch (err) {
      console.error('Failed to clear plugin env value:', err);
      setError(t('download.pluginEnvSaveError'));
    }
  };

  const handleSetDefaultProvider = async (
    language: PluginRuntimeLanguage,
    provider: PluginProvider,
  ) => {
    try {
      await invoke('set_default_provider_for_language', { language, provider });
      setDefaultProviders((current) => ({ ...current, [language]: provider }));
    } catch (err) {
      console.error('Failed to set default provider:', err);
      setError(t('download.pluginProviderDefaultError'));
    }
  };

  const selectedPlugin =
    selectedPluginId != null
      ? (plugins.find((plugin) => plugin.manifest.pluginId === selectedPluginId) ?? null)
      : null;

  const inspectionCompatibilityEntries = useMemo(
    () => (inspection ? summarizeCompatibility(inspection.manifest.compatibility, t) : []),
    [inspection, t],
  );

  const loadPluginLogs = useCallback(
    async (pluginId: string) => {
      setLogsLoading(true);
      setPluginLogsError(null);
      try {
        const result = await invoke<LogEntry[]>('get_plugin_logs', {
          pluginId,
          limit: 120,
        });
        setPluginLogs(result);
      } catch (err) {
        console.error('Failed to load plugin logs:', err);
        setPluginLogsError(t('download.pluginLogsLoadError'));
      } finally {
        setLogsLoading(false);
      }
    },
    [t],
  );

  const handleOpenPluginLogs = async (pluginId: string) => {
    setSelectedPluginId(pluginId);
    setLogsOpen(true);
    await loadPluginLogs(pluginId);
  };

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          className="border-dashed"
          onClick={() => setRuntimeGuideOpen(true)}
        >
          <Info className="h-4 w-4" />
          {t('download.pluginRuntimeGuideButton')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="border-dashed"
          onClick={handleImportFolder}
          disabled={inspecting}
        >
          <FolderOpen className="h-4 w-4" />
          {t('download.pluginImportFolder')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="border-dashed"
          onClick={handleImportZip}
          disabled={inspecting}
        >
          <PackageOpen className="h-4 w-4" />
          {t('download.pluginImportZip')}
        </Button>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          {t('download.pluginCreate')}
        </Button>
      </div>

      <SettingsCard className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">{t('download.pluginsTitle')}</p>
          <Button variant="outline" size="sm" onClick={loadPlugins} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            {t('download.pluginReload')}
          </Button>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        {inspection && installSource && (
          <div className="rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{inspection.manifest.name}</p>
                  <span className="rounded bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    v{inspection.manifest.version}
                  </span>
                  <span className="rounded bg-blue-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-blue-600 dark:text-blue-400">
                    {LANGUAGE_LABELS[inspection.manifest.runtime.language]}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {inspection.manifest.description || t('download.pluginNoDescription')}
                </p>
                <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  <span>{inspection.manifest.pluginId}</span>
                  <span>•</span>
                  <span>{formatSourceKind(inspection.source.kind, t)}</span>
                </div>
                <div className="space-y-1 text-[11px] text-muted-foreground">
                  <p className="font-medium text-foreground/80">
                    {t('download.pluginCompatibilityTitle')}
                  </p>
                  {inspectionCompatibilityEntries.length > 0 ? (
                    inspectionCompatibilityEntries.map((entry) => <p key={entry}>{entry}</p>)
                  ) : (
                    <p>{t('download.pluginCompatibilityNone')}</p>
                  )}
                </div>
                {inspection.warnings.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {inspection.warnings.map((warning) => (
                      <span
                        key={warning}
                        className="rounded bg-amber-500/10 px-2 py-1 text-[11px] text-amber-600 dark:text-amber-400"
                      >
                        {warning}
                      </span>
                    ))}
                  </div>
                )}
                <div className="rounded-lg border border-border/60 bg-background/60 px-3 py-3">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={installAcknowledged}
                      onChange={(event) => setInstallAcknowledged(event.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-border"
                    />
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-foreground">
                        {t('download.pluginInstallConfirmLabel')}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {t('download.pluginInstallConfirmHelp')}
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setInspection(null);
                    setInstallAcknowledged(false);
                  }}
                  disabled={installing}
                >
                  {t('download.pluginDismiss')}
                </Button>
                <Button
                  onClick={handleInstallInspection}
                  disabled={installing || !installAcknowledged}
                >
                  <Download className="h-4 w-4" />
                  {installing ? t('download.pluginInstalling') : t('download.pluginInstall')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">{t('download.pluginLoading')}</p>
        ) : plugins.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-background/40 px-4 py-6 text-center">
            <p className="text-sm font-medium">{t('download.pluginEmptyTitle')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('download.pluginEmptyDesc')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {plugins.map((plugin) => {
              const requestedPermissions = summarizeRequestedPermissions(plugin, t);
              const compatibilityEntries = summarizeCompatibility(plugin.manifest.compatibility, t);
              const selectedProvider = currentProvider(plugin);
              const supportedProviders = plugin.manifest.runtime.supportedProviders;
              const runtimeStatus = runtimeStatuses[plugin.manifest.pluginId];
              const isExpanded = expandedPluginId === plugin.manifest.pluginId;
              const providerSummary = `${PROVIDER_LABELS[selectedProvider]} / ${LANGUAGE_LABELS[plugin.manifest.runtime.language]}`;

              return (
                <Collapsible
                  key={plugin.manifest.pluginId}
                  open={isExpanded}
                  onOpenChange={(open) =>
                    setExpandedPluginId(open ? plugin.manifest.pluginId : null)
                  }
                >
                  <div className="rounded-xl border border-border/60 bg-background/60">
                    <div className="flex items-center gap-3 px-4 py-3">
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <div className="rounded-xl bg-purple-500/10 p-2 text-purple-500">
                            <Braces className="h-4 w-4" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-semibold">
                                {plugin.manifest.name}
                              </p>
                              <span className="rounded bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                                v{plugin.manifest.version}
                              </span>
                              {runtimeStatus?.status && (
                                <span
                                  className={cn(
                                    'rounded px-2 py-0.5 text-[10px] uppercase tracking-wide',
                                    runtimeStatus.status === 'running' &&
                                      'bg-sky-500/10 text-sky-600 dark:text-sky-400',
                                    runtimeStatus.status === 'success' &&
                                      'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                                    runtimeStatus.status === 'error' &&
                                      'bg-red-500/10 text-red-600 dark:text-red-400',
                                  )}
                                >
                                  {formatRuntimeStatusBadge(runtimeStatus.status, t)}
                                </span>
                              )}
                              {plugin.warnings.length > 0 && (
                                <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400">
                                  {t('download.pluginWarningCount', {
                                    count: plugin.warnings.length,
                                  })}
                                </span>
                              )}
                            </div>

                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                              <span>{providerSummary}</span>
                              <span>
                                {t('download.pluginTimeout', {
                                  seconds: plugin.manifest.timeoutSec,
                                })}
                              </span>
                              <span>
                                {requestedPermissions.length > 0
                                  ? t('download.pluginPermissionSummary', {
                                      count: requestedPermissions.length,
                                    })
                                  : t('download.pluginNoExtraPermissions')}
                              </span>
                            </div>
                          </div>

                          <ChevronDown
                            className={cn(
                              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                              isExpanded && 'rotate-180',
                            )}
                          />
                        </button>
                      </CollapsibleTrigger>

                      <div className="flex items-center gap-3">
                        <span className="hidden text-xs text-muted-foreground sm:inline">
                          {plugin.installation.enabled
                            ? t('download.pluginEnabled')
                            : t('download.pluginDisabled')}
                        </span>
                        <Switch
                          checked={plugin.installation.enabled}
                          onCheckedChange={(enabled) => handleTogglePlugin(plugin, enabled)}
                        />
                      </div>
                    </div>

                    <CollapsibleContent className="border-t border-border/60 px-4 py-4">
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRefreshPlugin(plugin.manifest.pluginId)}
                          >
                            <RefreshCw className="h-4 w-4" />
                            {t('download.pluginRefreshInfo')}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenPluginLogs(plugin.manifest.pluginId)}
                          >
                            <TerminalSquare className="h-4 w-4" />
                            {t('download.pluginViewLogs')}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenPluginDirectory(plugin.manifest.pluginId)}
                          >
                            <FolderOpen className="h-4 w-4" />
                            {t('download.pluginOpenFolder')}
                          </Button>
                        </div>

                        <div className="grid gap-3 lg:grid-cols-2">
                          <div className="rounded-xl bg-muted/30 p-3">
                            <div className="flex items-center gap-2 text-xs font-medium">
                              <PackageOpen className="h-4 w-4 text-purple-500" />
                              <span>{t('download.pluginPackageTitle')}</span>
                            </div>
                            <p className="mt-2 text-[11px] text-muted-foreground">
                              {t('download.pluginPackageDesc')}
                            </p>
                            <div className="mt-3 space-y-1 text-[11px] text-muted-foreground">
                              <p>
                                {t('download.pluginIdentifierLabel')}:{' '}
                                {formatPluginIdentifier(
                                  plugin.manifest.pluginId,
                                  plugin.manifest.slug,
                                )}
                              </p>
                              <p>
                                {t('download.pluginSourceLabel')}:{' '}
                                {formatSourceKind(plugin.installation.source.kind, t)}
                              </p>
                              {plugin.manifest.author && (
                                <p>
                                  {t('download.pluginAuthorLabel')}: {plugin.manifest.author}
                                </p>
                              )}
                              <p className="break-all">
                                {t('download.pluginLocationLabel')}:{' '}
                                {plugin.installation.source.value}
                              </p>
                              {plugin.installation.source.checksum && (
                                <p className="break-all">
                                  {t('download.pluginChecksumLabel')}:{' '}
                                  {formatChecksum(plugin.installation.source.checksum)}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="rounded-xl bg-muted/30 p-3">
                            <div className="flex items-center gap-2 text-xs font-medium">
                              <PackageOpen className="h-4 w-4 text-blue-500" />
                              <span>{t('download.pluginProviderTitle')}</span>
                            </div>
                            <p className="mt-2 text-[11px] text-muted-foreground">
                              {t('download.pluginProviderDesc')}
                            </p>
                            <div className="mt-3">
                              <Select
                                value={selectedProvider}
                                onValueChange={(value) =>
                                  handleSetPluginProvider(plugin, value as PluginProvider)
                                }
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {supportedProviders.map((provider) => (
                                    <SelectItem key={provider} value={provider} className="text-xs">
                                      {PROVIDER_LABELS[provider]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="mt-3 space-y-1 text-[11px] text-muted-foreground">
                              {plugin.installation.lastResolvedProvider && (
                                <p>
                                  {t('download.pluginLastResolvedProvider')}:{' '}
                                  {PROVIDER_LABELS[plugin.installation.lastResolvedProvider]}
                                </p>
                              )}
                              {plugin.installation.lastResolvedSource && (
                                <p>
                                  {t('download.pluginLastResolvedSource')}:{' '}
                                  {plugin.installation.lastResolvedSource}
                                </p>
                              )}
                              {plugin.installation.lastExecutionStatus && (
                                <p>
                                  {t('download.pluginLastExecutionStatus')}:{' '}
                                  {plugin.installation.lastExecutionStatus}
                                </p>
                              )}
                              {(runtimeStatus?.status === 'error' ||
                                plugin.installation.lastError) && (
                                <p className="text-destructive">
                                  {t('download.pluginLastError')}:{' '}
                                  {runtimeStatus?.status === 'error'
                                    ? runtimeStatus.message
                                    : plugin.installation.lastError}
                                </p>
                              )}
                              {runtimeStatus?.status === 'running' && (
                                <p className="text-sky-600 dark:text-sky-400">
                                  {t('download.pluginRunningNow')}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl bg-muted/30 p-3">
                          <div className="flex items-center gap-2 text-xs font-medium">
                            <Braces className="h-4 w-4 text-purple-500" />
                            <span>{t('download.pluginCompatibilityTitle')}</span>
                          </div>
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            {t('download.pluginCompatibilityDesc')}
                          </p>
                          <div className="mt-3 space-y-1 text-[11px] text-muted-foreground">
                            {compatibilityEntries.length > 0 ? (
                              compatibilityEntries.map((entry) => <p key={entry}>{entry}</p>)
                            ) : (
                              <p>{t('download.pluginCompatibilityNone')}</p>
                            )}
                          </div>
                          {plugin.warnings.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {plugin.warnings.map((warning) => (
                                <span
                                  key={`${plugin.manifest.pluginId}-${warning}`}
                                  className="rounded bg-amber-500/10 px-2 py-1 text-[11px] text-amber-600 dark:text-amber-400"
                                >
                                  {warning}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="rounded-xl bg-muted/30 p-3">
                          <div className="flex items-center gap-2 text-xs font-medium">
                            <ShieldCheck className="h-4 w-4 text-amber-500" />
                            <span>{t('download.pluginPermissionsTitle')}</span>
                          </div>

                          {requestedPermissions.length === 0 ? (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {t('download.pluginNoExtraPermissions')}
                            </p>
                          ) : (
                            <div className="mt-3 space-y-2">
                              <p className="text-xs text-muted-foreground">
                                {t('download.pluginRequestedPermissions')}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {requestedPermissions.map((permission) => (
                                  <span
                                    key={permission}
                                    className="rounded bg-amber-500/10 px-2 py-1 text-[11px] text-amber-600 dark:text-amber-400"
                                  >
                                    {permission}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                            {[
                              {
                                key: 'network' as const,
                                label: t('download.pluginPermissionNetwork'),
                                enabled: plugin.manifest.permissions.network,
                                approved: plugin.installation.approvedPermissions.network,
                              },
                              {
                                key: 'readPaths' as const,
                                label: t('download.pluginPermissionReadPaths'),
                                enabled: plugin.manifest.permissions.readPaths.length > 0,
                                approved: plugin.installation.approvedPermissions.readPaths,
                              },
                              {
                                key: 'writePaths' as const,
                                label: t('download.pluginPermissionWritePaths'),
                                enabled: plugin.manifest.permissions.writePaths.length > 0,
                                approved: plugin.installation.approvedPermissions.writePaths,
                              },
                              {
                                key: 'env' as const,
                                label: t('download.pluginPermissionEnv'),
                                enabled: plugin.manifest.permissions.env.length > 0,
                                approved: plugin.installation.approvedPermissions.env,
                              },
                            ].map((permission) => (
                              <div
                                key={permission.key}
                                className={cn(
                                  'flex items-center justify-between rounded-lg border border-border/60 px-3 py-2',
                                  !permission.enabled && 'opacity-50',
                                )}
                              >
                                <span className="text-xs">{permission.label}</span>
                                <Switch
                                  checked={permission.enabled && permission.approved}
                                  disabled={!permission.enabled}
                                  onCheckedChange={(checked) =>
                                    handleApprovePermissions(plugin, {
                                      ...plugin.installation.approvedPermissions,
                                      [permission.key]: checked,
                                    })
                                  }
                                />
                              </div>
                            ))}
                          </div>

                          {(plugin.manifest.permissions.readPaths.length > 0 ||
                            plugin.manifest.permissions.writePaths.length > 0 ||
                            plugin.manifest.permissions.env.length > 0) && (
                            <div className="mt-3 space-y-2 text-[11px] text-muted-foreground">
                              {plugin.manifest.permissions.readPaths.length > 0 && (
                                <p>
                                  {t('download.pluginPermissionReadPathsLabel')}:{' '}
                                  {plugin.manifest.permissions.readPaths.join(', ')}
                                </p>
                              )}
                              {plugin.manifest.permissions.writePaths.length > 0 && (
                                <p>
                                  {t('download.pluginPermissionWritePathsLabel')}:{' '}
                                  {plugin.manifest.permissions.writePaths.join(', ')}
                                </p>
                              )}
                            </div>
                          )}

                          {plugin.manifest.permissions.env.length > 0 && (
                            <div className="mt-4 space-y-3 border-t border-border/50 pt-3">
                              <div className="space-y-1">
                                <p className="text-xs font-medium">
                                  {t('download.pluginEnvTitle')}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  {t('download.pluginEnvDesc')}
                                </p>
                              </div>

                              {plugin.manifest.permissions.env.map((envKey) => {
                                const isSet = plugin.installation.envValueStatus[envKey] ?? false;
                                const draftValue = getEnvDraftValue(
                                  plugin.manifest.pluginId,
                                  envKey,
                                );
                                const isSecret =
                                  envKey.includes('TOKEN') ||
                                  envKey.includes('SECRET') ||
                                  envKey.includes('KEY') ||
                                  envKey.includes('PASSWORD');

                                return (
                                  <div
                                    key={`${plugin.manifest.pluginId}-${envKey}`}
                                    className="rounded-lg border border-border/60 px-3 py-3"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <p className="text-xs font-medium">{envKey}</p>
                                      <span
                                        className={cn(
                                          'rounded px-2 py-0.5 text-[10px]',
                                          isSet
                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                                        )}
                                      >
                                        {isSet
                                          ? t('download.pluginEnvValueSet')
                                          : t('download.pluginEnvValueMissing')}
                                      </span>
                                    </div>

                                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                                      <Input
                                        type={isSecret ? 'password' : 'text'}
                                        value={draftValue}
                                        onChange={(event) =>
                                          setEnvDraftValue(
                                            plugin.manifest.pluginId,
                                            envKey,
                                            event.target.value,
                                          )
                                        }
                                        placeholder={
                                          isSet
                                            ? t('download.pluginEnvReplacePlaceholder')
                                            : t('download.pluginEnvValuePlaceholder')
                                        }
                                      />
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          onClick={() => handleSavePluginEnv(plugin, envKey)}
                                          disabled={!draftValue.trim()}
                                        >
                                          {t('download.pluginEnvSave')}
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleClearPluginEnv(plugin, envKey)}
                                          disabled={!isSet}
                                        >
                                          {t('download.pluginEnvClear')}
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        )}
      </SettingsCard>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{t('download.pluginCreateDialogTitle')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('download.pluginCreateDialogDesc')}</p>

            <div className="space-y-2">
              <p className="text-sm font-medium">{t('download.pluginCreateNameLabel')}</p>
              <Input
                value={newPluginName}
                onChange={(event) => setNewPluginName(event.target.value)}
                placeholder={t('download.pluginNamePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">{t('download.pluginCreateSlugLabel')}</p>
              <Input
                value={newPluginSlug}
                onChange={(event) => setNewPluginSlug(event.target.value)}
                placeholder={t('download.pluginSlugPlaceholder')}
              />
            </div>

            <p className="text-xs text-muted-foreground">{t('download.pluginCreateHelp')}</p>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
                {t('download.pluginDismiss')}
              </Button>
              <Button onClick={handleCreatePlugin} disabled={creating || !newPluginName.trim()}>
                <Plus className="h-4 w-4" />
                {creating ? t('download.pluginCreating') : t('download.pluginCreate')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={runtimeGuideOpen} onOpenChange={setRuntimeGuideOpen}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{t('download.pluginRuntimeGuideTitle')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('download.pluginRuntimeGuideDesc')}</p>

            <div className="grid gap-3 lg:grid-cols-2">
              {(['javascript', 'python'] as PluginRuntimeLanguage[]).map((language) => {
                const allowedProviders = providers.filter((provider) =>
                  language === 'javascript'
                    ? provider.provider === 'deno' ||
                      provider.provider === 'node' ||
                      provider.provider === 'bun'
                    : provider.provider === 'python',
                );
                if (allowedProviders.length === 0) return null;

                return (
                  <div key={language} className="rounded-xl border border-border/60 p-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{LANGUAGE_LABELS[language]}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('download.pluginRuntimeDefault')}
                      </p>
                    </div>

                    <div className="mt-3">
                      <Select
                        value={defaultProviders[language] ?? allowedProviders[0].provider}
                        onValueChange={(value) =>
                          handleSetDefaultProvider(language, value as PluginProvider)
                        }
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {allowedProviders.map((provider) => (
                            <SelectItem
                              key={`${language}-${provider.provider}`}
                              value={provider.provider}
                              className="text-xs"
                            >
                              {PROVIDER_LABELS[provider.provider]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              {providers.map((provider) => (
                <span
                  key={provider.provider}
                  className={cn(
                    'rounded px-2 py-1 text-[11px]',
                    provider.available
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                  )}
                >
                  {PROVIDER_LABELS[provider.provider]}:{' '}
                  {provider.available
                    ? t('download.pluginRuntimeAvailable')
                    : t('download.pluginRuntimeMissing')}
                  {provider.resolvedSource ? ` (${provider.resolvedSource})` : ''}
                </span>
              ))}
            </div>

            <div className="rounded-xl bg-muted/30 p-3 text-[11px] text-muted-foreground">
              <p>{t('download.pluginRuntimeGuideNotePrimary')}</p>
              <p className="mt-1">{t('download.pluginRuntimeGuideNoteSecondary')}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PluginLogsDialog
        open={logsOpen}
        onOpenChange={(open) => {
          setLogsOpen(open);
          if (!open) {
            setSelectedPluginId(null);
            setPluginLogs([]);
            setPluginLogsError(null);
          }
        }}
        plugin={selectedPlugin}
        logs={pluginLogs}
        loading={logsLoading}
        error={pluginLogsError}
        onRefresh={() => (selectedPluginId ? loadPluginLogs(selectedPluginId) : undefined)}
      />
    </>
  );
}
