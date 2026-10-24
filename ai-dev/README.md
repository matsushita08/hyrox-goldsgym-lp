# AI開発社員 Phase 1 — ローカルfixture検証用の土台

API未接続の模擬修正フローです。Codex / Claude Codeによる実運用のAI自動修正はまだできません。追加依存、トークン設定、有料API呼出しはありません。Node.js 22以上と既存のnpmだけで動きます。サイト自体にpackage.jsonやビルド工程を追加するものではありません。

対象は `matsushita08/hyrox-goldsgym-lp`。実行器はGitHubに接続せず、元サイトにも変更を適用しません。Issue番号の例は模擬入力で、実在確認・取得・更新を行いません。

## 試す

専用リポジトリのルートで実行します。`npm install` は不要です。

```sh
npm --prefix ai-dev test
npm --prefix ai-dev run lint
node ai-dev/cli.mjs validate --task ai-dev/examples/issue-task.json
node ai-dev/cli.mjs queue ai-dev/examples/resume-task.json ai-dev/examples/fixture-task.json
```

提案と制限の確認だけをするdry-run:

```sh
node ai-dev/cli.mjs run --task ai-dev/examples/issue-task.json --fixture ai-dev/examples/fixture.json --dry-run
```

作業コピー内で模擬修正を適用し、構文・静的サイト・完了条件を検証:

```sh
node ai-dev/cli.mjs run --task ai-dev/examples/fixture-task.json --fixture ai-dev/examples/fixture.json
```

計画後に意図的に中断し、同じ入力で再開:

```sh
node ai-dev/cli.mjs run --task ai-dev/examples/resume-task.json --fixture ai-dev/examples/fixture.json --pause-after planned
# 上記は想定どおりexit 130 / INTERRUPTEDになる
node ai-dev/cli.mjs resume --task ai-dev/examples/resume-task.json --fixture ai-dev/examples/fixture.json
```

同じIssueの再実行は意図的に拒否されます。実行済みの例をもう一度試す場合は新しい分離コピーで実行するか、入力JSONをコピーし、`id`・`issue.number`・`issue.url`を整合する未使用の模擬番号に変更してください。完了済み状態やロックの自動削除は行いません。dry-runと模擬適用は別の模擬Issue例にしてあります。実行状態はGit管理外のため、新しくcloneした環境には含まれません。

## 入力と優先順位

- `task.schema.json`: Issue対応タスクのJSON Schema。外部バリデータ依存はなく、`lib/task.mjs` が必須項目・型・未知項目・対象一致を検証。
- `templates/issue.md`: 手動でIssueに記入するテンプレート。GitHubの設定には配置しない。
- `examples/*.json`: タスクJSONテンプレートとfixture。P0が最優先、P3が最低。同順位はIssue番号・IDの順。`queue` は順序を表示するだけで自動実行しない。
- 完了条件は空欄を拒否。`file_contains` / `file_not_contains` / `js_syntax` を実測し、`manual` は未実施として `awaiting_review` にする。見た目や業務上の正しさを自動合格にしない。

入力やfixtureにシェルコマンドを書く機能はありません。fixtureは `{ "edits": [{ "path", "find", "replace" }] }` の完全一致置換のみで、一致がない／複数ある場合は拒否します。

## 実行の流れと保存先

```text
Issue由来JSON → スキーマ・優先順位・予算検証 → Issue単位の排他ロック
  → 固定fixture adapter（環境変数を継承しない子Node）→ 変更提案
  → 許可パス・変更量検証 → planned checkpoint
      dry-run: 差分の保存だけで終了
      通常: workspaceへ適用 → applied checkpoint → 静的検証 → verified
  → state.json / events.jsonl / report.ja.md / proposal.diff
```

成果物はGit管理外の `.ai-dev-runs/issue-N/` に保存し、ファイルを原則0600・ディレクトリを0700にします。`workspace/` はサイトのテキスト4ファイルのみで、画像資産の存在検証には元コピーを読み取ります。独立した配布・プレビュー用バンドルではありません。

`state.json` はモード・段階・結果・入力/元ソース/実装ハッシュ・試行履歴・累積処理時間・料金を保存します。`events.jsonl` は固定イベントとエラーコードのみ。拒否は `.ai-dev-runs/rejections.jsonl` に記録します。説明本文、fixture本文、環境変数、子プロセス出力、例外スタックをログに出しません。`proposal.diff` と `workspace/` はコードのレビュー成果物であり、ログとは別です。

`completed` はfixtureの機械検証完了、`dry_run_completed` は提案検証完了です。どちらも本番の業務タスク完了・公開完了を意味しません。

## 制限と認証情報の境界

`policy.json` の固定上限:

| 項目 | 上限 |
|---|---|
| 変更可能ファイル | `index.html` / `style.css` / `script.js` / `leaflet-fallback.css` のうちタスクが許可したもの |
| 変更ファイル数 | 2 |
| 追加行・削除行 | それぞれ30 |
| 変更部分の合計バイト | 8,192 |
| 1ファイルのサイズ | 2 MiB |
| 累積処理時間 | タスク指定値、最大120秒 |
| タスク金額上限 | USD 0、fixture以外のアダプター選択不可 |

