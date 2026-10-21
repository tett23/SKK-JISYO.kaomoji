#!/bin/sh
# 生成した辞書を DDSKK で引いて検査する（ADR 0002、ADR 0003）。
# Deno、Emacs、DDSKK（環境変数 DDSKK_DIR、既定は /opt/ddskk）が要る。
# Docker で動かすときは scripts/check_ddskk_docker.sh を使う。
set -eu

DDSKK_DIR=${DDSKK_DIR:-/opt/ddskk}
FIXTURES=tests/ddskk
STDERR=.cache/check/stderr.txt

emacs_eval() {
  emacs --batch -Q -L "$DDSKK_DIR" -l scripts/check_ddskk.el --eval "$1"
}

# check <辞書> <コーディングシステム> <正解のデータ>
check() {
  emacs_eval "(kaomoji-check \"$1\" (quote $2) \"$3\")"
}

# check_order <辞書> <コーディングシステム> <順序（ddskk か utf-8）>
check_order() {
  emacs_eval "(kaomoji-check-order \"$1\" (quote $2) (quote $3))"
}

# expect_failure <標準エラーに出るはずの文字列> <コマンド> <引数>...
expect_failure() {
  pattern=$1
  shift
  if "$@" 2>"$STDERR"; then
    echo "error: $* should fail" >&2
    exit 1
  fi
  if ! grep -qF -- "$pattern" "$STDERR"; then
    echo "error: $* should report \"$pattern\"" >&2
    cat "$STDERR" >&2
    exit 1
  fi
  echo "$*: failed as expected, reported \"$pattern\""
}

deno task build --strict
deno task expected
deno task euc-table
mkdir -p .cache/check

emacs_eval '(kaomoji-check-table ".cache/check/euc-jp-table.tsv")'

# 検査そのものを確かめる（ADR 0002、ADR 0003 の「テスト設計」）
check "$FIXTURES/ok.euc" euc-jp "$FIXTURES/expected.tsv"
check "$FIXTURES/ok.utf8" utf-8 "$FIXTURES/expected.tsv"
check_order "$FIXTURES/ok.euc" euc-jp ddskk
check_order "$FIXTURES/ok.utf8" utf-8 utf-8
expect_failure "ORDER あせ あーん" check_order "$FIXTURES/ok.utf8" utf-8 ddskk
expect_failure "ORDER もぐもぐ" check_order "$FIXTURES/unsorted.euc" euc-jp ddskk
expect_failure "ORDER もぐもぐ" check_order "$FIXTURES/unsorted.utf8" utf-8 utf-8
expect_failure "MISMATCH しくしく" check "$FIXTURES/altered.utf8" utf-8 "$FIXTURES/expected.tsv"
expect_failure "MISMATCH もぐもぐ" check "$FIXTURES/v0.1.0.euc" euc-jp "$FIXTURES/expected.tsv"

# 本物の辞書
check dist/SKK-JISYO.kaomoji euc-jp .cache/check/expected.tsv
check dist/SKK-JISYO.kaomoji.utf8 utf-8 .cache/check/expected.tsv
check_order dist/SKK-JISYO.kaomoji euc-jp ddskk
check_order dist/SKK-JISYO.kaomoji.utf8 utf-8 utf-8
