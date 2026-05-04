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
    name: `Котельная ${i + 1}`,
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
        if (!Array.isArray(parsed)) throw new Error("JSON имитации таблицы должен быть массивом.");
        simulatedExcelRows = parsed.map((row) => {
          const r = row as { unitId?: unknown; dailyConsumptionKg?: unknown };
          if (typeof r.unitId !== "string") throw new Error("В каждой строке нужен unitId (строка).");
          const kg = Number(r.dailyConsumptionKg);
          if (!Number.isFinite(kg)) throw new Error("В каждой строке нужен dailyConsumptionKg (число).");
          return { unitId: r.unitId, dailyConsumptionKg: kg };
        });
      } catch (e) {
        setLoading(false);
        setError(e instanceof Error ? e.message : "Не удалось разобрать JSON имитации таблицы.");
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
          typeof detail?.error === "string" ? detail.error : `Ошибка запроса (${res.status})`
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
      setError(e instanceof Error ? e.message : "Симуляция не выполнена.");
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
        <h1>Двойник потребления угля — запас и горизонт</h1>
        <p>
          Десять котельных делят один складской остаток. Настройте суточный расход и запасы, затем запустите
          линейный прогноз. Расчёт и текстовое сопровождение выполняются на сервере, ключи в браузер не
          попадают.
        </p>
      </header>

      <section className="panel">
        <h2>Исходные данные</h2>
        <div className="grid-controls">
          <label className="field">
            Общий остаток (т)
            <input
              type="number"
              min={0}
              step={0.1}
              value={reserveTons}
              onChange={(e) => setReserveTons(Number(e.target.value))}
            />
            <span className="hint">По умолчанию в прототипе {DEFAULT_RESERVE_TONS} т.</span>
          </label>
          <label className="field">
            Горизонт прогноза (сут.)
            <input
              type="number"
              min={1}
              max={365}
              step={1}
              value={forecastDays}
              onChange={(e) => setForecastDays(Number(e.target.value))}
            />
            <span className="hint">Проверка, покрывает ли запас равномерный расход на этом горизонте.</span>
          </label>
          <div className="actions">
            <button className="primary" disabled={loading} onClick={() => runSimulation(false)}>
              {loading ? "Выполняется прогноз…" : "Запустить прогноз"}
            </button>
            <button className="ghost" type="button" onClick={resetFleet}>
              Сбросить по умолчанию
            </button>
          </div>
        </div>

        <label className="field" style={{ marginTop: "0.85rem" }}>
          JSON имитации таблицы (необязательное наложение)
          <textarea
            value={excelDraft}
            onChange={(e) => setExcelDraft(e.target.value)}
            placeholder={SAMPLE_EXCEL_JSON}
          />
          <span className="hint">
            Вставьте строки вида{" "}
            <code>[{"{"}&quot;unitId&quot;:&quot;BH-01&quot;,&quot;dailyConsumptionKg&quot;:12{"}"}]</code>,
            чтобы имитировать загрузку из таблицы.
          </span>
        </label>
        <div className="actions" style={{ marginTop: "0.65rem" }}>
          <button className="ghost" type="button" disabled={loading} onClick={() => runSimulation(true)}>
            Применить таблицу и прогноз
          </button>
          <button
            className="ghost"
            type="button"
            onClick={() => setExcelDraft(SAMPLE_EXCEL_JSON)}
          >
            Подставить пример строк
          </button>
        </div>

        {shortage === true && (
          <div className="alert-banner" role="status">
            <strong>Предупреждение о дефиците</strong>
            <span>
              Суммарного запаса не хватает на выбранный горизонт при текущем линейном расходе. Проверьте
              закупки или временно снизьте расход на объектах с высокой долей.
            </span>
          </div>
        )}
        {shortage === false && response && (
          <div className="alert-banner ok" role="status">
            <strong>Запас покрывает горизонт</strong>
            <span>
              При линейном расходе остатка хватает на выбранный период. Продолжайте мониторинг на случай
              нелинейных колебаний, когда появятся реальные телеметрические данные.
            </span>
          </div>
        )}
      </section>

      <section className="metrics-row" aria-live="polite">
        <div className="metric">
          <div className="label">Расход парка</div>
          <div className="value">{fleetKg.toFixed(1)} кг/сут</div>
          <div className="sub">{(fleetKg / 1000).toFixed(3)} т/сут суммарно</div>
        </div>
        <div className="metric">
          <div className="label">Остаток на складе</div>
          <div className="value">{reserveTons.toFixed(2)} т</div>
          <div className="sub">Общий пул на {BOILER_COUNT} объектов</div>
        </div>
        <div className="metric">
          <div className="label">Уверенность прогноза</div>
          <div className="value">
            {response ? `${Math.round(response.confidence * 100)}%` : "—"}
          </div>
          <div className="sub">Качество структурированного текста</div>
        </div>
      </section>

      <section className="split">
        <div className="panel">
          <h2>Расход по котельным</h2>
          <div className="table-wrap">
            <table className="units">
              <thead>
                <tr>
                  <th>Объект</th>
                  <th>Суточный расход угля (кг)</th>
                  <th>Доля в парке</th>
                  <th>Одиночный горизонт</th>
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
                      <td>{solo != null && Number.isFinite(solo) ? `${solo.toFixed(1)} сут.` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="status-text" style={{ marginTop: "0.75rem" }}>
            «Одиночный горизонт» — условно весь запас отдан одному объекту при его текущем расходе (для
            наглядности напряжённости); операционно ориентируйтесь на суммарный прогноз выше.
          </p>
        </div>

        <div className="panel">
          <h2>Прогноз с сервера</h2>
          {response ? (
            <>
              <div className="confidence-pill">
                Уверенность <b>{Math.round(response.confidence * 100)}%</b>
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
                  <div className="label">Суммарный запас хода</div>
                  <div className="value">
                    {response.result.aggregateDaysRemaining != null
                      ? `${response.result.aggregateDaysRemaining.toFixed(1)} сут.`
                      : "—"}
                  </div>
                  <div className="sub">Линейный объединённый расход</div>
                </div>
                <div className="metric">
                  <div className="label">Разрыв к горизонту</div>
                  <div className="value">
                    {response.result.shortfallTons > 0
                      ? `−${response.result.shortfallTons.toFixed(2)} т`
                      : "Без дефицита"}
                  </div>
                  <div className="sub">К плану на {response.result.forecastDays} сут.</div>
                </div>
              </div>
              {response.result.simulatedExcelSource && (
                <p className="status-text" style={{ marginTop: "0.65rem" }}>
                  В последнем расчёте строки имитации таблицы подставлены в расход объектов перед прогнозом.
                </p>
              )}
            </>
          ) : (
            <p className="status-text">
              Запустите прогноз, чтобы получить с сервера JSON с текстом, уверенностью и предупреждениями.
            </p>
          )}
          {error && <div className="error-line">{error}</div>}
        </div>
      </section>
    </main>
  );
}
