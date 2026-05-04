import type { SimulateRequestBody } from "./types";

const KG_PER_TON = 1000;
export const DEFAULT_DAILY_KG = 10;
export const DEFAULT_RESERVE_TONS = 5;
export const BOILER_COUNT = 10;

export type BoilerUnitSnapshot = {
  id: string;
  name: string;
  dailyConsumptionKg: number;
  shareOfFleetKg: number;
  /** Days if the entire reserve were burned only by this unit at its rate */
  impliedDaysAtFleetBurnRate: number | null;
};

function defaultUnits(): { id: string; name: string; dailyConsumptionKg: number }[] {
  return Array.from({ length: BOILER_COUNT }, (_, i) => ({
    id: `BH-${String(i + 1).padStart(2, "0")}`,
    name: `Котельная ${i + 1}`,
    dailyConsumptionKg: DEFAULT_DAILY_KG,
  }));
}

export type SimulationCore = {
  units: BoilerUnitSnapshot[];
  totalDailyConsumptionKg: number;
  totalReserveTons: number;
  aggregateDaysRemaining: number | null;
  forecastDays: number;
  shortfallTons: number;
  unitsAtRisk: string[];
  reserveInsufficientForForecast: boolean;
  simulatedExcelSource: boolean;
};

export function runLinearSimulation(body: SimulateRequestBody): SimulationCore {
  const forecastDays = Math.max(1, Math.min(365 * 3, Math.floor(body.forecastDays || 30)));
  const totalReserveTons = Math.max(0, Number(body.totalReserveTons) || DEFAULT_RESERVE_TONS);

  let simulatedExcelSource = false;
  let rawUnits = body.units?.length ? body.units : defaultUnits();

  if (body.simulatedExcelRows?.length) {
    simulatedExcelSource = true;
    const byId = new Map(body.simulatedExcelRows.map((r) => [r.unitId, r.dailyConsumptionKg]));
    rawUnits = rawUnits.map((u) => ({
      ...u,
      dailyConsumptionKg:
        typeof byId.get(u.id) === "number" ? Math.max(0, byId.get(u.id)!) : u.dailyConsumptionKg,
    }));
    for (const row of body.simulatedExcelRows) {
      if (!rawUnits.some((u) => u.id === row.unitId)) {
        rawUnits.push({
          id: row.unitId,
          name: row.unitId,
          dailyConsumptionKg: Math.max(0, row.dailyConsumptionKg),
        });
      }
    }
  }

  rawUnits = rawUnits.map((u) => ({
    ...u,
    dailyConsumptionKg: Math.max(0, u.dailyConsumptionKg),
  }));

  const totalDailyConsumptionKg = rawUnits.reduce((s, u) => s + u.dailyConsumptionKg, 0);
  const dailyBurnTons = totalDailyConsumptionKg / KG_PER_TON;

  let aggregateDaysRemaining: number | null = null;
  if (dailyBurnTons > 0) {
    aggregateDaysRemaining = totalReserveTons / dailyBurnTons;
  } else if (totalReserveTons > 0) {
    aggregateDaysRemaining = null;
  }

  const requiredTonsForHorizon = dailyBurnTons * forecastDays;
  const shortfallTons = Math.max(0, requiredTonsForHorizon - totalReserveTons);
  const reserveInsufficientForForecast = shortfallTons > 0;

  const meanKg =
    rawUnits.length > 0 ? totalDailyConsumptionKg / rawUnits.length : 0;
  const unitsAtRisk =
    reserveInsufficientForForecast && meanKg > 0
      ? rawUnits.filter((u) => u.dailyConsumptionKg > meanKg * 1.05).map((u) => u.id)
      : [];

  const units: BoilerUnitSnapshot[] = rawUnits.map((u) => ({
    id: u.id,
    name: u.name,
    dailyConsumptionKg: u.dailyConsumptionKg,
    shareOfFleetKg:
      totalDailyConsumptionKg > 0 ? u.dailyConsumptionKg / totalDailyConsumptionKg : 0,
    impliedDaysAtFleetBurnRate:
      dailyBurnTons > 0 && totalReserveTons >= 0
        ? totalReserveTons / ((u.dailyConsumptionKg / KG_PER_TON) || Number.EPSILON)
        : null,
  }));

  return {
    units,
    totalDailyConsumptionKg,
    totalReserveTons,
    aggregateDaysRemaining,
    forecastDays,
    shortfallTons,
    unitsAtRisk,
    reserveInsufficientForForecast,
    simulatedExcelSource,
  };
}
