"use client";

import { useMemo, useState } from "react";
import {
  BOILER_COUNT,
  DEFAULT_DAILY_KG,
  DEFAULT_RESERVE_TONS,
} from "@/lib/simulation";
import type { SimulateApiResponse } from "@/lib/types";

type UnitDraft = { id: string; name: string; dailyConsumptionKg: number };

function buildDefaultUnits(): UnitDraft[] {
  return Array.from({ length: BOILER_COUNT }, (_, i) => ({
    id: `BH-${String(i + 1).padStart(2, "0")}`,
    name: `Boiler house ${i + 1}`,
    dailyConsumptionKg: DEFAULT_DAILY_KG,
  }));
}

const SAMPLE_EXCEL_JSON = `[
  { "unitId": "BH-01", "dailyConsumptionKg": 12 },
  { "unitId": "BH-02", "dailyConsumptionKg": 11 },
  { "unitId": "BH-03", "dailyConsumptionKg": 10 },
  { "unitId": "BH-04", "dailyConsumptionKg": 14 },
  { "unitId": "BH-05", "dailyConsumptionKg": 9 },
  { "unitId": "BH-06", "dailyConsumptionKg": 13 },
  { "unitId": "BH-07", "dailyConsumptionKg": 10 },
  { "unitId": "BH-08", "dailyConsumptionKg": 15 },
  { "unitId": "BH-09", "dailyConsumptionKg": 9 },
  { "unitId": "BH-10", "dailyConsumptionKg": 12 }
]`;

