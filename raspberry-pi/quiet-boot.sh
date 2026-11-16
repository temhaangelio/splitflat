#!/bin/bash
# Pi açılırken ekrana akan çekirdek ve sistem yazılarını gizler; açılış
# boyunca yalnızca Split Flap görseli görünür.
#
# cmdline.txt'ye (tek satır olmalı) eksik olan ayarları ekler, ekranı
# tty1'den tty3'e taşır ve config.txt'de Raspberry Pi'nin renkli açılış
# karesini kapatır. Birden çok kez çalıştırmak güvenlidir. İlk değişiklikten
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

# Yazılar ekran yerine görünmeyen 3. konsola gitsin.
line="$(printf '%s' "$line" | sed -E 's/(^| )console=tty1( |$)/\1console=tty3\2/')"
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
