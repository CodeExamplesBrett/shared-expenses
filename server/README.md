# NUC server

A tiny zero-dependency Node server that hosts the **whole app plus its data** over
one origin, fronted by Tailscale for private HTTPS. There is **no login** — access
control is the tailnet (only devices you've shared the node with can reach it).

It serves two data APIs and the built SPA:

- **Food diary** — `GET /api/food-diary` returns JSON parsed **live** from your
  Obsidian vault. Read-only; you author meals in Obsidian / Claude Code on the NUC.
- **Expenses** — `GET/POST/PUT/DELETE /api/expenses`, a read-write list stored in a
  JSON file on the NUC (this replaces Firestore on this branch).

```
Obsidian vault (markdown) ─parse→ GET /api/food-diary  ┐
expenses.json  ────────────────── /api/expenses (CRUD) ├─ one origin
built SPA (dist/spa) ──────────────────────────────────┘   │ tailscale serve (HTTPS)
                                         phone / laptop ────┘  no login (tailnet only)
```

## What runs where

- **Food diary authoring:** Obsidian / Claude Code on the NUC writes `YYYY-MM-DD.md`
  files into the vault's `Food Diary` folder; the server reads them on each request.
- **Expenses:** created/edited in the app, persisted to `EXPENSES_FILE`.
- **Serving:** `server/index.mjs` on the NUC (zero dependencies — just Node 18+).
- **Access:** `tailscale serve` gives it HTTPS on your tailnet. For a second person
  (e.g. Martina) to use it, share the NUC node with their Tailscale account.

## Deploy to the NUC

Clone the repo on the NUC, build, and run:

```bash
cd ~
git clone https://github.com/CodeExamplesBrett/shared-expenses.git
cd shared-expenses
git checkout nuc-hosting
npm install
npm run build            # produces dist/spa
```

Then run it once by hand to check (Ctrl+C after testing):

```bash
VAULT_DIR="/mnt/storage/nextcloud-data/data/brett/files/Documents/obsidian-vault/Food Diary" \
PORT=8090 node server/index.mjs

# in another terminal:
curl -s localhost:8090/api/food-diary | head -c 120; echo
curl -s localhost:8090/api/expenses;                echo   # -> []
```

To update later: `git pull`, `npm run build`, `sudo systemctl restart food-diary`.
The expenses JSON file is outside the repo (see `EXPENSES_FILE`), so pulls and
rebuilds never touch your data.

## Keep it running (systemd)

```ini
# /etc/systemd/system/food-diary.service
[Unit]
Description=Food diary + expenses server
After=network.target

[Service]
# Quote the whole assignment when a path contains spaces (e.g. "Food Diary").
Environment="VAULT_DIR=/mnt/storage/nextcloud-data/data/brett/files/Documents/obsidian-vault/Food Diary"
Environment=PORT=8090
Environment=SPA_DIR=/home/brett-server/shared-expenses/dist/spa
Environment=EXPENSES_FILE=/home/brett-server/food-diary-data/expenses.json
ExecStart=/usr/bin/node /home/brett-server/shared-expenses/server/index.mjs
Restart=on-failure
User=brett-server
WorkingDirectory=/home/brett-server/shared-expenses

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now food-diary
sudo systemctl status food-diary --no-pager
```

## Expose over Tailscale (HTTPS)

```bash
tailscale serve --bg 8090
tailscale serve status      # prints the https://<nuc>.<tailnet>.ts.net URL
tailscale funnel status     # should say "tailnet only" — NOT public
```

Open that URL on your phone, then **Add to Home Screen** for an app icon.
(MagicDNS + HTTPS certificates must be enabled once in the Tailscale admin
console; `tailscale serve` tells you if they aren't. If it needs root, either
`sudo tailscale set --operator=$USER` once, or prefix the command with `sudo`.)

## Environment variables

| Var             | Default                | Purpose                                              |
| --------------- | ---------------------- | ---------------------------------------------------- |
| `VAULT_DIR`     | _(required)_           | Absolute path to the `Food Diary` folder             |
| `EXPENSES_FILE` | `../data/expenses.json`| Writable JSON store for expenses/payments            |
| `PORT`          | `8080`                 | Port to listen on                                    |
| `SPA_DIR`       | `../dist/spa`          | Built app to serve                                   |
| `CACHE_MS`      | `2000`                 | How long a food-diary parse is reused between calls  |

## Notes

- **No login:** the tailnet is the access boundary. Anyone who can reach the URL can
  read and edit expenses — that's fine for a private tailnet shared only with people
  you trust.
- **Back up `expenses.json`:** it's the only copy of your expense data on this branch.
  A periodic copy (e.g. into your Nextcloud folder) is worth setting up.
- **Freshness:** the app polls — food diary every 60s, expenses every 15s — and on
  reopen, so changes appear without a manual refresh. Expenses aren't real-time push
  like Firestore was; the other person's new entry shows up within ~15s.
- **Local dev:** `npm run dev` on the laptop has no `/api/*`. Point it at the NUC with
  `VITE_FOOD_DIARY_API` and `VITE_EXPENSES_API` in `.env.local`, or run
  `server/index.mjs` locally against a vault and a scratch `EXPENSES_FILE`.
```
