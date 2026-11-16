#!/bin/bash
# Otomatik güncelleme: GitHub'da yeni bir sürüm varsa update.sh'ı çalıştırır.
# splitflat-update.timer beş dakikada bir çağırır; internet yoksa sessizce çıkar.
# Elle denemek için:  bash ~/splitflat/raspberry-pi/auto-update.sh
set -euo pipefail
cd "$(dirname "$0")/.."

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
git fetch --quiet origin "$BRANCH" 2>/dev/null || exit 0
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/$BRANCH")"
[ "$LOCAL" = "$REMOTE" ] && exit 0

# Yalnızca ileri sarılabilen değişiklikler alınır; Pi'de elle yapılmış bir
# değişiklik varsa dokunulmaz, günlüğe yazılır.
if ! git merge-base --is-ancestor "$LOCAL" "$REMOTE"; then
  echo "Pi'deki kopya GitHub'dan ayrışmış; otomatik güncelleme atlandı."
  exit 0
fi
if ! sudo -n true 2>/dev/null; then
  echo "Bu kullanıcı şifresiz sudo kullanamıyor; elle güncelleyin: bash raspberry-pi/update.sh"
  exit 1
fi
echo "Yeni sürüm: ${LOCAL:0:7} -> ${REMOTE:0:7}"
exec bash raspberry-pi/update.sh
