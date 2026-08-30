# Zenith Habit Tracker — Free Deployment & Custom Subdomain Guide

This guide walks you through deploying your personal habit tracker completely for **\$0/month** on **Vercel**, connecting it to a free **Supabase** database, and mapping it to your **custom subdomain** (e.g., `habits.yourdomain.com`).

---

## 1. Set Up Free Database & Cloud Sync (Supabase)

1. Go to [supabase.com](https://supabase.com) and create a **Free Tier** account.
2. Click **"New Project"**, pick a name and database password.
3. Once created, open the **SQL Editor** from the left sidebar.
4. Copy the entire contents of [`supabase/schema.sql`](./supabase/schema.sql) and paste it into the editor, then click **Run**.
5. Go to **Project Settings** -> **API**:
   - Copy **Project URL**
   - Copy **anon public Key**

---

## 2. Deploy to Vercel (100% Free Hobby Tier)

1. Go to [vercel.com](https://vercel.com) and sign in with your GitHub account.
2. Click **"Add New..."** -> **"Project"**.
3. Select your private repository: `manuja-me/habit-tracker`.
4. In the **Environment Variables** section, add the two keys from Supabase:
   - `NEXT_PUBLIC_SUPABASE_URL` = `<your_project_url>`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `<your_anon_key>`
5. Click **"Deploy"**.
6. In ~60 seconds, your site will be live on a `*.vercel.app` URL!

---

## 3. Connect Your Custom Subdomain

1. In your Vercel Project Dashboard, go to **Settings** -> **Domains**.
2. Type your desired subdomain (e.g., `habits.yourdomain.com` or `tracker.yourdomain.com`) and click **Add**.
3. Vercel will give you a DNS record to configure:
   - **Type**: `CNAME`
   - **Name / Host**: `habits` (or your subdomain prefix)
   - **Value / Target**: `cname.vercel-dns.com`
4. Log into your domain registrar (where you bought your domain, e.g. Cloudflare, Namecheap, GoDaddy, Google Domains, etc.), open the **DNS Management** section, and add the `CNAME` record.
5. Vercel will verify the DNS and automatically issue a free SSL certificate within a few minutes!

---

## 4. Install as a Mobile App (PWA)

### On iPhone / iPad (Safari)
1. Open your subdomain in **Safari** (`https://habits.yourdomain.com`).
2. Tap the **Share** button (the square with the arrow pointing up).
3. Scroll down and tap **"Add to Home Screen"**.
4. Tap **Add**. Zenith will now open as a full-screen, standalone app with zero browser bars!

### On Android (Chrome)
1. Open your subdomain in **Chrome** (`https://habits.yourdomain.com`).
2. Tap the three dots menu (top right) and tap **"Add to Home screen"** or **"Install app"**.
3. Tap **Install**.

---

## 5. Zero-Login Multi-Device Usage
1. Open your habit tracker URL on your computer, phone, or tablet.
2. No username, email, or password required.
3. Every habit you check off on any device will automatically sync across all your devices in real-time.
