# ADR 0003: DDSKK による検査を、DDSKK の実際の辞書の引き方に合わせる

ステータス: 採択→UTF-8 版を DDSKK で引く検査は [ADR 0004](0004-import-kaomoji-data-and-emoticon.md)

## 文脈

[ADR 0002](0002-check-dictionaries-with-ddskk.md) を実装し、Docker のイメージ（Debian 13、Emacs 30.1、DDSKK `ddskk-17.2_Mena`）で検査を動かしたところ、次の 3 つが分かった。
どれも [ADR 0002](0002-check-dictionaries-with-ddskk.md) を書いた時点では知らなかったことで、[ADR 0002](0002-check-dictionaries-with-ddskk.md) のままでは検査が意味のある結果を返さない。

### 1. 二分探索の上限 64 では、正しく並んだ辞書も引けない

[ADR 0002](0002-check-dictionaries-with-ddskk.md) は、`skk-search-jisyo-file` の第 2 引数 `limit` を 64 にすると決めた。
DDSKK の二分探索（`skk.el` の `skk-search-jisyo`）は、範囲の中央の行の先頭が範囲の先頭と同じになると、範囲を空にして探索を終える。
この辞書は 1 行が最長で 865 文字あり、範囲が 1 行の 2 倍ほどより狭くなると、この処理に入って目的の行を見落とす。

v0.1.0 の辞書（253 の見出し語）で、引けなかった見出し語の数は次のとおりである。

| `limit` | EUC-JP 版 | UTF-8 版 |
|---|---|---|
| 64 | 141 | 175 |
| 1024 | 0 | 37 |
| 2048 | 0 | 14 |
| 4096 | 0 | 0 |
| 10000 | 0 | 0 |

DDSKK が実際に使う `limit` は 10000 である。
主辞書（`skk-large-jisyo`）も、`skk-extra-jisyo-file-list` に足した辞書も、10000 で引く（`skk-vars.el` の `skk-search-prog-list`、`skk.el` の `skk-search-extra-jisyo-files`）。

### 2. DDSKK は見出し語を emacs-mule のバイト順で比べ、その順は言語環境で変わる

DDSKK の二分探索は、見出し語を `skk-string<` で比べる。
`skk-string<` は、文字列を Emacs の内部の古い表現である emacs-mule に変換し、そのバイト列で比べる（`skk-macs.el`）。
ファイルの文字コード（EUC-JP や UTF-8）のバイト順ではない。

emacs-mule でのひらがなのバイト列は、Emacs の言語環境で変わる。

| 言語環境 | `あ` | `ー` | 順序 |
|---|---|---|---|
| `emacs -Q` のまま、または `LANG=C.UTF-8` | `91 A4 A2`（GB 2312） | `92 A1 BC`（JIS X 0208） | ひらがなが `ー` より前 |
| `Japanese`（`LANG=ja_JP.UTF-8`、または `set-language-environment` を一度でも呼んだ後） | `92 A4 A2`（JIS X 0208） | `92 A1 BC`（JIS X 0208） | `ー` がひらがなより前。EUC-JP のバイト順と同じ |

DDSKK を使う人は日本語の言語環境で使うのが普通なので、DDSKK にとっての正しい順は EUC-JP のバイト順と同じになる。

### 3. UTF-8 版の並び順は、DDSKK と libskk とで要求が違う

[ADR 0001](0001-kaomoji-dictionary-from-mozc.md) は、UTF-8 版の見出し語を UTF-8 のバイト順に並べると決めた。
この順は、2 で述べた DDSKK の順と、`ー` とひらがなの前後が逆になる（`あせ` と `あーん` など、v0.1.0 では 122 組）。

一方、libskk（fcitx5-skk、ibus-skk が使う）は、見出し語を辞書の文字コードに変換し、そのバイト列を `strcmp` で比べて二分探索する（`libskk/file-dict.vala`）。
UTF-8 の辞書には UTF-8 のバイト順が要る。
skk-dev/dict の UTF-8 の辞書 `SKK-JISYO.emoji` も、かなの見出し語 2,520 件を含めて UTF-8 のバイト順に並んでいる。

