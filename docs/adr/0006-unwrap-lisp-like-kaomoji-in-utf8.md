# ADR 0006: UTF-8 版では、DDSKK のためだけに `(concat "...")` で包まない

ステータス: 採択

## 文脈

[ADR 0001](0001-kaomoji-dictionary-from-mozc.md) は、次の候補を両方の版で `(concat "...")` の形に書くと決めた。

- `/` か `;` を含む顔文字。`/` は `\057`、`;` は `\073` にする（SKK の辞書の区切りのため）
- `(` で始まり、2 文字目が ASCII で、`)` で終わる顔文字（`(^^)` など）。DDSKK が Lisp の式として評価するのを防ぐため

[ADR 0005](0005-bang-prefixed-headwords.md) の確認で、AquaSKK がこの形を評価せず、`(concat "(T_T)")` のように式のまま表示すると分かった。
2026-10-21 の辞書（顔文字 2,221 件）では、UTF-8 版の 491 件（約 2 割）がこの形である。

| 理由 | 件数 |
|---|---|
| `/` か `;` を含む | 155 |
| `(` と ASCII の文字で始まり `)` で終わる（DDSKK のためだけに包んだもの） | 336 |

### `(concat "...")` は SKK の辞書の標準の書き方である

- DDSKK のマニュアルの「辞書の書式」は、1 行に書けない候補を `(concat "改\n行")` のような Lisp の式にして辞書に収めると説明している
- DDSKK は、利用者が登録した語に `/`、改行、`"` が含まれると、`skk-quote-char`（`skk.el`）で `(concat "...")` の形にして辞書に保存する
- skk-dev/dict の SKK-JISYO.L（コミット 14a1df7）には、`(concat "...")` を使う行が 10 行ある。例: `ao /(concat "and\057or")/`、`io /イオ/Ｉ／Ｏ/入出力/(concat "I\057O")/`、`dosv /(concat "DOS\057V")/`
- macSKK は、`(concat "` で始まる候補の `\057` と `\073` を戻し、利用者の辞書に保存するときも `/` と `;` を含む語をこの形で書く（`macSKK/Entry.swift`）
- libskk は、`(` で始まる候補を式として読み、`concat` を評価する（`libskk/state.vala`、`libskk/expr.vala`）

### AquaSKK の挙動

AquaSKK（codefirst/aquaskk、コミット 0e7a88f）には、`(concat "...")` を評価する処理が無い。
AquaSKK 独自の `[2f]`（`/`）、`[3b]`（`;`）、`[5b]`（`[`）という書き方はあるが、戻すのはユーザー辞書を読み書きするときだけで、ふつうの辞書の候補は書いてあるとおりに表示する。
AquaSKK の既定の設定では SKK-JISYO.L が有効なので、AquaSKK を既定のまま使う人は、SKK-JISYO.L の `ao` などでもこの問題に当たる。

手元の AquaSKK のエンジンに、既定のかな規則とキー設定でキーを送って確かめた（2026-10-21）。

| 辞書の行 | 入力 | AquaSKK の表示 |
|---|---|---|
| `ao /(concat "and\057or")/`（SKK-JISYO.L） | `/ao SPC` | `(concat "and\057or")` |
| `dosv /(concat "DOS\057V")/`（SKK-JISYO.L） | `/dosv SPC` | `(concat "DOS\057V")` |
| `あ /(concat "(^^)")/` | `A SPC` | `(concat "(^^)")` |
| `あ /(^^)/` | `A SPC` | `(^^)` |

AquaSKK には、ふつうの辞書に `/` を含む候補を書く手段が無い。標準の書き方を解釈しない AquaSKK の側の問題なので、AquaSKK の本家に issue で報告する。
利用者の NablaSKK（AquaSKK の入力エンジンを Rust で作り直したもの）にも、同じく `(concat "...")` を評価する処理が無い。

### この辞書の側でできること

