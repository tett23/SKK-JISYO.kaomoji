# ADR 0007: adr-guard を v0.8.3 に上げる

ステータス: 採択

## 文脈

[ADR 0001](0001-kaomoji-dictionary-from-mozc.md) は、CI に `tett23/adr-guard@v0.8.2` の `adr` ジョブを置くと決めた。
README も、インストールする adr-guard の版を v0.8.2 と書いている。

adr-guard の v0.8.3 で、次のものが加わった。

- 新しいステータス `採択（未実装）`（括弧は全角・半角のどちらでもよい。英語は `Accepted (not implemented)`）。採択したが、まだ実装していない ADR を表す
- 新しいサブコマンド `adr-guard unimplemented [--status]`。ステータスが `採択（未実装）` の ADR を一覧する

このリポジトリの ADR の運用でも、採択したが未実装の ADR を区別して書けるようにしたい。

## 実装すること

- CI（`.github/workflows/ci.yml` の `adr` ジョブ）の adr-guard の action を `tett23/adr-guard@v0.8.3` にする。ほかの入力は変えない
- README の adr-guard の版の記述を v0.8.3 にする
- `docs/specifications.md` の「ADR の運用」に、採択したが未実装の ADR のステータスを `採択（未実装）` にし、`adr-guard unimplemented` で一覧できることを書く。ADR の一覧にこの ADR を足す
- [ADR 0001](0001-kaomoji-dictionary-from-mozc.md) のステータスの行に、`adr-guard の版は ADR 0007` を足す

## 実装しないこと

- `.githooks/pre-commit` のコマンドは変えない（`adr-guard pre-commit --allow-status --allow-links` のまま）
- 既存の ADR のステータスを `採択（未実装）` に書きかえない。既存の ADR はどれも実装済みである
- adr-guard を CI 以外で自動でインストールする仕組みは作らない。手元の adr-guard は README に従って開発者が入れる

## テスト設計

このリポジトリには ADR のステータスの書式を検査するテストはない。設定と文書の変更なので、実装の後に実際に動かして確かめる。

1. 手元の adr-guard 0.8.3 で、`adr-guard links` と `adr-guard check-status` が終了コード 0 で終わる
2. `adr-guard unimplemented` が終了コード 0 で終わり、何も出さない（未実装の ADR がない）
3. `.github/workflows/ci.yml` が YAML として読める
4. コミットの後、`adr-guard check-range origin/main HEAD --allow-status --allow-links` が終了コード 0 で終わる
5. push の後、CI の `adr` ジョブが v0.8.3 の action で成功する

## トレードオフ

- adr-guard の版を上げるたびに ADR を書く手間がかかる。版は [ADR 0001](0001-kaomoji-dictionary-from-mozc.md) で決めたことなので、変えるときは新しい ADR で記録するほうを選ぶ
- `採択（未実装）` を使えるようにしても、このリポジトリで使う場面は少ない。ユーザーの全体の ADR の運用と合わせ、ステータスの候補を揃えておくほうを選ぶ

## 参考文献

- adr-guard v0.8.3 のリリース: https://github.com/tett23/adr-guard/releases/tag/v0.8.3
- adr-guard の ADR「[採択（未実装）のステータス](https://github.com/tett23/adr-guard/blob/main/docs/adr/0016-accepted-not-implemented-status.md)」
- adr-guard: https://github.com/tett23/adr-guard
