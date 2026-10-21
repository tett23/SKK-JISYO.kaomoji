# ADR 0004: kaomoji-data と tiwanari/emoticon の顔文字を取り込む

ステータス: 採択

## 文脈

v0.1.1 の辞書は、Mozc の顔文字（442 件）だけを収録している（[ADR 0001](0001-kaomoji-dictionary-from-mozc.md)）。
Mozc の顔文字は 2023 年 12 月から更新されておらず、近年よく使われる顔文字（`•` や `๑` を使うもの、絵文字と組み合わせたものなど）が少ない。
そこで、再配布と改変が許され、MIT License のこの辞書に取り込める公開データを探した。

### 検討したデータ

2026-10-21 に調べた。「使える顔文字」は、1 行で、この辞書の規則（ひらがなと `ー`）に合う読みが 1 つ以上あるものである。

| データ | ライセンス | 使える顔文字 | うち Mozc に無いもの | 判断 |
|---|---|---|---|---|
| [kaomojikan/kaomoji-data](https://github.com/kaomojikan/kaomoji-data) | MIT | 1,661 | 1,613 | 取り込む |
| [tiwanari/emoticon](https://github.com/tiwanari/emoticon) | MIT | 180 | 174 | 取り込む |
| [mtripg6666tdr/Kaomoji_proj](https://github.com/mtripg6666tdr/Kaomoji_proj)（みょんかおもじ） | MIT（v1.8 以降） | 2,165 | 2,096 | 取り込まない |
| [kaomojiya-collection/kaomoji-collection](https://github.com/kaomojiya-collection/kaomoji-collection) | MIT | 0 | 0 | 取り込まない |
| Simeji（Baidu） | 非公開 | | | 取り込まない |

- **kaomoji-data。** 顔文字館（kaomojikan.com）の運営者が、自分のサイトのデータを公開したもの。出所がはっきりしている。全件にひらがなの読み（`reading`）がある。複数行のアスキーアート（47 件）は、SKK の 1 行の候補にできない
- **tiwanari/emoticon。** Google 日本語入力の顔文字辞書。読みは `@ありがとう` の形のショートカットで、`@` を外せば使える。小さいが、出所の問題は見当たらない
- **みょんかおもじ。** 量は最も多い。しかし、README に「作者がネット上で見つけたものやそれらを組み合わせたもの」とあり、MIT License と書いた同じ README の末尾に「All Rights Reserved」ともあって、記述が食い違っている。出所の点で取り込まない
- **kaomoji-collection。** かなの読みが無く、英語のカテゴリ名しか無い
- **Simeji。** データは公開されておらず、利用規約が複製と再配布を禁じている。許諾を得る手間に見合わないので、検討をやめた

ほかに、ライセンスの記載が無いもの（networkelements/kichi-kaomoji）、再配布を禁じているもの（2ch 顔文字辞書）、読みが無いもの（PyPI の kaomoji-dataset、CC BY 4.0）があった。

顔文字には広く出回っているものが多く、どのデータについても、個々の顔文字の最初の作者までは確かめられない。これは Mozc のデータでも同じである。ここでの判断は、公開されているライセンスと README の記述にもとづく。

### 合わせた辞書の試作

3 つのデータを合わせた辞書を、今の生成スクリプトの関数で試作した（2026-10-21）。

| 項目 | v0.1.1 | 試作 |
|---|---|---|
| 顔文字 | 442 | 約 2,200 |
| 見出し語 | 253 | 566 |
| UTF-8 版の大きさ | 約 24 KB | 約 100 KB |
| 候補がいちばん多い見出し語 | `にこにこ` 65 件 | `にこにこ` 187 件 |

試作した辞書を、[ADR 0003](0003-match-ddskk-check-to-real-lookups.md) の DDSKK による検査にかけた。

- EUC-JP 版は、566 件すべてを引けた。並び順の検査も通った
- UTF-8 版は、`えー`、`えーと`、`えーる`、`えーん`、`きー`、`しーん`、`ぱーん`、`むー` の 8 件を DDSKK で引けなかった。UTF-8 のバイト順の並び順の検査は通った

[ADR 0003](0003-match-ddskk-check-to-real-lookups.md) で見込んだとおり、辞書が大きくなって DDSKK の二分探索が働くようになり、UTF-8 版の並び順（UTF-8 のバイト順）と DDSKK の比べ方（日本語の言語環境では EUC-JP の順）の違いが表に出た。
[ADR 0003](0003-match-ddskk-check-to-real-lookups.md) は、このときの対策を別の ADR で決めるとしていたので、この ADR で決める。

UTF-8 版の並び順は、libskk（fcitx5-skk、ibus-skk）の二分探索のために UTF-8 のバイト順でなければならず、DDSKK の順と両立できない。
skk-dev/dict の UTF-8 の辞書（`SKK-JISYO.emoji`）も UTF-8 のバイト順であり、同じ制約を持つ。

## 実装すること

### 取り込むデータ

| 名前 | リポジトリ | ファイル | 使う項目 |
|---|---|---|---|
| `kaomoji_data` | kaomojikan/kaomoji-data | `kaomoji.json`、`LICENSE` | 各要素の `text`（顔文字）と `reading`（読みの配列） |
| `emoticon` | tiwanari/emoticon | `source.txt`、`LICENSE.md` | タブ区切りの 1 列目（`@` を外して読み）と 2 列目（顔文字）。3 列目（品詞の `顔文字`）は使わない |

- kaomoji-data の `tags` と `categories`、`categories.json` は使わない
- kaomoji-data で、`text` に改行かタブを含む要素は捨てる（複数行のアスキーアート）

### `sources.lock` の形式

取り込むデータが 3 つになるので、`sources.lock` の形式を次のように変える。

```
mozc_commit = 85590f17409ebff387285f9665f362ede83ebd8e
kaomoji_data_commit = 60c92ea4e85279ad42ff525e9a40464ebeb1003e
emoticon_commit = 3df8debd54eab6c6510fdd05e0ebc7773b4e3170
ddskk_commit = e8bf68b27021c29781dbfa6a8ef7b770565bdb5b
mozc:src/data/emoticon/emoticon.tsv = 366558b380bef07dda26822c9100d1efabee539f7961b2c6363d4614c4a762c4
mozc:src/data/emoticon/categorized.tsv = 4497c16a706de418b05e73eaddbce13e5d3390e7c2de71200b28c0c97ae5c4fc
kaomoji_data:kaomoji.json = 22721e1b31d60fee5a9bd9f26c8639ab4efee2e6c01cec3f674f0e0d1d3aea2b
kaomoji_data:LICENSE = 08cb2c981c94a80ef0b80be68cdec72e54faa8d81c96e3476a23955eb9ba8a3b
emoticon:source.txt = 2cd833f39fa0ed2019923bde3bf35d8779a14523b8f961357bec752cbe7efd27
emoticon:LICENSE.md = 9ea29f6a7796e515d3b6b0c9a24293ff2016a97e9bb92f800a7fd7af9d69fbee
```

- `<名前>_commit` は各リポジトリのコミット、`<名前>:<パス>` は取得するファイルの SHA-256 である
- 名前とリポジトリの対応（`mozc` は google/mozc、`kaomoji_data` は kaomojikan/kaomoji-data、`emoticon` は tiwanari/emoticon）は `scripts/lib.ts` に定数として書く
- `scripts/fetch_sources.ts` は、`https://raw.githubusercontent.com/<リポジトリ>/<コミット>/<パス>` から `.cache/<名前>/<コミット>/<パス>` に取得し、SHA-256 が合わなければ失敗する
- `ddskk_commit` は DDSKK のイメージを作るときだけに使い、取得の対象にはしない（[ADR 0002](0002-check-dictionaries-with-ddskk.md) のとおり）

### 顔文字の前後の空白

- すべてのデータの顔文字について、前後の空白（半角と全角）を取り除く。試作では 12 件が当たった（例: tiwanari/emoticon の ` (๑•ૅㅁ•๑)ぁ？`）
- 取り除いた後に同じ顔文字になったものは、[ADR 0001](0001-kaomoji-dictionary-from-mozc.md) の併合の規則で 1 つにまとめる
- Mozc の顔文字には当たるものが無いので、v0.1.1 の候補は変わらない

### 候補の並び順

同じ読みの中の候補を、次の順に並べる。[ADR 0001](0001-kaomoji-dictionary-from-mozc.md) の順の後ろに、新しい 2 つのデータを足す。

1. `data/extra.tsv`
2. Mozc の `emoticon.tsv`
3. Mozc の `categorized.tsv` にだけある顔文字
4. kaomoji-data の `kaomoji.json` の順
5. tiwanari/emoticon の `source.txt` の順

Mozc の順は、よく使う顔文字を前に置いた順なので、先に置く。
kaomoji-data は件数が多いので、tiwanari/emoticon より前に置く。

### 警告と `--strict`

- 外部のデータ（Mozc、kaomoji-data、tiwanari/emoticon）で、規則に合わない読みは、警告を出して捨てる。`--strict` でも失敗にしない
  - 試作では、tiwanari/emoticon の `?`、`あ?`、`はぁ？` の 3 つが当たった。これらしか読みの無い 3 件の顔文字は、辞書に入らない
- `data/extra.tsv`（このリポジトリで書くデータ）の規則に合わない読みは、今までどおり `--strict` で失敗にする
- 外部のデータの更新で読みが捨てられても、手で直せないので、生成を止めない。捨てた読みは生成のたびに標準エラーに出る

### 顔文字の数

- ヘッダーとリリースノートの「顔文字の数」は、辞書に 1 つ以上の見出し語で入った顔文字の数にする
- 今は、読みが 1 つも残らなかった顔文字も数えている。上の 3 件のような顔文字を数えないように直す

### ライセンス

- kaomoji-data の `LICENSE` と tiwanari/emoticon の `LICENSE.md` を、`sources.lock` で固定したコミットから取得する（SHA-256 で確かめる）
- `deno task build` は、それぞれを手を加えずに `dist/LICENSE-kaomoji-data.txt`、`dist/LICENSE-emoticon.txt` に書く。冒頭に、どのデータをどのコミットから取り込んだかを英語で 1 段落書く（`LICENSE-Mozc.txt` と同じ形）
- 辞書のヘッダーに、Mozc に続けて、2 つのデータの出典（リポジトリとコミット）とライセンスの全文を書く
- リリースに `LICENSE-kaomoji-data.txt` と `LICENSE-emoticon.txt` を添付し、`SHA256SUMS` の対象にする。リリースノートの Files の表にも足す
- `README.md` の「ライセンス」の節に、2 つのデータの出典とライセンスの全文を足す

### DDSKK と UTF-8 版

- DDSKK では EUC-JP 版を使う。`README.md` に、UTF-8 版を DDSKK で使うと `ー` を含む見出し語の一部が引けないことを書き、DDSKK の設定例から UTF-8 版の行を消す
- UTF-8 版の並び順は変えない（[ADR 0001](0001-kaomoji-dictionary-from-mozc.md)、[ADR 0003](0003-match-ddskk-check-to-real-lookups.md) のとおり、UTF-8 のバイト順）
- DDSKK による UTF-8 版の検査は、引けるかどうかではなく、候補の中身（`(concat "...")` の評価と文字コード）を確かめるものに変える。
  `scripts/check_ddskk.el` の `kaomoji-check` に、`limit` を省略可能な 4 つ目の引数として足し、UTF-8 版は `limit` 0（線形探索だけ）で検査する。EUC-JP 版は今までどおり 10000 で検査する
- UTF-8 版の並び順は、今までどおり UTF-8 のバイト順の並び順の検査で確かめる
- [ADR 0003](0003-match-ddskk-check-to-real-lookups.md) のステータスの行を `採択→UTF-8 版を DDSKK で引く検査は ADR 0004` に変える

### [ADR 0001](0001-kaomoji-dictionary-from-mozc.md) のステータス

- [ADR 0001](0001-kaomoji-dictionary-from-mozc.md) のステータスの行を `採択→EUC-JP 版の候補の書き方の一部は ADR 0002、データの出典と候補の並び順は ADR 0004` に変える

### 文書

- `docs/specifications.md` の「データの出典」「候補の並び順」「DDSKK による検査」「ファイル構成」と ADR の一覧を直す
- `README.md` の冒頭の説明、変換の例、DDSKK の設定例、データの出典、ライセンスを直す

## 実装しないこと

- みょんかおもじ、kaomoji-collection、Simeji のデータの取り込み
- kaomoji-data の `tags`、`categories` を読みに使うこと。`tags` は漢字やカタカナを含み、読みに直す規則が要る
- 候補の多い見出し語（`にこにこ` の 187 件など）の候補を減らすこと。並び順で、よく使う Mozc の顔文字を先に置くことで対応する
- 複数行のアスキーアートを 1 行に直して取り込むこと
- UTF-8 版を DDSKK の順に並べかえること、DDSKK 向けの UTF-8 版を別に作ること
- 取り込むデータを自動で最新にすること。今までどおり `sources.lock` を手で直す
- 前のリリースとの候補の差分をリリースノートに載せること

## テスト設計

実装の前に次のテストを書いて失敗させてから実装する。

### `tests/lib_test.ts`（`deno task test`）

1. kaomoji-data の解析: `[{"text":"(◍•ᗜ•◍)","reading":["うれしい","にこにこ"]},{"text":"a\nb","reading":["あすきーあーと"]}]` から、1 件目だけが `{ kaomoji: "(◍•ᗜ•◍)", readings: ["うれしい", "にこにこ"] }` として返る
2. tiwanari/emoticon の解析: `@ありがとう\t(*ゝω・)ﾉ ｱﾘｶﾞ㌧♪\t顔文字` が `{ kaomoji: "(*ゝω・)ﾉ ｱﾘｶﾞ㌧♪", readings: ["ありがとう"] }` になる。空行は飛ばす
3. 前後の空白: ` (๑•ૅㅁ•๑)ぁ？` と `(๑•ૅㅁ•๑)ぁ？　` が、どちらも `(๑•ૅㅁ•๑)ぁ？` になり、1 つにまとまる。顔文字の中の空白（`m(_ _)m`）は残る
4. 並び順: 同じ読みの候補が、extra、Mozc の emoticon、Mozc の categorized だけのもの、kaomoji-data、tiwanari/emoticon の順になる
5. 警告: 外部のデータの規則に合わない読みは警告になるが、`strictFailures`（`--strict` で失敗にする警告）には入らない。`data/extra.tsv` の規則に合わない読みは両方に入る
6. 顔文字の数: 読みが 1 つも残らなかった顔文字は数えない
7. `sources.lock` の解析: 4 つのコミットと、`<名前>:<パス>` ごとの SHA-256 を返す。`<名前>` が定数に無ければ例外を投げる
8. ヘッダー: 両方の版のヘッダーに、`Copyright (c) 2026 kaomojikan` と `` Copyright © `2013` `Tatsuya Iwanari` `` と、2 つのデータのコミットが入る

### `tests/data_test.ts`

9. `sources.lock` の 3 つのデータのコミット（40 桁）と、6 つのファイルのハッシュ（64 桁）がある
10. [ADR 0002](0002-check-dictionaries-with-ddskk.md) の「検査すべき顔文字」の顔文字と見出し語が、合わせた辞書にもすべて含まれる（今あるテストを、3 つのデータを合わせた形に直す）

### `scripts/check_ddskk.sh`（Docker で実行）

11. UTF-8 版の小さな辞書（`tests/ddskk/ok.utf8`）と本物の UTF-8 版を、`limit` 0 で引く検査が終了コード 0 になる
12. 本物の EUC-JP 版を `limit` 10000 で引く検査と、両方の版の並び順の検査が、今までどおり終了コード 0 になる

### 実装の後に実際に動かして確かめること

1. `deno task build --strict` が終了コード 0 で終わり、標準エラーに tiwanari/emoticon の 3 つの読みの警告が出る
2. 顔文字の数と見出し語の数が、試作と同じ程度（約 2,200 と 566）になる
3. `dist/` に `LICENSE-kaomoji-data.txt` と `LICENSE-emoticon.txt` ができ、取得した元のファイルと、冒頭の段落を除いて一致する
4. `scripts/check_ddskk_docker.sh` が、手元と CI で終了コード 0 で終わる
5. 本物の UTF-8 版を `limit` 10000 で DDSKK で引くと、`ー` を含む見出し語の一部が引けない（README の注意書きの根拠を確かめる。検査のスクリプトには入れない）
6. 次のリリースで、5 つのライセンスファイルと `SHA256SUMS` が添付される

## トレードオフ

- 顔文字が約 5 倍になり、新しい顔文字を引けるようになる。その代わり、よく使う読みの候補が多くなる（`にこにこ` で 187 件）。Mozc の顔文字を先に並べるので、よく使う顔文字は今までどおり先に出る
- 取り込むデータが増えると、それぞれの更新や消滅の影響を受ける。コミットとハッシュで固定するので、元のリポジトリが消えても、キャッシュがあれば同じ辞書を作れる。キャッシュも無ければ生成できない
- 外部のデータの規則に合わない読みを `--strict` でも失敗にしないので、データの更新で読みが減っても CI では気づかない。生成のたびに標準エラーに出るので、更新するときに確かめる
- DDSKK の利用者は EUC-JP 版を使う必要がある。EUC-JP 版は、EUC-JP に無い文字を `(concat "...")` の式で書くので DDSKK でしか顔文字に戻らないが、DDSKK の利用者には問題にならない。UTF-8 版を DDSKK で使っている人は、`ー` を含む一部の見出し語が引けなくなる
- 顔文字の最初の作者まで確かめられないのは、Mozc を含むどのデータでも同じである。出所を README に書いているデータに限って取り込むことで、危険を下げる

## 参考文献

- kaomojikan/kaomoji-data（コミット 60c92ea4e85279ad42ff525e9a40464ebeb1003e）: https://github.com/kaomojikan/kaomoji-data/tree/60c92ea4e85279ad42ff525e9a40464ebeb1003e
- tiwanari/emoticon（コミット 3df8debd54eab6c6510fdd05e0ebc7773b4e3170）: https://github.com/tiwanari/emoticon/tree/3df8debd54eab6c6510fdd05e0ebc7773b4e3170
- mtripg6666tdr/Kaomoji_proj: https://github.com/mtripg6666tdr/Kaomoji_proj
- kaomojiya-collection/kaomoji-collection: https://github.com/kaomojiya-collection/kaomoji-collection
- Simeji の利用規約: https://simeji.me/termofuse/
- awesome-japanese-nlp-resources（候補の探索に使った一覧）: https://github.com/taishi-i/awesome-japanese-nlp-resources
- libskk `libskk/file-dict.vala`: https://github.com/ueno/libskk/blob/master/libskk/file-dict.vala
- skk-dev/dict `SKK-JISYO.emoji`: https://github.com/skk-dev/dict/blob/master/SKK-JISYO.emoji
