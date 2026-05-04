import type { FoundationAugmentation } from "./types";
import type { SimulationCore } from "./simulation";

function extractJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
        return parsed && typeof parsed === "object" ? parsed : null;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeAugmentation(
  raw: Record<string, unknown> | null,
  fallback: FoundationAugmentation
): FoundationAugmentation {
  if (!raw) return fallback;
  const explanation =
    typeof raw.explanation === "string" && raw.explanation.trim()
      ? raw.explanation.trim()
      : fallback.explanation;
  let confidence = fallback.confidence;
  if (typeof raw.confidence === "number" && Number.isFinite(raw.confidence)) {
    confidence = Math.min(1, Math.max(0, raw.confidence));
  }
  let warnings: string[] = fallback.warnings;
  if (Array.isArray(raw.warnings)) {
    warnings = raw.warnings.filter((w): w is string => typeof w === "string" && w.trim().length > 0);
    if (warnings.length === 0) warnings = fallback.warnings;
  }
  return { explanation, confidence, warnings };
}

export function buildFallbackAugmentation(core: SimulationCore): FoundationAugmentation {
  const daysLabel =
    core.aggregateDaysRemaining != null
      ? `${core.aggregateDaysRemaining.toFixed(1)} сут.`
      : "не определено, пока расход не положительный";
  const horizonOk = !core.reserveInsufficientForForecast;
  const explanation = [
    `Парк суммарно потребляет около ${core.totalDailyConsumptionKg.toFixed(1)} кг/сут (${(core.totalDailyConsumptionKg / 1000).toFixed(3)} т/сут).`,
    `При остатке ${core.totalReserveTons.toFixed(2)} т линейное объединение даёт порядка ${daysLabel} запаса хода.`,
    horizonOk
      ? `При текущем линейном расходе запаса хватает на горизонт планирования ${core.forecastDays} сут.`
      : `Запаса не хватает на ${core.forecastDays} сут. примерно на ${core.shortfallTons.toFixed(3)} т.`,
  ].join(" ");
  const warnings: string[] = [
    "Прогноз основан на постоянном суточном расходе и одном общем складском пуле.",
    core.simulatedExcelSource
      ? "Расход по объектам взят из имитации строк таблицы; сверяйте с оперативными данными перед решениями."
      : "Значения по умолчанию на панели — иллюстрация до появления калиброванных каналов или импорта.",
  ];
  return {
    explanation,
    confidence: horizonOk ? 0.78 : 0.72,
    warnings,
  };
}

/**
 * Calls the configured foundation HTTP endpoint server-side (never expose keys to the browser).
 * Uses generic Anthropic-compatible Messages JSON when DEMO_FOUNDATION_PROVIDER implies anthropic.
 */
export async function augmentSimulationWithFoundation(
  core: SimulationCore
): Promise<FoundationAugmentation> {
  const fallback = buildFallbackAugmentation(core);
  const provider = (process.env.DEMO_FOUNDATION_PROVIDER || "").toLowerCase();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL;
  const providerAllowsAnthropic = !provider || provider === "anthropic";

  if (!apiKey || !model || !providerAllowsAnthropic) {
    return fallback;
  }

  const baseRaw = (process.env.ANTHROPIC_PROXY_URL || "https://api.anthropic.com").replace(/\/$/, "");
  const url = baseRaw.endsWith("/messages") ? baseRaw : `${baseRaw}/v1/messages`;

  const userPrompt = [
    "You support boiler coal inventory briefings for Russian-speaking operators.",
    "Given CONTEXT_JSON, emit ONLY JSON with keys:",
    "explanation (two short sentences in Russian for operators),",
    "confidence (number 0-1 reflecting certainty given linear assumptions),",
    "warnings (array of concise caveats; each string in Russian).",
    "Do not cite vendors, models, or training data.",
    "CONTEXT_JSON:",
    JSON.stringify(core),
  ].join(" ");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 750,
        temperature: 0.2,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!res.ok) {
      return {
        ...fallback,
        warnings: [...fallback.warnings, `Запрос к модели: HTTP ${res.status}; используется локальное описание.`],
      };
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const textBlock = data.content?.find((c) => c.type === "text");
    const rawObj = extractJsonObject(textBlock?.text || "");
    return normalizeAugmentation(rawObj, fallback);
  } catch {
    return {
      ...fallback,
      warnings: [...fallback.warnings, "Запрос к модели не выполнен; текст сформирован локально."],
    };
  }
}
