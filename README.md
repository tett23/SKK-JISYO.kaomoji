# SKK-JISYO.kaomoji

顔文字を読みから変換できる SKK 辞書です。
顔文字と読みは [Mozc](https://github.com/google/mozc)（Google 日本語入力のオープンソース版）のデータを使っています。

```
しょぼーん → (´・ω・｀) (´・ω・`) (´・ω・｀)ｼｮﾎﾞｰﾝ …
ぺこり     → m(_ _)m m(__)m (._.) …
にこにこ   → ＼(^o^)／ (^o^) (^^) (*^^*) …
```

## ダウンロード

[Releases](https://github.com/tett23/SKK-JISYO.kaomoji/releases) から辞書をダウンロードしてください。

| ファイル | 文字コード | 候補の書き方 |
|---|---|---|
| `SKK-JISYO.kaomoji.utf8` | UTF-8 | 顔文字そのもの |
| `SKK-JISYO.kaomoji` | EUC-JP | 顔文字そのもの。JIS X 0208 にない文字を含む顔文字は `(concat "\uXXXX")` の式 |

- EUC-JP 版で式になっている顔文字（`•`、`๑`、`✧` などを含むもの）を変換できるのは DDSKK（Emacs）だけです。
- AquaSKK、macSKK、libskk、fcitx5-skk、skkeleton などでは UTF-8 版を使ってください。
- `/`、`;` を含む顔文字と、`(^^)` のように `(` と ASCII の文字で始まり `)` で終わる顔文字は、`(concat "...")` の形で書いてあります。
  多くの SKK の実装は `concat` を解釈するので、変換の結果は顔文字そのものになります。

## 設定例（DDSKK）

```elisp
;; EUC-JP 版
(add-to-list 'skk-extra-jisyo-list "~/path/to/SKK-JISYO.kaomoji")
;; UTF-8 版（文字コードを指定する）
(add-to-list 'skk-extra-jisyo-list '("~/path/to/SKK-JISYO.kaomoji.utf8" . utf-8))
```

## 候補の並び順

1. `data/extra.tsv`（このリポジトリで足した顔文字）の順
2. Mozc の `emoticon.tsv` の順（よく使う顔文字が前）
3. Mozc の `categorized.tsv` にだけある顔文字の順

注釈は付けていません。
詳しい仕様は [docs/specifications.md](docs/specifications.md) にあります。

## 生成

[Deno](https://deno.com/) 2 が必要です。

```bash
deno task build
```

`dist/` に辞書ができます。
Mozc のデータは `sources.lock` に固定したコミットから `.cache/` に取得します。
`--strict` を付けると、捨てた読みがあるときに失敗します。

```bash
deno task test
```

### 顔文字を足す

`data/extra.tsv` に、顔文字と読み（ひらがなと「ー」、空白区切り）をタブ区切りで 1 行足します。
ここに書いた顔文字は Mozc の顔文字より前の候補になります。

### Mozc の更新

`sources.lock` の `mozc_commit` を新しいコミットにし、2 つのファイルの SHA-256 を書きかえます。

```bash
commit=<新しいコミット>
for f in emoticon.tsv categorized.tsv; do
  curl -fsSL "https://raw.githubusercontent.com/google/mozc/$commit/src/data/emoticon/$f" | shasum -a 256
done
```

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

コミット済みの ADR を守るため、[adr-guard](https://github.com/tett23/adr-guard)（v0.8.2）をインストールし
（[インストール方法](https://github.com/tett23/adr-guard#インストール)）、clone ごとに git の hook を有効にします。

```bash
git config core.hooksPath .githooks
```

CI でも同じ検査をします（`.github/workflows/ci.yml` の `adr` ジョブ）。

## ライセンス

この辞書（生成スクリプト、`data/extra.tsv`）は [MIT License](LICENSE) です。

顔文字と読みは Mozc の `src/data/emoticon/emoticon.tsv` と `categorized.tsv` に由来し、次のライセンス（BSD 3-Clause License）が適用されます。
このライセンスは辞書ファイルのヘッダーにも含め、リリースには `LICENSE-Mozc.txt` として添付しています。

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
