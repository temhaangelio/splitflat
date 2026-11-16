#!/bin/bash
# FullPageOS ayarları: Pi açılınca tarayıcı ne gösterecek.
#
#   - Açılış adresi diskteki boot.html olur. FullPageOS normalde tarayıcıyı
#     ancak adres yanıt verince açar; o sırada ekranda sabit bir görsel kalır
#     ve pano takılmış gibi görünür. boot.html diskten hemen açılır, hareketli
#     logoyu gösterir, sunucu hazır olunca panoya (http://localhost:8080/?lite)
#     geçer. Bu yüzden FullPageOS'un adres denetimi kapatılır.
#   - Chromium'un "1 GB'tan az bellek" uyarısı kapatılır.
#
# install.sh ve update.sh çağırır; FullPageOS değilse hiçbir şey yapmaz.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"

BOOT=/boot/firmware
[ -f "$BOOT/fullpageos.txt" ] || BOOT=/boot
URL_FILE="$BOOT/fullpageos.txt"
if [ ! -f "$URL_FILE" ]; then
  echo "FullPageOS bulunamadı; tarayıcı ayarlarına dokunulmadı."
  exit 0
fi

echo "file://$DIR/boot.html" | sudo tee "$URL_FILE" >/dev/null
echo "açılış adresi: $(cat "$URL_FILE")"
# FullPageOS adres yanıt verene kadar tarayıcıyı açmaz; disk sayfası için gereksiz.
echo "disabled" | sudo tee "$BOOT/check_for_httpd" >/dev/null

START=/opt/custompios/scripts/start_chromium_browser
if [ -f "$START" ] && ! grep -q -- "--no-memcheck" "$START"; then
  sudo sed -i 's/^   --kiosk$/   --kiosk\n   --no-memcheck/' "$START"
  echo "bellek uyarısı kapatıldı"
fi
