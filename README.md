# Moyu - Break Salary Tracker

Moyu (摸魚) is a macOS desktop app that tracks your breaks during work hours and calculates how much you've earned while away from your screen. It sits in your menu bar as a compact floating panel and automatically detects when you lock/unlock your screen.

## What It Does

- **Automatic break detection** — monitors macOS screen lock/unlock events to start and stop break timers automatically
- **Real-time earnings ticker** — shows how much money you're making per second while on break, based on your salary
- **Manual clock in/out** — track your work sessions and add custom break or work entries
- **Daily timeline chart** — visual breakdown of your work and break periods throughout the day, with zoom support
- **Weekly summary** — bar chart of daily break earnings, click any day to drill into details
- **Flexible salary config** — supports annual, monthly, or hourly input in 8 currencies (USD, EUR, TWD, GBP, JPY, KRW, CAD, AUD)
- **Customizable work schedule** — set different hours for each day of the week, with per-date overrides
- **Edit history** — right-click any entry to modify or delete it

## Screenshots

<!-- Add screenshots here -->

## Tech Stack

- **Frontend**: React 19, TypeScript, TailwindCSS 4, Zustand
- **Backend**: Rust, Tauri 2
- **macOS Integration**: Core Foundation APIs for screen lock detection, NSPanel for floating window, system tray

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri CLI prerequisites](https://v2.tauri.app/start/prerequisites/)

### Development

```bash
# Install dependencies
yarn install

# Run in development mode
yarn tauri dev
```

### Build

```bash
yarn tauri build
```

The built app will be in `src-tauri/target/release/bundle/`.

## How It Works

1. Set your salary and work schedule in Settings
2. Clock in when you start working
3. Lock your screen when you take a break — the app automatically starts tracking
4. Unlock your screen — the break is recorded with earnings calculated
5. Check the Today tab for your daily breakdown or the Summary tab for weekly trends

## Platform Support

Currently macOS only. The automatic screen lock detection uses native macOS APIs. Tauri supports cross-platform builds, but the screen event integration would need platform-specific implementations for Windows/Linux.

