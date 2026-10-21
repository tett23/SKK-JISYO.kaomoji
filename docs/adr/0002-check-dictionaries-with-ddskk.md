# ADR 0002: 生成した辞書を DDSKK で引いて検査し、EUC-JP の対応表の違いを直す

ステータス: 採択→検索の上限と、並びを崩した辞書の確かめ方は [ADR 0003](0003-match-ddskk-check-to-real-lookups.md)

## 文脈

[ADR 0001](0001-kaomoji-dictionary-from-mozc.md) では、DDSKK で実際に変換できるかを「自動テストを書けないもの」とし、手で確かめることにしていた。
v0.1.0 の公開までに、この確認は行っていない。

`deno task test` は、辞書を作る関数の出力を文字列として確かめているだけである。
次のことは、DDSKK で引いてみないと分からない。

- 見出し語の並びが、DDSKK の二分探索で全件見つかる順になっているか（EUC-JP 版と UTF-8 版で並びが違う）
- `(concat "...")` の中の `\057`、`\073`、`\"`、`\\`、`\uXXXX` が、評価すると元の顔文字に戻るか
- `(concat "...")` で包まなかった候補が、DDSKK に Lisp の式として評価されて別の文字列に化けないか
- EUC-JP 版を `euc-jp` として読んだとき、文字が化けないか

DDSKK の辞書の検索と候補の評価は、Emacs Lisp の関数として呼べる。

- `skk-search-jisyo-file`（`skk.el`）: 辞書ファイルを `skk-henkan-key` で検索する。第 2 引数 `limit` が正なら二分探索をする。ファイルの代わりに `(ファイル . コーディングシステム)` も受けつける
- `skk-eval-string`（`skk-macs.el`）: 候補を表示する前に通す関数。`skk-lisp-prog-p` が真なら式として評価する

Emacs をバッチモード（`emacs --batch`）で動かせば、これらを呼べる。

検討の中で、EUC-JP 版の一部の顔文字が DDSKK では別の文字として読まれることが分かった（「検査すべき顔文字」の「対応表の違いと直し方」）。
辞書を作る Deno と Emacs とで、EUC-JP の対応表が 7 文字で違うためである。
この ADR では、検査を足すのと同時に、この違いを直す。直さずに検査だけを足すと、検査が最初から失敗するためである。

ただし、検査には Deno、Emacs、決まった版の DDSKK の 3 つが要る。
手元の開発環境（macOS）には Emacs が無く、CI（Ubuntu）とも環境が違う。
手元と CI で同じ環境を使えるように、検査の環境を Docker のイメージにまとめる。

## 検査すべき顔文字

検査はすべての見出し語に対して行う。そのうえで、壊れやすい顔文字を次の表にまとめる。
`tests/ddskk/` の小さな辞書（「テスト設計」）には、この表の顔文字をすべて入れる。
本物の辞書にもこれらが含まれていることを、`tests/data_test.ts` で確かめる。

### Emacs を使わない人のための前提

この節は、Vim は使うが Emacs には詳しくない読み手を想定して書く。

- **SKK の辞書の 1 行。** `よみ /候補1/候補2;注釈/` の形である。`/` は候補の区切り、`;` は候補と注釈の区切りになる。
  skkeleton（Vim と Neovim の SKK）が読む辞書も同じ形である。
- **DDSKK。** Emacs の上で動く SKK で、SKK の元祖にあたる実装である。
- **Emacs Lisp。** Emacs の設定と拡張に使う言語で、Vim にとっての Vim script にあたる。
  関数の呼び出しを `(関数名 引数1 引数2)` と書く。`(concat "a" "b")` は、Vim script の `"a" .. "b"` と同じく文字列をつなぐ。
- **候補を式として評価すること。** DDSKK は、候補が `(` と ASCII の文字で始まり `)` で終わると、Emacs Lisp の式として読み、評価した結果を表示する。
  Vim で言えば、候補の文字列をそのまま `eval()` に渡すようなものである。
  `(concat "...")` の形で書いた候補は、評価されて中の文字列になる。
- **文字列の中の書き方。** Emacs Lisp の `"..."` の中の `\057`（8 進数で `/`）、`\073`（`;`）、`\u2022`（`•`）、`\"`、`\\` は、Vim script のダブルクォートの文字列と同じ意味である。
- **文字コードの対応表。** Emacs は、EUC-JP のバイト列を Unicode の文字にするとき、Emacs 自身の対応表を使う。
  辞書を作る Deno は、Web ブラウザと同じ WHATWG の対応表を使う。一部の記号で、この 2 つの対応表が違う文字を当てる。
