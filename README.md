# AFLOW IRAN website

## Run locally

1. Use Node.js 20 or newer.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env` and set your SMTP provider details. Reservation submissions are unavailable until SMTP is configured.
4. Start the website with `npm start` and open `http://127.0.0.1:3000`.

The static pages are served from `public/`. Reservation requests are validated by the server and emailed to `SMTP_TO` (or `SMTP_USER` if `SMTP_TO` is not set). Do not commit `.env`.

Run the automated server tests with `npm test`.
