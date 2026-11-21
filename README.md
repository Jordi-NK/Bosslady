# Bosslady Cosmetics

## Run locally

Install Node.js, then run `npm start` in this folder and open `http://localhost:3000`.
Do not open `index.html` directly: reviews are loaded from the server.

Reviews are stored in `data/reviews.json` and shared by visitors of this server. When
deploying, use a Node.js host and attach persistent storage for this file; hosts with
ephemeral filesystems will lose reviews when the app restarts or is redeployed.
