// Hava durumu: Open-Meteo (https://open-meteo.com). Ücretsiz, anahtar istemez
// ve tarayıcıdan doğrudan çağrılabilir.
// Konum otomatikken koordinatlar tarayıcının konum izniyle alınır; şehir adı
// için BigDataCloud'un istemci tarafı ücretsiz servisine koordinat gönderilir.
// Şehir elle seçildiyse yalnızca şehir adı gönderilir.

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

/** Koordinatın şehir adı; bulunamazsa boş metin. */
export async function placeName(
  latitude: number,
  longitude: number,
  language: string,
  signal?: AbortSignal,
): Promise<string> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    localityLanguage: language,
  });
  const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`, {
    signal,
  });
  if (!res.ok) return "";
  const data = await res.json();
  return data.city || data.locality || data.principalSubdivision || "";
}

/** Tarayıcıdan konum ister (ilk seferde izin sorulur). */
export function currentPosition(): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("Konum desteklenmiyor"));
    navigator.geolocation.getCurrentPosition((p) => resolve(p.coords), reject, {
      maximumAge: 60 * 60 * 1000,
      timeout: 20_000,
    });
  });
}
