# ADR 0009: adr-guard を v0.13.1 に上げ、ADR のステータスの行を新形式に移す

Status: proposed

## 文脈

[ADR 0008](0008-update-adr-guard-to-v0.10.0.md) は、CI の `adr` ジョブの adr-guard の action を `tett23/adr-guard@v0.10.0` にすると決めた。
README も、インストールする adr-guard の版を v0.10.0 と書いている。

adr-guard の v0.11.0 から v0.13.1 までで、次のものが加わった。

- v0.11.0: Codex の PreToolUse hook `adr-guard codex-hook`（adr-guard の [ADR 0021](https://github.com/tett23/adr-guard/blob/v0.13.1/docs/adr/0021-codex-hook.md)）
- v0.12.0: ステータスの行の新形式と、状態遷移の検査（adr-guard の [ADR 0022](https://github.com/tett23/adr-guard/blob/v0.13.1/docs/adr/0022-status-transitions.md)）。新形式は `Status: <トークン>` で、トークンは `proposed`、`accepted`、`accepted-pending`、`rejected`、`discarded`、`deprecated`、または `superseded [<変更の JSON 配列>]` である。変更は `{"part":<部分名か null>,"by":[<修正先>]}` で、修正先はリポジトリのルートからのパスである。追加した ADR と、ステータスの行を書きかえた ADR には新形式が要る。新しい ADR は最初に `Status: proposed` でコミットする。pre-commit と check-range は、最初のコミットを含めて状態遷移を検査し、その違反は書きかえの許可のオプション（`--allow-status` など）やトレーラーでは免除されない。旧形式の行はそのまま読める。旧形式を新形式に書きかえる移行スクリプト `scripts/migrate-adr-status` は adr-guard のソースにあり、リリースのアーカイブには入らない
- v0.12.0: 修正の関係をたどる `adr-guard trace`（adr-guard の [ADR 0023](https://github.com/tett23/adr-guard/blob/v0.13.1/docs/adr/0023-trace-amendments.md)）
- v0.13.0: 移行スクリプトの `--dry-run` と、移行できない ADR の全件の数え上げ（adr-guard の [ADR 0024](https://github.com/tett23/adr-guard/blob/v0.13.1/docs/adr/0024-migration-dry-run-and-error-count.md)）
- v0.13.0: `superseded-pending`、変更の `kind` と `note`、`https://` の URL の修正先、`trace --list` の 6 列（adr-guard の [ADR 0025](https://github.com/tett23/adr-guard/blob/v0.13.1/docs/adr/0025-extend-canonical-status-amendments.md)）
- v0.13.0: 旧形式の参照の読み方の拡張（adr-guard の [ADR 0026](https://github.com/tett23/adr-guard/blob/v0.13.1/docs/adr/0026-read-more-legacy-references.md)、[ADR 0027](https://github.com/tett23/adr-guard/blob/v0.13.1/docs/adr/0027-read-legacy-replaced-status.md)）
- v0.13.1: 移行スクリプトが旧形式の行から作る部分名の修正。部分名から修飾子（リンクのテキストの `ADR NNNN` の前の語）、先頭の `。`、末尾の `→` を除く。部分名を決められない行は「部分名を決められません」と報告し、書かない（adr-guard の [ADR 0028](https://github.com/tett23/adr-guard/blob/v0.13.1/docs/adr/0028-fix-legacy-part-names.md)）

手元の adr-guard はすでに 0.13.1 で、`.githooks/pre-commit` はこれを呼ぶ。
CI の action だけが v0.10.0 のままでは、手元の pre-commit と CI で検査の規則が食い違う。
状態遷移の検査は v0.12.0 で加わったので、v0.10.0 の action は状態遷移を検査せず、手元の検査を通さずに作ったコミット（`--no-verify` など）を CI が見逃す。

このリポジトリの ADR のステータスの行は、すべて旧形式（`ステータス: 採択` など）である。
旧形式の行はそのまま読めるが、書きかえるときには新形式が要る。
書きかえるたびに 1 行ずつ移すと、旧形式と新形式がいつまでも混ざるので、版を上げるときにまとめて移す。

ステータスの書き方は、ほかの ADR と `docs/specifications.md` の「ADR の運用」でも決めている。

- [ADR 0001](0001-kaomoji-dictionary-from-mozc.md) は、人間のレビューを受けてから、ステータスを `採択` にしてコミットすると決めた。新形式では、最初は `Status: proposed` でコミットする
- [ADR 0007](0007-update-adr-guard-to-v0.8.3.md) は、採択したが実装していない ADR のステータスを `採択（未実装）` にすると決めた。新形式では `accepted-pending` になる

## 調査した事項

この節のコマンドは、このリポジトリの worktree（ブランチ `adr-guard-v0.13.0`、origin/main から作成）か、その一時的な clone で実行した。

### 版と action

- `adr-guard -V` は `adr-guard 0.13.1` を出力した。
- `.github/workflows/ci.yml` の 50 行めは `uses: tett23/adr-guard@v0.10.0` である。版の指定はタグで、`version` の入力は付けていない。
- adr-guard のリポジトリで `git diff v0.10.0 v0.13.1 --stat -- action.yml` は何も出力しなかった。action の入力（`base`、`head`、`version`、`allow-status`、`allow-links`、`links`、`check-status`、`check-numbers`、`allow-renumber`）は v0.10.0 と v0.13.1 で同じである。
- `rg -n 'adr-guard@|v0\.10\.0'` で ADR の外に見つかった adr-guard の版の記述は、`.github/workflows/ci.yml` の 50 行めと、`README.md` の 153 行め（`（v0.10.0）`）だけである。`docs/specifications.md` は版を書いていない。
- `.githooks/pre-commit` は `exec adr-guard pre-commit --allow-status --allow-links` である。

### 移行スクリプトの --dry-run

adr-guard の v0.13.1 のコミット（`ab55769`）を checkout した worktree でビルドした `migrate_adr_status` の example を、この worktree のルートで `--dry-run` で実行した。
`scripts/migrate-adr-status` は、この example を `cargo run --example migrate_adr_status` で動かすシェルスクリプトである。
終了コードは 0 で、標準エラーの最後の行は `移行できる: 8件、移行済み: 1件、移行できない: 0件` だった。
移行済みの 1 件は、`Status: proposed` で書いたこの ADR である。
この ADR を含まない一時的な clone では、`移行できる: 8件、移行済み: 0件、移行できない: 0件` だった。
`git status --porcelain` は何も出力せず、ファイルは変わらなかった。

差分のステータスの行は次のとおりである。
`superseded` の行は、変更を 1 つずつ「部分名 → 修正先」で示す。

| ADR | トークン | 変更 |
|---|---|---|
| [ADR 0001](0001-kaomoji-dictionary-from-mozc.md) | `superseded` | `EUC-JP 版の候補の書き方の一部` → `docs/adr/0002-check-dictionaries-with-ddskk.md`、`データの出典と候補の並び順` → `docs/adr/0004-import-kaomoji-data-and-emoticon.md`、`UTF-8 版の候補の書き方の一部` → `docs/adr/0006-unwrap-lisp-like-kaomoji-in-utf8.md`、`adr-guard の版` → `docs/adr/0007-update-adr-guard-to-v0.8.3.md` |
| [ADR 0002](0002-check-dictionaries-with-ddskk.md) | `superseded` | `検索の上限と、並びを崩した辞書の確かめ方` → `docs/adr/0003-match-ddskk-check-to-real-lookups.md` |
| [ADR 0003](0003-match-ddskk-check-to-real-lookups.md) | `superseded` | `UTF-8 版を DDSKK で引く検査` → `docs/adr/0004-import-kaomoji-data-and-emoticon.md` |
| [ADR 0004](0004-import-kaomoji-data-and-emoticon.md) | `accepted` | |
| [ADR 0005](0005-bang-prefixed-headwords.md) | `accepted` | |
| [ADR 0006](0006-unwrap-lisp-like-kaomoji-in-utf8.md) | `accepted` | |
| [ADR 0007](0007-update-adr-guard-to-v0.8.3.md) | `superseded` | `adr-guard の版` → `docs/adr/0008-update-adr-guard-to-v0.10.0.md` |
| [ADR 0008](0008-update-adr-guard-to-v0.10.0.md) | `accepted` | |

部分名は旧形式の行の `は` の前の文字列のとおりで、補足や注記はない。
v0.13.0 のスクリプトの `--dry-run` の差分も、ステータスの行の 1 行ずつまで同じだった。

### 一時的な clone での試し

worktree を `$TMPDIR` に clone し、次を確かめた。

1. `--write` の後、`git add -A` してから `adr-guard pre-commit --allow-status --allow-links` を実行すると、終了コード 0 で終わった。`adr-guard check-status` と `adr-guard links` も終了コード 0 で終わった。
2. 移行をコミットした状態で `adr-guard links --fix --include-committed` を実行すると、終了コード 0 で終わり、ファイルは変わらなかった。

新しい ADR を追加するときと、`accepted` の ADR を `superseded` にするときの pre-commit の振る舞いは、SKK-JISYO.emoji-ja の worktree の一時的な clone で確かめた。

- 新しい ADR を `Status: accepted` で足すと、pre-commit は `許可されていない状態遷移: Absent -> accepted` で終了コード 1 になった。`ステータス: 提案` で足すと ``新形式のステータス行は `Status: ` で始めてください`` で終了コード 1 になった。`Status: proposed` で足すと終了コード 0 で終わった。
- その `Status: proposed` の ADR をコミットした後、その ADR を `Status: accepted-pending` にし、`Status: accepted` の ADR を、その ADR を修正先とする `superseded` にすると、pre-commit は終了コード 0 で終わった。

### いまの worktree の検査

ADR を足す前の worktree で、`adr-guard links`、`adr-guard check-status`、`adr-guard check-numbers` は終了コード 0 で終わった。

## 実装すること

- `.github/workflows/ci.yml` の `adr` ジョブの action を `uses: tett23/adr-guard@v0.13.1` にする。タグで指定する形を保ち、ほかの入力は変えない
- ステータスの行を新形式に移す。リポジトリのルートで、adr-guard v0.13.1 のソースの `scripts/migrate-adr-status --dry-run` を実行し、結果が「調査した事項」の表と同じ 8 件で、移行済みがこの ADR の 1 件で、移行できない ADR が 0 件であることを確かめてから、`--write` で書く。移行は、ほかの変更と分けて 1 つのコミットにする
- 移行の後、ステータスの行を次のように直す
  - [ADR 0008](0008-update-adr-guard-to-v0.10.0.md) を `Status: superseded [{"part":"adr-guard の版","by":["docs/adr/0009-update-adr-guard-to-v0.13.1.md"]}]` にする
  - [ADR 0001](0001-kaomoji-dictionary-from-mozc.md) の変更の配列に `{"part":"ADR を最初にコミットするときのステータス","by":["docs/adr/0009-update-adr-guard-to-v0.13.1.md"]}` を足す。いまある 4 つの変更は残す
  - [ADR 0007](0007-update-adr-guard-to-v0.8.3.md) の変更の配列に `{"part":"未実装の ADR のステータスの書き方","by":["docs/adr/0009-update-adr-guard-to-v0.13.1.md"]}` を足す。いまある `adr-guard の版` の変更は残す
- `README.md` の adr-guard の版を v0.13.1 にし、新しい ADR は `Status: proposed` で最初にコミットすることを書く
- `docs/specifications.md` の「ADR の運用」を次のように直す
  - ステータスの書き方を新形式にする。レビューの後に `Status: proposed` でコミットし、次のコミットで `accepted` か `accepted-pending` にすること、未実装の ADR は `accepted-pending` にすること（`adr-guard unimplemented` で一覧できる）、破棄するときは `discarded` にすること、修正を受けた ADR は `superseded [...]` に部分名と修正先を書くことを書く
  - pre-commit と CI（`adr` ジョブ）が状態遷移を検査し、`--allow-status` では免除されないことを書く
  - ADR の一覧にこの ADR を足し、すべての行のステータスの列を、移行した後のステータスの行に合わせる。`superseded` の行は、部分名と修正先の ADR へのリンクを添える
- この ADR のステータスは、実装のプルリクエストで `accepted` にする
- `adr-guard links --fix --include-committed` を実行し、直すものがあれば直す

## 実装しないこと

- `.githooks/pre-commit` のコマンドは変えない（`adr-guard pre-commit --allow-status --allow-links` のまま）。Claude Code の hook は全体の設定にあり、このリポジトリには置かない
- Codex の hook（v0.11.0 の `adr-guard codex-hook`）は足さない
- action の `version` の入力は付けない。ほかの入力も変えない
- 移行した行の部分名を書きかえない。`kind` と `note` も足さない。旧形式の行に補足や注記はない
- ADR の本文は変えない。本文の中の `採択（未実装）` や `ステータス:` の記述は、そのときの決定の記録として残す
- 移行スクリプトをこのリポジトリに入れない。移行は一度だけ行う

## 不変条件

なし。
CI の設定の値と、ステータスの行を移す手順だけを決める ADR で、入力によって変わる振る舞いを持たない。

## テスト設計

このリポジトリには ADR の書式を検査するテストはない。
設定と文書の変更なので、実装の後に実際に動かして確かめる。

1. `scripts/migrate-adr-status --dry-run` が、終了コード 0 と `移行できる: 8件、移行済み: 1件、移行できない: 0件` で終わる（移行の前）
2. `--write` の後、もう一度 `--dry-run` を実行すると、`移行できる: 0件` で終わる
3. 手元の adr-guard 0.13.1 で、`adr-guard links`、`adr-guard check-status`、`adr-guard check-numbers` が終了コード 0 で終わる
4. `rg -n '^ステータス:' docs/adr` が何も出力しない
5. `adr-guard trace --list docs/adr/0001-kaomoji-dictionary-from-mozc.md` が、0008 からこの ADR への `adr-guard の版` の辺と、0001 と 0007 からこの ADR への辺を出力する
6. `.github/workflows/ci.yml` が YAML として読める
7. `deno fmt --check`、`deno lint`、`deno task test` が通る
8. 各コミットで `.githooks/pre-commit` が通り、コミットの後に `adr-guard check-range origin/main HEAD --allow-status --allow-links` が終了コード 0 で終わる
9. push の後、CI の `adr` ジョブが v0.13.1 の action で成功する

## トレードオフ

- 新形式の `superseded` の行は JSON を含むので、旧形式より人が読みにくい。修正の関係は `adr-guard trace` で読めるので、機械で検査できるほうを選ぶ
- すべての ADR のステータスの行をまとめて書きかえるので、1 つのコミットが全 ADR に触れる。変わるのはステータスの行だけで、移行を 1 つのコミットに分けるので、レビューでは `--dry-run` の差分と照らせる
- 新しい ADR ごとに、`proposed` のコミットと `accepted` のコミットの 2 つが要る。状態遷移を adr-guard が検査できるようになるので、手間は受け入れる
- 移行には adr-guard のソースと Rust のツールチェインが要る。移行は一度だけなので、スクリプトをこのリポジトリに入れない
- adr-guard の版を上げるたびに ADR を書く手間がかかる。版は [ADR 0008](0008-update-adr-guard-to-v0.10.0.md) で決めたことなので、変えるときは新しい ADR で記録するほうを選ぶ

## 参考文献

- adr-guard v0.11.0 のリリース: https://github.com/tett23/adr-guard/releases/tag/v0.11.0
- adr-guard v0.12.0 のリリース: https://github.com/tett23/adr-guard/releases/tag/v0.12.0
- adr-guard v0.13.0 のリリース: https://github.com/tett23/adr-guard/releases/tag/v0.13.0
- adr-guard v0.13.1 のリリース: https://github.com/tett23/adr-guard/releases/tag/v0.13.1
- adr-guard の README（v0.13.1）: https://github.com/tett23/adr-guard/blob/v0.13.1/README.md
- adr-guard の ADR「[Codex の PreToolUse hook で、コミット済みのADRと記録の編集を拒否する](https://github.com/tett23/adr-guard/blob/v0.13.1/docs/adr/0021-codex-hook.md)」
- adr-guard の ADR「[状態と遷移を別々の代数的データ型で表す](https://github.com/tett23/adr-guard/blob/v0.13.1/docs/adr/0022-status-transitions.md)」
- adr-guard の ADR「[trace で元の決定から修正ADRをたどる](https://github.com/tett23/adr-guard/blob/v0.13.1/docs/adr/0023-trace-amendments.md)」
- adr-guard の ADR「[移行スクリプトに --dry-run を設け、失敗を最後まで数える](https://github.com/tett23/adr-guard/blob/v0.13.1/docs/adr/0024-migration-dry-run-and-error-count.md)」
- adr-guard の ADR「[新形式のステータス行に、実装待ちの修正、補足、注記、別のリポジトリの修正先を加える](https://github.com/tett23/adr-guard/blob/v0.13.1/docs/adr/0025-extend-canonical-status-amendments.md)」
- adr-guard の ADR「[旧形式のステータス行の修正先を、リンク先と裸の番号からも読む](https://github.com/tett23/adr-guard/blob/v0.13.1/docs/adr/0026-read-more-legacy-references.md)」
- adr-guard の ADR「[旧形式の `置換（…）` を、修正を受けた状態として読む](https://github.com/tett23/adr-guard/blob/v0.13.1/docs/adr/0027-read-legacy-replaced-status.md)」
- adr-guard の ADR「[旧形式の部分名から修飾子と区切りの記号を除き、決められない部分名を移行しない](https://github.com/tett23/adr-guard/blob/v0.13.1/docs/adr/0028-fix-legacy-part-names.md)」
- adr-guard: https://github.com/tett23/adr-guard
