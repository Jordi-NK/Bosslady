# Bosslady Cosmetics

## Run locally

Install Node.js, then run `npm start` in this folder and open `http://localhost:3000`.
Do not open `index.html` directly: reviews are loaded from the server.

For local `npm start`, reviews are stored in `data/reviews.json`. This local file is
separate from the production review database used by the Vercel deployment.

## Deploy to Vercel

The site includes a Vercel Function at `api/reviews.js`. It stores reviews in a Neon
Postgres database; the database table is created automatically on the first API call.

1. Create a Neon Postgres database and copy its connection string.
2. Import this project into Vercel with the `Bosslady` folder as the project root.
3. In Vercel project settings, add `DATABASE_URL` with the Neon connection string for
   Production (and Preview/Development if you want reviews in those environments).
4. Redeploy. Vercel serves `index.html` and the `assets` folder, and routes `/api/reviews`
   to the database-backed function.

Keep the connection string private. Local `npm start` still uses `data/reviews.json`;
the Vercel deployment uses Neon.
