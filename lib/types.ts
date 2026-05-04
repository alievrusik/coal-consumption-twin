import type { BoilerUnitSnapshot } from "./simulation";

/** API response shape returned to the dashboard */
export type SimulateApiResponse = {
  result: {
    units: BoilerUnitSnapshot[];
    totalDailyConsumptionKg: number;
    totalReserveTons: number;
    /** Shared-pool linear forecast: reserve / (sum daily kg converted to tons/day) */
    aggregateDaysRemaining: number | null;
    forecastDays: number;
    /** Tons short vs linear forecast over forecastDays (0 if sufficient) */
    shortfallTons: number;
    /** IDs of units flagged relative to fleet average when inventory stress exists */
    unitsAtRisk: string[];
    reserveInsufficientForForecast: boolean;
    simulatedExcelSource: boolean;
  };
  confidence: number;
  explanation: string;
  warnings: string[];
};

/** Optional payload mimicking rows imported from a workbook */
export type SimulatedExcelRow = {
  unitId: string;
  dailyConsumptionKg: number;
};

export type SimulateRequestBody = {
  /** Total shared reserve across all boiler houses (tons) */
  totalReserveTons: number;
  /** Planning horizon for sufficiency check (days) */
  forecastDays: number;
  /** Per-unit daily consumption (kg). Omit for defaults. */
  units?: { id: string; name: string; dailyConsumptionKg: number }[];
  /** When present, overrides unit kg values as if parsed from a workbook */
  simulatedExcelRows?: SimulatedExcelRow[];
};

export type FoundationAugmentation = {
  explanation: string;
  confidence: number;
  warnings: string[];
};
