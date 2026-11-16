#!/bin/bash
# Splitflat'i Raspberry Pi'ye kurar. Bir kez çalıştırılır:
#
#   git clone https://github.com/temhaangelio/splitflat.app.git ~/splitflat
#   bash ~/splitflat/raspberry-pi/install.sh
#
# Yaptıkları:
#   1. Node.js yoksa kurar.
#   2. Sunucuyu açılışta başlayan bir servis olarak kurar ve başlatır.
#   3. FullPageOS varsa, panonun açılışta bu sunucuyu göstermesini sağlar ve
#      Chromium'un "1 GB'tan az bellek" uyarısını kapatır.
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

echo "==> Servis"
sed -e "s|__USER__|$USER_NAME|" -e "s|__DIR__|$DIR|" "$DIR/splitflat.service" |
  sudo tee /etc/systemd/system/splitflat.service >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable --now splitflat
sudo systemctl restart splitflat

echo "==> Sunucu yanıt veriyor mu"
for _ in $(seq 1 20); do
  if curl -fs "http://localhost:$PORT/" >/dev/null; then echo "tamam"; break; fi
  sleep 1
done

URL_FILE=/boot/firmware/fullpageos.txt
[ -f "$URL_FILE" ] || URL_FILE=/boot/fullpageos.txt
if [ -f "$URL_FILE" ]; then
  echo "==> FullPageOS: panonun adresi"
  echo "http://localhost:$PORT/?lite" | sudo tee "$URL_FILE" >/dev/null
  cat "$URL_FILE"

  START=/opt/custompios/scripts/start_chromium_browser
  if [ -f "$START" ] && ! grep -q -- "--no-memcheck" "$START"; then
    echo "==> FullPageOS: bellek uyarısı kapatılıyor"
    sudo sed -i 's/^   --kiosk$/   --kiosk\n   --no-memcheck/' "$START"
  fi
fi

echo
echo "Kurulum bitti. Pi'yi yeniden başlatın:  sudo reboot"
echo "Telefonlar panoya şu adresten ulaşır:    $(hostname -I | awk '{print "http://" $1 ":'$PORT'"}')"
