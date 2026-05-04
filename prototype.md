# Prototype summary — coal consumption twin

## Domain

Industrial boiler operations for a distributed fleet (ten houses) sharing bulk coal inventory.

## Task type

Planning / inventory digital twin (linear simulation with narrative augmentation).

## Inputs

- Per-boiler daily coal consumption `X` (kg/day); MVP default **10 kg × 10 units**.
- Fleet-wide reserve statement `Y` (tons); MVP default **5 t**.
- Forecast horizon (days) for sufficiency testing.
- Optional simulated workbook rows `{ unitId, dailyConsumptionKg }` standing in for future Excel ingestion.

## Outputs

- Fleet aggregate burn (kg/day, t/day).
- Linear pooled runway (`aggregateDaysRemaining`).
- Horizon shortfall (`shortfallTons`) when linear demand exceeds stock.
- Highlighted higher-draw units during shortage (`unitsAtRisk`).
- Structured JSON response including `confidence`, `explanation`, and `warnings`.

## Approach

- Next.js App Router UI tuned to operators (inventory controls + boiler grid + alert ribbon).
- Deterministic simulation in `lib/simulation.ts` for reproducible numbers.
- Server-only foundation model call (`lib/foundation.ts`) that must return JSON merged into the API envelope; graceful deterministic fallback if credentials are absent or HTTP fails.
- Simulated spreadsheet path demonstrates future Excel parsing without handling binary files in-browser.

## Reuse notes

- Swap `/api/simulate` internals for real telemetry ingestion while keeping the JSON contract stable for dashboards.
- Extend `simulatedExcelRows` parsing into true workbook ingestion behind the same route.
- Confidence currently reflects narrative certainty under linear assumptions—not predictive uncertainty from sensors.

## Links (fill after publishing)

- Preview deployment: `_TODO_VERCEL_URL_`
- Repository: https://github.com/alievrusik/coal-consumption-twin

## Limitations

- No live sensor feeds; defaults are illustrative.
- Forecast assumes constant daily consumption and one pooled reserve.
- Higher-draw risk tagging is relative to fleet averages during shortage only.
- Spreadsheet flow accepts JSON mimicry, not `.xlsx` binaries.
