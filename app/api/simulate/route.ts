import { NextResponse } from "next/server";
import { augmentSimulationWithFoundation } from "@/lib/foundation";
import { runLinearSimulation } from "@/lib/simulation";
import type { SimulateApiResponse, SimulateRequestBody } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: SimulateRequestBody;
  try {
    body = (await req.json()) as SimulateRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const core = runLinearSimulation(body);
  const augmentation = await augmentSimulationWithFoundation(core);

  const payload: SimulateApiResponse = {
    result: {
      units: core.units,
      totalDailyConsumptionKg: core.totalDailyConsumptionKg,
      totalReserveTons: core.totalReserveTons,
      aggregateDaysRemaining: core.aggregateDaysRemaining,
      forecastDays: core.forecastDays,
      shortfallTons: core.shortfallTons,
      unitsAtRisk: core.unitsAtRisk,
      reserveInsufficientForForecast: core.reserveInsufficientForForecast,
      simulatedExcelSource: core.simulatedExcelSource,
    },
    confidence: augmentation.confidence,
    explanation: augmentation.explanation,
    warnings: augmentation.warnings,
  };

  return NextResponse.json(payload);
}
