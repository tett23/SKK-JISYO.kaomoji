#!/bin/sh
# 生成した辞書を DDSKK で引いて検査する（ADR 0002）。
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

# expect_failure <辞書> <コーディングシステム> <正解のデータ> <標準エラーに出るはずの文字列>
expect_failure() {
  if check "$1" "$2" "$3" 2>"$STDERR"; then
    echo "error: $1 should fail the check" >&2
    exit 1
  fi
  if ! grep -qF -- "$4" "$STDERR"; then
    echo "error: $1 should report \"$4\"" >&2
    cat "$STDERR" >&2
    exit 1
  fi
  echo "$1 ($2): failed as expected, reported \"$4\""
}

deno task build --strict
deno task expected
deno task euc-table
mkdir -p .cache/check

emacs_eval '(kaomoji-check-table ".cache/check/euc-jp-table.tsv")'

check "$FIXTURES/ok.euc" euc-jp "$FIXTURES/expected.tsv"
check "$FIXTURES/ok.utf8" utf-8 "$FIXTURES/expected.tsv"
expect_failure "$FIXTURES/unsorted.utf8" utf-8 "$FIXTURES/expected.tsv" "MISMATCH もぐもぐ"
expect_failure "$FIXTURES/altered.utf8" utf-8 "$FIXTURES/expected.tsv" "MISMATCH しくしく"
expect_failure "$FIXTURES/v0.1.0.euc" euc-jp "$FIXTURES/expected.tsv" "MISMATCH もぐもぐ"

check dist/SKK-JISYO.kaomoji euc-jp .cache/check/expected.tsv
check dist/SKK-JISYO.kaomoji.utf8 utf-8 .cache/check/expected.tsv
