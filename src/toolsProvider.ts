import { tool, type ToolsProvider } from "@lmstudio/sdk";
import { z } from "zod";

import { buildConfigSchematics } from "./configSchematics.js";
import { geocode, getWeather, type GeoResult, type WeatherData } from "./weatherApi.js";

const configSchematics = buildConfigSchematics();

// ---------------------------------------------------------------------------
// Tools provider
// ---------------------------------------------------------------------------

export const toolsProvider: ToolsProvider = async (ctl) => {
  const config = ctl.getPluginConfig(configSchematics);
  const units: string = config.get("units");
  const defaultCity: string = config.get("defaultCity");

  const weatherTool = tool({
    name: "get_weather",
    description: [
      "Get current weather and forecast for any city or coordinates.",
      "Uses Open-Meteo (free, no API key). Returns temperature, conditions, wind, humidity.",
      'Examples: "Tokyo", "London, UK", "48.85,2.35"',
    ].join(" "),
    parameters: {
      location: z
        .string()
        .optional()
        .describe(
          `City name, "City, Country", or "lat,lon" coordinates. ` +
            (defaultCity
              ? `Default: "${defaultCity}"`
              : "Required if no default city configured."),
        ),
      days: z
        .number()
        .min(0)
        .max(7)
        .optional()
        .describe("Forecast days (0 = current only, default 3)"),
    },
    async implementation({ location, days }) {
      const loc = location?.trim() || defaultCity?.trim();
      if (!loc) {
        return [
          "No location provided and no default city configured.",
          'Use "City Name", "City, Country", or "lat,lon" format.',
        ].join("\n");
      }

      try {
        // --- Geocode --------------------------------------------------------
        let geo: GeoResult;
        const coords = loc.split(",").map((s) => parseFloat(s.trim()));

        if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
          geo = { latitude: coords[0], longitude: coords[1], displayName: loc };
        } else {
          const geoResults = await geocode(loc);
          if (geoResults.length === 0) {
            return `Location not found: "${loc}". Try "City, Country" format or coordinates.`;
          }
          geo = geoResults[0];
        }

        // --- Fetch weather --------------------------------------------------
        const forecastDays = days ?? 3;
        const tempUnit = units === "fahrenheit" ? "fahrenheit" : "celsius";
        const weather = await getWeather(geo.latitude, geo.longitude, tempUnit, forecastDays);

        return formatWeather(geo.displayName, weather, tempUnit);
      } catch (err) {
        return `Weather error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  return [weatherTool];
};

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function formatWeather(location: string, w: WeatherData, tempUnit: string): string {
  const deg = tempUnit === "fahrenheit" ? "°F" : "°C";
  const lines: string[] = [];

  lines.push(`Weather for ${location}`);
  lines.push(`Current: ${w.current.temp}${deg}, ${w.current.condition}`);
  lines.push(`Feels like: ${w.current.feelsLike}${deg}`);
  lines.push(`Humidity: ${w.current.humidity}%`);
  lines.push(`Wind: ${w.current.windSpeed} km/h ${w.current.windDir}`);

  if (w.forecast.length > 0) {
    lines.push("");
    lines.push("Forecast:");
    for (const day of w.forecast) {
      lines.push(
        `  ${day.date}: ${day.high}${deg}/${day.low}${deg} — ${day.condition}`,
      );
    }
  }

  return lines.join("\n");
}
