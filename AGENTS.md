# AGENTS.md

## Cursor Cloud specific instructions

### Repository layout

`main` may only contain a stub README until the auction aggregator is merged. The runnable Node.js app lives on `cursor/auction-aggregator-app-b25a` (or a descendant branch such as `cursor/dev-env-setup-2e9a`). Check out a branch that includes `package.json` before installing dependencies or running the server.

### Services

| Service | Command | Port | Notes |
|---|---|---|---|
| Auction aggregator (Express) | `npm run dev` | 3000 | `npm start` for production-style run without `--watch` |

No database, Docker, or external secrets are required. The app fetches live auction data from public IVG and SIVAG endpoints over the network.

### Common commands

See `README.md` for full details. Quick reference:

- Install: `npm install` (or `npm ci` when `package-lock.json` is present)
- Dev server: `npm run dev`
- Tests: `npm test` (Node built-in test runner; no separate lint script)
- Health check: `GET http://localhost:3000/api/health`
- Auction data: `GET http://localhost:3000/api/auctions` (add `?fresh=1` to bypass the 5-minute cache)

### Gotchas

- First `/api/auctions` request can take several seconds while external sources are scraped (Cremona is the slowest).
- `PORT` and `CACHE_TTL_MS` are optional env vars (defaults: 3000 and 300000).
- External source availability depends on third-party sites; partial failures surface in the `sources` array of the API response.
- Use tmux for long-running dev servers in Cloud Agent VMs.
