# lmstudio-weather

Current conditions and forecast for a city or coordinates via Open-Meteo.

| | |
|---|---|
| Type | tools |
| Tools | 1 |
| Requires network | yes |
| Requires external service | no |
| Destructive | no |
| Version | 1.0.0 |

## Tools

| Tool | What it does |
|---|---|
| `get_weather` | Current conditions and short forecast |

## Requirements

| Requirement | Detail |
|---|---|
| Network | Open-Meteo; no key required |

## Configuration

`units`, `defaultCity`.

Configured in LM Studio under Integrations → lmstudio-weather; field definitions live in `src/configSchematics.ts`.

## Privileged surface

Sends the requested location to a third-party API. No key, no account.

## Failure modes

| Symptom | Cause |
|---|---|
| City not found | Use coordinates for ambiguous names |

## Example prompts

- "What's the weather in Chiang Mai?"
- "Will it rain here tomorrow?"

## Development

```bash
npm install    # also runs `lms dev --install`
npm run build  # tsc
node scripts/smoke.mjs   # from the suite root
```

## Status

| Item | State |
|---|---|
| Compiles | yes — verified with `tsc --noEmit` against the current toolchain |
| Tests | smoke harness: manifest validation + tool inventory |
| Verified against | LM Studio 0.4.28 |
| Known gaps | no behavioural tests; docs written from source review |

## License

MIT
