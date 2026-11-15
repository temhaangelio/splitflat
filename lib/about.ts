import type { Lang } from "@/lib/i18n";

// Hakkında sayfasının metinleri. "Verileriniz" bölümü uygulamanın gerçekte ne
// yaptığını anlatır; bir servis eklenir ya da çıkarılırsa burası da güncellenmeli
// (bkz. lib/weather.ts, app/api/board/route.ts).

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
          "Siteyi pano olacak ekranda açın: bir tablet, eski bir monitör ya da bir Raspberry Pi. Ekranda bir kod görünür.",
          "Kodu telefonunuzun kamerasıyla okutun. Telefonda panonun kumandası açılır ve ekrandaki kod kaybolur; eşleşme bir kez yapılır, telefon hatırlanır.",
          "Bundan sonra her şey telefondan: ekranda düğme ya da ayar yoktur, yalnızca gösterir.",
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
          "Hesap yok. Panonuzun içeriği (notlar, nelerin gösterileceği, geri sayım, şehir, dil ve ses tercihi) sunucumuzda saklanır ki telefonunuz ve panonuz aynı şeyi görsün. Bunlar adınızla ya da bir hesapla ilişkilendirilmez; yalnızca panonun rastgele üretilmiş anahtarına bağlıdır.",
          "Kayıt, kodu ilk okuttuğunuzda oluşur; okutmadan önce sunucuda panonuza ait hiçbir şey yoktur. Eşleşmeyi sıfırladığınızda kayıt silinir; bir yıl kullanılmayan kayıtlar da kendiliğinden silinir.",
          "Eşleştirme kodunu ya da bağlantısını bilen herkes o panoyu okuyabilir ve ona yazabilir. Bağlantıyı yalnızca güvendiğiniz kişilerle paylaşın, panoya şifre gibi gizli bilgiler yazmayın. Bağlantı yanlış birinin eline geçerse telefondan \"Eşleşmeyi sıfırla\" ile eskisini geçersiz kılın.",
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
          "Open the site on the screen that will be the board: a tablet, an old monitor or a Raspberry Pi. A code appears on the screen.",
          "Scan the code with your phone's camera. The board's remote opens on your phone and the code disappears from the screen; you pair once and the phone is remembered.",
          "From then on everything happens on the phone: the screen has no buttons or settings, it only displays.",
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
          "There are no accounts. Your board's content (notes, what it shows, the countdown, city, language and sound preference) is stored on our server so that your phone and your board see the same thing. It isn't tied to your name or an account, only to the board's randomly generated key.",
          "The record is created when you first scan the code; before that, nothing about your board exists on the server. Resetting the pairing deletes the record; records unused for a year are deleted automatically.",
          "Anyone who has the pairing code or link can read that board and write to it. Share it only with people you trust, and don't put secrets such as passwords on the board. If the link ends up with the wrong person, use \"Reset pairing\" on your phone to make the old one stop working.",
          "If you turn on weather, the name of the city you chose is sent to Open-Meteo for the forecast. Your device's location is not used.",
        ],
      },
    ],
  },
};
