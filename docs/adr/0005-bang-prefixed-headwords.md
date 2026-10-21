# ADR 0005: `!` を先頭に付けた見出し語で、顔文字だけを候補に出す

ステータス: 採択

## 文脈

この辞書は、ほかの辞書（SKK-JISYO.L など）と併せて使われる。
`にこにこ` のような読みで変換すると、ほかの辞書の候補（`ニコニコ` など）と顔文字が混ざって並ぶ。
顔文字だけを探したいときに、ほかの辞書の候補を飛ばす手間がかかる。

そこで、すべての読みについて、先頭に半角の `!` を付けた見出し語（`!にこにこ` など）も作り、その候補を顔文字だけにする。
`!` で始まりかなが続く見出し語は、ほかの辞書には無いので、`!` を付けて変換すれば顔文字だけが並ぶ。
同じ仕組みは、あとで SKK-JISYO.emoji-ja にも入れる予定である。そのため、マーカーは emoji-ja の見出し語とも重ならないものを選ぶ。

### マーカーの比べ方

マーカーには、次の条件を付けた。

- 利用者が想定する実装（DDSKK と AquaSKK）で、▽モードの最初の文字として入力できる
- skk-dev/dict の辞書と emoji-ja の見出し語に、そのマーカーで始まりかなが続くものが無い
- 辞書の区切り（`/`、`;`）や、DDSKK の特別な文字（数値変換の `#`、接頭辞と接尾辞の `>`）を避ける

2026-10-21 に、DDSKK（Docker のイメージ、Emacs 30.1、`ddskk-17.2_Mena`）と AquaSKK（手元の codefirst/aquaskk のエンジンのライブラリ）にキーを送り、`Q` で▽モードを始めてからマーカーと `nikoniko` を入力して変換した。

| マーカー | DDSKK | AquaSKK | そのほか | 判断 |
|---|---|---|---|---|
| `!`（半角） | 引けた。`!` は半角のまま入る | 引けた。`!` は半角のまま入る | skkeleton は `！`（全角）を入れる | 採用 |
| `@` | 日付の入力（`skk-today`）が始まり、入力できない | 入力できる | | 不採用 |
| `:` → `：` | 引けた | 入力できる | libskk、AquaSKK、skkeleton も `：` を入れる | 次点 |
| `?` → `？` | ▽モードでは `>` になり、使えない | | | 不採用 |
| `;` → `；` | | | skkeleton では▽モードを始めるキー | 不採用 |
| `#`、`>` | 数値変換、接頭辞と接尾辞に使われている | | | 不採用 |

- `!` は、DDSKK、AquaSKK、libskk、macSKK の既定のかな規則に項目が無い。DDSKK と AquaSKK は、規則に無い文字をそのまま入れる。
  AquaSKK のローマ字かな変換（`src/engine/trie/SKKRomanKanaConverter.cpp`）は、規則に無い文字をそのまま出力する
- `：` は、DDSKK と AquaSKK の両方で入力できるが、利用者の判断で、全角に変わらない半角の `!` を採用する
- 末尾に付ける形（`にこにこ!`）も、DDSKK と AquaSKK の両方で引けた。先頭に付ける形を選ぶ理由は「トレードオフ」に書く

### ほかの辞書との重なり

2026-10-21 に調べた。

- SKK-JISYO.L で `!` で始まる見出し語は `!`、`!!`、`!=` の 3 つで、`!` にかなが続く見出し語は無い
- SKK-JISYO.emoji には `!` で始まる見出し語が 3 つあるが、どれも `!` にかなは続かない（ASCII の記号の並び）
- SKK-JISYO.jinmei、geo、propernoun、station には無い
- SKK-JISYO.emoji-ja には `!` で始まる見出し語は無い

## 実装すること

### `!` の付いた見出し語

