// Panonun videosu: tarayıcının sekme kaydı (getDisplayMedia) + MediaRecorder.
// Sayfayı olduğu gibi kaydeder; animasyonlar ve tık sesi dahil. Tarayıcı her
// kayıttan önce izin sorar. Telefon tarayıcılarında sekme kaydı yoktur.

export const canRecord = () =>
  typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;

// Paylaşması kolay olduğu için önce MP4 denenir; desteklenmiyorsa WebM.
const FORMATS = [
  { mime: "video/mp4;codecs=avc1,mp4a.40.2", ext: "mp4" },
  { mime: "video/mp4", ext: "mp4" },
  { mime: "video/webm;codecs=vp9,opus", ext: "webm" },
  { mime: "video/webm", ext: "webm" },
];

/** Bu sekmenin görüntüsünü (ve varsa sesini) ister. Kullanıcı reddederse hata fırlatır. */
export function captureTab(): Promise<MediaStream> {
  // preferCurrentTab ve cursor henüz TypeScript tiplerinde yok: seçim
  // penceresinde bu sekmeyi öne alır ve fare imlecini videoya katmaz.
  const options = {
    video: { frameRate: 60, displaySurface: "browser", cursor: "never" },
    audio: true,
    preferCurrentTab: true,
    selfBrowserSurface: "include",
  } as DisplayMediaStreamOptions;
  return navigator.mediaDevices.getDisplayMedia(options);
}

export type Recording = {
  /** Kaydı bitirir ve dosyayı döndürür. */
  stop: () => Promise<{ blob: Blob; ext: string }>;
  /** Kullanıcı tarayıcının "paylaşımı durdur" düğmesine basarsa çözülür. */
  ended: Promise<void>;
};

export function startRecording(stream: MediaStream): Recording {
  const format = FORMATS.find((f) => MediaRecorder.isTypeSupported(f.mime));
  const recorder = new MediaRecorder(stream, {
    mimeType: format?.mime,
    videoBitsPerSecond: 8_000_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const done = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });
  const ended = new Promise<void>((resolve) => {
    stream.getVideoTracks()[0]?.addEventListener("ended", () => resolve());
  });
  recorder.start();

  return {
    ended,
    stop: async () => {
      if (recorder.state !== "inactive") recorder.stop();
      await done;
      stream.getTracks().forEach((t) => t.stop());
      return {
        blob: new Blob(chunks, { type: recorder.mimeType || format?.mime || "video/webm" }),
        ext: format?.ext ?? "webm",
      };
    },
  };
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const timestamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};