UTF-8 版を DDSKK の順に変えると、libskk で引けない見出し語が出る。
v0.1.0 の UTF-8 版は、DDSKK の `limit` 10000 では全件引ける（1 の表）。範囲が狭くなる前に線形探索に切りかわるためである。

## 実装すること

### 検索の上限

- `scripts/check_ddskk.el` の `kaomoji-check` は、`skk-search-jisyo-file` を `limit` 10000 で呼ぶ。[ADR 0002](0002-check-dictionaries-with-ddskk.md) の 64 をこれで置きかえる
- 10000 は DDSKK が主辞書と追加の辞書に使う値であり、利用者が実際に引くのと同じ結果になる

### 言語環境

- `scripts/check_ddskk.el` は、`skk` を読み込んだ後に `(set-language-environment "Japanese")` を呼ぶ
- DDSKK をビルドせずに読み込むので、通常のインストールなら自動で読み込まれる `skk-num` も `require` する（[ADR 0002](0002-check-dictionaries-with-ddskk.md) の実装で分かったこと）

### 並び順の検査

`limit` 10000 では、小さな辞書はほぼ線形探索で引かれるので、引けるかどうかだけでは並び順の誤りに気づけない。
そこで、並び順を直接確かめる検査を足す。

- `scripts/check_ddskk.el` に `(kaomoji-check-order DICT CODING ORDER)` を足す。DICT の okuri-nasi の見出し語を上から順に読み、隣り合う 2 つが ORDER の昇順になっているかを確かめる
  - ORDER が `ddskk` のとき: `skk-string<`（日本語の言語環境）で比べる。EUC-JP 版に使う
  - ORDER が `utf-8` のとき: UTF-8 のバイト列で比べる。UTF-8 版に使う（libskk のため）
  - 昇順でない組があれば、その 2 つの見出し語を標準エラーに書き、すべて調べた後に終了コード 1 で終わる。すべて昇順なら、調べた見出し語の数を書いて終了コード 0 で終わる
- `scripts/check_ddskk.sh` で、本物の 2 つの辞書の並び順を検査する（EUC-JP 版は `ddskk`、UTF-8 版は `utf-8`）

### 小さな辞書（`tests/ddskk/`）

- `unsorted.euc` を足す。`ok.euc` の最後の行を先頭に移したもの
- 見出し語の並びを崩した辞書（`unsorted.euc`、`unsorted.utf8`）は、並び順の検査で失敗することを確かめる。[ADR 0002](0002-check-dictionaries-with-ddskk.md) では引けないことで確かめるとしていたが、`limit` 10000 では引けてしまうので、並び順の検査に置きかえる

### UTF-8 版の並び順

- 変えない。[ADR 0001](0001-kaomoji-dictionary-from-mozc.md) のとおり、UTF-8 のバイト順に並べる
- README の DDSKK の設定例の近くに、UTF-8 版の並び順は DDSKK の順と違うこと、今の大きさでは DDSKK で全件引けることを書く。DDSKK では EUC-JP 版を勧める

### [ADR 0002](0002-check-dictionaries-with-ddskk.md) のステータス

- [ADR 0002](0002-check-dictionaries-with-ddskk.md) のステータスの行を `採択→検索の上限と、並びを崩した辞書の確かめ方は ADR 0003` に変える
- [ADR 0002](0002-check-dictionaries-with-ddskk.md) のそのほかの内容（CI とリリースへの組み込み、文書）は、この ADR と一緒に実装する

### 文書

- `docs/specifications.md` の「DDSKK による検査」に、上限 10000、言語環境、並び順の検査を書く
- `README.md` に、DDSKK での UTF-8 版の並び順の注意を書く

## 実装しないこと

- UTF-8 版を DDSKK の順に並べかえること。libskk で引けなくなる
- 日本語以外の言語環境での検査。日本語以外の言語環境で DDSKK を使うと、EUC-JP 版でも `ー` とひらがなの順が DDSKK と合わない。今の辞書の大きさでは `limit` 10000 のため影響しないが、検査はしない
- DDSKK の二分探索の扱い（範囲を空にする処理や、言語環境で順が変わること）を、DDSKK の側で直す提案
- 辞書ごとに、行の長さから `limit` を計算すること。実際の DDSKK と同じ値で引くことを優先する
- 二分探索で引けなくなる大きさになったときの対策（辞書の分割など）。`limit` 10000 の検査が失敗したときに、別の ADR で決める

