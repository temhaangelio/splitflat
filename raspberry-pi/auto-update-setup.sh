#!/bin/bash
# Otomatik güncelleme zamanlayıcısını kurar (bkz. auto-update.sh). install.sh
# ve update.sh çağırır; birden çok kez çalıştırmak güvenlidir.
# Kapatmak için:  touch ~/.splitflat/no-auto-update
#                  sudo systemctl disable --now splitflat-update.timer
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
USER_NAME="$(id -un)"
for unit in splitflat-update.service splitflat-update.timer; do
  sed -e "s|__USER__|$USER_NAME|" -e "s|__DIR__|$DIR|g" "$DIR/raspberry-pi/$unit" |
    sudo tee "/etc/systemd/system/$unit" >/dev/null
done
sudo systemctl daemon-reload
# Kullanıcı kapattıysa yeniden açılmaz; ilk kurulumda açılır.
if [ ! -f "$HOME/.splitflat/no-auto-update" ]; then
  sudo systemctl enable --now splitflat-update.timer >/dev/null 2>&1
  echo "otomatik güncelleme: açık (5 dakikada bir)"
else
  echo "otomatik güncelleme: kapalı (~/.splitflat/no-auto-update)"
fi
