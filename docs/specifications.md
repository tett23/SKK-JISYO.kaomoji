# SKK-JISYO.kaomoji の仕様

この文書は、その時点の仕様の全体を書く。main では常に最新に保つ。
仕様の変更は ADR（`docs/adr/`）で決め、同じ変更でこの文書と `README.md` も直す。

## ADR の一覧

| ADR | ステータス | 内容 |
|---|---|---|
| [ADR 0001](adr/0001-kaomoji-dictionary-from-mozc.md) | 採択 | Mozc の顔文字データから SKK 辞書を生成する |
| [ADR 0002](adr/0002-check-dictionaries-with-ddskk.md) | 採択 | 生成した辞書を DDSKK で引いて検査し、EUC-JP の対応表の違いを直す（Docker の環境を含む） |
| [ADR 0003](adr/0003-match-ddskk-check-to-real-lookups.md) | 採択 | DDSKK による検査を、DDSKK の実際の辞書の引き方に合わせる |
| [ADR 0004](adr/0004-import-kaomoji-data-and-emoticon.md) | 採択 | kaomoji-data と tiwanari/emoticon の顔文字を取り込む |
| [ADR 0005](adr/0005-bang-prefixed-headwords.md) | 採択 | `!` を先頭に付けた見出し語で、顔文字だけを候補に出す |

## 配布物

[ADR 0001](adr/0001-kaomoji-dictionary-from-mozc.md)、[ADR 0004](adr/0004-import-kaomoji-data-and-emoticon.md) による。

| ファイル | 文字コード | 候補の書き方 |
|---|---|---|
| `SKK-JISYO.kaomoji` | EUC-JP | 顔文字そのもの。JIS X 0208 にない文字を含む顔文字は `(concat "\uXXXX")` の式（DDSKK 専用） |
| `SKK-JISYO.kaomoji.utf8` | UTF-8 | 顔文字そのもの。DDSKK 以外の実装向け（「DDSKK と UTF-8 版」） |
| `LICENSE` | | この辞書のライセンス（MIT License） |
| `LICENSE-Mozc.txt` | | Mozc のライセンス（BSD 3-Clause License） |
| `LICENSE-kaomoji-data.txt` | | kaomojikan/kaomoji-data のライセンス（MIT License） |
| `LICENSE-emoticon.txt` | | tiwanari/emoticon のライセンス（MIT License） |
| `SHA256SUMS` | | 上の 6 つの SHA-256（リリースにだけ添付） |

`LICENSE-kaomoji-data.txt` と `LICENSE-emoticon.txt` は、`sources.lock` で固定したコミットの `LICENSE`、`LICENSE.md` に手を加えず、冒頭に出典の段落を足したものである。
辞書のヘッダーにも、3 つのデータの出典（リポジトリとコミット）とライセンスの全文を書く。EUC-JP 版のヘッダーでは、EUC-JP で表せない文字を書きかえる（`©` は `(c)`、そのほかは `U+XXXX`）

## データの出典

[ADR 0004](adr/0004-import-kaomoji-data-and-emoticon.md) による。

| 名前 | リポジトリ | 使うファイル | 使う項目 |
|---|---|---|---|
| `mozc` | google/mozc | `src/data/emoticon/emoticon.tsv`、`categorized.tsv` | 顔文字と読み |
| `kaomoji_data` | kaomojikan/kaomoji-data | `kaomoji.json`、`LICENSE` | 各要素の `text`（顔文字）と `reading`（読み）。`text` に改行かタブを含む要素（複数行のアスキーアート）は捨てる |
| `emoticon` | tiwanari/emoticon | `source.txt`、`LICENSE.md` | タブ区切りの 1 列目（`@` を外して読み）と 2 列目（顔文字） |

- 各リポジトリのコミットと、取得するファイルの SHA-256 を `sources.lock` に固定する。形式は、`<名前>_commit = <コミット>` と `<名前>:<パス> = <SHA-256>`
- `deno task fetch`（`deno task build` の依存タスク）が `.cache/<名前>/<コミット>/<パス>` に取得する。SHA-256 が合わなければ失敗する
- このリポジトリで足す顔文字は `data/extra.tsv` に書く。列はタブ区切りで、顔文字、読み（空白区切り）。`#` で始まる行はコメント
- すべてのデータの顔文字について、前後の空白（半角と全角）を取り除いてから併合する

## 見出し語

