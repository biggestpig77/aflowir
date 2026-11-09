# AFLOW IRAN website

## Run locally

1. Use Node.js 20 or newer.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env` and set your SMTP provider details. Reservation submissions are unavailable until SMTP is configured.
4. Start the website with `npm start` and open `http://127.0.0.1:3000`.

The static pages are served from `public/`. Reservation requests are validated by the server and emailed to `SMTP_TO` (or `SMTP_USER` if `SMTP_TO` is not set). Do not commit `.env`.

Run the automated server tests with `npm test`.

## Deploy to Vercel

1. Import the GitHub repository into Vercel. The Vercel configuration publishes `public/` as the static site and deploys `api/reservations.js` as the `/api/reservations` function.
2. In the Vercel project settings, add `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, and `SMTP_PASS`. Optionally add `SMTP_FROM` and `SMTP_TO`; they default to `SMTP_USER`.
3. Add the variables to the Production environment (and Preview if you want reservation emails from preview deployments), then deploy or redeploy.
4. Open the deployed site and submit a test reservation. If it fails, check the Vercel function logs and verify the SMTP values with your mail provider.

Never commit `.env` or expose SMTP credentials in client-side code. If an SMTP app password may have been exposed, revoke it and use a newly generated password in Vercel.