行数・バイト数は各ファイルの共通の先頭・末尾を除いた範囲で保守的に数えます。離れた変更の間にある不変行も数えるため、過大な変更を許す方向には緩めません。

`.github`、`.git`、認証ファイル、`ai-dev`自身、画像等の変更は固定allowlist外として拒否。パストラバーサル・絶対パス・symlink（リンク切れも含む）を拒否します。変更は常にscratch側で行い、元サイトへの適用機能はありません。

実行器はGitHub tokenを読み取らず、GitHub CLIも起動しません。adapterと構文検査の子プロセスには `LANG / LC_ALL / TZ` だけを明示して渡し、`GH_TOKEN / GITHUB_TOKEN / HOME / NODE_OPTIONS / PATH` 等を継承しません（macOSが追加する非認証のlocaleキーは許容）。子の作業場所にも`.git`や認証ファイルをコピーしません。生成JSは `node --check` による解析だけで、コード本体やnpm lifecycle scriptsを実行しません。

秘密らしい既知形式の入力は拒否します。ただし、これは完全な秘密検知器ではありません。このローカルfixtureは信頼する固定コードだけを実行する構成で、同一ユーザーによるファイル改変・OS全体のファイルアクセス・ネットワークを隔離するsandboxではありません。任意のAI生成コードを実行する設計へ拡張する前に、資格情報のないcontainer等の隔離とネットワーク制限が必要です。

単一アダプター境界は `lib/adapter.mjs` → `adapters/fixture.mjs`。標準入力JSONから提案JSONを返す契約です。将来CodexまたはClaude Codeを接続するときも、親がパス・量・予算・完了条件を検証する責務を維持します。現段階でCLI名や実行コマンドを入力から差し替える機能はありません。

## 再開と失敗

- `--pause-after planned|applied` またはSIGINT/SIGTERMで中断状態を保存。`resume` は同じタスク・fixture・モード・元ソース・実装でのみ許可します。
- 再開時は入力ハッシュを確認し、fixtureから変更を再構築します。途中まで書かれたscratch結果を信用せず、機械検証も再実行します。処理時間は試行間で累積し、待機時間は予算消費に含めません。
- scratchに余分なファイルやsymlinkが見つかった場合は拒否します。勝手に削除したり、追加コードを実行したりしません。
- 同一Issueの同時実行は `wx` ロックで拒否。別IDに変えても同一Issueを重複実行できません。完了済み・人間確認待ちの再実行も拒否。
- 強制終了・停電で残ったロックは自動で奪取しません。`TASK_LOCKED` の場合は所有プロセスの終了を人間が確認し、その実行ディレクトリの `run.lock` だけを整理してから再開が必要です。自動プロセス操作はしません。
- 検証失敗は `failed` と固定コード、日本語報告を保存。機械検証の失敗を成功扱いしません。入力を変える修正は新しいタスクとして扱います。上限時間を使い切った同一タスクは予算を増やして再開できません。
- ローカル状態は改ざん耐性のある課金台帳ではありません。外部サービス接続時には提供元側の予算制限と監査も必要です。

## 検証結果の意味

| 項目 | 何を確認するか |
|---|---|
| テスト | Node標準test runnerで正常系・拒否系・失敗・再開・排他・子環境・非実行を検証 |
| Lint相当 | ツールのNode構文と末尾空白、提案追加行の末尾空白・競合マーカー |
| サイト検証 | JS構文、HTML主要タグ、ローカルsrc/href資産の存在、指定完了条件 |
| ビルド | **該当なし**。静的サイトにビルド工程は存在せず、成功とは記録しない |
| ブラウザ・視覚・外部URL | **未実施**。完全なHTML/CSS lint、JS内動的URL検証も未実装 |

料金は `actualUsd: null`（未取得）。fixtureに有料API呼出しはないため `upperBoundUsd: 0` と明記し、実料金を0と偽りません。累積処理時間・各試行時間・結果はstateに残ります。利用枠や請求額を取得する機能はありません。

## 今後、別途承認・実装が必要なもの

実AIアダプター、認証やAPIキーの設定、料金・利用枠連携、有料実行、Issueの取得と更新、push、PR外部作成、本番公開、外部送信。これらは実行器に実装していません。この土台コードを専用ブランチに保存して確認用PRを作る操作は、実行器とは別に人間の承認下で扱います。

`drafts/manual-workflow.yml.disabled` は `.github/workflows` 外の無効な下書きです。手動起動だけを想定しジョブ条件も常にfalse、権限は空。イベント・スケジュール起動はありません。将来は認証付き取得ジョブと、token・認証用HOME・.gitを持たない生成/テストジョブを分けます。下書きを移動するだけでは運用できません。

クラウド実行は未有効化です。現状はMacスリープ非依存ではありません。
