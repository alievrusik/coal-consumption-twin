# Coal consumption twin — boiler fleet prototype

Interactive Next.js dashboard for ten simulated boiler houses sharing one coal reserve. Deterministic linear physics produce forecasts on the server; an optional foundation-model pass adds structured narrative, confidence, and warnings. Suitable for Vercel previews.

## Features

- Per-unit daily consumption (kg), editable grid with fleet share and stress lens.
- Shared reserve (tons) plus configurable forecast horizon.
- Simulated spreadsheet ingestion via JSON rows (`unitId`, `dailyConsumptionKg`).
- Server route `POST /api/simulate` returns JSON: `result`, `confidence`, `explanation`, `warnings`.
- Push-style shortage banner when reserves cannot cover the horizon at linear burn.

## Local setup

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`.

### Foundation model configuration (server-only)

Secrets stay on the server; the browser only calls `/api/simulate`.

| Variable | Purpose |
| --- | --- |
| `DEMO_FOUNDATION_PROVIDER` | Set to `anthropic` (or leave unset) to allow Anthropic-compatible calls. |
| `ANTHROPIC_API_KEY` | Service credential used exclusively in API routes. |
| `ANTHROPIC_MODEL` | Target model identifier for Messages requests. |
| `ANTHROPIC_PROXY_URL` | Optional HTTPS base or full `/v1/messages` endpoint when routing through a proxy. |

If credentials are missing or the provider gate fails, the route falls back to deterministic copy while preserving the same JSON envelope.

Custom TLS materials (for example corporate proxies) should be configured at the deployment/runtime layer rather than in client bundles.

## Deployment (Vercel)

1. Import the repository in Vercel.
2. Framework preset: **Next.js**.
3. Add the foundation environment variables above as encrypted project settings.
4. Deploy; verify `/api/simulate` responds from the preview URL.

## Scripts

- `npm run dev` — local development server.
- `npm run build` — production build check.
- `npm run start` — serve the production build locally.
- `npm run lint` — Next.js ESLint rules.

## API contract

`POST /api/simulate` with JSON body:

```json
{
  "totalReserveTons": 5,
  "forecastDays": 45,
  "units": [{ "id": "BH-01", "name": "Boiler house 1", "dailyConsumptionKg": 10 }],
  "simulatedExcelRows": [{ "unitId": "BH-01", "dailyConsumptionKg": 12 }]
}
```

`units` defaults to ten houses at 10 kg/day when omitted. `simulatedExcelRows` overrides matching IDs when supplied.

Response fields:

- `result` — quantitative twin snapshot (units, aggregate runway, shortfall, flags).
- `confidence` — 0–1 qualitative certainty tied to linear assumptions.
- `explanation` — operator-facing prose (foundation-augmented when configured).
- `warnings` — caveats (telemetry gaps, spreadsheet simulation, linear burn).

## Repository

Upstream reference: https://github.com/alievrusik/coal-consumption-twin
