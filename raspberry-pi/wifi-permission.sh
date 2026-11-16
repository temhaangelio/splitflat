#!/bin/bash
# İnternet kurulumu için: sunucu WiFi'yi değiştirebilsin diye kullanıcıya
# yalnızca nmcli komutunu şifresiz çalıştırma izni verir. Başka hiçbir komut
# bu izinle çalıştırılamaz. install.sh ve update.sh çağırır; birden çok kez
# çalıştırmak güvenlidir.
set -euo pipefail

USER_NAME="$(id -un)"
NMCLI_BIN="$(command -v nmcli || true)"
RULE=/etc/sudoers.d/splitflat-nmcli

if [ -z "$NMCLI_BIN" ]; then
  echo "nmcli yok; internet kurulumu kullanılamayacak."
  exit 0
fi

# Önce geçici dosyaya yazılır ve denetlenir: hatalı bir kural sudo'yu bozabilir.
# (sudo, adında nokta olan dosyaları okumadığı için .tmp dosyası etkisizdir.)
echo "$USER_NAME ALL=(root) NOPASSWD: $NMCLI_BIN" | sudo tee "$RULE.tmp" >/dev/null
if sudo visudo -cf "$RULE.tmp" >/dev/null; then
  sudo chmod 440 "$RULE.tmp"
  sudo mv "$RULE.tmp" "$RULE"
  echo "internet kurulumu izni: $RULE"
else
  sudo rm -f "$RULE.tmp"
  echo "izin kuralı doğrulanamadı; eklenmedi."
fi
