#!/bin/bash
# Split Flap'in yeni sürümünü GitHub'dan çeker ve sunucuyu yeniden başlatır.
# Notlar ~/.splitflat altında durur; güncelleme onlara dokunmaz.
#
#   bash ~/splitflat/raspberry-pi/update.sh
set -euo pipefail
# Betiğin tamamı önce okunur: git pull bu dosyayı çalışırken değiştirebilir.
{
cd "$(dirname "$0")/.."
git pull --ff-only
bash raspberry-pi/wifi-permission.sh
bash raspberry-pi/auto-update-setup.sh
sudo systemctl restart splitflat
# Açılış sayfası ve görseli değiştiyse onları da uygula.
bash raspberry-pi/kiosk.sh
bash raspberry-pi/splash.sh
bash raspberry-pi/quiet-boot.sh
# Panoyu yeni sürümle yeniden yükle (FullPageOS'ta varsa).
[ -x /opt/custompios/scripts/refresh ] && DISPLAY=:0 /opt/custompios/scripts/refresh || true
echo "Güncellendi: $(git log -1 --format='%h %s')"
exit
}
