// Yaprak düşüşü için kısa bir "tık" sesi. Tarayıcılar sesi ancak kullanıcı
// etkileşiminden sonra açtığı için setSound(true) bir tıklama içinde çağrılmalı.

let on = false;
let ctx: AudioContext | null = null;
let buf: AudioBuffer | null = null;
let last = 0;

export function setSound(enabled: boolean) {
  on = enabled;
  if (!enabled) return;
  if (!ctx) {
    ctx = new AudioContext();
    const n = Math.floor(ctx.sampleRate * 0.02);
    buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    }
  }
  void ctx.resume();
}

export function tick() {
  if (!on || !ctx || !buf) return;
  const t = performance.now();
  if (t - last < 28) return; // yüzlerce hücre aynı anda dönerken boğulmasın
  last = t;
  const src = ctx.createBufferSource();
  const bp = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  src.buffer = buf;
  src.playbackRate.value = 0.8 + Math.random() * 0.5;
  bp.type = "bandpass";
  bp.frequency.value = 2200;
  bp.Q.value = 0.8;
  gain.gain.value = 0.16;
  src.connect(bp).connect(gain).connect(ctx.destination);
  src.start();
}
