// ---------------------------------------------------------------------------
// Open-Meteo API — free, no API key required
// ---------------------------------------------------------------------------

export interface GeoResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

export interface CurrentWeather {
  temp: number;
  feelsLike: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  windDir: string;
}

export interface ForecastDay {
  date: string;
  high: number;
  low: number;
  condition: string;
}

export interface WeatherData {
  current: CurrentWeather;
  forecast: ForecastDay[];
}

// ---------------------------------------------------------------------------
// Geocoding (Open-Meteo)
// ---------------------------------------------------------------------------

export async function geocode(query: string): Promise<GeoResult[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Geocoding HTTP ${res.status}`);

  const data = (await res.json()) as {
    results?: { latitude: number; longitude: number; name: string; country?: string }[];
  };

  return (data.results ?? []).map((r) => ({
    latitude: r.latitude,
    longitude: r.longitude,
    displayName: r.country ? `${r.name}, ${r.country}` : r.name,
  }));
}

// ---------------------------------------------------------------------------
// Weather (Open-Meteo)
// ---------------------------------------------------------------------------

const WMO_CODES: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

function windDir(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

export async function getWeather(
  lat: number,
  lon: number,
  tempUnit: string,
  forecastDays: number,
): Promise<WeatherData> {
  const tempParam = tempUnit === "fahrenheit" ? "fahrenheit" : "celsius";
  const url = [
    `https://api.open-meteo.com/v1/forecast?`,
    `latitude=${lat}&longitude=${lon}`,
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m`,
    `&daily=temperature_2m_max,temperature_2m_min,weather_code`,
    `&forecast_days=${Math.max(1, forecastDays)}`,
    `&temperature_unit=${tempParam}`,
  ].join("");

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Weather API HTTP ${res.status}`);

  const data = (await res.json()) as {
    current: {
      temperature_2m: number;
      relative_humidity_2m: number;
      apparent_temperature: number;
      weather_code: number;
      wind_speed_10m: number;
      wind_direction_10m: number;
    };
    daily: {
      time: string[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      weather_code: number[];
    };
  };

  const current = {
    temp: data.current.temperature_2m,
    feelsLike: data.current.apparent_temperature,
    condition: WMO_CODES[data.current.weather_code] ?? `Code ${data.current.weather_code}`,
    humidity: data.current.relative_humidity_2m,
    windSpeed: data.current.wind_speed_10m,
    windDir: windDir(data.current.wind_direction_10m),
  };

  const forecast: ForecastDay[] = [];
  for (let i = 0; i < data.daily.time.length; i++) {
    forecast.push({
      date: data.daily.time[i],
      high: data.daily.temperature_2m_max[i],
      low: data.daily.temperature_2m_min[i],
      condition: WMO_CODES[data.daily.weather_code[i]] ?? `Code ${data.daily.weather_code[i]}`,
    });
  }

  return { current, forecast };
}
