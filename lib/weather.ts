// Hava durumu: Open-Meteo (https://open-meteo.com). Ücretsiz, anahtar istemez
// ve tarayıcıdan doğrudan çağrılabilir. Yalnızca telefondan seçilen şehrin adı
// gönderilir; cihazın konumu kullanılmaz.

export type Weather = {
  city: string;
  temp: number;
  max: number;
  min: number;
  code: number;
};

export async function fetchWeatherAt(
  latitude: number,
  longitude: number,
  city: string,
  signal?: AbortSignal,
): Promise<Weather> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,weather_code",
    daily: "temperature_2m_max,temperature_2m_min",
    timezone: "auto",
    forecast_days: "1",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal });
  if (!res.ok) throw new Error("Hava durumu alınamadı");
  const data = await res.json();
  return {
    city,
    temp: Math.round(data.current.temperature_2m),
    code: data.current.weather_code,
    max: Math.round(data.daily.temperature_2m_max[0]),
    min: Math.round(data.daily.temperature_2m_min[0]),
  };
}

/** Şehir adından hava durumu. */
export async function fetchWeather(
  city: string,
  language: string,
  signal?: AbortSignal,
): Promise<Weather> {
  const geo = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?count=1&language=${language}&name=${encodeURIComponent(city)}`,
    { signal },
  ).then((r) => r.json());
  const place = geo?.results?.[0];
  if (!place) throw new Error("Şehir bulunamadı");
  return fetchWeatherAt(place.latitude, place.longitude, place.name, signal);
}
