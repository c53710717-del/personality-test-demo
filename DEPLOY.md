# Deployment Guide (Fly + Vercel)

This repo is a monorepo:
- `server/` runs on Fly (Node + WebSocket)
- `client/` runs on Vercel
- `common/` shared game logic

## 1) Deploy API on Fly (with Postgres)

### Install Fly CLI
Follow the official guide: https://fly.io/docs/hands-on/install-flyctl/

### Create a Fly Postgres database
```bash
fly auth login
fly postgres create --name splendor-db --region sjc
```
This creates a new Postgres app. Save the connection info.

### Launch the API app
From repo root:
```bash
fly launch --name splendor-api --region sjc --dockerfile ./Dockerfile
```

### Attach database and set secrets
```bash
fly postgres attach --app splendor-api splendor-db
fly secrets set CLIENT_ORIGIN="https://YOUR-VERCEL-URL"
```
Fly will automatically set `DATABASE_URL` for you.

### Deploy
```bash
fly deploy
```

Your API URL will look like:
```
https://splendor-api.fly.dev
```

## 2) Deploy Frontend on Vercel

### Create a Vercel project
- Import the GitHub repo
- Set **Root Directory** to `client`
- Build Command: `npm run build`
- Output Directory: `dist`

### Set environment variables
```
VITE_API_URL=https://splendor-api.fly.dev
VITE_WS_URL=wss://splendor-api.fly.dev
```

### Deploy
After the first deploy, you will get a Vercel URL.

## 3) Update Fly CORS
Go back to Fly and update CORS with your Vercel URL:
```bash
fly secrets set CLIENT_ORIGIN="https://YOUR-VERCEL-URL"
```

## Notes
- `DATABASE_URL` is required in production.
- Use `wss://` for WebSocket in production.
- If you add a custom domain later, update `CLIENT_ORIGIN`.
