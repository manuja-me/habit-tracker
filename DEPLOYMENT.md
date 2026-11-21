# Zenith Habit Tracker — Free Deployment & Custom Subdomain Guide

This guide walks you through deploying your personal habit tracker completely for **\$0/month** on **Vercel**, connecting it to a free **Supabase** database, and mapping it to your **custom subdomain** (e.g., `habits.yourdomain.com`).

---

## 1. Set Up Free Database & Cloud Sync (Supabase)

1. Go to [supabase.com](https://supabase.com) and create a **Free Tier** account.
2. Click **"New Project"**, pick a database password and region.
3. Open the **SQL Editor** from the left sidebar.
4. Copy the entire contents of [`supabase/schema.sql`](./supabase/schema.sql) and paste it into the editor, then click **Run**.
5. Go to **Project Settings** -> **API**:
   - Copy **Project URL**
   - Copy **`service_role` secret Key** (never expose this in client-side code; used exclusively by server actions)

---

## 2. Deploy to Vercel (100% Free Hobby Tier)

1. Go to [vercel.com](https://vercel.com) and sign in with your GitHub account.
2. Click **"Add New..."** -> **"Project"**.
3. Select your private repository: `manuja-me/habit-tracker`.
4. In the **Environment Variables** section, add your 5 configuration variables:
   - `SUPABASE_URL` = `<your_project_url>`
   - `SUPABASE_SERVICE_ROLE_KEY` = `<your_service_role_secret_key>`
   - `PIN_SALT` = `<random_32_byte_hex_string>` (required in production; generate via `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - `SESSION_SECRET` = `<second_random_32_byte_hex_string>` (required in production; generate via `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - `APP_SECRET_PIN` = `<your_private_6_digit_pin>` (e.g., `100100`; must be a 6-digit numeric PIN, not default `1001`)
5. Click **"Deploy"**.
6. In ~60 seconds, your site will be live on a `*.vercel.app` URL!

> **Note on Security Enforcements**: Production builds strictly require custom non-default secrets for `PIN_SALT`, `SESSION_SECRET`, and `APP_SECRET_PIN`. If any of these are missing or left as default (`1001`), server actions will reject requests with a security guard error.

---

## 3. Connect Your Custom Subdomain

1. In your Vercel Project Dashboard, go to **Settings** -> **Domains**.
2. Type your desired subdomain (e.g., `habits.yourdomain.com`) and click **Add**.
3. Add the `CNAME` record in your domain registrar's DNS settings:
   - **Type**: `CNAME`
   - **Name / Host**: `habits`
   - **Value / Target**: `cname.vercel-dns.com`
4. Vercel will verify the DNS and automatically issue a free SSL certificate within a few minutes!

---

## 4. Install as a Mobile App (PWA)

### On iPhone / iPad (Safari)
1. Open your subdomain in **Safari** (`https://habits.yourdomain.com`).
2. Tap the **Share** button -> tap **"Add to Home Screen"**.
3. Tap **Add**. Zenith will open as a full-screen, standalone app with zero browser bars!

### On Android (Chrome)
1. Open your subdomain in **Chrome** (`https://habits.yourdomain.com`).
2. Tap the three dots menu -> tap **"Add to Home screen"** or **"Install app"**.
3. Tap **Install**.

---

## 5. Security & Access
- **PIN Protected**: Access is guarded by your private 6-digit PIN configured in `APP_SECRET_PIN` (salted with `PIN_SALT` and hashed with memory-hard Scrypt / SHA-256).
- **HttpOnly Cookie**: Once entered on any device, an encrypted session cookie signed with `SESSION_SECRET` keeps your phone or laptop unlocked.
- **Server Gateway**: The public internet cannot query your Supabase database directly; all traffic is mediated by Next.js Server Actions with strict Row Level Security.
