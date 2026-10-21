# DDSKK による検査の環境（ADR 0002）。Deno、Emacs、DDSKK だけを入れ、リポジトリはマウントして使う。
# scripts/check_ddskk_docker.sh から、ビルドのコンテキストなし（docker build - < Dockerfile）で作る。
FROM denoland/deno:debian-2.9.7@sha256:fa335acdf6b72106eda2cb6a8cb5f4187e7630e357467489db4b2e7352d5e432

RUN apt-get update \
 && apt-get install -y --no-install-recommends emacs-nox git ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# sources.lock の ddskk_commit。既定値は置かない。
ARG DDSKK_COMMIT
RUN test -n "$DDSKK_COMMIT" || { echo "DDSKK_COMMIT is required (see sources.lock)" >&2; exit 1; } \
 && git init -q /opt/ddskk \
 && git -C /opt/ddskk fetch -q --depth 1 https://github.com/skk-dev/ddskk.git "$DDSKK_COMMIT" \
 && git -C /opt/ddskk checkout -q FETCH_HEAD \
 && rm -rf /opt/ddskk/.git

ENV DDSKK_DIR=/opt/ddskk HOME=/tmp
