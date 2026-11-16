#!/bin/bash
# İndirilmiş sürümü Pi'ye uygular: izinler, servis, açılış ayarları.
# update.sh git pull'dan sonra çağırır; elle de çalıştırılabilir:
#
#   bash ~/splitflat/raspberry-pi/apply.sh
set -euo pipefail
cd "$(dirname "$0")/.."
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