- **二分探索。** DDSKK は辞書を、見出し語のバイト列の昇順に並んでいるものとして、範囲を半分ずつ狭めて探す。
  並びが 1 か所でも崩れていると、その近くの見出し語が見つからなくなる。

### 一覧

| 顔文字 | 辞書での書き方（断りが無ければ両方の版で同じ） | 検査が必要な理由 |
|---|---|---|
| `(^^)/` | `(concat "(^^)\057")` | `/` は候補の区切りなので、そのまま書くと候補が `(^^)` と空の 2 つに割れる。`\057` が評価で `/` に戻るかを確かめる |
| `^^;`、`(;_;)` | `(concat "^^\073")`、`(concat "(\073_\073)")` | `;` は注釈の区切りなので、そのまま書くと `^^` と注釈に割れる。さらに DDSKK は、評価の前に候補を `;` の位置で切る。`\073` で書けば切られないことを確かめる |
| `¯\_(ツ)_/¯` | `(concat "¯\\_(ツ)_\057¯")` | `\` は Emacs Lisp の文字列のエスケープの記号なので、`\\` と書かないと消えたり次の文字と結びついたりする。`"` も同じ理由で `\"` と書く。`\` を含む唯一の顔文字である。EUC-JP 版では、`¯` も EUC-JP に無いので `\u00AF` になる |
| `(^^)`、`(-_-)`、`((+_+))` | `(concat "(^^)")` など | 包まずに書くと、DDSKK が `(^^)` を「`^^` という関数を引数なしで呼ぶ式」として読む。今の顔文字は、その名前の関数が無いので元の文字列のまま出る。しかし、`(-)` のような顔文字を足すと、引き算の関数が呼ばれて `0` が出る。包んだ形が評価で元に戻るかを確かめる |
| `(´・ω・｀)`、`` (´・ω・`) `` | そのまま | 2 文字目が ASCII でないので、DDSKK は式とみなさない。包まずに書いた候補が、評価されずにそのまま出ることを確かめる |
| `(๑•̀ㅂ•́)و✧`、`ʕ•ٹ•ʔ` | EUC-JP 版では `(concat "(\u0E51\u2022\u0300…")` | EUC-JP で表せない文字（`•`、`๑`、ハングル、アラビア文字、結合文字など）を `\uXXXX` で書いている。結合文字（`̀` のように、前の文字に重ねて表示する文字）を含めて、元の文字の並びに戻るかを確かめる |
| `＼(^o^)／` | そのまま | `＼` は EUC-JP の `A1C0` で、Deno と Emacs が同じ文字（U+FF3C）を当てる。対応表が一致する記号の対照として確かめる |
| `−３−` | EUC-JP 版では `(concat "\u2212３\u2212")` | `−`（U+2212、マイナス記号）は、Deno の対応表では EUC-JP に無いので `\u2212` で書いている。Emacs の対応表には有るが、`\u` で書けば対応表によらず元に戻ることを確かめる |
| `♪～(´ε｀ )`、`●～*`、`(´～｀)ﾓｸﾞﾓｸﾞ` | UTF-8 版ではそのまま。EUC-JP 版では `(concat "♪\uFF5E(´ε｀ )")` など（この ADR で変える） | `～`（U+FF5E、全角チルダ）を、v0.1.0 の生成スクリプトは EUC-JP の `A1C1` にする。Emacs は `A1C1` を `〜`（U+301C、波ダッシュ）として読むので、DDSKK では見た目のよく似た別の文字になる。この ADR の直し方で、元の `～` に戻ることを確かめる |
| `(－－〆)` | UTF-8 版ではそのまま。EUC-JP 版では `(concat "(\uFF0D\uFF0D〆)")`（この ADR で変える） | `－`（U+FF0D、全角ハイフンマイナス）を、v0.1.0 の生成スクリプトは `A1DD` にする。Emacs は `A1DD` を `−`（U+2212、マイナス記号）として読む。この ADR の直し方で、元の `－` に戻ることを確かめる |
| `(¯―¯٥)` | EUC-JP 版では `(concat "(\u00AF\u2015\u00AF\u0665)")`（この ADR で `―` を `\u2015` に変える） | `―`（U+2015、水平線）を、v0.1.0 の生成スクリプトは `A1BD` にする。Emacs は `A1BD` を `—`（U+2014、全角ダッシュ）として読む。v0.1.0 では、`\u` の式の中でも EUC-JP で表せる文字はそのまま書くので、式の中でも同じ問題が起きていた |
| `(´・ω・｀)ｼｮﾎﾞｰﾝ` | そのまま | 半角カナは、EUC-JP では `8E` で始まる 2 バイトになる。他の文字と長さが違うので、正しく読めるかを確かめる |
| `m(_ _)m`、`(　･ิω･ิ)` | そのまま、EUC-JP 版では `\u` の式 | 候補の中の半角の空白と全角の空白。SKK の辞書の行は、見出し語の後の最初の空白で区切るので、候補の中の空白が区切りと取り違えられないかを確かめる |
| 見出し語 `あーん` と `あせ`、`うーん` と `うぇ` | | EUC-JP では `ー`（`A1BC`）がひらがな（`A4xx`）より小さいので `あーん` が先になる。UTF-8 では `ー`（`E383BC`）がひらがな（`E381xx`、`E382xx`）より大きいので `あせ` が先になる。版ごとの並べ直しが正しく、二分探索で両方が見つかるかを確かめる |
| 見出し語 `にこにこ` | 候補 65 件 | 候補がいちばん多い見出し語（v0.1.0）。長い行の途中で候補が欠けないか、並び順が保たれるかを確かめる |

### 対応表の違いと直し方

v0.1.0 の EUC-JP 版では、上の表のうち `～`、`－`、`―` を含む 5 件の顔文字が、DDSKK で別の文字になる。

2026-10-21 に、Docker のイメージ（Debian 13、Emacs 30.1）で、Deno が文字を当てる全符号位置を比べた。JIS X 0208 の 1〜8 区と 16〜84 区が 6,879 か所、JIS X 0201 のカナが 63 か所で、計 6,942 か所である。
Deno（WHATWG の対応表）が当てる文字と、Emacs の `decode-coding-string` が当てる文字が違うのは、次の 7 か所だけだった。

| EUC-JP | Deno（WHATWG）が当てる文字 | Emacs が当てる文字 | v0.1.0 で当たる顔文字 |
|---|---|---|---|
| `A1BD` | `―` U+2015 水平線 | `—` U+2014 全角ダッシュ | `(¯―¯٥)` |
| `A1C1` | `～` U+FF5E 全角チルダ | `〜` U+301C 波ダッシュ | `♪～(´ε｀ )`、`●～*`、`(´～｀)ﾓｸﾞﾓｸﾞ` |
| `A1C2` | `∥` U+2225 平行記号 | `‖` U+2016 二重縦線 | なし |
| `A1DD` | `－` U+FF0D 全角ハイフンマイナス | `−` U+2212 マイナス記号 | `(－－〆)` |
| `A1F1` | `￠` U+FFE0 全角セント記号 | `¢` U+00A2 セント記号 | なし |
| `A1F2` | `￡` U+FFE1 全角ポンド記号 | `£` U+00A3 ポンド記号 | なし |
| `A2CC` | `￢` U+FFE2 全角否定記号 | `¬` U+00AC 否定記号 | なし |

これらは、同じ JIS の文字に、Unicode のどの文字を当てるかの流儀の違いである（Microsoft の CP932 に近い流儀と、JIS の規格表に近い流儀）。
どちらかが誤りというわけではない。

**直し方。** EUC-JP 版では、Deno の対応表の上の 7 文字（U+2015、U+FF5E、U+2225、U+FF0D、U+FFE0、U+FFE1、U+FFE2）を、EUC-JP で表せない文字と同じに扱う。
つまり、これらを含む候補を `(concat "...")` の形にし、これらの文字を `\uXXXX` で書く。
`\uXXXX` は Unicode の符号位置をそのまま指すので、対応表によらず元の文字に戻る。

逆向き（Emacs が当てる側の `—`、`〜`、`‖`、`−`、`¢`、`£`、`¬`）は、Deno の対応表では EUC-JP に無い文字なので、v0.1.0 でもすでに `\uXXXX` で書いている（例: `−３−`）。直す必要はない。

見出し語はひらがなと `ー` だけで、ヘッダーのコメントも ASCII とひらがなだけなので、この 7 文字は現れない。直すのは候補の書き方だけである。

## 実装すること

### EUC-JP 版の候補の書き方の変更

[ADR 0001](0001-kaomoji-dictionary-from-mozc.md) の「候補の書き方」を、次のように変える。

- EUC-JP 版で `(concat "...")` の形にする条件に、「Deno と Emacs で EUC-JP の対応表が違う 7 文字（U+2015、U+FF5E、U+2225、U+FF0D、U+FFE0、U+FFE1、U+FFE2）を含む」を足す。これらの文字は `\uXXXX` で書く
- 7 文字は `scripts/lib.ts` に定数として書く。辞書を作るときに Emacs を呼ぶことはしない
- UTF-8 版は変えない
- [ADR 0001](0001-kaomoji-dictionary-from-mozc.md) のステータスの行を `採択→EUC-JP 版の候補の書き方の一部は ADR 0002` に変える

### 対応表の違いの検査

7 文字の一覧が、使っている Emacs の対応表と合っているかを、DDSKK の検査と一緒に確かめる。
Emacs の版が変わって対応表が変わったときに気づけるようにするためである。

- `scripts/euc_table.ts`（`deno task euc-table`）を足す。Deno の対応表の全符号位置を `.cache/check/euc-jp-table.tsv` に書く。
  列はタブ区切りの「EUC-JP のバイト列（16 進数）」「Deno が当てる文字の符号位置（16 進数）」「7 文字に入っていれば `differs`、入っていなければ空」
- `scripts/check_ddskk.el` に、この表を読む検査を足す。各行のバイト列を `decode-coding-string` で `euc-jp` として読み、
  3 列目が空の行では Deno と同じ文字に、`differs` の行では違う文字になるかを確かめる。どちらかが外れたら、その行を標準エラーに書き、終了コード 1 で終わる

### 正解のデータ

- `scripts/expected.ts`（`deno task expected`）を足す。`deno task build` と同じ入力から `buildEntries`（`scripts/lib.ts`）で見出し語と候補を作り、
  `.cache/check/expected.tsv` に書く
- 1 行が 1 つの見出し語で、列はタブ区切りの「見出し語」「候補 1」「候補 2」…。候補は `(concat "...")` にする前の顔文字そのもの
- 行の順は見出し語の UTF-8 のバイト列の昇順にする
- 顔文字にタブと改行は含まれないので、エスケープはしない。含まれていれば `scripts/expected.ts` を失敗させる
- 辞書の出力の関数を通さずに作るので、出力の関数の誤りを検出できる

### Emacs Lisp の検査

`scripts/check_ddskk.el` を足し、次のように実行する。

```sh
emacs --batch -Q -L <DDSKK のディレクトリ> -l scripts/check_ddskk.el \
  --eval '(kaomoji-check "dist/SKK-JISYO.kaomoji" (quote euc-jp) ".cache/check/expected.tsv")'
```

- `skk` を `require` する。DDSKK はビルドせず、ソースのディレクトリを `load-path` に足して読み込む
- 正解のデータの各行について、`skk-henkan-key` に見出し語を束縛し、`skk-search-jisyo-file` を `(辞書 . コーディングシステム)` と `limit` 64（二分探索をする）で呼ぶ
- 返った候補をそれぞれ `skk-eval-string` に通し、正解の候補の並びと完全に一致するか比べる
- 辞書の okuri-nasi の行の数が、正解のデータの行の数と一致するか比べる（正解にない見出し語が辞書にないことを確かめる）
- 一致しない見出し語があれば、見出し語、期待した候補、実際の候補を標準エラーに書き、すべて調べた後に終了コード 1 で終わる。すべて一致すれば、調べた見出し語の数を書いて終了コード 0 で終わる
- EUC-JP 版は `euc-jp`、UTF-8 版は `utf-8` で読む

### 検査の手順をまとめるシェルスクリプト

`scripts/check_ddskk.sh` を足す。Docker のコンテナの中でも、Emacs と DDSKK のある環境でも、そのまま動く。

- DDSKK のディレクトリは環境変数 `DDSKK_DIR` で受け取る（既定は `/opt/ddskk`。Docker のイメージの中の置き場所）
- 次をこの順に行い、どれかが失敗したら止まって終了コード 1 を返す
  1. `deno task build --strict`
  2. `deno task expected` と `deno task euc-table`
  3. 対応表の違いの検査
  4. `tests/ddskk/` の小さな辞書で、検査そのものを確かめる（「テスト設計」の 4 つ）
  5. `dist/SKK-JISYO.kaomoji`（`euc-jp`）と `dist/SKK-JISYO.kaomoji.utf8`（`utf-8`）を検査する

### Docker のイメージ

リポジトリの直下に `Dockerfile` を置く。イメージには道具（Deno、Emacs、DDSKK）だけを入れ、リポジトリのファイルは入れない。
リポジトリは実行するときにマウントするので、データやスクリプトを変えてもイメージを作り直さなくてよい。

- 土台は Deno の公式イメージ `denoland/deno:debian-2.9.7` を、ダイジェスト（`sha256:fa335acdf6b72106eda2cb6a8cb5f4187e7630e357467489db4b2e7352d5e432`）で固定する。
  2026-10-21 の時点で Debian 13（trixie）で、amd64 と arm64 のイメージがある
- `apt-get install --no-install-recommends emacs-nox git ca-certificates` で Emacs と git を入れる。2026-10-21 の時点で Emacs は 30.1。
  Debian のパッケージの版は固定しない（Debian の更新で古い版が取れなくなるため）
- DDSKK はビルド引数 `DDSKK_COMMIT` のコミットを `git clone` して `/opt/ddskk` に置く。`DDSKK_COMMIT` に既定値は置かず、無ければビルドを失敗させる
- DDSKK のコミットは `sources.lock` に `ddskk_commit` として書く。初めは skk-dev/ddskk のタグ `ddskk-17.2_Mena`（`e8bf68b27021c29781dbfa6a8ef7b770565bdb5b`）にする
- 環境変数 `DDSKK_DIR=/opt/ddskk` と `HOME=/tmp` を設定する（任意の利用者 ID で動かすため）

Docker での実行は `scripts/check_ddskk_docker.sh` にまとめる。手元でも CI でもこのスクリプトを使う。

```sh
scripts/check_ddskk_docker.sh
```

- `sources.lock` から `ddskk_commit` を読み、`docker build --build-arg DDSKK_COMMIT=<コミット> -t skk-jisyo-kaomoji-ddskk - < Dockerfile` でイメージを作る。
  イメージにリポジトリのファイルを入れないので、ビルドのコンテキストは渡さない
- `docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/work" -w /work -e DENO_DIR=/work/.cache/deno skk-jisyo-kaomoji-ddskk scripts/check_ddskk.sh` で検査する
  - `--user` で、`dist/` と `.cache/` に作るファイルの所有者を実行した利用者にする
  - Deno のキャッシュは `.cache/deno` に置き、実行のたびに取り直さないようにする（`.cache/` は `.gitignore` 済み）
- イメージをレジストリには公開しない。実行する環境ごとに作る

### CI とリリース

- `.github/workflows/ci.yml` に `ddskk` ジョブを足し、`scripts/check_ddskk_docker.sh` を実行する。`build` ジョブとは別のジョブにして、並行して動かす
- `.github/workflows/release.yml` でも、辞書を作った後に `scripts/check_ddskk_docker.sh` を実行し、失敗したらリリースしない
- `.cache/` のキャッシュのキーに `sources.lock` を使うのは今までどおり

### 文書

- `docs/specifications.md` に「DDSKK による検査」の節を立て、上の内容を書く。ADR の一覧とファイル構成の表に足す
- `docs/specifications.md` の「候補の書き方」に 7 文字の扱いを足し、「既知の問題（EUC-JP 版）」の節を消す
- `README.md` の、EUC-JP 版の 5 件の顔文字が別の文字になるという注意書きを消す
- `README.md` に、Docker で検査する方法と、Docker を使わずに検査する方法（`DDSKK_DIR` を指定して `scripts/check_ddskk.sh` を実行する）を書く

## 実装しないこと

- AquaSKK、macSKK、libskk、skkeleton、NablaSKK など、DDSKK 以外の実装での検査。それぞれ別の実行環境が要り、`concat` の解釈の差はこの ADR では扱わない
- 変換の操作（キー入力から確定まで）の再現。辞書の検索と候補の評価だけを確かめる
- 複数の版の Emacs での検査
- Docker のイメージをレジストリ（GitHub Container Registry など）に公開すること
- 辞書の生成（`deno task build`）を Docker の中だけで行うようにすること。Docker が無くても、今までどおり手元の Deno で生成できる
- `deno task test` から Emacs や Docker を呼ぶこと。`deno task test` は今までどおり Deno だけで動く
- EUC-JP 版で、7 文字を Emacs の対応表に合うバイト列に置きかえること（例: `～` を、Emacs が `～` に戻す JIS X 0212 の `8FA2B7` にする）。Emacs 以外の EUC-JP の読み手で別の文字になるおそれがあり、`\uXXXX` のほうが読み手によらない
- UTF-8 版の変更。UTF-8 には対応表の違いが無い
- v0.1.0 のリリースの差しかえ。直した辞書は次の版で出す

## テスト設計

実装の前に次のテストを書いて失敗させてから実装する。

### `tests/expected_test.ts`（`deno task test`）

1. 正解のデータの書式: 見出し語 `にこ`、候補 `(^^)`、`^_^` の行が `にこ\t(^^)\t^_^` になる。`(concat` の形にはならない
2. 行の順は見出し語の UTF-8 のバイト列の昇順になる（`ああ` が `あー` より前）
3. タブか改行を含む顔文字があれば例外を投げる

### `tests/lib_test.ts` への追加

1. `candidateEucJp("♪～(´ε｀ )")` が `(concat "♪\uFF5E(´ε｀ )")` になる
2. `candidateEucJp("(－－〆)")` が `(concat "(\uFF0D\uFF0D〆)")` になる
3. `candidateEucJp("(¯―¯٥)")` が `(concat "(\u00AF\u2015\u00AF\u0665)")` になる（`―` が式の中でも `\u2015` になる）
4. 残りの 4 文字（`∥`、`￠`、`￡`、`￢`）もそれぞれ `\uXXXX` になる
5. 対応表が一致する `＼(^o^)／` は、今までどおりそのまま
6. `candidateUtf8` は 7 文字を含む候補を変えない（`♪～(´ε｀ )` はそのまま）
7. 7 文字の定数が、ちょうど U+2015、U+FF5E、U+2225、U+FF0D、U+FFE0、U+FFE1、U+FFE2 である

### `tests/euc_table_test.ts`（`deno task test`）

1. 対応表の行の書式: `A4A2` の行が `a4a2\t3042\t` になる。`A1C1` の行が `a1c1\tff5e\tdiffers` になる
2. `differs` の行がちょうど 7 行ある
3. 行の数が、JIS X 0208 の 1〜8 区と 16〜84 区で Deno が文字を当てる符号位置と、JIS X 0201 のカナの数の合計（2026-10-21 の時点で 6,879 と 63、計 6,942）になる

### `tests/data_test.ts` への追加

4. `sources.lock` に `ddskk_commit`（40 桁の 16 進数）がある
5. 本物の辞書（UTF-8 版）に、「検査すべき顔文字」の表の顔文字と見出し語がすべて含まれる。Mozc の更新で消えたら、表を見直すためにテストを失敗させる

### `scripts/check_ddskk.el` そのものの確かめ方

Emacs を使うので `deno task test` には入れず、`scripts/check_ddskk.sh` の中で、本物の辞書の検査の前に次の 4 つを実行する。
`tests/ddskk/` に小さな辞書と正解のデータを置き、終了コードで確かめる。期待どおりでなければ `scripts/check_ddskk.sh` を失敗させる。

1. 正しい辞書（「検査すべき顔文字」の表の顔文字をすべて含み、この ADR の書き方で書いたもの）と正解のデータの組では、終了コード 0 になる
2. 見出し語の並びを崩した辞書（二分探索で見つからない並び）では、終了コード 1 になる
3. 候補を 1 つ書きかえた辞書（例: `\057` を `\073` にした）では、終了コード 1 になり、その見出し語が標準エラーに出る
4. v0.1.0 の書き方の EUC-JP 版の辞書（`～` を `A1C1` のまま書いたもの）では、終了コード 1 になり、`～` を含む候補の見出し語が標準エラーに出る。直す前の書き方を、この検査が実際に見つけられることを確かめる

### 実装の後に実際に動かして確かめること

1. 手元（macOS、arm64）で `scripts/check_ddskk_docker.sh` が終了コード 0 で終わり、EUC-JP 版と UTF-8 版それぞれで 253 件（v0.1.0 の見出し語の数）を調べたことと、対応表の違いの検査が通ったことが出る
2. 直す前の生成スクリプト（v0.1.0 のタグ）で作った EUC-JP 版を検査すると、`～`、`－`、`―` を含む 5 件の顔文字の見出し語だけが不一致として報告される
3. 手元で実行した後、`dist/` と `.cache/` に作られたファイルの所有者が実行した利用者である
4. `DDSKK_COMMIT` を渡さずに `docker build - < Dockerfile` を実行すると失敗する
5. push の後、CI の `ddskk` ジョブ（ubuntu-latest、amd64）で、手元と同じ結果になる
6. ログに、`tests/ddskk/` の 4 つの検査が期待どおりの終了コードになったことが出る

## トレードオフ

- 手元で検査するには Docker が要る。Emacs と DDSKK を手元に入れる手順を利用者ごとに書くより、環境の差が出ない。Docker を使わない手順（`DDSKK_DIR` を指定して `scripts/check_ddskk.sh`）も残す
- イメージにリポジトリのファイルを入れず、マウントして使う。データを変えるたびにイメージを作り直さずに済む。その代わり、手元のファイルの状態（未コミットの変更を含む）を検査することになる。CI ではチェックアウトしたファイルを検査するので問題にならない
- CI では毎回イメージを作る（Emacs の導入と DDSKK の取得で 1 分前後）。レジストリに公開してキャッシュすれば速くなるが、公開と更新の手間が増えるので、まずは毎回作る
- 土台のイメージはダイジェストで固定するが、Debian のパッケージ（Emacs）の版は固定しない。Emacs の更新で結果が変わることはありうる。固定すると Emacs をソースから作るなど手順が重くなるので、変わったときに対応する
- DDSKK の内部の関数（`skk-search-jisyo-file`、`skk-eval-string`）を直接呼ぶので、DDSKK の版が変わると動かなくなることがある。DDSKK のコミットを固定し、上げるときにだけ直す
- 正解のデータを辞書と同じ `buildEntries` から作るので、`buildEntries` の誤り（並び順や読みの正規化の誤り）は検出できない。それは `tests/lib_test.ts` で確かめる。この検査が確かめるのは、辞書の書式、並び順、文字コード、候補の書き方が DDSKK で正しく読めることである

- EUC-JP 版で 7 文字を `\uXXXX` で書くと、それを含む候補は DDSKK でしか顔文字に戻らない。EUC-JP 版は、もともと EUC-JP で表せない文字を `\uXXXX` で書いており、DDSKK 向けと README に書いている。その方針の範囲内の変更である
- 7 文字の一覧を定数として持つので、Emacs の対応表が変わっても辞書の生成は気づかない。対応表の違いの検査が、CI とリリースで変化を見つける
- 検査と直し方を 1 つの ADR にまとめたので、ADR が大きくなる。分けると、検査だけを入れた時点で CI が失敗し続けるので、まとめるほうを選んだ

## 参考文献

- DDSKK `skk.el` の `skk-search-jisyo-file`、`skk-search-jisyo`: https://github.com/skk-dev/ddskk/blob/e8bf68b27021c29781dbfa6a8ef7b770565bdb5b/skk.el
- DDSKK `skk-macs.el` の `skk-lisp-prog-p`、`skk-eval-string`: https://github.com/skk-dev/ddskk/blob/e8bf68b27021c29781dbfa6a8ef7b770565bdb5b/skk-macs.el
- DDSKK のタグ `ddskk-17.2_Mena`: https://github.com/skk-dev/ddskk/releases/tag/ddskk-17.2_Mena
- GNU Emacs Manual, Command Line Arguments for Emacs Invocation（`--batch`、`-Q`、`-L`、`-l`、`--eval`）: https://www.gnu.org/software/emacs/manual/html_node/emacs/Emacs-Invocation.html
- Deno の公式 Docker イメージ `denoland/deno`: https://hub.docker.com/r/denoland/deno
- WHATWG Encoding Standard, EUC-JP の対応表（index-jis0208）: https://encoding.spec.whatwg.org/#euc-jp
- Docker のドキュメント, `docker build` で標準入力から Dockerfile を渡す（ビルドのコンテキストなし）: https://docs.docker.com/build/concepts/context/#empty-context
