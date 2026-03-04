# Youwee

<div align="center">

  [![English](https://img.shields.io/badge/lang-English-blue)](../README.md)
  [![Tiếng Việt](https://img.shields.io/badge/lang-Tiếng_Việt-red)](README.vi.md)
  [![简体中文](https://img.shields.io/badge/lang-简体中文-green)](README.zh-CN.md)
  [![Français](https://img.shields.io/badge/lang-Français-0055A4)](README.fr.md)
  [![Русский](https://img.shields.io/badge/lang-Русский-1F5FBF)](README.ru.md)
  [![Vote for next language](https://img.shields.io/badge/Vote-Следующий_язык-orange?logo=github)](https://github.com/vanloctech/youwee/discussions/18)

  <img src="../src-tauri/icons/icon.png" alt="Логотип Youwee" width="128" height="128">
  
  **Современный и красивый загрузчик видео YouTube, созданный на Tauri и React**

  [![Downloads](https://img.shields.io/github/downloads/vanloctech/youwee/total?label=Downloads)](https://github.com/vanloctech/youwee/releases)
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
  [![Reddit](https://img.shields.io/badge/Reddit-r%2Fyouwee-FF4500?logo=reddit&logoColor=white)](https://www.reddit.com/r/youwee)
  [![Tauri](https://img.shields.io/badge/Tauri-2.0-FFC131?logo=tauri&logoColor=white)](https://tauri.app/)
  [![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
</div>

---

## Возможности

- **Загрузка видео** — YouTube, TikTok, Facebook, Instagram, Bilibili, Youku и более 1800 сайтов
- **Интеграция с браузерным расширением** — Расширение для Chromium + Firefox с плавающей кнопкой, выбором формата/качества и отправкой в Youwee в один клик (`Download now` / `Add to queue`)
- **Подписка на каналы** — Подписывайтесь на каналы YouTube, Bilibili и Youku, получайте уведомления о новых видео, включайте автозагрузку и управляйте через системный трей
- **Получение метаданных** — Скачивайте информацию о видео, описание, комментарии и миниатюры без загрузки самого видео
- **Поддержка прямых эфиров** — Скачивание live-трансляций с отдельным переключателем
- **AI-сводка видео** — Краткое содержание видео через Gemini, OpenAI или Ollama
- **AI-обработка видео** — Редактирование видео естественным языком (обрезка, конвертация, изменение размера, извлечение аудио)
- **Загрузка по диапазону времени (обрезка)** — Загружайте только нужный фрагмент, задав время начала и окончания
- **Пакетная загрузка и плейлисты** — Скачивание нескольких видео или целых плейлистов
- **Извлечение аудио** — Извлечение аудио в MP3, M4A или Opus
- **Поддержка субтитров** — Скачивание или встраивание субтитров
- **Мастерская субтитров** — Создание, редактирование и улучшение субтитров (SRT/VTT/ASS): тайминг-инструменты, поиск/замена, авто-исправление, AI-перевод, AI-исправление грамматики и генерация через Whisper
- **Ключевые функции страницы субтитров** — Таймлайн waveform/spectrogram, синхронизация по смене сцен, realtime QC со style-профилями, инструменты split/merge, режим переводчика (source/target), batch/project операции
- **Постобработка** — Автоматическое встраивание метаданных, миниатюры и субтитров (если включено) в выходные файлы
- **SponsorBlock** — Автоматический пропуск спонсорских вставок, интро/аутро и саморекламы в режимах remove/mark/custom
- **Ограничение скорости** — Управление скоростью загрузки (KB/s, MB/s, GB/s)
- **Библиотека загрузок** — Отслеживание и управление всеми загрузками
- **6 красивых тем** — Midnight, Aurora, Sunset, Ocean, Forest, Candy
- **Быстро и легко** — Создано на Tauri для минимального потребления ресурсов

## Скриншоты

![Youwee](screenshots/youwee-1.png)

<details>
<summary><strong>Больше скриншотов</strong></summary>

![Youwee - Библиотека](screenshots/youwee-2.png)
![Youwee - AI Summary](screenshots/youwee-3.png)
![Youwee - Processing](screenshots/youwee-4.png)
![Youwee - Settings](screenshots/youwee-5.png)
![Youwee - Themes](screenshots/youwee-6.png)
![Youwee - About](screenshots/youwee-7.png)
![Youwee - Download](screenshots/youwee-8.png)
![Youwee - Universal](screenshots/youwee-9.png)
![Youwee - Metadata](screenshots/youwee-10.png)
![Youwee - History](screenshots/youwee-11.png)
![Youwee - Channel Follow](screenshots/youwee-12.png)
![Youwee - Channel Polling](screenshots/youwee-13.png)
![Youwee - Queue & Processing](screenshots/youwee-14.png)
![Youwee - Language Vote](screenshots/youwee-15.png)
![Youwee - Subtitle Workshop](screenshots/youwee-16.png)
![Youwee - Subtitle Timeline & QC](screenshots/youwee-17.png)
![Youwee - Browser Extension](screenshots/youwee-18.png)

</details>

## Демо-видео

▶️ [Смотреть на YouTube](https://www.youtube.com/watch?v=H7TtVZWxilU)

## Установка

### Скачать для вашей платформы

> ⚠️ **Примечание**: Приложение пока не подписано сертификатом Apple Developer. Если macOS блокирует приложение, откройте терминал и выполните:
> ```bash
> xattr -cr /Applications/Youwee.app
> ```

| Платформа | Скачать |
|----------|---------|
| **Windows** (x64) | [Скачать .msi](https://github.com/vanloctech/youwee/releases/latest/download/Youwee-Windows.msi) · [Скачать .exe](https://github.com/vanloctech/youwee/releases/latest/download/Youwee-Windows-Setup.exe) |
| **macOS** (Apple Silicon) | [Скачать .dmg](https://github.com/vanloctech/youwee/releases/latest/download/Youwee-Mac-Apple-Silicon.dmg) |
| **macOS** (Intel) | [Скачать .dmg](https://github.com/vanloctech/youwee/releases/latest/download/Youwee-Mac-Intel.dmg) |
| **Linux** (x64) | [Скачать .deb](https://github.com/vanloctech/youwee/releases/latest/download/Youwee-Linux.deb) · [Скачать .AppImage](https://github.com/vanloctech/youwee/releases/latest/download/Youwee-Linux.AppImage) (рекомендуется для автообновления) |

> Все версии доступны на странице [Releases](https://github.com/vanloctech/youwee/releases)

### Браузерное расширение (Chromium + Firefox)

| Браузер | Скачать |
|---------|---------|
| **Chromium** (Chrome/Edge/Brave/Opera/Vivaldi/Arc/Coc Coc) | [Скачать .zip](https://github.com/vanloctech/youwee/releases/latest/download/Youwee-Extension-Chromium.zip) |
| **Firefox** | [Скачать .xpi](https://github.com/vanloctech/youwee/releases/latest/download/Youwee-Extension-Firefox-signed.xpi) |

- Отправка текущей вкладки в Youwee в один клик (`Download now` или `Add to queue`)
- Плавающая кнопка поддерживает выбор `Video/Audio` и качества на поддерживаемых сайтах
- Popup работает на любых корректных HTTP/HTTPS вкладках
- Инструкция: [docs/browser-extension.md](browser-extension.md)

### Сборка из исходников

#### Требования

- [Bun](https://bun.sh/) (v1.3.5 или новее)
- [Rust](https://www.rust-lang.org/) (v1.70 или новее)
- [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites)

#### Шаги

```bash
# Клонировать репозиторий
git clone https://github.com/vanloctech/youwee.git
cd youwee

# Установить зависимости
bun install

# Запустить в режиме разработки
bun run tauri dev

# Собрать production-версию
bun run tauri build
```

## Технологический стек

- **Frontend**: React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Rust, Tauri 2.0
- **Downloader**: yt-dlp (встроенный)
- **Build**: Bun, Vite

## Вклад в проект

Мы приветствуем вклад. См. [руководство по внесению вклада](../CONTRIBUTING.md).

## Лицензия

Проект распространяется по лицензии MIT — подробнее в файле [LICENSE](../LICENSE).

## Благодарности

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - Мощный загрузчик видео
- [FFmpeg](https://ffmpeg.org/) - Мультимедийный фреймворк для обработки аудио/видео
- [Deno](https://deno.com/) - JavaScript runtime для извлечения YouTube
- [Tauri](https://tauri.app/) - Создание более маленьких, быстрых и безопасных десктоп-приложений
- [shadcn/ui](https://ui.shadcn.com/) - Красивые UI-компоненты
- [Lucide Icons](https://lucide.dev/) - Красивые иконки с открытым исходным кодом

## Контакты

- **GitHub**: [@vanloctech](https://github.com/vanloctech)
- **Issues**: [GitHub Issues](https://github.com/vanloctech/youwee/issues)

---

## Star History

<picture>
  <source
    media="(prefers-color-scheme: dark)"
    srcset="
      https://api.star-history.com/svg?repos=vanloctech/youwee&type=Date&theme=dark
    "
  />
  <source
    media="(prefers-color-scheme: light)"
    srcset="
      https://api.star-history.com/svg?repos=vanloctech/youwee&type=Date
    "
  />
  <img
    alt="Star History Chart"
    src="https://api.star-history.com/svg?repos=vanloctech/youwee&type=Date"
  />
</picture>

<div align="center">
  Made with ❤️ by VietNam
</div>
