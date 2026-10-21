# SKK-JISYO.kaomoji

顔文字を読みから変換できる SKK 辞書です。
約 2,200 件の顔文字を、約 570 の読みから変換できます。
読みの先頭に `!` を付けて変換すると、ほかの辞書の候補が混ざらず、顔文字だけが並びます（「`!` で顔文字だけを出す」）。
顔文字と読みは、次の 3 つの公開データを使っています（[ADR 0004](docs/adr/0004-import-kaomoji-data-and-emoticon.md)）。

- [Mozc](https://github.com/google/mozc)（Google 日本語入力のオープンソース版）の顔文字のデータ
- [kaomojikan/kaomoji-data](https://github.com/kaomojikan/kaomoji-data)（顔文字館のデータセット）
- [tiwanari/emoticon](https://github.com/tiwanari/emoticon)（Google 日本語入力向けの顔文字辞書）

```
しょぼーん → (´・ω・｀) (´・ω・`) (´・ω・｀)ｼｮﾎﾞｰﾝ …
ぺこり     → m(_ _)m m(__)m (._.) …
にこにこ   → ＼(^o^)／ (^o^) (^^) (*^^*) …
もぐもぐ   → (๑´ڡ`๑) (´～｀)ﾓｸﾞﾓｸﾞ (＾ᴗ＾)🍰 …
```

## ダウンロード

[Releases](https://github.com/tett23/SKK-JISYO.kaomoji/releases) から辞書をダウンロードしてください。

| ファイル | 文字コード | 候補の書き方 |
|---|---|---|
| `SKK-JISYO.kaomoji.utf8` | UTF-8 | 顔文字そのもの。DDSKK 以外の実装向け |
| `SKK-JISYO.kaomoji` | EUC-JP | 顔文字そのもの。JIS X 0208 にない文字や、Emacs が別の文字として読む 7 文字（`～`、`－`、`―` など）を含む顔文字は `(concat "\uXXXX")` の式 |

- EUC-JP 版で式になっている顔文字（`•`、`๑`、`✧` などを含むもの）を変換できるのは DDSKK（Emacs）だけです。
- DDSKK では EUC-JP 版を使ってください。
- AquaSKK、macSKK、libskk、fcitx5-skk、skkeleton などでは UTF-8 版を使ってください。
- `/`、`;` を含む顔文字は、SKK の辞書の標準の書き方に従い、`(concat "...")` の形で書いてあります。
  EUC-JP 版では、DDSKK が式として評価しないように、`(^^)` のように `(` と ASCII の文字で始まり `)` で終わる顔文字もこの形にしています。
  DDSKK はこの式を評価するので、変換の結果は顔文字そのものになります。
  AquaSKK はこの式を評価しないので、UTF-8 版の `/` か `;` を含む顔文字（2,221 件中 155 件）が `(concat "...")` のまま表示されます。
  これは AquaSKK が SKK の辞書の標準の書き方を解釈しないためで、AquaSKK の本家に報告します（[ADR 0006](docs/adr/0006-unwrap-lisp-like-kaomoji-in-utf8.md)）。

## 設定例（DDSKK）

```elisp
(add-to-list 'skk-extra-jisyo-file-list "~/path/to/SKK-JISYO.kaomoji")
```

DDSKK では EUC-JP 版を使ってください。
UTF-8 版の見出し語は、libskk（fcitx5-skk、ibus-skk）に合わせて UTF-8 のバイト順に並べており、DDSKK が探すときの順とは違います。
UTF-8 版を DDSKK で使うと、`えー`、`しーん` など `ー` を含む見出し語の一部が引けません（[ADR 0004](docs/adr/0004-import-kaomoji-data-and-emoticon.md)）。

## `!` で顔文字だけを出す

すべての読みについて、先頭に半角の `!` を付けた見出し語も入れています（[ADR 0005](docs/adr/0005-bang-prefixed-headwords.md)）。
SKK-JISYO.L などには `!` にかなが続く見出し語が無いので、`!にこにこ` で変換すると顔文字だけが並びます。

```
にこにこ   → ＼(^o^)／ … （ほかの辞書の「ニコニコ」などと混ざる）
!にこにこ  → ＼(^o^)／ (^o^) (^^) (*^^*) … （顔文字だけ）
```

入力の仕方は実装によって違います。

| 実装 | 入力 | 確かめ方 |
|---|---|---|
| DDSKK | `Q ! n i k o n i k o SPC` | Docker の DDSKK にキーを送って確かめた |
| AquaSKK | `Q ! n i k o n i k o SPC` | AquaSKK のエンジンのライブラリにキーを送って確かめた（アプリそのものではない） |
| skkeleton | 使えない | `!` が全角の `！` に変わるため |
| libskk（fcitx5-skk、ibus-skk）、macSKK | 確かめていない | 既定のかな規則に `!` の項目が無いことだけを確かめた |

## 候補の並び順

1. `data/extra.tsv`（このリポジトリで足した顔文字）の順
2. Mozc の `emoticon.tsv` の順（よく使う顔文字が前）
3. Mozc の `categorized.tsv` にだけある顔文字の順
4. kaomoji-data の `kaomoji.json` の順
5. tiwanari/emoticon の `source.txt` の順

注釈は付けていません。
詳しい仕様は [docs/specifications.md](docs/specifications.md) にあります。

## 生成

[Deno](https://deno.com/) 2 が必要です。

```bash
deno task build
```

`dist/` に辞書ができます。
取り込むデータは、`sources.lock` に固定したコミットから `.cache/` に取得します。
`--strict` を付けると、捨てた読みがあるときに失敗します。

```bash
deno task test
```

### DDSKK での検査

生成した 2 つの辞書を DDSKK で実際に引き、すべての見出し語の候補が正しく出るか、見出し語が正しい順に並んでいるかを確かめます（[ADR 0002](docs/adr/0002-check-dictionaries-with-ddskk.md)、[ADR 0003](docs/adr/0003-match-ddskk-check-to-real-lookups.md)）。
CI とリリースでも同じ検査をします。
Docker があれば、次の 1 行で Deno、Emacs、DDSKK の入ったイメージを作り、その中で検査します。

```bash
scripts/check_ddskk_docker.sh
```

Docker を使わない場合は、Deno と Emacs を入れ、`sources.lock` の `ddskk_commit` の DDSKK を取得してから、そのディレクトリを指定して実行します。

```bash
DDSKK_DIR=~/src/ddskk scripts/check_ddskk.sh
```

### 顔文字を足す

`data/extra.tsv` に、顔文字と読み（ひらがなと「ー」、空白区切り）をタブ区切りで 1 行足します。
ここに書いた顔文字は Mozc の顔文字より前の候補になります。

### 取り込むデータの更新

`sources.lock` の `<名前>_commit` を新しいコミットにし、そのデータのファイルの SHA-256 を書きかえます。
名前とリポジトリの対応は、`mozc` が google/mozc、`kaomoji_data` が kaomojikan/kaomoji-data、`emoticon` が tiwanari/emoticon です。

```bash
repo=kaomojikan/kaomoji-data
commit=<新しいコミット>
for f in kaomoji.json LICENSE; do
  curl -fsSL "https://raw.githubusercontent.com/$repo/$commit/$f" | shasum -a 256
done
```

外部のデータの読みのうち、ひらがなと `ー` にならないものは、警告を出して捨てます。
`deno task build --strict` でも失敗しないので、更新したときは標準エラーの警告を確かめてください。

## リリース

`VERSION` を更新してコミットし、`v` で始まるタグを push すると、GitHub Actions が辞書を生成して GitHub Releases に公開します。
`-` を含むタグ（`v0.1.0-rc1` など）はプレリリースになります。

```bash
git tag v0.1.0
git push origin v0.1.0
```

リリースノートは英語で、前のリリースからのコミットを Added、Changed、Removed、Fixed に分け、コミット・PR・ADR への絶対リンクを付けて載せます。

## 仕様と ADR

- [docs/specifications.md](docs/specifications.md): 仕様の全体
- [docs/adr/](docs/adr/): 設計判断の記録（ADR）。最初の設計は [ADR 0001](docs/adr/0001-kaomoji-dictionary-from-mozc.md)

仕様を変えるときは、先に ADR を書いてレビューを受けます。
一度コミットした ADR はステータスの行を除いて変更できず、仕様を変える場合は新しい ADR を作ります。
ADR で仕様が変わったら、同じ変更で `docs/specifications.md` とこの README も直します。

### 開発の準備

コミット済みの ADR を守るため、[adr-guard](https://github.com/tett23/adr-guard)（v0.8.3）をインストールし
（[インストール方法](https://github.com/tett23/adr-guard#インストール)）、clone ごとに git の hook を有効にします。

```bash
git config core.hooksPath .githooks
```

CI でも同じ検査をします（`.github/workflows/ci.yml` の `adr` ジョブ）。

## ライセンス

この辞書（生成スクリプト、`data/extra.tsv`）は [MIT License](LICENSE) です。

顔文字と読みは、次の 3 つのデータに由来し、それぞれのライセンスが適用されます。
各ライセンスは辞書ファイルのヘッダーにも含め、リリースには `LICENSE-Mozc.txt`、`LICENSE-kaomoji-data.txt`、`LICENSE-emoticon.txt` として添付しています。

### Mozc

Mozc の `src/data/emoticon/emoticon.tsv` と `categorized.tsv` に由来します。ライセンスは BSD 3-Clause License です。

```
Copyright 2010-2018, Google Inc.
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

  * Redistributions of source code must retain the above copyright
    notice, this list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above
    copyright notice, this list of conditions and the following disclaimer
    in the documentation and/or other materials provided with the
    distribution.
  * Neither the name of Google Inc. nor the names of its
    contributors may be used to endorse or promote products derived from
    this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

### kaomojikan/kaomoji-data

[kaomojikan/kaomoji-data](https://github.com/kaomojikan/kaomoji-data) の `kaomoji.json` に由来します。ライセンスは MIT License です。

```
MIT License

Copyright (c) 2026 kaomojikan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### tiwanari/emoticon

[tiwanari/emoticon](https://github.com/tiwanari/emoticon) の `source.txt` に由来します。ライセンスは MIT License です。

```
The MIT License (MIT)
=====================

Copyright © `2013` `Tatsuya Iwanari`

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the “Software”), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
```