- `/` と `;` を含む 155 件は、標準の書き方（`(concat "...")`）のまま残す。半角と全角は顔文字の印象をまったく変えるので、全角などへの置きかえはしない
- DDSKK のためだけに包んだ 336 件は、UTF-8 版では包む必要が無い。[ADR 0004](0004-import-kaomoji-data-and-emoticon.md) で、DDSKK では EUC-JP 版を使うと決めたためである。
  包まずに書けば、AquaSKK を含むすべての実装で、元の顔文字（半角のまま）が表示される

| 実装 | 包まない `(^^)` の扱い |
|---|---|
| DDSKK | 先頭が関数なら評価する。DDSKK では EUC-JP 版を使う（EUC-JP 版は今までどおり包む） |
| libskk | 式として読むが、知っている関数（`concat`、`current-time-string`、`pwd`、`skk-version`）でなければ、そのまま表示する |
| macSKK | `(concat "` で始まらないので、そのまま表示する |
| AquaSKK | そのまま表示する |
| skkeleton | `(concat "...")` を評価する処理が見当たらず、そのまま表示する |

## 実装すること

### UTF-8 版の候補の書き方

- UTF-8 版では、`(` で始まり、2 文字目が ASCII で、`)` で終わるという理由だけでは `(concat "...")` で包まない。顔文字をそのまま書く
- `/` か `;` を含む候補は、今までどおり `(concat "...")` の形にする（`\057`、`\073`、`\"`、`\\`）
- UTF-8 版の候補が、`(` に続けて libskk が評価する関数の名前（`concat`、`current-time-string`、`pwd`、`skk-version`）と空白か `)` で始まるときは、`deno task build` を失敗させる。libskk がその顔文字を評価して別の文字列にするのを防ぐ（2026-10-21 の辞書には無い）

### EUC-JP 版

- 変えない。DDSKK のために、今までどおり `(` で始まる顔文字も包み、`\uXXXX` も使う

### 正解のデータと DDSKK による検査

- 正解のデータ（候補は顔文字そのもの）は 2 つの版で同じなので、変えない
- DDSKK による UTF-8 版の検査（`limit` 0）は、包まない `(^^)` などを DDSKK が評価しようとしても元の文字列のまま出ることを、今までどおり確かめる。将来、DDSKK が評価して別の文字列に化ける顔文字が入れば、この検査が失敗する
- `tests/ddskk/` の UTF-8 版の小さな辞書（`ok.utf8`、`unsorted.utf8`、`altered.utf8`）を、この ADR の書き方に作り直す

### 文書

- `docs/specifications.md` の「候補の書き方」を版ごとに書き分け、ADR の一覧に足す
- `README.md` の、AquaSKK で `(concat "...")` が式のまま出るという注意書きを直す。式のまま出るのは `/` か `;` を含む顔文字（155 件）だけになり、原因は AquaSKK が標準の書き方を解釈しないことだと書く
- [ADR 0001](0001-kaomoji-dictionary-from-mozc.md) のステータスの行に、`UTF-8 版の候補の書き方の一部は ADR 0006` を足す

### AquaSKK と NablaSKK への報告

- AquaSKK の本家（codefirst/aquaskk）に、ふつうの辞書の `(concat "...")` を評価しない問題を issue で報告する。報告するのは利用者である
- NablaSKK で `(concat "...")` を評価するかどうかは、NablaSKK のリポジトリで別に決める

## 実装しないこと

- `/` と `;` を全角（`／`、`；`）や、似た形の別の文字（`∕` U+2215、U+037E など）に置きかえること。半角と全角、別の文字では、顔文字の印象や文字そのものが変わる
- AquaSKK の独自の書き方（`[2f]` など）を使うこと。AquaSKK でもふつうの辞書では戻されず、ほかの実装では誤った表示になる
- AquaSKK 向けの辞書を別に配ること
- `/` と `;` を含む顔文字を除くこと
- EUC-JP 版の変更
- macSKK が `\\` と `\"` を戻さない問題（`¯\_(ツ)_/¯` の 1 件で `\` が 2 つに見える）への対処。DDSKK と libskk の書き方（Emacs Lisp の文字列）に合わせる

## テスト設計

実装の前に次のテストを書いて失敗させてから実装する。

### `tests/lib_test.ts`（`deno task test`）

1. `candidateUtf8`: `(^^)` → `(^^)`、`(-)` → `(-)`、`((+_+))` → `((+_+))`、`` (´・ω・`) `` → そのまま。`(^^)/` → `(concat "(^^)\057")`、`^^;` → `(concat "^^\073")`、`¯\_(ツ)_/¯` → `(concat "¯\\_(ツ)_\057¯")` は今までどおり
2. `candidateEucJp` は今までどおり（`(^^)` → `(concat "(^^)")`）
3. `(pwd)`、`(concat "x")`、`(skk-version)`、`(current-time-string)` のような候補があると、`candidateUtf8` が例外を投げる。`(pwdx)` や `(concatenate)` は通る

