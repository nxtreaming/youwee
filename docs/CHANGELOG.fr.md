# Journal des modifications

Toutes les modifications notables de Youwee seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
et ce projet suit [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Ajouté
- **Sélecteur de source des dépendances (yt-dlp/FFmpeg)** - Ajout d'un sélecteur dans Paramètres → Dépendances pour choisir entre les binaires gérés par l'application et ceux gérés par le système
- **Confirmation de sécurité avant bascule vers la source système** - Ajout d'une boîte de confirmation lors du passage de yt-dlp/FFmpeg à la source système pour éviter les changements accidentels

### Modifié
- **Libellé de source système selon l'OS** - Le libellé de source système s'adapte désormais à la plateforme (`Homebrew` sur macOS, `PATH` sur Windows, gestionnaire de paquets sur Linux)
- **Génération automatique des notes de release GitHub dans le workflow build** - Activation de `generate_release_notes` dans le workflow de publication afin d'inclure des notes générées automatiquement
- **Intégration d'une barre de titre personnalisée sur Windows** - Remplacement de la barre de titre native Windows par des contrôles alignés au thème de l'application (zone de glisser, minimiser/maximiser/fermer)

### Corrigé
- **Enregistrement de l'historique de téléchargement sous Windows** - Capture fiable du chemin de sortie final sous Windows pour ajouter correctement les téléchargements terminés dans la bibliothèque
- **Analyse du chemin de retéléchargement sous Windows** - Correction de l'extraction du dossier de sortie pour les chemins Windows avec séparateur `\`
- **Sortie yt-dlp non UTF-8 sous Windows** - Ajout d'un fallback de décodage GBK/ANSI et de la gestion `--print-to-file` pour capturer correctement les chemins finaux dans les locales non UTF-8
- **Auto-refresh de la bibliothèque après la fin d'un téléchargement** - L'historique de la bibliothèque se rafraîchit automatiquement lorsque le statut passe à `finished`
- **Compatibilité des URL Douyin en mode modal** - Normalisation des URL `douyin.com` avec `modal_id` vers le format canonique `/video/{id}` dans les appels yt-dlp backend et le parseur de deep-link frontend

## [0.11.1] - 2026-03-01

### Ajouté
- **Prise en charge du français, portugais et russe** - Localisation complète de l'interface, des paramètres, des messages d'erreur et des libellés de métadonnées en Français, Português et Русский
- **Localisation des erreurs backend** - Les messages d'erreur backend (échecs de téléchargement, erreurs réseau, etc.) sont maintenant traduits selon la langue choisie par l'utilisateur au lieu d'être toujours en anglais

### Modifié
- **Refonte de la chaîne de fallback des transcriptions** - Unification de la logique fallback entre AI Summary et Processing pour un comportement plus cohérent

### Corrigé
- **Fallback de transcription pour Douyin et TikTok** - Amélioration de l'extraction des transcriptions pour les vidéos Douyin et TikTok qui échouaient auparavant silencieusement
- **Erreurs de transcription et sous-titres courts** - Les erreurs de transcription sont conservées pour le diagnostic au lieu d'être masquées, et les sous-titres courts sont désormais acceptés comme valides
- **Paramètres par défaut TikTok** - Alignement des paramètres de téléchargement par défaut TikTok sur les conventions de la plateforme

## [0.11.0] - 2026-02-20

### Ajouté
- **Extension navigateur pour téléchargement en un clic (Chromium + Firefox)** - Envoi de la page vidéo courante vers Youwee avec le choix `Download now` ou `Add to queue`
- **Configuration de l'extension dans Paramètres** - Ajout d'une section Paramètres → Extension avec boutons de téléchargement directs et étapes d'installation simplifiées pour Chromium et Firefox

### Modifié
- **Rafraîchissement UI/UX des pages YouTube et Universal** - Simplification des interactions d'entrée, aperçu, file d'attente et barre de titre pour une interface plus propre et cohérente

### Corrigé
- **Résolution cohérente des dépendances entre fonctionnalités** - Unification de la gestion des sources yt-dlp/FFmpeg dans download, metadata, channels et polling en arrière-plan
- **Comportement strict en mode système** - Lorsqu'une source système est sélectionnée et qu'un binaire manque, l'application affiche désormais une erreur claire au lieu d'un fallback silencieux

## [0.10.1] - 2026-02-15

### Ajouté
- **Paramètres de police ASS** - Ajout de la configuration de la famille et taille de police pour l'export ASS et l'aperçu des sous-titres
- **Workflow de retour à la ligne** - Ajout d'une action rapide d'auto retour à la ligne et prise en charge de Shift+Enter lors de l'édition des sous-titres
- **Réessai automatique configurable** - Ajout des paramètres Auto Retry pour les téléchargements YouTube et Universal (tentatives et délai configurables)

### Modifié

### Corrigé
- **Diagnostics des échecs de téléchargement** - Amélioration des messages d'échec yt-dlp avec des causes plus claires, permettant une meilleure gestion des erreurs temporaires

## [0.10.0] - 2026-02-15

### Ajouté
- **Atelier de sous-titres** - Nouvelle page tout-en-un pour SRT/VTT/ASS avec édition, outils temporels, rechercher/remplacer, auto-correction et actions IA (Whisper, traduction, correction grammaticale)
- **Outils avancés de sous-titres** - Ajout de timeline waveform/spectrogramme, synchronisation par changements de plans, QC temps réel via profils de style, outils fusion/scission, mode traducteur (source/cible), et opérations batch/projet

### Modifié

### Corrigé