- Mozc の読みを、NFKC 正規化、カタカナからひらがなへの変換、`～`・`〜`・`~` から `ー` への変換、`・` の削除の順で正規化する
- 正規化の後、ひらがなと `ー` だけの読みを見出し語にする。それ以外は警告を出して捨てる。
  `deno task build --strict` は、`data/extra.tsv` の読みの警告だけを失敗にする。外部のデータの警告では失敗しない（[ADR 0004](adr/0004-import-kaomoji-data-and-emoticon.md)）
- 読みが 1 つも残らなかった顔文字は、辞書に入らない。ヘッダーとリリースノートの顔文字の数は、辞書に入った顔文字の数である
- 送り仮名のある見出し語、英字の見出し語は作らない
- すべての見出し語について、先頭に半角の `!` を付けた見出し語（`!にこにこ` など）も作り、元の見出し語と同じ候補を同じ順に並べる（[ADR 0005](adr/0005-bang-prefixed-headwords.md)）。
  ほかの辞書には `!` にかなが続く見出し語が無いので、`!` を付けて変換すると顔文字だけが並ぶ
  - 見出し語の規則は、ひらがなと `ー` だけのもの、またはその先頭に `!` を 1 つ付けたもの。`deno task build` は、規則に合わない見出し語があれば失敗する
  - `!` は辞書を出力する直前に足す（`withBangHeadwords`）。`data/extra.tsv` や取り込むデータの読みには書かない
  - 全角の `！` を付けた見出し語は作らない
  - ヘッダーとリリースノートの見出し語の数は、`!` の付いた見出し語を含めた数である
  - DDSKK と AquaSKK では、`Q` で▽モードを始めて `!` と読みを入力する。skkeleton は `!` を全角の `！` に変えるので引けない。libskk と macSKK は確かめていない

## 候補の並び順

1. `data/extra.tsv` の行の順
2. Mozc の `emoticon.tsv` の行の順（Mozc がよく使う顔文字を前に置いた順）
3. Mozc の `categorized.tsv` にだけある顔文字の、ファイルの順
4. kaomoji-data の `kaomoji.json` の順
5. tiwanari/emoticon の `source.txt` の順

同じ顔文字が複数回現れたら最初の位置に 1 つにまとめ、読みは現れた順に和集合をとる。
分類（SMILE など）は使わない。注釈は付けない。

## 候補の書き方

次のどれかに当たる候補は `(concat "...")` の形にする。

- `/` か `;` を含む。`/` は `\057`、`;` は `\073` にする（SKK-JISYO.L と同じ書き方）
- `(` で始まり、2 文字目が ASCII で、`)` で終わる（`(^^)` など）。DDSKK の `skk-lisp-prog-p` が Lisp の式とみなし、
  先頭の要素が関数なら評価して置きかえてしまうのを防ぐ
- EUC-JP 版で、JIS X 0208（NEC 特殊文字と IBM 拡張を除く）と JIS X 0201 のカナで表せない文字を含む。
  表せない文字だけを `\uXXXX`（BMP の外は `\UXXXXXXXX`）にする
- EUC-JP 版で、Deno（WHATWG）と Emacs とで EUC-JP の対応表が違う 7 文字（U+2015 `―`、U+FF5E `～`、U+2225 `∥`、U+FF0D `－`、U+FFE0 `￠`、U+FFE1 `￡`、U+FFE2 `￢`）を含む。
  これらの文字も `\uXXXX` にする（[ADR 0002](adr/0002-check-dictionaries-with-ddskk.md)）。そのまま書くと、DDSKK では `—`、`〜`、`‖`、`−`、`¢`、`£`、`¬` として読まれる

