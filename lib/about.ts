import type { Lang } from "@/lib/i18n";

// Hakkında sayfasının metinleri. Gizlilik bölümü uygulamanın gerçekte ne
// yaptığını anlatır; bir servis eklenir ya da çıkarılırsa burası da güncellenmeli
// (bkz. lib/weather.ts, lib/record.ts, app/api/board/route.ts).

export type AboutContent = {
  metaTitle: string;
  lead: string;
  back: string;
  sections: { title: string; body?: string[]; list?: { term: string; text: string }[] }[];
};

export const ABOUT: Record<Lang, AboutContent> = {
  tr: {
    metaTitle: "Hakkında",
    lead: "Splitflat, havaalanlarındaki ve tren garlarındaki dönen harfli panoları evinize getiren bir web uygulaması. Notunuzu yazın; kartlar tek tek dönerek yerine otursun.",
    back: "Panoya dön",
    sections: [
      {
        title: "Neler yapar",
        list: [
          { term: "Notlar", text: "20 nota kadar yazın, seçtiğiniz aralıkla sırayla dönsünler." },
          { term: "Saat ve tarih", text: "İsterseniz saniyesiyle birlikte." },
          { term: "Hava durumu", text: "Bulunduğunuz yer ya da seçtiğiniz şehir için sıcaklık ve durum." },
          { term: "Geri sayım", text: "Bir başlık ve tarih seçin; pano kalan günü ve saati saysın." },
          { term: "Telefondan kontrol", text: "Panodaki kodu telefonla okutun; notları telefondan gönderin." },
          { term: "Kaydet", text: "Panoyu PNG görsel ya da kısa bir video olarak indirin." },
          { term: "Duvar ekranı", text: "Tam ekran yapın; kontroller gizlenir, ekran uykuya geçmez." },
        ],
      },
      {
        title: "Nasıl kullanılır",
        body: [
          "Alttaki kutuya notunuzu yazıp Enter'a basın. Liste simgesinden notlarınızı görebilir, birini seçebilir ya da silebilirsiniz.",
          "Dişli simgesi ayarları açar: panoda nelerin görüneceğini, geçiş süresini, hücre sayısını, duvar arka planını, sesi ve dili oradan değiştirirsiniz.",
          "Fareyi birkaç saniye oynatmazsanız kontroller kaybolur; dokununca geri gelir.",
        ],
      },
      {
        title: "Verileriniz",
        body: [
          "Hesap yok. Siz açmadıkça notlarınız ve ayarlarınız yalnızca bu tarayıcıda saklanır, bir sunucuya gönderilmez. Tarayıcı verilerini silerseniz onlar da silinir.",
          "Telefondan kontrolü açarsanız notlarınız, panoda nelerin gösterileceği, geçiş süresi ve geri sayım sunucumuzda saklanır ki telefonunuz ve panonuz aynı içeriği görsün. Bunlar adınızla ya da bir hesapla ilişkilendirilmez; yalnızca panonun rastgele üretilmiş anahtarına bağlıdır. Özelliği kapattığınızda kayıt silinir; bir yıl kullanılmayan kayıtlar da kendiliğinden silinir.",
          "Eşleştirme kodunu ya da bağlantısını bilen herkes o panoyu okuyabilir ve ona yazabilir. Bağlantıyı yalnızca güvendiğiniz kişilerle paylaşın, panoya şifre gibi gizli bilgiler yazmayın. Bağlantı yanlış birinin eline geçerse ayarlardan \"Bağlantıyı yenile\" ile eskisini geçersiz kılın.",
          "Hava durumunu açarsanız, seçtiğiniz şehrin adı ya da izin verdiyseniz konumunuz hava durumu için Open-Meteo'ya, konumdan şehir adını bulmak için BigDataCloud'a gönderilir. Hava durumu kapalıyken hiçbir dış servise istek yapılmaz.",
          "PNG ve video dosyaları cihazınızda oluşturulur ve doğrudan size iner.",
        ],
      },
    ],
  },
  en: {
    metaTitle: "About",
    lead: "Splitflat brings the flipping-letter boards of airports and train stations into your home, as a web app. Type a note and watch the cards flip into place one by one.",
    back: "Back to the board",
    sections: [
      {
        title: "What it does",
        list: [
          { term: "Notes", text: "Write up to 20 notes and let them rotate at the interval you choose." },
          { term: "Time and date", text: "With seconds, if you like." },
          { term: "Weather", text: "Temperature and conditions for where you are, or for a city you pick." },
          { term: "Countdown", text: "Pick a title and a date; the board counts the days and hours left." },
          { term: "Phone control", text: "Scan the code on the board with your phone and send notes from there." },
          { term: "Save", text: "Download the board as a PNG image or a short video." },
          { term: "Wall display", text: "Go full screen; the controls hide and the screen stays awake." },
        ],
      },
      {
        title: "How to use it",
        body: [
          "Type a note in the box at the bottom and press Enter. The list icon shows your notes, where you can pick one or delete it.",
          "The gear icon opens settings: what the board shows, the rotation interval, board size, wall background, sound and language.",
          "Leave the mouse still for a few seconds and the controls disappear; touch the screen to bring them back.",
        ],
      },
      {
        title: "Your data",
        body: [
          "There are no accounts. Unless you turn on phone control, your notes and settings are stored only in this browser and are not sent to a server. Clearing your browser data clears them too.",
          "If you turn on phone control, your notes, what the board shows, the rotation interval and the countdown are stored on our server so that your phone and your board see the same content. They aren't tied to your name or an account, only to the board's randomly generated key. Turning the feature off deletes the record; records unused for a year are deleted automatically.",
          "Anyone who has the pairing code or link can read that board and write to it. Share it only with people you trust, and don't put secrets such as passwords on the board. If the link ends up with the wrong person, use \"Reset link\" in settings to make the old one stop working.",
          "If you turn on weather, the city you chose — or your location, if you allowed it — is sent to Open-Meteo for the forecast and to BigDataCloud to find the city name. With weather off, no outside service is contacted.",
          "PNG and video files are created on your device and downloaded straight to you.",
        ],
      },
    ],
  },
};
