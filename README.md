# ⚡ Zenith | High-Performance Minimalist Habit Tracker

<div align="center">

![Zenith Preview](public/apple-icon.png)

**A distraction-free, terminal-inspired habit tracking system and behavioral addiction weaning engine.**  
*Engineered with JetBrains Mono typography, 0ms optimistic state updates, and scientific behavioral fading.*

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?style=flat-square&logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-MIT-emerald?style=flat-square)](LICENSE)

</div>

---

## 🌟 Key Features

### 1. ⚡ Dual Routine Paradigms (DO & DON'T)
- **🟢 DO Routines (Build)**: Positive daily habits (e.g. *Deep Work, 2.5L Hydration, Daily Workout, Reading*) with boolean check-offs or quantitative numeric steppers (`+250ml`, `-10 pages`).
- **🛑 DON'T Routines (Quit & Break Addictions)**: Designed specifically for stopping bad habits (e.g. *Smoking, Junk Food, Alcohol, Doomscrolling*).
  - **Auto-Clean Daily**: You succeed automatically by not doing the activity. Days remain clean by default with zero manual input required.
  - **1-Click Slip-Up Logging**: Log slip-ups with an instant undo safety buffer.

### 2. 🧠 Expanding Interval Addiction Tapering (*Scientific Behavioral Fading*)
- Rather than traumatic "cold turkey" cessation (which has a 90%+ relapse rate due to sudden dopamine depletion), Zenith implements **Scheduled Inter-Event Spacing**:
  - **📈 Exponential Expansion (Recommended)**: `1 Day` → `2 Days` → `4 Days` → `7 Days` → `14 Days` → `21 Days` → `30 Days` → `60 Days Clean`.
  - **📏 Linear Step**: `+1 Day Clean` added after each successful cycle.
  - **⚡ Rapid Fading**: `2d` → `5d` → `10d` → `20d` → `30d`.
  - **🛡️ Strict / Cold Turkey**: Zero slip-ups allowed.
- **Stage Progress HUD**: Live stage tracker on each addiction card showing days clean, countdown to the next milestone, and automated `🎯 STAGE COMPLETE` advancements.

### 3. 🏆 11-Tier Milestone Mastery Ladder
Celebrate long-term consistency with an 11-tier progression system:
| Tier | Name | Target Streak | Badge |
| :--- | :--- | :--- | :--- |
| 1 | **Spark** | 3 Days | ⚡ Spark |
| 2 | **Ignition** | 7 Days | 🔥 Ignition |
| 3 | **Momentum** | 14 Days | 🚀 Momentum |
| 4 | **Habit Loop** | 21 Days | 🔄 Habit Loop |
| 5 | **Iron Will** | 30 Days | 🛡️ Iron Will |
| 6 | **Diamond** | 60 Days | 💎 Diamond |
| 7 | **Century** | 100 Days | 💯 Century |
| 8 | **Half Year** | 180 Days | ⏳ Half Year |
| 9 | **Zenith Legend** | 365 Days | 👑 Zenith Legend |
| 10 | **Titan** | 500 Days | 🏛️ Titan |
| 11 | **Immortal** | 1000 Days | 🌌 Immortal |

### 4. 📊 Multi-Scale Consistency Heatmaps
- **52-Week Master Matrix**: GitHub-style aggregate yearly consistency overview.
- **Individual Routine Heatmap Stack**: Dedicated 52-week heatmaps for each habit, color-coded to custom routine palettes with streak and completion KPIs.

### 5. ⌨️ Vim & IDE Keyboard Navigation
Designed for terminal and keyboard power users:
| Shortcut | Action |
| :--- | :--- |
| <kbd>j</kbd> / <kbd>↓</kbd> | Move focus down to next habit |
| <kbd>k</kbd> / <kbd>↑</kbd> | Move focus up to previous habit |
| <kbd>Space</kbd> or <kbd>x</kbd> | Toggle check / slip-up on focused habit |
| <kbd>+</kbd> / <kbd>=</kbd> | Increment numeric habit value |
| <kbd>-</kbd> / <kbd>_</kbd> | Decrement numeric habit value |
| <kbd>n</kbd> | Open New Habit creation modal |
| <kbd>1</kbd> | Switch to **Daily View** |
| <kbd>2</kbd> | Switch to **Weekly Grid** |
| <kbd>3</kbd> | Switch to **Heatmap View** |
| <kbd>4</kbd> | Switch to **Analytics View** |
| <kbd>t</kbd> | Jump to **Today** |
| <kbd>?</kbd> | Open **Keyboard Shortcuts Cheat Sheet** |

### 6. 🔒 Privacy, Security & Cross-Device Sync
- **Server-Only Supabase Architecture**: Browser clients never communicate directly with Supabase using public API keys. All database queries execute via authenticated Next.js Server Actions using strict environment variables.
- **Zero-Latency Optimistic UI**: 0ms local UI response with background atomic synchronization and cross-tab `BroadcastChannel` syncing.
- **PIN Privacy Screen**: Client-side PIN lock with customizable auto-lock timer.
- **Offline PWA Support**: Service Worker caching with daily reminder notifications.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack, React 19)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Database**: [Supabase](https://supabase.com/) PostgreSQL (Row-Level Security)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Audio & Haptics**: Web Audio API synthesizer
- **Date Engine**: [date-fns](https://date-fns.org/)

---

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/manuja-me/habit-tracker.git
cd habit-tracker
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env.local` file in the root directory:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Optional App Authentication Password / PIN
APP_SECRET_PIN=1234
```

### 4. Set Up Supabase Database Schema
Run the SQL migration in your Supabase SQL Editor:
```bash
# Found at: supabase/schema.sql
```

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📦 Production Build

```bash
npm run build
npm start
```

---

## 📄 License

MIT License — free for personal and commercial use. Developed with precision for peak human consistency.