- 辞書のすべての見出し語 `r` について、見出し語 `!r` を作る。候補と並び順は `r` と同じにする
- 見出し語の規則に、「`!` の後にひらがなと `ー` が続くもの」を足す。`!` はこの辞書が作る見出し語の先頭にだけ付け、`data/extra.tsv` や取り込むデータの読みには書かない（書けば、今までどおり規則に合わない読みとして警告にする）
- `!` の付いた見出し語は、辞書を出力する直前に、`scripts/lib.ts` の純粋な関数（`withBangHeadwords`）で足す。`buildEntries` の結果（見出し語と候補）は変えない
- 全角の `！` を付けた見出し語は作らない
- 並び順は今までどおり、EUC-JP 版は EUC-JP のバイト順、UTF-8 版は UTF-8 のバイト順にする。`!`（`0x21`）はひらがなより前に並ぶ。DDSKK の比べ方（emacs-mule）でも、ASCII の `!` はひらがなより前になる

### 数え方

- ヘッダーとリリースノートの見出し語の数は、`!` の付いた見出し語を含めた、辞書の okuri-nasi の行の数にする
- 顔文字の数は変えない

### DDSKK による検査

- `deno task expected` が作る正解のデータに、`!` の付いた見出し語も入れる。今の検査（引く検査と並び順の検査）が、そのまま `!` の付いた見出し語も確かめる
- `tests/ddskk/` の小さな辞書と正解のデータに、`!` の付いた見出し語を 2 つ足す（`!あせ`、`!もぐもぐ`）

### 文書

- `docs/specifications.md` の「見出し語」に `!` の付いた見出し語を書き、ADR の一覧に足す
- `README.md` に、`!` を付けて変換すると顔文字だけが出ることと、入力の仕方（DDSKK と AquaSKK では `Q` の後に `!` と読みを入力する）を書く。確かめた実装と、確かめていない実装も書く

## 実装しないこと

- 全角の `！` を付けた見出し語。skkeleton など、`!` を `！` に変える実装では、`!` の付いた見出し語を引けない
- 末尾に `!` を付ける形（`にこにこ!`）
- `!` だけの見出し語。SKK-JISYO.L の `! /！/` などと重なる
- DDSKK と AquaSKK 以外の実装での確認と、その設定例
- SKK-JISYO.emoji-ja への導入。emoji-ja のリポジトリで別に決める

## テスト設計

実装の前に次のテストを書いて失敗させてから実装する。

### `tests/lib_test.ts`（`deno task test`）

1. `withBangHeadwords`: 見出し語 `にこ`（候補 `(^^)`、`^_^`）と `あせ`（候補 `^^;`）から、`!にこ`、`!あせ` が同じ候補と並び順で足される。元の見出し語は残る
2. `withBangHeadwords` は元の見出し語の集まりを書きかえない（新しい値を返す）
3. 出力の並び: UTF-8 版で `!あせ`、`!にこ`、`あせ`、`にこ` の順になる。EUC-JP 版でも `!` で始まる見出し語がひらがなの見出し語より前に並ぶ
4. 見出し語の規則: `!にこにこ` は辞書の見出し語として正しいが、`normalizeReading("!にこにこ")` は今までどおり `undefined`（読みとしては受け付けない）
5. ヘッダーの見出し語の数が、`!` の付いた見出し語を含めた数になる

### `tests/expected_test.ts`

6. 正解のデータに、`!` の付いた見出し語の行が、元の見出し語と同じ候補で入る

### `scripts/check_ddskk.sh`（Docker で実行）

7. `tests/ddskk/` の小さな辞書（`!あせ`、`!もぐもぐ` を足したもの）で、今の検査がすべて期待どおりになる
8. 本物の辞書で、EUC-JP 版を `limit` 10000 で、UTF-8 版を `limit` 0 で引く検査と、両方の並び順の検査が通る。見出し語の数は、[ADR 0004](0004-import-kaomoji-data-and-emoticon.md) の後の 566 の 2 倍の 1,132 になる

### 実装の後に実際に動かして確かめること

