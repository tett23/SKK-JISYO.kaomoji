# ADR 0008: adr-guard を v0.10.0 に上げる

ステータス: 採択

## 文脈

[ADR 0007](0007-update-adr-guard-to-v0.8.3.md) は、CI の `adr` ジョブの adr-guard の action を `tett23/adr-guard@v0.8.3` にすると決めた。
README も、インストールする adr-guard の版を v0.8.3 と書いている。

adr-guard の v0.9.0 から v0.10.0 までで、次のものが加わった。

- v0.9.0: 新しいサブコマンド `adr-guard check-numbers`。同じディレクトリで番号が重複した ADR を報告する。action は既定でこれを実行し、重複があると CI が失敗する。重複を直す `adr-guard renumber [--dry-run]` と、`pre-commit` と `check-range` の `--allow-renumber` も加わった
- v0.9.1: `renumber` の誤報の修正
- v0.10.0: 修飾子付きの ADR の参照。`ADR NNNN` の直前の語（空白 1 つ）を修飾子として読む。`/` を含む語はディレクトリ、`-` を含む語はモジュール（`docs/<モジュール>/adr/`）、それ以外の語はそのモジュールが存在するときだけ修飾子になる。`links` と pre-commit は、対象の無い修飾子付きの参照、リンク先が修飾子の ADR と異なるリンク、リンクの外に出た修飾子を報告し、`links --fix` で直せるものは直す
- v0.10.0: シンボリックリンクの `.md` は検査しない

このリポジトリでも、ADR の番号の重複を CI で防ぎ、ADR の参照の検査を新しい規則に合わせたい。
このリポジトリの ADR は `docs/adr/` の一か所だけで、モジュールの ADR はない。

## 実装すること

- CI（`.github/workflows/ci.yml` の `adr` ジョブ）の adr-guard の action を `tett23/adr-guard@v0.10.0` にする。ほかの入力は変えない（`check-numbers` は既定のまま有効にする）
- README の adr-guard の版の記述を v0.10.0 にする
- `docs/specifications.md` の「ADR の運用」に、CI が ADR の番号の重複も検査すること（`adr-guard check-numbers`）と、`ADR NNNN` の直前に `/` や `-` を含む語を置くと修飾子として読まれるので、ほかのリポジトリの ADR への参照は外部リンクのテキストに入れることを書く。ADR の一覧にこの ADR を足す
- [ADR 0007](0007-update-adr-guard-to-v0.8.3.md) のステータスの行を、adr-guard の版はこの ADR に変わったことを示す形にする
- `adr-guard links --fix --include-committed` を実行し、直すものがあれば直す

## 実装しないこと

- `.githooks/pre-commit` のコマンドは変えない（`adr-guard pre-commit --allow-status --allow-links` のまま）。`--allow-renumber` は付けない
- CI の action に `check-numbers: false` を付けない
- `adr-guard renumber` は使わない。いまの ADR の番号に重複はない
- adr-guard を CI 以外で自動でインストールする仕組みは作らない。手元の adr-guard は README に従って開発者が入れる

## テスト設計

このリポジトリには ADR の書式を検査するテストはない。設定と文書の変更なので、実装の後に実際に動かして確かめる。

1. 手元の adr-guard 0.10.0 で、`adr-guard links`、`adr-guard check-status`、`adr-guard check-numbers` が終了コード 0 で終わる
2. `adr-guard links --fix --include-committed` を実行し、直したファイルを確かめる
3. `.github/workflows/ci.yml` が YAML として読める
4. `deno fmt --check`、`deno lint`、`deno task test` が通る
5. コミットの後、`adr-guard check-range origin/main HEAD --allow-status --allow-links` が終了コード 0 で終わる
6. push の後、CI の `adr` ジョブが v0.10.0 の action で成功する

## トレードオフ

- adr-guard の版を上げるたびに ADR を書く手間がかかる。版は [ADR 0007](0007-update-adr-guard-to-v0.8.3.md) で決めたことなので、変えるときは新しい ADR で記録するほうを選ぶ
- 番号の重複の検査で、並行するブランチで同じ番号の ADR を作ると、後からマージするほうの CI が失敗する。番号を振り直す手間は増えるが、重複したまま main に入るよりよい
- 修飾子付きの参照の規則は、モジュールの ADR を持たないこのリポジトリではほとんど効かない。ほかのリポジトリと版を揃えておくほうを選ぶ

## 参考文献

- adr-guard v0.10.0 のリリース: https://github.com/tett23/adr-guard/releases/tag/v0.10.0
- adr-guard v0.9.1 のリリース: https://github.com/tett23/adr-guard/releases/tag/v0.9.1
- adr-guard v0.9.0 のリリース: https://github.com/tett23/adr-guard/releases/tag/v0.9.0
- adr-guard の ADR「[重複したADRの番号の修復](https://github.com/tett23/adr-guard/blob/main/docs/adr/0018-repair-duplicate-adr-numbers.md)」
- adr-guard の ADR「[モジュールで修飾したADRの参照](https://github.com/tett23/adr-guard/blob/main/docs/adr/0019-module-qualified-adr-references.md)」
- adr-guard の ADR「[シンボリックリンクの文書を飛ばす](https://github.com/tett23/adr-guard/blob/main/docs/adr/0020-skip-symlinked-documents.md)」
- adr-guard: https://github.com/tett23/adr-guard