### `scripts/check_ddskk.sh`（Docker で実行）

4. 作り直した UTF-8 版の小さな辞書で、今の検査（引く検査、並び順の検査、書きかえた辞書の失敗）が期待どおりになる
5. 本物の UTF-8 版を `limit` 0 で引き、正解のデータと一致する（包まない 336 件が DDSKK で化けない）

### 実装の後に実際に動かして確かめること

1. 本物の UTF-8 版で `(concat ` を含む候補が 155 件になる（`/` か `;` を含むものだけ）
2. 手元の AquaSKK のエンジンに本物の UTF-8 版を読ませ、`Q ! n a m i d a SPC` の最初の候補が `(T_T)` になる（今は `(concat "(T_T)")`）
3. 本物の EUC-JP 版が、この変更の前と 1 バイトも変わらない

## トレードオフ

- `/` か `;` を含む 155 件は、AquaSKK が直るまで、AquaSKK では式のまま表示される。標準の書き方に従い、壊れているのは AquaSKK の側だと判断して、辞書では対処しない。顔文字を全角などに変えるより、正しい顔文字を標準の書き方で配るほうを選ぶ
- UTF-8 版を DDSKK で使うと、包まない `(^^)` などを DDSKK が式として評価しようとする。今の顔文字はどれも評価に失敗して元のまま出るが、将来の顔文字が別の文字列に化けるおそれがある。
  DDSKK では EUC-JP 版を使うと [ADR 0004](0004-import-kaomoji-data-and-emoticon.md) で決めており、DDSKK による UTF-8 版の検査（`limit` 0）が、化けた場合に気づく
- 2 つの版で候補の書き方の違いが増える。版ごとに書き方を分ける規則は今もある（EUC-JP 版の `\uXXXX`）ので、構成は大きく変わらない

## 参考文献

- DDSKK マニュアル（`doc/skk.texi`）の「辞書の書式」: https://github.com/skk-dev/ddskk/blob/master/doc/skk.texi
- DDSKK `skk.el` の `skk-quote-char`: https://github.com/skk-dev/ddskk/blob/e8bf68b27021c29781dbfa6a8ef7b770565bdb5b/skk.el
- skk-dev/dict `SKK-JISYO.L`（コミット 14a1df7ec8f84410f5fb006978cf00878768150a）: https://github.com/skk-dev/dict/blob/14a1df7ec8f84410f5fb006978cf00878768150a/SKK-JISYO.L
- AquaSKK `src/engine/entry/SKKCandidate.cpp`、`src/engine/dictionary/SKKLocalUserDictionary.cpp`、`platform/mac/plist/DictionarySet.plist`、`platform/mac/src/server/SKKServer.mm`（コミット 0e7a88f4713299de2c42c71a088bfe458fc0e3cd）: https://github.com/codefirst/aquaskk/tree/0e7a88f4713299de2c42c71a088bfe458fc0e3cd
- libskk `libskk/state.vala`（`expand_expr`）、`libskk/expr.vala`: https://github.com/ueno/libskk/tree/master/libskk
- macSKK `macSKK/Entry.swift`（`decode`、`serializeSpecialCharacters`）: https://github.com/mtgto/macSKK/blob/main/macSKK/Entry.swift
- skkeleton `denops/skkeleton/`: https://github.com/vim-skk/skkeleton/tree/main/denops/skkeleton
