# Hi Frankie server

A Next.js API for the mobile app. It runs every AI feature, account deletion and the morning email. The Gemini key lives only here.

Each route is `POST /api/<name>`, for example `/api/getTodaysEdit`. The app sends the user's Supabase login token, and the route checks it before doing anything.

## Run it locally

```bash
cd server
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

The server starts on port 3000. A phone can't reach `localhost` on your computer, so in the app's `.env` use your computer's network address:

```
EXPO_PUBLIC_API_URL=http://192.168.1.20:3000
```

Restart Expo after changing it. The phone and computer must be on the same Wi-Fi.

## Deploy to Vercel

1. Import the repository in Vercel and set **Root Directory** to `server`.
2. Add every variable from `.env.example` under **Settings → Environment Variables**.
3. Deploy, then set the app's `EXPO_PUBLIC_API_URL` to the Vercel URL and rebuild the app.

Each route allows 60 seconds (`maxDuration` in its `route.ts`). If image or video features time out, raise it as far as your Vercel plan allows.

## Morning email

Emails go out through SMTP, set up for Gmail. In your Google account, turn on 2-Step Verification, then create an app password at **myaccount.google.com/apppasswords**. Put your Gmail address in `SMTP_USER` and the 16-letter app password in `SMTP_PASS`. A personal Gmail account can send roughly 500 emails a day; for more, use Google Workspace or another SMTP provider by changing `SMTP_HOST` and `SMTP_PORT`.

### Schedule

`/api/sendDailyOutfitNotification` runs hourly and emails users in their local 6am hour. Supabase can call it on a schedule. In the **SQL Editor**, after enabling `pg_cron` and `pg_net`:

```sql
select cron.schedule('daily-outfit-email', '0 * * * *', $$
  select net.http_post(
    url := 'https://<your-server>.vercel.app/api/sendDailyOutfitNotification',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "<DAILY_CRON_TOKEN>"}'::jsonb
  );
$$);
```

## How the code is organised

- `lib/functions/<name>.ts`: copied from the Base44 web app by `scripts/port-base44-functions.js`, so prompts stay word for word. Don't edit these by hand; re-run the script with a newer export.
- `lib/shared/compat.ts`: gives those functions the Base44 client shape on top of Supabase.
- `lib/shared/ai.ts`: the only file that talks to Gemini.
- `lib/shared/policy.ts`: Free vs Premium and daily limits. `LIMITS_ENABLED` is `false` until subscriptions launch.
- `app/api/<name>/route.ts`: the URL for each function.
