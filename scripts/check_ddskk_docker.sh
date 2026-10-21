#!/bin/sh
# Docker のコンテナの中で scripts/check_ddskk.sh を実行する（ADR 0002）。
# リポジトリの直下で実行する。
set -eu

IMAGE=skk-jisyo-kaomoji-ddskk
commit=$(sed -n 's/^ddskk_commit *= *//p' sources.lock)
if [ -z "$commit" ]; then
  echo "error: ddskk_commit is not in sources.lock" >&2
  exit 1
fi

docker build --build-arg "DDSKK_COMMIT=$commit" -t "$IMAGE" - <Dockerfile
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/work" -w /work \
  -e DENO_DIR=/work/.cache/deno "$IMAGE" scripts/check_ddskk.sh
