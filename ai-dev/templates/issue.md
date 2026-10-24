# AI開発社員へのタスク（手動入力用・自動起動なし）

## 対象
repository: matsushita08/hyrox-goldsgym-lp
Issue番号・URL: 実在する対象Issueを記入
優先順位: P0 / P1 / P2 / P3（P0が最優先）

## 目的と変更範囲
目的:
許可ファイル: index.html / style.css / script.js / leaflet-fallback.css から選択

## 完了条件
- 機械検証: 対象ファイルに含まれる／含まれない文字列を具体化
- 人間確認: 見た目・日本語の自然さ・業務上の正しさ（自動完了にしない）

## 制限
実行秒数上限: 30（ポリシー上限120）
金額上限 USD: 0（今回はfixture限定・API未接続）
本番公開・push・PR作成・外部送信はこのタスクに含めない。

`../task.schema.json`に従いJSONに転記する。入力例は`../examples/issue-task.json`。
このファイルは`.github/ISSUE_TEMPLATE`に配置していないため、GitHubには反映されない。
