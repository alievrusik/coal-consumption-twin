# Laplace prototype standards

These rules apply to Laplace-generated demo repositories such as this coal consumption twin.

## Security

- Never expose foundation credentials, proxy secrets, or signing keys to client bundles or public environment prefixes (`NEXT_PUBLIC_*`) unless explicitly required and reviewed.
- Keep simulation and model orchestration in Route Handlers or server actions; the UI consumes HTTP JSON only.

## Product copy

- Avoid naming specific foundation vendors or model brands in user-visible strings; describe capabilities generically (“server outlook”, “automated briefing”).
- Prefer concise operator language over research jargon.

## Architecture

- Prefer deterministic cores for numeric outputs; use foundation models for explanation, classification language, or hypothetical parsing—as long as numerical truth remains inspectable.
- Return structured JSON (`result`, `confidence`, `explanation`, `warnings`) from prototype APIs whenever feasible.
- Document environment variables generically in README (`DEMO_FOUNDATION_PROVIDER`, provider credentials, optional proxy base).

## Dependencies

- Stay on conservative Next.js/React ranges compatible with Vercel defaults.
- Avoid experimental bundlers or heavy UI kits unless the brief demands them; small CSS-first layouts are welcome.

## Deliverables hygiene

- Maintain `README.md` (setup + deployment), `prototype.md` (summary + limitations), and this rule file for consistency across Laplace outputs.
- Do not commit secrets; Laplace orchestration handles git pushes after local verification (`npm run build`).
