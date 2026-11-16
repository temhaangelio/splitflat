#!/bin/bash
# Pi açılırken ekrana akan çekirdek ve sistem yazılarını gizler; açılış
# boyunca yalnızca Split Flap görseli görünür.
#
# cmdline.txt'ye (tek satır olmalı) eksik olan sessiz açılış ayarlarını ekler
# ve config.txt'de Raspberry Pi'nin renkli açılış karesini kapatır.
#
# Konsol tty1'de kalmalıdır. FullPageOS'un açılış görseli (fbi) konsola bağlı
# çalışır; konsol başka ekrana (tty3) taşınınca grafik ekran (X) açılamıyor,
# Pi açılış görselinde takılı kalıyordu. Eski bir sürüm taşıdıysa geri alınır. Birden çok kez çalıştırmak güvenlidir. İlk değişiklikten
# önceki dosya cmdline.txt.orig olarak saklanır: bir sorun olursa SD kartı
# bilgisayara takıp o dosyayı cmdline.txt adıyla geri koymak yeterlidir.
#
# install.sh ve update.sh çağırır. BOOT değişkeniyle başka bir klasörde
# denenebilir (ör. BOOT=/tmp/deneme bash quiet-boot.sh).
set -euo pipefail

if [ -z "${BOOT:-}" ]; then
  BOOT=/boot/firmware
  [ -f "$BOOT/cmdline.txt" ] || BOOT=/boot
fi
CMD="$BOOT/cmdline.txt"
CFG="$BOOT/config.txt"
SUDO=sudo
[ -w "$BOOT" ] && SUDO=""

if [ ! -f "$CMD" ]; then
  echo "cmdline.txt bulunamadı ($BOOT); açılış yazıları değiştirilmedi."
  exit 0
fi

[ -f "$CMD.orig" ] || $SUDO cp "$CMD" "$CMD.orig"

line="$(head -n1 "$CMD" | tr -d '\r')"
case "$line" in
  *root=*) ;;
  *)
    echo "cmdline.txt beklenmedik görünüyor (root= yok); dokunulmadı."
    exit 0
    ;;
esac

# Eski sürümün tty3'e taşıdığı konsolu tty1'e geri al (yukarıya bakın).
line="$(printf '%s' "$line" | sed -E 's/(^| )console=tty3( |$)/\1console=tty1\2/')"
# Var olan loglevel değerini kaldır; aşağıda 0 olarak eklenir.
line="$(printf '%s' "$line" | sed -E 's/(^| )loglevel=[0-9]+//g')"

for opt in quiet loglevel=0 logo.nologo vt.global_cursor_default=0 \
  systemd.show_status=false rd.udev.log_level=0 udev.log_priority=0 consoleblank=0; do
  case " $line " in
    *" $opt "*) ;;
    *) line="$line $opt" ;;
  esac
done
line="$(printf '%s' "$line" | tr -s ' ' | sed -E 's/^ //; s/ $//')"
printf '%s\n' "$line" | $SUDO tee "$CMD" >/dev/null
echo "açılış yazıları kapatıldı: $CMD"

if [ -f "$CFG" ] && ! grep -q '^disable_splash=1' "$CFG"; then
  echo "disable_splash=1" | $SUDO tee -a "$CFG" >/dev/null
  echo "renkli açılış karesi kapatıldı: $CFG"
fi