1. Docker の DDSKK で、本物の EUC-JP 版を `skk-extra-jisyo-file-list` に入れて、`Q ! n i k o n i k o SPC` が顔文字に変換される（この ADR の「文脈」と同じ方法）
2. 同じ環境で、SKK-JISYO.L と併せて `!にこにこ` を変換したとき、候補が顔文字だけになる
3. 手元の AquaSKK のエンジンで、本物の UTF-8 版を辞書にして `Q ! n i k o n i k o SPC` が顔文字に変換される（この ADR の「文脈」と同じ方法）

## トレードオフ

- 確かめるのは DDSKK と AquaSKK だけにする。利用者が使う実装はこの 2 つで、この 2 つで `!` を先頭に付けた見出し語を引ければよいと判断した
- skkeleton は、▽モードで `!` を全角の `！` に変えるので、`!` の付いた見出し語を引けない。libskk（fcitx5-skk、ibus-skk）と macSKK は、既定のかな規則に `!` の項目が無いことまでは確かめたが、実際に入力できるかは確かめていない。
  これらの実装の利用者は、`!` を付けずに引けば、今までどおり顔文字を使える（ほかの辞書の候補と混ざるだけである）
- 全角の `！` の見出し語も作れば skkeleton でも引けるが、見出し語がさらに増え、`！` が `!` と別の文字であることを利用者が意識する必要がある。対象の実装で要らないので作らない
- 先頭に付ける形は、`Q` などで▽モードを始めてから `!` を入力する必要がある。末尾に付ける形（`にこにこ!`）なら、`Nikoniko` で▽モードを始めて最後に `!` を押すだけでよい。
  しかし、先頭に付けると、変換する前から「顔文字を探している」ことが見出し語に表れ、tiwanari/emoticon の `@` の付いた読みなど、記号を先頭に付ける慣習とも合う。利用者の要望に従い、先頭に付ける形を選ぶ
- 見出し語が 2 倍になり、辞書の大きさもおよそ 2 倍になる（UTF-8 版で約 200 KB）。候補は同じなので、収録する顔文字は増えない
- `!` の付いた見出し語は、この辞書（と、あとで emoji-ja）だけが持つことを前提にしている。ほかの辞書が `!` にかなが続く見出し語を持つと、顔文字だけにはならない。2026-10-21 の時点の skk-dev/dict には無い
- AquaSKK で確かめたのは、手元の codefirst/aquaskk（コミット 0e7a88f）のエンジンのライブラリ（テスト用にビルド済みのもの）に、既定のかな規則とキー設定でキーを送った結果であり、AquaSKK のアプリそのものではない

## 参考文献

- DDSKK `skk-vars.el` の `skk-rom-kana-base-rule-list`: https://github.com/skk-dev/ddskk/blob/e8bf68b27021c29781dbfa6a8ef7b770565bdb5b/skk-vars.el
- DDSKK `skk-gadget.el` の `skk-today`: https://github.com/skk-dev/ddskk/blob/e8bf68b27021c29781dbfa6a8ef7b770565bdb5b/skk-gadget.el
- AquaSKK `data/config/kana-rule.conf`、`data/config/keymap.conf`、`src/engine/trie/SKKRomanKanaConverter.cpp`、`src/engine/tests/SKKInputSession_TEST.cpp`（コミット 0e7a88f4713299de2c42c71a088bfe458fc0e3cd）: https://github.com/codefirst/aquaskk/tree/0e7a88f4713299de2c42c71a088bfe458fc0e3cd
- skk-dev/dict `SKK-JISYO.L`、`SKK-JISYO.emoji`: https://github.com/skk-dev/dict
- skkeleton `denops/skkeleton/kana/rom_hira.ts`: https://github.com/vim-skk/skkeleton/blob/main/denops/skkeleton/kana/rom_hira.ts
- libskk `rules/default/rom-kana/default.json`: https://github.com/ueno/libskk/blob/master/rules/default/rom-kana/default.json
- macSKK `macSKK/kana-rule.conf`: https://github.com/mtgto/macSKK/blob/main/macSKK/kana-rule.conf
- tiwanari/emoticon `source.txt`（記号を先頭に付けた読みの先例）: https://github.com/tiwanari/emoticon/blob/3df8debd54eab6c6510fdd05e0ebc7773b4e3170/source.txt