## テスト設計

`deno task test` で確かめるもの（Emacs を使わない）は増えない。UTF-8 版の並び順は、すでに `tests/lib_test.ts` の `renderUtf8` のテストで確かめている。

`scripts/check_ddskk.sh` の中で、本物の辞書の検査の前に次を実行し、期待どおりでなければ失敗させる。

1. `ok.euc`（`euc-jp`）と `ok.utf8`（`utf-8`）は、引く検査が終了コード 0 になる
2. `ok.euc` は `ddskk` の順で、`ok.utf8` は `utf-8` の順で、並び順の検査が終了コード 0 になる
3. `ok.utf8` を `ddskk` の順で検査すると、終了コード 1 になり、`あせ` と `あーん` の組が標準エラーに出る（2 つの順が実際に違うことを確かめる）
4. `unsorted.euc`（`ddskk`）と `unsorted.utf8`（`utf-8`）は、並び順の検査が終了コード 1 になり、先頭に移した見出し語が標準エラーに出る
5. `altered.utf8` は、引く検査が終了コード 1 になり、`しくしく` が標準エラーに出る
6. `v0.1.0.euc` は、引く検査が終了コード 1 になり、`もぐもぐ` が標準エラーに出る

実装の後に、実際に動かして次を確かめる。

1. 手元（macOS、arm64）で `scripts/check_ddskk_docker.sh` が終了コード 0 で終わる。本物の 2 つの辞書で、253 件を引けて、並び順の検査も通る
2. 検査のスクリプトで `limit` を 64 に戻すと、`ok.euc` の引く検査が失敗する（上限の値を変えた理由を確かめる。確かめた後は戻す）
3. 検査のスクリプトから `set-language-environment` を外すと、`ok.euc` の `ddskk` の順の検査が失敗する（言語環境を設定する理由を確かめる。確かめた後は戻す）
4. push の後、CI の `ddskk` ジョブで手元と同じ結果になる

## トレードオフ

- `limit` を 10000 にすると、今の辞書（okuri-nasi の範囲が EUC-JP 版で 16,808 文字、UTF-8 版で 14,572 文字）は 1 回だけ二分探索し、残りを線形探索で引く。並び順の誤りに引く検査だけでは気づけないので、並び順の検査を別に持つ。その代わり、検査が 2 種類になる
- 言語環境を日本語に固定するので、日本語以外の言語環境で DDSKK を使う人の結果は確かめない。DDSKK を使う人のほとんどは日本語の言語環境だと考える
- UTF-8 版は、DDSKK と libskk の両方の順には並べられない。libskk と skk-dev/dict の慣習に合わせ、DDSKK の利用者には EUC-JP 版を勧める。UTF-8 版を DDSKK で使っても、辞書が大きくならない限り全件引ける。大きくなって引けなくなれば、`limit` 10000 の検査が失敗して気づける

## 参考文献

- DDSKK `skk.el` の `skk-search-jisyo`（二分探索）と `skk-search-extra-jisyo-files`: https://github.com/skk-dev/ddskk/blob/e8bf68b27021c29781dbfa6a8ef7b770565bdb5b/skk.el
- DDSKK `skk-macs.el` の `skk-string<`: https://github.com/skk-dev/ddskk/blob/e8bf68b27021c29781dbfa6a8ef7b770565bdb5b/skk-macs.el
- DDSKK `skk-vars.el` の `skk-search-prog-list`、`skk-extra-jisyo-file-list`、`skk-jisyo-code`: https://github.com/skk-dev/ddskk/blob/e8bf68b27021c29781dbfa6a8ef7b770565bdb5b/skk-vars.el
- libskk `libskk/file-dict.vala`（`search_pos` と `strcmp`）: https://github.com/ueno/libskk/blob/master/libskk/file-dict.vala
- skk-dev/dict `SKK-JISYO.emoji`（UTF-8 のバイト順の UTF-8 の辞書）: https://github.com/skk-dev/dict/blob/master/SKK-JISYO.emoji
- GNU Emacs Lisp Reference Manual, Language Environments: https://www.gnu.org/software/emacs/manual/html_node/emacs/Language-Environments.html
