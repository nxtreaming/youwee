import { useCallback, useEffect, useRef, useState } from 'react';
import type { PluginSummary } from '@/lib/types';
import type { PluginReminderToastState } from './post-download-plugins-shared';

export function usePluginReminderState() {
  const [pluginReminderToast, setPluginReminderToast] = useState<PluginReminderToastState>(null);
  const pluginReminderToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPluginReminderToast = useCallback(() => {
    setPluginReminderToast(null);
    if (pluginReminderToastTimeoutRef.current) {
      clearTimeout(pluginReminderToastTimeoutRef.current);
      pluginReminderToastTimeoutRef.current = null;
    }
  }, []);

  const showPluginReminderToast = useCallback(
    (plugin: PluginSummary) => {
      clearPluginReminderToast();
      setPluginReminderToast({
        pluginId: plugin.manifest.id,
        pluginName: plugin.manifest.name,
        pluginIcon: plugin.manifest.icon,
      });
      pluginReminderToastTimeoutRef.current = setTimeout(() => {
        setPluginReminderToast(null);
        pluginReminderToastTimeoutRef.current = null;
      }, 5000);
    },
    [clearPluginReminderToast],
  );

  useEffect(
    () => () => {
      if (pluginReminderToastTimeoutRef.current) {
        clearTimeout(pluginReminderToastTimeoutRef.current);
      }
    },
    [],
  );

  return {
    clearPluginReminderToast,
    pluginReminderToast,
    showPluginReminderToast,
  };
}