export default function DashboardPage() {
  const [units, setUnits] = useState<UnitDraft[]>(() => buildDefaultUnits());
  const [reserveTons, setReserveTons] = useState(DEFAULT_RESERVE_TONS);
  const [forecastDays, setForecastDays] = useState(45);
  const [excelDraft, setExcelDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<SimulateApiResponse | null>(null);

  const fleetKg = useMemo(
    () => units.reduce((sum, u) => sum + Math.max(0, u.dailyConsumptionKg), 0),
    [units]
  );

  async function runSimulation(useExcel: boolean) {
    setLoading(true);
    setError(null);
    let simulatedExcelRows: { unitId: string; dailyConsumptionKg: number }[] | undefined;
    if (useExcel) {
      try {
        const parsed = JSON.parse(excelDraft || SAMPLE_EXCEL_JSON) as unknown;
        if (!Array.isArray(parsed)) throw new Error("Simulated workbook JSON must be an array.");
        simulatedExcelRows = parsed.map((row) => {
          const r = row as { unitId?: unknown; dailyConsumptionKg?: unknown };
          if (typeof r.unitId !== "string") throw new Error("Each row needs unitId (string).");
          const kg = Number(r.dailyConsumptionKg);
          if (!Number.isFinite(kg)) throw new Error("Each row needs dailyConsumptionKg (number).");
          return { unitId: r.unitId, dailyConsumptionKg: kg };
        });
      } catch (e) {
        setLoading(false);
        setError(e instanceof Error ? e.message : "Could not parse simulated workbook JSON.");
        return;
      }
    }

    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          totalReserveTons: reserveTons,
          forecastDays,
          units: units.map((u) => ({
            id: u.id,
            name: u.name,
            dailyConsumptionKg: Math.max(0, u.dailyConsumptionKg),
          })),
          simulatedExcelRows,
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(
          typeof detail?.error === "string" ? detail.error : `Request failed (${res.status})`
        );
      }
      const payload = (await res.json()) as SimulateApiResponse;
      setResponse(payload);
      if (useExcel && simulatedExcelRows?.length) {
        const map = new Map(simulatedExcelRows.map((r) => [r.unitId, r.dailyConsumptionKg]));
        setUnits((prev) =>
          prev.map((u) =>
            map.has(u.id) ? { ...u, dailyConsumptionKg: map.get(u.id)! } : u
          )
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Simulation failed.");
    } finally {
      setLoading(false);
    }
  }

  function resetFleet() {
    setUnits(buildDefaultUnits());
    setReserveTons(DEFAULT_RESERVE_TONS);
    setForecastDays(45);
    setExcelDraft("");
    setResponse(null);
    setError(null);
  }

  const shortage = response?.result.reserveInsufficientForForecast;

  return (
    <main className="shell">
      <header className="hero">
        <h1>Fleet coal twin — inventory runway</h1>
        <p>
          Ten boiler houses share a single reserve statement. Adjust daily draws and reserves, then run a
          linear outlook. Server-side intelligence summarizes risks without exposing credentials to the
          browser.
        </p>
      </header>

      <section className="panel">
        <h2>Operating posture</h2>
        <div className="grid-controls">
          <label className="field">
            Shared reserves (tons)
            <input
              type="number"
              min={0}
              step={0.1}
              value={reserveTons}
              onChange={(e) => setReserveTons(Number(e.target.value))}
            />
            <span className="hint">Prototype default {DEFAULT_RESERVE_TONS} t.</span>
          </label>
          <label className="field">
            Forecast window (days)
            <input
              type="number"
              min={1}
              max={365}
              step={1}
              value={forecastDays}
              onChange={(e) => setForecastDays(Number(e.target.value))}
            />
            <span className="hint">Checks whether stock covers steady burn across this horizon.</span>
          </label>
          <div className="actions">
            <button className="primary" disabled={loading} onClick={() => runSimulation(false)}>
              {loading ? "Running forecast…" : "Run forecast"}
            </button>
            <button className="ghost" type="button" onClick={resetFleet}>
              Reset defaults
            </button>
          </div>
        </div>

        <label className="field" style={{ marginTop: "0.85rem" }}>
          Simulated workbook JSON (optional overlay)
          <textarea
            value={excelDraft}
            onChange={(e) => setExcelDraft(e.target.value)}
            placeholder={SAMPLE_EXCEL_JSON}
          />
          <span className="hint">
            Paste rows shaped like{" "}
            <code>[{"{"}&quot;unitId&quot;:&quot;BH-01&quot;,&quot;dailyConsumptionKg&quot;:12{"}"}]</code>{" "}
            to mimic spreadsheet ingestion.
          </span>
        </label>
        <div className="actions" style={{ marginTop: "0.65rem" }}>
          <button className="ghost" type="button" disabled={loading} onClick={() => runSimulation(true)}>
            Apply simulated workbook &amp; forecast
          </button>
          <button
            className="ghost"
            type="button"
            onClick={() => setExcelDraft(SAMPLE_EXCEL_JSON)}
          >
            Load sample rows
          </button>
        </div>

        {shortage === true && (
          <div className="alert-banner" role="status">
            <strong>Shortfall alert</strong>
            <span>
              Aggregate reserves cannot cover the selected horizon at current linear consumption. Review
              procurement or temporarily throttle higher-draw houses.
            </span>
          </div>
        )}
        {shortage === false && response && (
          <div className="alert-banner ok" role="status">
            <strong>Inventory covers horizon</strong>
            <span>
              Linear burn stays within stated reserves for the forecast window. Continue monitoring for
              nonlinear swings once telemetry arrives.
            </span>
          </div>
        )}
      </section>

      <section className="metrics-row" aria-live="polite">
        <div className="metric">
          <div className="label">Fleet draw</div>
          <div className="value">{fleetKg.toFixed(1)} kg/d</div>
          <div className="sub">{(fleetKg / 1000).toFixed(3)} t/day aggregate</div>
        </div>
        <div className="metric">
          <div className="label">On-hand inventory</div>
          <div className="value">{reserveTons.toFixed(2)} t</div>
          <div className="sub">Shared pool across {BOILER_COUNT} houses</div>
        </div>
        <div className="metric">
          <div className="label">API outlook confidence</div>
          <div className="value">
            {response ? `${Math.round(response.confidence * 100)}%` : "—"}
          </div>
          <div className="sub">Structured narrative quality signal</div>
        </div>
      </section>

      <section className="split">
        <div className="panel">
          <h2>Boiler draw schedule</h2>
          <div className="table-wrap">
            <table className="units">
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>Daily coal (kg)</th>
                  <th>Fleet share</th>
                  <th>Solo runway (twin lens)</th>
                </tr>
              </thead>
              <tbody>
                {units.map((unit) => {
                  const solo =
                    unit.dailyConsumptionKg > 0 ? reserveTons / (unit.dailyConsumptionKg / 1000) : null;
                  const share = fleetKg > 0 ? unit.dailyConsumptionKg / fleetKg : 0;
                  const atRisk = response
                    ? response.result.unitsAtRisk.includes(unit.id)
                    : false;
                  return (
                    <tr key={unit.id} className={atRisk ? "at-risk" : undefined}>
                      <td>
                        <div>{unit.name}</div>
                        <div style={{ color: "var(--muted)", fontSize: "0.78rem" }}>{unit.id}</div>
                      </td>
                      <td>
                        <input
                          className="cell"
                          type="number"
                          min={0}
                          step={0.5}
                          value={unit.dailyConsumptionKg}
                          onChange={(e) => {
                            const next = Number(e.target.value);
                            setUnits((prev) =>
                              prev.map((u) =>
                                u.id === unit.id ? { ...u, dailyConsumptionKg: next } : u
                              )
                            );
                          }}
                        />
                      </td>
                      <td>{(share * 100).toFixed(1)}%</td>
                      <td>{solo != null && Number.isFinite(solo) ? `${solo.toFixed(1)} d` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="status-text" style={{ marginTop: "0.75rem" }}>
            Solo runway hypothetically allocates the entire reserve to one house at its current draw for
            stress visualization; operations still rely on the pooled forecast above.
          </p>
        </div>

        <div className="panel">
          <h2>Server outlook</h2>
          {response ? (
            <>
              <div className="confidence-pill">
                Confidence <b>{Math.round(response.confidence * 100)}%</b>
              </div>
              <p className="narrative" style={{ marginTop: "0.75rem" }}>
                {response.explanation}
              </p>
              <ul className="warnings">
                {response.warnings.map((w, idx) => (
                  <li key={`${idx}-${w.slice(0, 48)}`}>{w}</li>
                ))}
              </ul>
              <div className="metrics-row" style={{ marginTop: "0.75rem" }}>
                <div className="metric">
                  <div className="label">Aggregate runway</div>
                  <div className="value">
                    {response.result.aggregateDaysRemaining != null
                      ? `${response.result.aggregateDaysRemaining.toFixed(1)} d`
                      : "—"}
                  </div>
                  <div className="sub">Linear pooled burn</div>
                </div>
                <div className="metric">
                  <div className="label">Horizon gap</div>
                  <div className="value">
                    {response.result.shortfallTons > 0
                      ? `-${response.result.shortfallTons.toFixed(2)} t`
                      : "Balanced"}
                  </div>
                  <div className="sub">Versus {response.result.forecastDays}-day plan</div>
                </div>
              </div>
              {response.result.simulatedExcelSource && (
                <p className="status-text" style={{ marginTop: "0.65rem" }}>
                  Latest run merged simulated workbook rows into unit draws before forecasting.
                </p>
              )}
            </>
          ) : (
            <p className="status-text">
              Run a forecast to retrieve structured JSON with narrative, confidence, and warnings from the
              server route.
            </p>
          )}
          {error && <div className="error-line">{error}</div>}
        </div>
      </section>
    </main>
  );
}
