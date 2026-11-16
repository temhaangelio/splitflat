#!/bin/bash
# Split Flap'i Raspberry Pi'ye kurar. Bir kez çalıştırılır:
#
#   git clone https://github.com/temhaangelio/splitflat.git ~/splitflat
#   bash ~/splitflat/raspberry-pi/install.sh
#
# Yaptıkları:
#   1. Node.js yoksa kurar.
#   2. Sunucuyu açılışta başlayan bir servis olarak kurar ve başlatır.
#   3. FullPageOS varsa, tarayıcının açılışta hareketli bir yükleniyor
#      sayfası (boot.html) gösterip sunucu hazır olunca panoya geçmesini
#      sağlar, Chromium'un "1 GB'tan az bellek" uyarısını kapatır ve
#      FullPageOS logosunu Split Flap açılış görseliyle değiştirir (kiosk.sh).
#   4. Pi açılırken ekrana akan sistem yazılarını gizler.
#   5. Pi bir ağa bağlanamazsa kendi kurulum ağını açabilsin diye sunucuya
#      yalnızca nmcli için izin verir (bkz. wifi.ts).
#   6. GitHub'a dakikada bir bakan otomatik güncellemeyi açar.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
USER_NAME="$(id -un)"
PORT=8080

echo "==> Node.js"
if ! command -v node >/dev/null; then
  sudo apt-get update
  sudo apt-get install -y nodejs
fi
node --version

echo "==> İnternet kurulumu izni"
bash "$DIR/wifi-permission.sh"

echo "==> Servis"
sed -e "s|__USER__|$USER_NAME|" -e "s|__DIR__|$DIR|" "$DIR/splitflat.service" |
  sudo tee /etc/systemd/system/splitflat.service >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable --now splitflat
sudo systemctl restart splitflat

echo "==> Sunucu yanıt veriyor mu"
up=""
for _ in $(seq 1 30); do
  if curl -fs "http://localhost:$PORT/" >/dev/null; then up=1; echo "tamam"; break; fi
  sleep 1
done
if [ -z "$up" ]; then
  echo
  echo "!!! Split Flap sunucusu başlamadı. Son günlük satırları:"
  journalctl -u splitflat -n 25 --no-pager || true
  echo "!!! Bu çıktıyı gönderin. Node.js sürümü: $(node --version 2>/dev/null || echo yok)"
  echo
fi

echo "==> FullPageOS: açılış sayfası ve görsel"
bash "$DIR/kiosk.sh"
bash "$DIR/splash.sh"

echo "==> Açılış yazıları"
bash "$DIR/quiet-boot.sh"

echo "==> Otomatik güncelleme"
bash "$DIR/auto-update-setup.sh"

echo
echo "Kurulum bitti. Pi'yi yeniden başlatın:  sudo reboot"
echo "Telefonlar panoya şu adresten ulaşır:    $(hostname -I | awk '{print "http://" $1 ":'$PORT'"}')"
