# ADR 0001: Mozc の顔文字データから SKK 辞書を生成する

ステータス: 採択→EUC-JP 版の候補の書き方の一部は [ADR 0002](0002-check-dictionaries-with-ddskk.md)、データの出典と候補の並び順は [ADR 0004](0004-import-kaomoji-data-and-emoticon.md)、UTF-8 版の候補の書き方の一部は [ADR 0006](0006-unwrap-lisp-like-kaomoji-in-utf8.md)

## 文脈

SKK で顔文字（`` (´・ω・`) `` のような文字の組み合わせ）を読みから変換できる辞書を作る。
skk-dev/dict には絵文字の辞書（SKK-JISYO.emoji）はあるが、顔文字の辞書はない。

顔文字と読みの対応は、[Mozc](https://github.com/google/mozc)（Google 日本語入力のオープンソース版）の
`src/data/emoticon/emoticon.tsv` と `src/data/emoticon/categorized.tsv` にある（BSD 3-Clause License）。
自分で読みを考えるより、実績のあるデータを使うほうが、読みの網羅性と妥当性が高い。

同じ作者の [SKK-JISYO.emoji-ja](https://github.com/tett23/SKK-JISYO.emoji-ja) は、Mozc の絵文字データの取り込み、
EUC-JP 版と UTF-8 版の 2 種の配布、Deno による生成、GitHub Actions でのリリースを行っている。
本リポジトリも同じ構成に合わせる。ただし、本リポジトリは最初から ADR（`docs/adr/`）で設計を決め、
[adr-guard](https://github.com/tett23/adr-guard) で守る。

### Mozc のデータの性質（2023-12-18 のコミット 85590f17 時点）

- `emoticon.tsv`: 438 行。列は「顔文字」「読み（空白区切り）」「分類（空白区切り、空のこともある）」。
  行の順は Mozc が候補に出す順で、よく使う顔文字が前にある。同じ顔文字が別の読みで複数行あることがある（25 件）
- `categorized.tsv`: 206 行。列は「顔文字」「分類」「読み（空白区切り）」。`emoticon.tsv` にない顔文字が 6 件ある
- 分類は SMILE、SWEAT、SADNESS、DISPLEASURE、SURPRISE、OTHER の 6 種で、複数のこともある
- 読みは原則ひらがなと長音「ー」だけだが、`やだね～`、`どうしましょう・・` のように記号を含むものが少数ある
- 顔文字には `/`、`;`（59 件）、空白（71 件）、`"`、`\`（`¯\_(ツ)_/¯`）を含むものがある
- 顔文字のうち 49 件は、JIS X 0208 にない文字（`•`、`๑`、`✧`、結合文字など）を含み、EUC-JP で表せない

## 実装すること

### 配布物

| ファイル | 文字コード | 候補の書き方 |
|---|---|---|
| `SKK-JISYO.kaomoji` | EUC-JP | 顔文字そのもの。EUC-JP で表せない文字を含む顔文字は Emacs Lisp の式 |
| `SKK-JISYO.kaomoji.utf8` | UTF-8 | 顔文字そのもの |

ファイル名は skk-dev/dict と SKK-JISYO.emoji-ja の慣習に合わせ、EUC-JP 版を無印、UTF-8 版を `.utf8` にする。
あわせて `LICENSE`（本リポジトリの MIT License）と `LICENSE-Mozc.txt`（Mozc のライセンス）を `dist/` に出力し、リリースに添付する。

### データの取得

- Mozc のコミットと 2 つのファイルの SHA-256 を `sources.lock` に固定する。`scripts/fetch_sources.ts` が
  `https://raw.githubusercontent.com/google/mozc/<コミット>/<パス>` から `.cache/` に取得し、SHA-256 が合わなければ失敗する
- 取得は `deno task build` の依存タスクとして自動で行う。取得済みでハッシュが合えば取り直さない

### 見出し語（読み）

- Mozc の読みを次の順で正規化する。NFKC 正規化、カタカナをひらがなに、`～`・`〜` を `ー` に、`・` を削除
- 正規化の後、ひらがなと `ー` だけからなる読み（`^[ぁ-ゖー]+$`）だけを見出し語にする。それ以外は警告を出して捨てる
- 送り仮名のある見出し語は作らない（okuri-ari の節は空）

### 候補の集め方と並び順

1. `data/extra.tsv`（本リポジトリで足す顔文字。列は「顔文字」「読み（空白区切り）」。`#` で始まる行はコメント）
2. `emoticon.tsv` の行の順
3. `categorized.tsv` にだけある顔文字（ファイルの順）

- 同じ顔文字が複数回現れたら、最初の位置に置き、読みは現れた順に和集合をとる（`categorized.tsv` の読みも足す）
- 同じ読みの中の候補の順は、上の順に従う。つまり `data/extra.tsv` の顔文字が先、次に Mozc がよく使う順
- 分類（SMILE など）は使わない。注釈は付けない。顔文字は見れば分かり、注釈は候補の一覧を読みにくくする

### 候補の書き方

- `/` と `;` は SKK の辞書で区切りに使われるため、含む候補は `(concat "...")` の形にし、`/` を `\057`、`;` を `\073` に置きかえる
  （SKK-JISYO.L と同じ書き方）。`"` は `\"`、`\` は `\\` にする
- DDSKK は、`(` で始まり、2 文字目が ASCII で、`)` で終わり、全体を 1 つの S 式として読める候補を Lisp の式とみなし、
  先頭の要素が関数なら評価して、成功すれば評価結果に置きかえる（`skk-macs.el` の `skk-lisp-prog-p` と `skk-eval-string`）。
  Mozc の顔文字のうち 92 件（`(^^)`、`(-_-)` など）がこの形に当たる。今の Mozc の顔文字は評価に失敗するので元の文字列のまま出るが、
  `(-)` のような顔文字を足すと `0` に化ける。そこで、`(` で始まり、2 文字目が ASCII で、`)` で終わる候補も `(concat "...")` の形にする
- 空白はそのまま書く（SKK-JISYO.L にも空白を含む候補がある）
- EUC-JP 版では、JIS X 0208（NEC 特殊文字などの拡張を除く）と JIS X 0201 のカナで表せない文字を含む候補を
  `(concat "...")` の形にし、表せない文字だけを `\uXXXX`（Emacs Lisp の文字列の記法）にする。
  この式を評価して顔文字にできるのは DDSKK（Emacs）だけである。これは SKK-JISYO.emoji-ja の EUC-JP 版と同じ方針で、
  EUC-JP 版を使う環境は実質 DDSKK に限られるため、候補を落とすより式にして残す
- UTF-8 版の候補は、上の条件に当たるものを除き、顔文字そのものを書く

### 辞書の形式

- 先頭に `;; -*- mode: fundamental; coding: <euc-jp|utf-8> -*-` の行、辞書名、版（`VERSION`）、収録数、
  Mozc のコミット、本リポジトリのライセンス、Mozc のライセンス全文（`NOTICE`）をコメントで書く
- `;; okuri-ari entries.`（空）と `;; okuri-nasi entries.` の節を置く
- 見出し語は、それぞれの文字コードのバイト列の昇順に並べる（DDSKK の二分探索のため）。
  EUC-JP と UTF-8 では `ー` とひらがなの順が逆になるので、版ごとに並べ直す

### ツールと構成

- Deno 2 と TypeScript で書く。クラスは使わない。純粋な関数を `scripts/lib.ts` に置き、ファイルの入出力は各スクリプトの `import.meta.main` に閉じる
- `deno task build` で `dist/` に生成する。`deno task test` でテストを実行する
- `VERSION` に版を書く。タグ `v<VERSION>` を push すると `.github/workflows/release.yml` が GitHub Releases に公開する

### リリースノート

- 英語で書く（利用者の規則どおり）。`scripts/release_notes.ts` が生成する
- 節は Added、Changed、Removed、Fixed、Dictionary、Files の順。中身のない節は書かない（Dictionary と Files は常に書く）
- 冒頭は前のリリースへの絶対リンクを含む `Changes since <tag>.`。前のリリースがなければ `First release.`
- 前のリリースは GitHub Releases の一覧で今回のタグを除いた最新のもの。そのタグから今回のタグまでの、マージを除くコミットを、件名の最初の単語で分ける

  | 最初の単語（大文字小文字は区別しない） | 節 |
  |---|---|
  | `Add`、`Introduce`、`Create`、`Support` | Added |
  | `Remove`、`Delete`、`Drop` | Removed |
  | `Fix`、`Correct` | Fixed |
  | それ以外 | Changed |

- 件名が版番号だけのコミット（`v0.1.0` など）は載せない
- 各行には短い SHA（7 桁）でコミットへの絶対リンクを付ける。件名の `(#123)` は PR への、`ADR NNNN` はそのタグ時点の ADR のファイルへの絶対リンクにする
- Dictionary には見出し語の数と顔文字の数を書く
- `-` を含むタグ（`v0.1.0-rc1` など）はプレリリースにする

### ADR の運用と adr-guard

- ADR は `docs/adr/` に置き、ファイル名は 4 桁の連番と kebab-case の名前にする。節は「文脈」「実装すること」「実装しないこと」「テスト設計」「トレードオフ」「参考文献」
- ADR は作成時点ではコミットせず、人間のレビューを受けてから、ステータスを `採択` にしてコミットする
- 一度コミットした ADR は、ステータスの行とリンクを除いて変更しない。仕様を変える場合は新しい ADR を作る
- `.githooks/pre-commit` に `exec adr-guard pre-commit --allow-status --allow-links` を置き、実行権限を付ける。clone ごとに `git config core.hooksPath .githooks` を実行する
- CI に `tett23/adr-guard@v0.8.2` の `adr` ジョブを置く
- 仕様の全体は `docs/specifications.md` に書き、main では常に最新に保つ。ADR で仕様が変わったら、同じ変更で `docs/specifications.md` と `README.md` も直す

### CI

- push と pull request で、`deno fmt --check`、`deno lint`、`deno task test`、`deno task build` を実行し、生成した辞書をアーティファクトにする
- `.cache/` は `sources.lock` のハッシュをキーにキャッシュする
- GitHub Actions は Node 24 以降で動く最新のメジャー版を使う（`actions/checkout@v7`、`actions/cache@v6`、`actions/upload-artifact@v7`、`denoland/setup-deno@v2`）

## 実装しないこと

- 自分で考えた読みの大量追加。まず Mozc の読みだけで公開し、足りない読みは `data/extra.tsv` に足す
- 分類（SMILE など）を注釈や別辞書にすること
- 送り仮名のある見出し語、英字の見出し語（abbrev モード）
- Mozc のコミットを自動で最新にするタスク。`sources.lock` を手で直す手順を README に書く
- EUC-JP 版で、表せない文字を含む顔文字を落とすこと、または似た文字に置きかえること
- 前のリリースとの候補の差分をリリースノートに載せること（SKK-JISYO.mahjong-riichi にはあるが、顔文字は Mozc の更新が少なく、差分の価値が小さい）
- Node.js での実行（SKK-JISYO.emoji-ja にはあるが、実行環境を Deno に限って構成を単純にする）
- Claude Code の hook（`.claude/settings.json`）。利用者の全体の設定で有効になっているため

## テスト設計

`tests/` に、実装の前に次のテストを書いて失敗させてから実装する（`deno task test`）。

### `tests/lib_test.ts`

1. `emoticon.tsv` の解析: 見出し行を飛ばし、顔文字と読み（空白区切り）を行の順に返す。分類の列が空でもよい
2. `categorized.tsv` の解析: `#` の見出し行を飛ばし、顔文字と読みを返す（3 列目が読み）
3. `data/extra.tsv` の解析: `#` のコメント行と空行を飛ばす
4. 読みの正規化: `ハート`→`はーと`、`やだね～`→`やだねー`、`どうしましょう・・`→`どうしましょう`、`ｱｾ`→`あせ`。`abc`、`11:30`、空文字は無効（`undefined`）
5. 顔文字の併合: 同じ顔文字が 2 回現れたら、最初の位置に 1 つにまとめ、読みは現れた順の和集合になる
6. 候補の集め方: 同じ読みの候補の順が、extra、emoticon の順、categorized だけの顔文字の順になる。無効な読みは警告になり、候補にならない
7. 候補の書き方: `(^^)/`→`(concat "(^^)\057")`、`^^;`→`(concat "^^\073")`、`¯\_(ツ)_/¯`→`(concat "¯\\_(ツ)_\057¯")`、`(^^)`→`(concat "(^^)")`、`(-)`→`(concat "(-)")`、`` (´・ω・`) ``（2 文字目が ASCII でない）→そのまま、`^_^`→そのまま、空白を含む `・ω・ ・ω・`→そのまま
8. EUC-JP の符号化: `あ`→`A4A2`、`ー`→`A1BC`、`ﾟ`→`8EDF`、`Д`→`A7A5`、`ω`→`A6D8`。`•`、`①`（NEC 特殊文字）は表せない
9. EUC-JP 版の候補: `•ω•♡` が `(concat "\u2022ω\u2022\u2661")` になり、表せない文字だけが `\uXXXX` になる。表せる文字だけの `` (´・ω・`) `` はそのまま
10. 辞書の出力: UTF-8 版と EUC-JP 版で、ヘッダーに `coding:`、版、Mozc のコミット、Mozc の著作権表示があり、okuri-ari の節が空で、見出し語がそれぞれのバイト列の昇順（UTF-8 では `ー` がひらがなの後、EUC-JP では前）に並ぶ
11. `sources.lock` の解析: Mozc のコミットと、パスごとの SHA-256 を返す

### `tests/release_notes_test.ts`

1. 分類: `Add …`→Added、`add …`→Added、`Introduce …`→Added、`Remove …`→Removed、`Drop …`→Removed、`Fix …`→Fixed、`Bump …`→Changed
2. 版番号だけの件名（`v0.1.0`、`v0.1.0-rc1`）は除かれ、`v2 support` は除かれない
3. コミット・PR・ADR のリンク: `(#12)` が PR へ、`ADR 0001` が `docs/adr/0001-*.md` へ、ない番号はそのまま
4. 本文: 前のリリースがあるとき `Changes since [v0.1.0](…).` で始まり、空の節は出ず、Dictionary と Files は出る。ないとき `First release.`

### `tests/data_test.ts`

1. `data/extra.tsv` のすべての読みが有効である
2. `sources.lock` に Mozc のコミット（40 桁）と 2 つのファイルのハッシュ（64 桁）がある

### 自動テストを書けないもの

実装の後に実際に動かして確かめる。

1. `deno task build` が `dist/` に 2 つの辞書と 2 つのライセンスファイルを作る。EUC-JP 版を `iconv -f EUC-JP -t UTF-8` で読めて、`\u` の式になった顔文字が 49 件前後ある
2. `adr-guard check-status` と `adr-guard links` が終了コード 0 で終わる
3. `git config core.hooksPath .githooks` の後、コミット済みの ADR の本文を書きかえてコミットすると pre-commit hook が拒否し、ステータスの行だけの変更は通る
4. push の後、CI の `build` と `adr` のジョブが成功する
5. DDSKK（UTF-8 版と EUC-JP 版）で `しょぼーん` から `` (´・ω・`) `` に変換できる

## トレードオフ

- Mozc の読みは「にこにこ」「にこ」「にこっ」のように多くの顔文字に付いており、1 つの読みに 60 件以上の候補が並ぶ。
  候補の絞り込みより網羅を優先し、Mozc の順（よく使う順）を保って並べることで実用性を確保する
- `(` と ASCII の文字で始まり `)` で終わる顔文字（`(^^)` など 92 件）を `(concat "...")` で包むので、辞書を目で読むと分かりにくい。
  DDSKK のほか、AquaSKK、macSKK、libskk、skkeleton なども `concat` を解釈するので、変換の結果は変わらない。DDSKK で将来の顔文字が評価結果に化ける危険を避けるほうを選ぶ
- EUC-JP 版で `\uXXXX` の式を使うと、DDSKK 以外では読めない候補が 49 件ほど混ざる。EUC-JP 版を使う環境はほぼ DDSKK だけなので、候補を落とすより残すほうを選ぶ
- `data/extra.tsv` を Mozc より前に置くと、Mozc の順位を本リポジトリの判断で上書きできる。その代わり、extra に書いた顔文字が Mozc にもある場合、順位が変わる
- 注釈を付けないと、分類や出典が候補の一覧から分からない。顔文字は見れば分かるので、一覧の読みやすさを優先する
- Node.js での実行を外したので、Deno のない環境では生成できない。配布物は Releases にあるので、利用者には影響しない

## 参考文献

- Mozc `src/data/emoticon/emoticon.tsv`、`categorized.tsv`（コミット 85590f17409ebff387285f9665f362ede83ebd8e）: https://github.com/google/mozc/tree/85590f17409ebff387285f9665f362ede83ebd8e/src/data/emoticon
- Mozc のライセンス: https://github.com/google/mozc/blob/85590f17409ebff387285f9665f362ede83ebd8e/LICENSE
- SKK 辞書の書式（skk-dev/dict の README と SKK-JISYO.L の `(concat "...\057...")` の用例）: https://github.com/skk-dev/dict
- SKK-JISYO.emoji-ja（EUC-JP 版で Emacs Lisp の式を使う先行例）: https://github.com/tett23/SKK-JISYO.emoji-ja
- DDSKK の `skk-lisp-prog-p` と `skk-eval-string`: https://github.com/skk-dev/ddskk/blob/master/skk-macs.el
- adr-guard: https://github.com/tett23/adr-guard
