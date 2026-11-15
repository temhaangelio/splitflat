// Arayüz ve pano metinleri. Pano yalnızca büyük harf gösterir; pano metinleri
// bu yüzden doğrudan büyük harfle yazılır.

/** Panoda, PNG çıktısında ve sayfa altlarında görünen marka yazısı. */
export const BRAND = "SPLITFLAT.SITE";

export type Lang = "tr" | "en";
export const LANGS: { value: Lang; label: string }[] = [
  { value: "tr", label: "TÜRKÇE" },
  { value: "en", label: "ENGLISH" },
];

/** Tarayıcının diline göre varsayılan: Türkçe tarayıcıda Türkçe, aksi halde İngilizce. */
export const browserLang = (): Lang =>
  navigator.language?.toLowerCase().startsWith("tr") ? "tr" : "en";

/** Büyük harfe çevirme dile göre farklıdır: Türkçede i → İ, İngilizcede i → I. */
export const locale = (lang: Lang) => (lang === "tr" ? "tr-TR" : "en-US");
export const upper = (s: string, lang: Lang) => s.toLocaleUpperCase(locale(lang));

export const STRINGS = {
  tr: {
    title: "Split-Flap Ev Panosu",
    // pano
    // Panoda gösterilecek başka bir şey yokken sırayla dönen tanıtım notları.
    // Satırlar elle bölünür ki kelimeler ortasından kırılmasın. En küçük pano
    // (10 sütun, 4 satır) için ayrı, daha kısa bir takım var.
    intro: (cols: number, rows: number): string[][] =>
      cols < 12 || rows < 5
        ? [
            ["SPLITFLAT", "NOT EKLE", "ENTER'A BAS"],
            ["HER ŞEY", "AYARLARDA", "DİŞLİYE", "DOKUNUN"],
            ["SAAT VE", "HAVA DURUMU", "EKLEYİN"],
            ["NOTLARINIZ", "SIRAYLA", "DÖNER"],
            ["PANOYU PNG", "OLARAK", "KAYDEDİN"],
            ["TAM EKRAN", "YAPIP", "DUVARA ASIN"],
          ]
        : [
            ["SPLITFLAT'E", "HOŞ GELDİNİZ", "", "NOT EKLE VE", "ENTER'A BAS"],
            ["AYARLAR İÇİN", "DİŞLİ", "SİMGESİNE", "DOKUNUN"],
            ["SAAT, TARİH", "VE HAVA", "DURUMUNU", "AYARLARDAN", "AÇIN"],
            ["BİRDEN ÇOK", "NOT EKLEYİN", "", "SIRAYLA", "DÖNSÜNLER"],
            ["PANOYU PNG", "OLARAK", "KAYDEDİN"],
            ["TAM EKRAN", "YAPIN VE", "DUVARA ASIN"],
          ],
    days: ["PAZAR", "PAZARTESİ", "SALI", "ÇARŞAMBA", "PERŞEMBE", "CUMA", "CUMARTESİ"],
    months: [
      "OCAK", "ŞUBAT", "MART", "NİSAN", "MAYIS", "HAZİRAN",
      "TEMMUZ", "AĞUSTOS", "EYLÜL", "EKİM", "KASIM", "ARALIK",
    ],
    weatherTitle: "HAVA DURUMU",
    weatherLoading: "YÜKLENİYOR",
    weatherFailed: "ALINAMADI",
    newYear: "YENİ YIL",
    dayOne: "GÜN",
    dayMany: "GÜN",
    countdownDone: "ZAMAN DOLDU",
    seconds: "SN",
    minutes: "DK",
    // şerit ve not listesi
    board: "Split-flap pano",
    newNote: "Yeni not",
    notePlaceholder: "Not ekle, Enter'a bas…",
    clearDraft: "Yazılanı temizle",
    addNote: "Notu ekle",
    addNoteTitle: "Notu ekle (Enter)",
    noteList: "Not listesi",
    deleteNote: "Notu sil",
    notesHeading: "NOTLAR",
    rotatesEvery: (interval: string) => `${interval} ARAYLA DÖNER`,
    noNotes: "Henüz not yok. Aşağıya yazıp Enter'a bas.",
    settings: "Ayarlar",
    fullscreen: "Tam ekran",
    exitFullscreen: "Tam ekrandan çık",
    // ayarlar
    settingsTitle: "AYARLAR",
    about: "Hakkında",
    close: "Kapat",
    language: "DİL",
    sound: "SES",
    wall: "DUVAR ARKA PLANI",
    cellCount: "HÜCRE SAYISI",
    cellsAria: (cols: number, rows: number) => `${cols} sütun, ${rows} satır`,
    showOnBoard: "PANODA GÖSTER",
    boardSection: "PANO",
    notes: "NOTLAR",
    clock: "SAAT VE TARİH",
    showSeconds: "SANİYE",
    weather: "HAVA DURUMU",
    countdown: "GERİ SAYIM",
    countdownTitle: "Başlık",
    countdownDate: "Hedef tarih ve saat",
    location: "Konum",
    myLocation: "KONUMUM",
    chooseCity: "ŞEHİR SEÇ",
    city: "Şehir",
    save: "KAYDET",
    locationError: "Konum alınamadı. Tarayıcıda konum izni ver ya da şehir seç.",
    cityError: "Hava durumu alınamadı. Şehir adını kontrol et.",
    interval: "GEÇİŞ SÜRESİ",
    // telefondan kontrol
    remoteSection: "TELEFONDAN KONTROL",
    remoteToggle: "TELEFONDAN KONTROL",
    remoteHelp:
      "Telefonunuzla kodu okutun, panoya oradan not gönderin. Kodu ya da bağlantıyı bilen herkes bu panoya yazabilir; yalnızca güvendiğiniz kişilerle paylaşın.",
    remotePair: "TELEFON EŞLEŞTİR",
    remoteHide: "KODU GİZLE",
    remoteCopy: "BAĞLANTIYI KOPYALA",
    remoteCopied: "KOPYALANDI",
    remoteRotate: "BAĞLANTIYI YENİLE",
    remoteRotateConfirm:
      "Bağlantı yenilenecek ve eski kod geçersiz olacak. Eşleşmiş telefonların yeniden eşleştirilmesi gerekir. Devam edilsin mi?",
    remoteQrAlt: "Telefon eşleştirme kodu",
    remoteUnavailable: "Bu özellik sunucuda henüz ayarlanmamış.",
    remoteError: "Sunucuya ulaşılamadı. Pano çalışmaya devam ediyor; bağlantı gelince eşitlenecek.",
    remoteLost: "Bu pano sunucuda bulunamadı. Özelliği kapatıp yeniden açın.",
    // telefon sayfası
    phoneTitle: "Pano kumandası",
    phoneNotPaired:
      "Bu telefon bir panoyla eşleşmemiş. Panoda Ayarlar → Telefondan kontrol → Telefon eşleştir deyip çıkan kodu okutun.",
    phoneGone:
      "Bu pano artık yok ya da bağlantısı yenilenmiş. Panodaki yeni kodu okutun.",
    phoneOffline: "Sunucuya ulaşılamadı. Yeniden deneniyor…",
    phoneLoading: "Pano yükleniyor…",
    phoneAdd: "EKLE",
    phoneTooLong: "Bu not panoya sığmıyor.",
    phoneFull: "Liste dolu. Yeni not için birini silin.",
    phoneSent: "Panoya gönderildi",
    phoneForget: "BU TELEFONU UNUT",
    phoneForgetConfirm: "Bu telefonun panoyla eşleşmesi kaldırılsın mı?",
    downloadPng: "PNG olarak kaydet",
    recordVideo: "Video kaydet",
  },
  en: {
    title: "Split-Flap Home Board",
    intro: (cols: number, rows: number): string[][] =>
      cols < 12 || rows < 5
        ? [
            ["SPLITFLAT", "ADD A NOTE", "PRESS ENTER"],
            ["TAP THE", "GEAR FOR", "SETTINGS"],
            ["ADD TIME", "AND", "WEATHER"],
            ["YOUR NOTES", "ROTATE"],
            ["SAVE THE", "BOARD AS", "A PNG"],
            ["GO FULL", "SCREEN AND", "HANG IT UP"],
          ]
        : [
            ["WELCOME TO", "SPLITFLAT", "", "ADD A NOTE", "PRESS ENTER"],
            ["TAP THE GEAR", "TO OPEN", "SETTINGS"],
            ["TURN ON TIME", "DATE AND", "WEATHER IN", "SETTINGS"],
            ["ADD SEVERAL", "NOTES AND", "THEY ROTATE"],
            ["SAVE THE", "BOARD AS", "A PNG"],
            ["GO FULL", "SCREEN AND", "HANG IT UP"],
          ],
    days: ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"],
    months: [
      "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
      "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
    ],
    weatherTitle: "WEATHER",
    weatherLoading: "LOADING",
    weatherFailed: "UNAVAILABLE",
    newYear: "NEW YEAR",
    dayOne: "DAY",
    dayMany: "DAYS",
    countdownDone: "TIME IS UP",
    seconds: "SEC",
    minutes: "MIN",
    board: "Split-flap board",
    newNote: "New note",
    notePlaceholder: "Add a note, press Enter…",
    clearDraft: "Clear text",
    addNote: "Add note",
    addNoteTitle: "Add note (Enter)",
    noteList: "Note list",
    deleteNote: "Delete note",
    notesHeading: "NOTES",
    rotatesEvery: (interval: string) => `ROTATES EVERY ${interval}`,
    noNotes: "No notes yet. Type one below and press Enter.",
    settings: "Settings",
    fullscreen: "Full screen",
    exitFullscreen: "Exit full screen",
    settingsTitle: "SETTINGS",
    about: "About",
    close: "Close",
    language: "LANGUAGE",
    sound: "SOUND",
    wall: "WALL BACKGROUND",
    cellCount: "BOARD SIZE",
    cellsAria: (cols: number, rows: number) => `${cols} columns, ${rows} rows`,
    showOnBoard: "SHOW ON BOARD",
    boardSection: "BOARD",
    notes: "NOTES",
    clock: "TIME AND DATE",
    showSeconds: "SECONDS",
    weather: "WEATHER",
    countdown: "COUNTDOWN",
    countdownTitle: "Title",
    countdownDate: "Target date and time",
    location: "Location",
    myLocation: "MY LOCATION",
    chooseCity: "CHOOSE CITY",
    city: "City",
    save: "SAVE",
    locationError: "Couldn't get your location. Allow location access or choose a city.",
    cityError: "Couldn't get the weather. Check the city name.",
    interval: "ROTATION INTERVAL",
    remoteSection: "PHONE CONTROL",
    remoteToggle: "PHONE CONTROL",
    remoteHelp:
      "Scan the code with your phone and send notes to the board from there. Anyone with the code or link can write to this board; share it only with people you trust.",
    remotePair: "PAIR A PHONE",
    remoteHide: "HIDE CODE",
    remoteCopy: "COPY LINK",
    remoteCopied: "COPIED",
    remoteRotate: "RESET LINK",
    remoteRotateConfirm:
      "The link will be reset and the old code will stop working. Paired phones will need to be paired again. Continue?",
    remoteQrAlt: "Phone pairing code",
    remoteUnavailable: "This feature isn't set up on the server yet.",
    remoteError: "Couldn't reach the server. The board keeps working and will sync when it's back.",
    remoteLost: "This board wasn't found on the server. Turn the feature off and on again.",
    phoneTitle: "Board remote",
    phoneNotPaired:
      "This phone isn't paired with a board. On the board, open Settings → Phone control → Pair a phone and scan the code.",
    phoneGone: "This board no longer exists or its link was reset. Scan the new code on the board.",
    phoneOffline: "Couldn't reach the server. Retrying…",
    phoneLoading: "Loading the board…",
    phoneAdd: "ADD",
    phoneTooLong: "This note doesn't fit on the board.",
    phoneFull: "The list is full. Delete a note to add a new one.",
    phoneSent: "Sent to the board",
    phoneForget: "FORGET THIS PHONE",
    phoneForgetConfirm: "Unpair this phone from the board?",
    downloadPng: "Save as PNG",
    recordVideo: "Record video",
  },
} satisfies Record<Lang, unknown>;

export type Strings = (typeof STRINGS)["tr"];

/** WMO hava kodlarının panoya sığan kısa karşılıkları. */
const WEATHER: Record<Lang, string[]> = {
  // açık, az bulutlu, kapalı, sisli, çiselti, yağmur, kar, sağanak, kar sağanağı, fırtına
  tr: ["AÇIK", "AZ BULUTLU", "KAPALI", "SİSLİ", "ÇİSELTİ", "YAĞMURLU", "KARLI", "SAĞANAK", "KAR SAĞANAĞI", "GÖK GÜRÜLTÜ"],
  en: ["CLEAR", "PARTLY CLOUDY", "OVERCAST", "FOGGY", "DRIZZLE", "RAIN", "SNOW", "SHOWERS", "SNOW SHOWERS", "THUNDERSTORM"],
};

export function describeWeather(code: number, lang: Lang): string {
  const w = WEATHER[lang];
  if (code === 0) return w[0];
  if (code <= 2) return w[1];
  if (code === 3) return w[2];
  if (code <= 48) return w[3];
  if (code <= 57) return w[4];
  if (code <= 67) return w[5];
  if (code <= 77) return w[6];
  if (code <= 82) return w[7];
  if (code <= 86) return w[8];
  return w[9];
}
