// Pano ve telefon sayfasının metinleri. Pano yalnızca büyük harf gösterir; pano
// metinleri bu yüzden doğrudan büyük harfle yazılır.

/** Uygulamanın adı; logo ve sayfa altlarında görünür. */
export const BRAND = "SPLIT FLAP";

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
    title: "Split Flap",

    /* ----- pano ----- */
    board: "Split-flap pano",
    // Gösterilecek başka bir şey yokken sırayla dönen tanıtım notları. Satırlar
    // elle bölünür ki kelimeler ortasından kırılmasın (pano 12 sütun, 5 satır).
    intro: [
      ["SPLIT FLAP", "", "HOŞ GELDİNİZ"],
      ["TELEFONDAN", "NOT GÖNDERİN"],
      ["SAAT, TARİH", "VE HAVA", "DURUMUNU", "TELEFONDAN", "AÇIN"],
      ["GERİ SAYIM", "BAŞLATIN"],
      ["BİRDEN ÇOK", "NOT EKLEYİN", "", "SIRAYLA", "DÖNSÜNLER"],
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

    /* ----- panodaki eşleştirme ekranı ----- */
    pairQrAlt: "Telefon eşleştirme kodu",
    pairTitle: "Telefonunuzla okutun",
    pairText:
      "Kameranızı koda tutun. Açılan sayfadan panoya not gönderir, saati, hava durumunu ve geri sayımı açarsınız.",
    pairOffline: "Pano sunucusuna ulaşılamıyor. Raspberry Pi'deki splitflat servisi çalışıyor mu?",
    // eşleşmiş panoda, açılışta ya da dokununca kısa süre görünen kod
    pairMoreTitle: "Telefon eklemek için okutun",
    pairMoreText:
      "Bu kod birazdan kaybolur. Eşleşmiş telefonlar etkilenmez; yeniden görmek için panoyu kapatıp açın ya da ekrana dokunun.",
    pairUnavailableTitle: "Telefon bağlantısı hazır değil",
    pairUnavailable:
      "Bu sitede telefon bağlantısı için gereken sunucu deposu henüz kurulmamış. Kurulunca burada bir eşleştirme kodu görünecek.",

    /* ----- telefon sayfası ----- */
    phoneTitle: "Pano kumandası",
    about: "Hakkında",
    phoneLoading: "Pano yükleniyor…",
    phoneNotPaired:
      "Bu telefon bir panoyla eşleşmemiş. Panonun ekranındaki kodu telefonunuzun kamerasıyla okutun.",
    phoneGone:
      "Bu pano artık yok ya da eşleşmesi sıfırlanmış. Panonun ekranındaki yeni kodu okutun.",
    phoneOffline: "Panoya ulaşılamadı. Telefon evin WiFi ağında mı? Yeniden deneniyor…",
    phoneSent: "Panoya gönderildi",
    newNote: "Yeni not",
    phoneAdd: "EKLE",
    phoneTooLong: "Bu not panoya sığmıyor.",
    phoneFull: "Liste dolu. Yeni not için birini silin.",
    notesHeading: "NOTLAR",
    noNotes: "Henüz not yok. Yukarıya yazıp Ekle'ye basın.",
    deleteNote: "Notu sil",

    showOnBoard: "PANODA GÖSTER",
    notes: "NOTLAR",
    clock: "SAAT VE TARİH",
    showSeconds: "SANİYE",
    countdown: "GERİ SAYIM",
    countdownTitle: "Başlık",
    countdownDate: "Hedef tarih ve saat",
    weather: "HAVA DURUMU",
    city: "Şehir",
    interval: "GEÇİŞ SÜRESİ",
    seconds: "SN",
    minutes: "DK",

    general: "GENEL",
    sound: "KART SESİ",
    boardLanguage: "PANO DİLİ",

    pairing: "EŞLEŞME",
    shareHelp:
      "Başka bir telefonu eklemek için bu bağlantıyı gönderin. Bağlantıyı bilen herkes panoya yazabilir; yalnızca güvendiğiniz kişilerle paylaşın.",
    shareLink: "BAĞLANTIYI KOPYALA",
    shareCopied: "KOPYALANDI",
    resetPairing: "EŞLEŞMEYİ SIFIRLA",
    resetConfirm:
      "Tüm telefonların eşleşmesi kaldırılacak ve panoda yeni bir kod görünecek. Notlarınız panoda kalır. Devam edilsin mi?",
    phoneForget: "BU TELEFONU UNUT",
    phoneForgetConfirm: "Bu telefonun panoyla eşleşmesi kaldırılsın mı?",

    /* ----- internet kurulumu ----- */
    wifiTitle: "İnternete bağlayalım",
    wifiStep1: "Telefonunuzla okutun ve bu ağa bağlanın",
    wifiStep2: "Sonra bunu okutun ve evinizin WiFi ağını seçin",
    wifiNetwork: "Ağ",
    wifiPassword: "Şifre",
    wifiConnecting: (ssid: string) => `${ssid} ağına bağlanılıyor…`,
    wifiConnectingHint: "Bu bir dakika kadar sürebilir.",
    wifiErrors: {
      wrong_password: "Bağlanılamadı: şifre yanlış olabilir. Telefonla tekrar deneyin.",
      not_found: "Bağlanılamadı: ağ bulunamadı. Ağın 2,4 GHz olduğundan emin olun.",
      no_address: "Ağa girildi ama ağ panoya adres vermedi. Kurum ağlarında cihazın kaydı gerekebilir.",
      failed: "Bağlanılamadı. Telefonla tekrar deneyin.",
    },
    setupTitle: "İnternet kurulumu",
    setupIntro: "Panonun bağlanacağı WiFi ağını seçin. Pano yalnızca 2,4 GHz ağları görebilir.",
    setupOther: "Listede olmayan bir ağ",
    setupOtherName: "Ağ adı",
    setupNoNetworks: "Ağ bulunamadı. Aşağıya ağın adını yazabilirsiniz.",
    setupOpen: "şifresiz",
    setupConnect: "BAĞLAN",
    setupPasswordShort: "WiFi şifresi en az 8 karakter olmalı.",
    setupSent:
      "Pano bağlanmaya çalışıyor. Telefonunuz kurulum ağından düşecek; sonucu panonun ekranından görün. Bağlanamazsa kurulum ağı yeniden açılır, tekrar bağlanıp deneyebilirsiniz.",
    setupDone: "Pano internete bağlı. Bu sayfayı kapatabilirsiniz.",
    setupUnavailable: "Pano şu anda kurulum modunda değil.",
    setupFailed: "İstek gönderilemedi. Kurulum ağına bağlı olduğunuzdan emin olun.",
  },
  en: {
    title: "Split Flap",

    board: "Split-flap board",
    intro: [
      ["WELCOME TO", "SPLIT FLAP"],
      ["SEND NOTES", "FROM YOUR", "PHONE"],
      ["TURN ON TIME", "DATE AND", "WEATHER", "FROM YOUR", "PHONE"],
      ["START A", "COUNTDOWN"],
      ["ADD SEVERAL", "NOTES AND", "THEY ROTATE"],
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

    pairQrAlt: "Phone pairing code",
    pairTitle: "Scan with your phone",
    pairText:
      "Point your camera at the code. From the page that opens you can send notes to the board and turn on the time, weather and countdown.",
    pairOffline: "Can't reach the board server. Is the splitflat service running on the Raspberry Pi?",
    pairMoreTitle: "Scan to add a phone",
    pairMoreText:
      "This code disappears shortly. Paired phones aren't affected; to see it again, restart the board or touch the screen.",
    pairUnavailableTitle: "Phone link isn't ready",
    pairUnavailable:
      "The server storage needed for the phone link hasn't been set up on this site yet. A pairing code will appear here once it is.",

    phoneTitle: "Board remote",
    about: "About",
    phoneLoading: "Loading the board…",
    phoneNotPaired:
      "This phone isn't paired with a board. Scan the code on the board's screen with your phone's camera.",
    phoneGone:
      "This board no longer exists or its pairing was reset. Scan the new code on the board's screen.",
    phoneOffline: "Couldn't reach the board. Is the phone on your home WiFi? Retrying…",
    phoneSent: "Sent to the board",
    newNote: "New note",
    phoneAdd: "ADD",
    phoneTooLong: "This note doesn't fit on the board.",
    phoneFull: "The list is full. Delete a note to add a new one.",
    notesHeading: "NOTES",
    noNotes: "No notes yet. Type one above and press Add.",
    deleteNote: "Delete note",

    showOnBoard: "SHOW ON BOARD",
    notes: "NOTES",
    clock: "TIME AND DATE",
    showSeconds: "SECONDS",
    countdown: "COUNTDOWN",
    countdownTitle: "Title",
    countdownDate: "Target date and time",
    weather: "WEATHER",
    city: "City",
    interval: "ROTATION INTERVAL",
    seconds: "SEC",
    minutes: "MIN",

    general: "GENERAL",
    sound: "CARD SOUND",
    boardLanguage: "BOARD LANGUAGE",

    pairing: "PAIRING",
    shareHelp:
      "To add another phone, send it this link. Anyone with the link can write to the board; share it only with people you trust.",
    shareLink: "COPY LINK",
    shareCopied: "COPIED",
    resetPairing: "RESET PAIRING",
    resetConfirm:
      "Every phone will be unpaired and the board will show a new code. Your notes stay on the board. Continue?",
    phoneForget: "FORGET THIS PHONE",
    phoneForgetConfirm: "Unpair this phone from the board?",

    wifiTitle: "Let's get online",
    wifiStep1: "Scan with your phone and join this network",
    wifiStep2: "Then scan this and choose your home WiFi",
    wifiNetwork: "Network",
    wifiPassword: "Password",
    wifiConnecting: (ssid: string) => `Connecting to ${ssid}…`,
    wifiConnectingHint: "This can take about a minute.",
    wifiErrors: {
      wrong_password: "Couldn't connect: the password may be wrong. Try again from your phone.",
      not_found: "Couldn't connect: network not found. Make sure it is a 2.4 GHz network.",
      no_address: "Joined the network but it gave the board no address. Workplace networks may require registering the device.",
      failed: "Couldn't connect. Try again from your phone.",
    },
    setupTitle: "Internet setup",
    setupIntro: "Choose the WiFi network for the board. The board can only see 2.4 GHz networks.",
    setupOther: "A network that isn't listed",
    setupOtherName: "Network name",
    setupNoNetworks: "No networks found. You can type the network name below.",
    setupOpen: "open",
    setupConnect: "CONNECT",
    setupPasswordShort: "A WiFi password has at least 8 characters.",
    setupSent:
      "The board is connecting. Your phone will drop off the setup network; watch the board's screen for the result. If it can't connect, the setup network comes back and you can try again.",
    setupDone: "The board is online. You can close this page.",
    setupUnavailable: "The board isn't in setup mode right now.",
    setupFailed: "Couldn't send the request. Make sure you're connected to the setup network.",
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