`concat` の文字列の中では、`"` を `\"`、`\` を `\\` にする。空白はそのまま書く。

## 辞書の形式

- 1 行目は `;; -*- mode: fundamental; coding: <euc-jp|utf-8> -*-`
- ヘッダーのコメントに、辞書名、版（`VERSION`）、顔文字と見出し語の数、Mozc のコミット、この辞書のライセンス、Mozc のライセンス全文を書く
- `;; okuri-ari entries.`（空）と `;; okuri-nasi entries.` の節を置く
- 見出し語は、それぞれの文字コードのバイト列の昇順に並べる。EUC-JP と UTF-8 では `ー` とひらがなの順が逆になる
  - EUC-JP 版の順は、日本語の言語環境の DDSKK が二分探索で使う順（`skk-string<`）と同じになる
  - UTF-8 版の順は、libskk が UTF-8 の辞書の二分探索で使う順（UTF-8 のバイト列）であり、DDSKK の順とは違う。
    DDSKK は追加の辞書を `limit` 10000 で引くので、今の大きさの UTF-8 版は DDSKK でも全件引ける（[ADR 0003](adr/0003-match-ddskk-check-to-real-lookups.md)）

## DDSKK による検査

[ADR 0002](adr/0002-check-dictionaries-with-ddskk.md)、[ADR 0003](adr/0003-match-ddskk-check-to-real-lookups.md) による。

生成した 2 つの辞書を DDSKK で実際に引き、すべての見出し語について、候補が元の顔文字の並びと一致するかを確かめる。

- 正解のデータ: `deno task expected` が `.cache/check/expected.tsv` を作る。列はタブ区切りの「見出し語」「候補 1」「候補 2」…で、候補は `(concat "...")` にする前の顔文字そのもの。行は見出し語の UTF-8 のバイト列の昇順
- 引く検査: `scripts/check_ddskk.el` の `kaomoji-check` が、Emacs のバッチモードで DDSKK の `skk-search-jisyo-file` を呼び、返った候補を `skk-eval-string` に通して正解と比べる。
  EUC-JP 版は `limit` 10000 で引く。10000 は、DDSKK が主辞書と `skk-extra-jisyo-file-list` の辞書を引くときの値である。
  UTF-8 版は `limit` 0（線形探索だけ）で引き、候補の中身だけを確かめる（「DDSKK と UTF-8 版」、[ADR 0004](adr/0004-import-kaomoji-data-and-emoticon.md)）。
  辞書の okuri-nasi の見出し語の数が正解の行の数と一致するかも比べる。EUC-JP 版は `euc-jp`、UTF-8 版は `utf-8` で読む。
  DDSKK が文字コードを指定しない辞書に使う `euc-jis-2004` でも、この辞書の文字はすべて `euc-jp` と同じ文字として読まれる（2026-10-21 に 6,942 か所で確かめた）
- 並び順の検査: `kaomoji-check-order` が、見出し語の隣り合う 2 つが昇順かを確かめる。EUC-JP 版は DDSKK の `skk-string<` で、UTF-8 版は UTF-8 のバイト列で比べる。
  `limit` 10000 では小さな辞書はほぼ線形探索で引かれ、引く検査だけでは並びの誤りに気づけないためである
- 言語環境: DDSKK の `skk-string<` は見出し語を emacs-mule のバイト列で比べ、その順は Emacs の言語環境で変わる。検査は、DDSKK を使う人の普通の環境である日本語の言語環境（`set-language-environment "Japanese"`）で行う。
  DDSKK はビルドせずに読み込むので、通常は自動で読み込まれる `skk-num` も読み込む
- 対応表の違いの検査: `deno task euc-table` が Deno の EUC-JP の対応表を `.cache/check/euc-jp-table.tsv` に書き、`scripts/check_ddskk.el` が Emacs の対応表と比べる。違うのが上の 7 文字だけであることを確かめる
- 手順: `scripts/check_ddskk.sh` が、`deno task build --strict`、`deno task expected` と `deno task euc-table`、対応表の違いの検査、`tests/ddskk/` の小さな辞書による検査そのものの確認、2 つの辞書の引く検査と並び順の検査を順に行う。DDSKK のディレクトリは環境変数 `DDSKK_DIR`（既定は `/opt/ddskk`）で受け取る
- 環境: リポジトリの直下の `Dockerfile` に、Deno、Emacs、DDSKK をまとめる
  - 土台は `denoland/deno:debian-2.9.7` をダイジェストで固定する（Debian 13）。Emacs は Debian の `emacs-nox` で、版は固定しない
  - DDSKK は `sources.lock` の `ddskk_commit` のコミットを、ビルド引数 `DDSKK_COMMIT` で受け取って `/opt/ddskk` に置く
  - イメージにはリポジトリのファイルを入れず、実行するときにマウントする。レジストリには公開しない
- 実行: `scripts/check_ddskk_docker.sh` がイメージを作り、実行した利用者の ID でコンテナの中の `scripts/check_ddskk.sh` を実行する。手元でも CI でもこのスクリプトを使う
- CI の `ddskk` ジョブと、リリースのワークフローで実行する。リリースでは失敗したら公開しない

## DDSKK と UTF-8 版

[ADR 0004](adr/0004-import-kaomoji-data-and-emoticon.md) による。

- DDSKK では EUC-JP 版を使う
- UTF-8 版は、libskk（fcitx5-skk、ibus-skk）の二分探索のために UTF-8 のバイト順に並べる。日本語の言語環境の DDSKK の比べ方（EUC-JP の順）とは、`ー` とひらがなの前後が逆になる
- このため、UTF-8 版を DDSKK で使うと、`ー` を含む見出し語の一部が引けない（2026-10-21 の辞書で `えー`、`しーん` など 8 件）

## リリース

- `VERSION` に版を書く。タグ `v<VERSION>` を push すると、`.github/workflows/release.yml` が辞書を生成して GitHub Releases に公開する。タグと `VERSION` が合わなければ失敗する
- `-` を含むタグ（`v0.1.0-rc1` など）はプレリリースにする
- リリースノートは英語で、`scripts/release_notes.ts` が生成する
  - 冒頭は前のリリースへの絶対リンクを含む `Changes since <tag>.`。前のリリースがなければ `First release.`
  - 前のリリースは、GitHub Releases の一覧で今回のタグを除いた最新のもの
  - 節は Added、Changed、Removed、Fixed、Dictionary、Files の順。中身のない節は書かない（Dictionary と Files は常に書く）
  - 前のリリースから今回のタグまでの、マージを除くコミットを件名の最初の単語で分ける

    | 最初の単語（大文字小文字は区別しない） | 節 |
    |---|---|
    | `Add`、`Introduce`、`Create`、`Support` | Added |
    | `Remove`、`Delete`、`Drop` | Removed |
    | `Fix`、`Correct` | Fixed |
    | それ以外 | Changed |

  - 件名が版番号だけのコミット（`v0.1.0` など）は載せない
  - 各行には短い SHA でコミットへの絶対リンクを付ける。件名の `(#123)` は PR への、`ADR NNNN` はそのタグ時点の ADR のファイルへの絶対リンクにする

## ADR の運用

- ADR は `docs/adr/` に置き、ファイル名は 4 桁の連番と kebab-case の名前にする
- ADR は作成時点ではコミットせず、人間のレビューを受けてから、ステータスを `採択` にしてコミットする
- 一度コミットした ADR は、ステータスの行とリンクを除いて変更しない。仕様を変える場合は新しい ADR を作る
- ADR を破棄する場合は、ステータスを `破棄` にし、理由をこの文書に書く
- [adr-guard](https://github.com/tett23/adr-guard) で、git の pre-commit hook（`.githooks/pre-commit`）と CI（`adr` ジョブ）の二か所で強制する

## ファイル構成

| パス | 内容 |
|---|---|
| `data/extra.tsv` | このリポジトリで足す顔文字 |
| `sources.lock` | 取り込むデータのコミットと、取得するファイルの SHA-256（[ADR 0004](adr/0004-import-kaomoji-data-and-emoticon.md)）。DDSKK のコミット（[ADR 0002](adr/0002-check-dictionaries-with-ddskk.md)） |
| `VERSION` | 版 |
| `scripts/lib.ts` | 解析、正規化、候補の集め方、EUC-JP の符号化、辞書の出力（純粋な関数） |
| `scripts/fetch_sources.ts` | 取り込むデータの取得 |
| `scripts/sources.ts` | 取り込むデータの読み込みと出典（[ADR 0004](adr/0004-import-kaomoji-data-and-emoticon.md)） |
| `scripts/build.ts` | 辞書とライセンスファイルの生成 |
| `scripts/release_notes.ts` | リリースノートの生成 |
| `scripts/expected.ts` | DDSKK による検査の正解のデータの生成（[ADR 0002](adr/0002-check-dictionaries-with-ddskk.md)） |
| `scripts/check_ddskk.el` | DDSKK による検査（同上） |
| `scripts/euc_table.ts` | EUC-JP の対応表の違いの検査に使う、Deno の対応表の書き出し（同上） |
| `scripts/check_ddskk.sh` | DDSKK による検査の手順（同上） |
| `scripts/check_ddskk_docker.sh` | Docker での DDSKK による検査の実行（同上） |
| `Dockerfile` | DDSKK による検査の環境（同上） |
| `tests/ddskk/` | DDSKK による検査そのものを確かめる小さな辞書（同上） |
| `tests/` | テスト（`deno task test`） |
| `docs/specifications.md` | この文書 |
| `docs/adr/` | ADR |
| `.githooks/pre-commit` | adr-guard の pre-commit hook |
