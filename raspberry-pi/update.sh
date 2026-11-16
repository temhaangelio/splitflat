#!/bin/bash
# Split Flap'in yeni sürümünü GitHub'dan çeker ve uygular.
# Notlar ~/.splitflat altında durur; güncelleme onlara dokunmaz.
#
#   bash ~/splitflat/raspberry-pi/update.sh
#
# Yalnızca çeker; uygulama adımları apply.sh'tadır. apply.sh çekme işleminden
# sonra okunduğu için her zaman yeni sürümün adımları çalışır (bu dosya
# çalışırken kendisi değişse bile).
set -euo pipefail
{
cd "$(dirname "$0")/.."
git pull --ff-only
exec bash raspberry-pi/apply.sh
}
