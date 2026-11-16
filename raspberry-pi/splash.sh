#!/bin/bash
# FullPageOS'un kendi görsellerini Split Flap görseliyle değiştirir:
#   /boot/firmware/splash.png        Pi açılırken görünen görsel
#   /opt/custompios/background.png   tarayıcı açılmadan önceki arka plan
# install.sh ve update.sh çağırır; FullPageOS değilse hiçbir şey yapmaz.
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)/splash.png"

BOOT=/boot/firmware
[ -d "$BOOT" ] || BOOT=/boot
if [ -f "$BOOT/fullpageos.txt" ]; then
  sudo cp "$SRC" "$BOOT/splash.png"
  echo "açılış görseli: $BOOT/splash.png"
fi
if [ -d /opt/custompios ]; then
  sudo cp "$SRC" /opt/custompios/background.png
  echo "arka plan: /opt/custompios/background.png"
fi
