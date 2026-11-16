import type { Lang } from "@/lib/i18n";

// Hakkında sayfasının metinleri. "Verileriniz" bölümü uygulamanın gerçekte ne
// yaptığını anlatır; bir servis eklenir ya da çıkarılırsa burası da güncellenmeli
// (bkz. lib/weather.ts, raspberry-pi/server.ts).

export type AboutContent = {
  metaTitle: string;
  lead: string;
  back: string;
  sections: { title: string; body?: string[]; list?: { term: string; text: string }[] }[];
};

export const ABOUT: Record<Lang, AboutContent> = {
  tr: {
    metaTitle: "Hakkında",
    lead: "Splitflat, havaalanlarındaki ve tren garlarındaki dönen harfli panoları evinize getirir. Bir ekran pano olur, telefonunuz kumanda: notunuzu gönderin, kartlar tek tek dönerek yerine otursun.",
    back: "Panoya dön",
    sections: [
      {
        title: "Nasıl çalışır",
        body: [
          "Pano evinizdeki bir Raspberry Pi'de çalışır ve ona bağlı ekranda görünür. Eşleşmiş bir telefon yoksa ekranda bir kod belirir.",
          "Kodu, panoyla aynı WiFi ağındaki telefonunuzun kamerasıyla okutun. Telefonda panonun kumandası açılır ve ekrandaki kod kaybolur; eşleşme bir kez yapılır, telefon hatırlanır.",
          "Bundan sonra her şey telefondan: ekranda düğme ya da ayar yoktur, yalnızca gösterir. Telefon panoya yalnızca ev ağındayken ulaşır. Pano açılışta ve ekrana dokununca kodu kısa süre yeniden gösterir; yeni bir telefon eklemek ya da eşleşmesini kaybeden bir telefonu geri bağlamak için.",
        ],
      },
      {
        title: "Telefondan neler yapılır",
        list: [
          { term: "Notlar", text: "20 nota kadar gönderin, seçtiğiniz aralıkla sırayla dönsünler." },
          { term: "Saat ve tarih", text: "İsterseniz saniyesiyle birlikte." },
          { term: "Hava durumu", text: "Seçtiğiniz şehir için sıcaklık ve durum." },
          { term: "Geri sayım", text: "Bir başlık ve tarih seçin; pano kalan günü ve saati saysın." },
          { term: "Ses ve dil", text: "Kart sesini açıp kapatın, panonun dilini seçin." },
          { term: "Başka telefonlar", text: "Bağlantıyı paylaşarak ailenizi ekleyin ya da eşleşmeyi sıfırlayın." },
        ],
      },
      {
        title: "Verileriniz",
        body: [
          "Hesap ve bulut yok. Panonuzun içeriği (notlar, nelerin gösterileceği, geri sayım, şehir, dil ve ses tercihi) yalnızca evinizdeki Raspberry Pi'de, bir dosyada saklanır; internete gönderilmez.",
          "Kayıt, kodu ilk okuttuğunuzda oluşur. Eşleşmeyi sıfırladığınızda silinir; notlar ekranda kalır, yeni bir telefon eşleşince ona aktarılır.",
          "Ev ağınızdaki ve eşleştirme kodunu ya da bağlantısını bilen herkes panoyu okuyabilir ve ona yazabilir. Ev içinde bağlantı şifrelenmez; panoya şifre gibi gizli bilgiler yazmayın. Bağlantı yanlış birinin eline geçerse telefondan \"Eşleşmeyi sıfırla\" ile eskisini geçersiz kılın.",
          "Hava durumunu açarsanız, seçtiğiniz şehrin adı hava durumu için Open-Meteo'ya gönderilir. Cihazınızın konumu kullanılmaz.",
        ],
      },
    ],
  },
  en: {
    metaTitle: "About",
    lead: "Splitflat brings the flipping-letter boards of airports and train stations into your home. A screen becomes the board and your phone is the remote: send a note and watch the cards flip into place one by one.",
    back: "Back to the board",
    sections: [
      {
        title: "How it works",
        body: [
          "The board runs on a Raspberry Pi in your home and shows on the screen attached to it. When no phone is paired, a code appears on the screen.",
          "Scan the code with the camera of a phone on the same WiFi network. The board's remote opens on your phone and the code disappears from the screen; you pair once and the phone is remembered.",
          "From then on everything happens on the phone: the screen has no buttons or settings, it only displays. The phone reaches the board only while it is on your home network. The board shows the code briefly at start-up and when the screen is touched, to add a new phone or bring back one that lost its pairing.",
        ],
      },
      {
        title: "What the phone can do",
        list: [
          { term: "Notes", text: "Send up to 20 notes and let them rotate at the interval you choose." },
          { term: "Time and date", text: "With seconds, if you like." },
          { term: "Weather", text: "Temperature and conditions for a city you pick." },
          { term: "Countdown", text: "Pick a title and a date; the board counts the days and hours left." },
          { term: "Sound and language", text: "Turn the card sound on or off and choose the board's language." },
          { term: "More phones", text: "Share the link to add your family, or reset the pairing." },
        ],
      },
      {
        title: "Your data",
        body: [
          "There are no accounts and no cloud. Your board's content (notes, what it shows, the countdown, city, language and sound preference) is stored only in a file on the Raspberry Pi in your home; it is not sent to the internet.",
          "The record is created when you first scan the code. Resetting the pairing deletes it; the notes stay on the screen and move to the next phone that pairs.",
          "Anyone on your home network who has the pairing code or link can read the board and write to it. Inside your home the connection is not encrypted, so don't put secrets such as passwords on the board. If the link ends up with the wrong person, use \"Reset pairing\" on your phone to make the old one stop working.",
          "If you turn on weather, the name of the city you chose is sent to Open-Meteo for the forecast. Your device's location is not used.",
        ],
      },
    ],
  },
};
