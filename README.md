<div align="center">
  <img src="public/cover.svg" width="300" alt="Zenith Cover" />
</div>

# Zenith — Minimalist Habit Tracker

A fast, terminal-inspired habit tracker, daily planner, and addiction tapering system built with Next.js, Tailwind CSS, and Supabase.

---

## Features

- **DO & DON'T Routines**: Track daily build habits (boolean or numeric targets) and quit/break routines with automatic daily clean tracking and slip-up logging.
- **Addiction Tapering Engine**: Supports exponential, linear, rapid-fading, and cold-turkey interval spacing to progressively extend clean streaks.
- **Planner & Projects**: Daily focus tasks, freeform planner notes (auto-pruned after 3 months), and project/group organization.
- **Consistency Heatmaps & Milestones**: 52-week aggregate and per-habit consistency matrices with an 11-tier streak progression ladder.
- **6-Digit Scrypt PIN Security**: Server-only Supabase architecture (RLS locked to `service_role`), per-user salted Scrypt PIN hashing, and database-backed brute-force lockout.

---

## Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| `j` / `↓` | Focus next habit |
| `k` / `↑` | Focus previous habit |
| `Space` / `x` | Toggle check or slip-up on focused habit |
| `+` / `-` | Increment / decrement numeric habit value |
| `n` | Open New Habit modal |
| `1` – `4` | Switch views (Daily, Weekly, Heatmap, Analytics) |
| `t` | Jump to Today |
| `?` | Open keyboard shortcuts help |

---

## Self-Deployment Guide

You can self-host Zenith by downloading the source code (via `git clone` or GitHub's **Download ZIP** button) and connecting it to a free [Supabase](https://supabase.com/) database.

### 1. Download Source Code & Install Dependencies

```bash
git clone https://github.com/manuja-me/habit-tracker.git
cd habit-tracker
npm install
```
*(If you downloaded the ZIP archive, extract it, open a terminal in the extracted folder, and run `npm install`.)*

### 2. Set Up the Supabase Database

1. Create a new project at [supabase.com](https://supabase.com/).
2. In your Supabase dashboard, open **SQL Editor** → **New Query**.
3. Copy the entire contents of [`supabase/schema.sql`](supabase/schema.sql), paste it into the SQL Editor, and click **Run**.
4. Go to **Project Settings** → **API** and copy your **Project URL** and **`service_role` secret key** (never expose the `service_role` key in client-side variables).

### 3. Configure Environment Variables

Create a `.env.local` file in the project root (or add these variables in your hosting provider's dashboard):

```env
# 1. Supabase Server Credentials (Required)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-secret-key

# 2. Production Security Secrets (Required in production — must NOT use default values)
PIN_SALT=replace-with-a-random-32-byte-hex-string
SESSION_SECRET=replace-with-a-second-random-32-byte-hex-string

# 3. Initial Owner PIN (6 digits recommended)
APP_SECRET_PIN=100100
```

You can generate random strings for `PIN_SALT` and `SESSION_SECRET` in your terminal:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Run Locally or Deploy to Production

**Local development:**
```bash
npm run dev
```
Open `http://localhost:3000`.

**Self-host on a VPS / Node.js server:**
```bash
npm run build
npm start
```

**Deploy to Vercel / Netlify / Railway:**
1. Import your forked repository or upload the project directory using the platform CLI (`npx vercel --prod`).
2. Add the 5 environment variables from **Step 3** in the deployment settings.
3. Deploy.

### 5. First Login & Managing Users

1. On first launch, unlock the app using the `APP_SECRET_PIN` you configured (or default `1001` in local dev, which will prompt you to upgrade to a 6-digit Scrypt PIN on first login).
2. To change your PIN later, open **Settings** → **Account & Security** → **6-DIGIT PIN**.
3. To invite friends/members with isolated workspaces on the same deployment, open **Settings** → **Invite Friends** to generate a one-time signup link.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router, React 19, TypeScript)
- **Styling**: Tailwind CSS v4, Lucide Icons
- **Database**: Supabase PostgreSQL (`service_role` Server Actions)

---

## License

MIT License — see [LICENSE](LICENSE).
