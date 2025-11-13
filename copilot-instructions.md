# GitHub Copilot 指示書

このプロジェクトは **計算式スロットで数字をピックする新感覚ビンゴゲーム** です。

## GitHub 認証設定

**このリポジトリでは `.copilot-profile` に記載されているGitHubプロファイルを使用してください。**

### 設定手順

1. `.copilot-profile` ファイルからプロファイル名を読み取る
2. GitHub CLI認証: `gh auth switch -u $(cat .copilot-profile)`
3. Git設定（このリポジトリのみ）:
   ```bash
   PROFILE=$(cat .copilot-profile)
   git config user.name "$PROFILE"
   git config user.email "$PROFILE@users.noreply.github.com"
   ```
4. リモートURL: HTTPS形式を使用

### 操作前の確認

- コミット、プッシュ、PR作成などのGitHub操作を行う前に、必ず `.copilot-profile` のプロファイルに切り替わっているか確認
- SSH接続ではなくHTTPS接続を使用すること

### 初回セットアップ

`.copilot-profile` ファイルを作成し、使用するGitHubプロファイル名を記載してください（このファイルは `.gitignore` に追加されています）:
```bash
echo "your-github-username" > .copilot-profile
```

## プロジェクト概要

- **言語**: Node.js (JavaScript)
- **フレームワーク**: Express + Socket.io
- **フロントエンド**: Vanilla JavaScript + HTML5 + CSS3
- **リアルタイム通信**: WebSocket (Socket.io)
- **主な機能**: 計算式スロット、QRコード参加、リーチ/ビンゴ申告、テーマ切り替え

## コーディング規約

### 一般原則

- **シンプルさ優先**: 複雑な抽象化は避け、読みやすいコードを書く
- **Vanilla JavaScript**: フレームワーク不使用、ブラウザ標準APIを活用
- **WebSocket通信**: Socket.ioを使用したリアルタイム同期
- **レスポンシブ対応**: スマホ/タブレット/PCすべてで動作

### コードスタイル

```javascript
// 変数名: キャメルケース
const pickedNumbers = [];
let currentNumber = 0;

// 関数名: 動詞+名詞の組み合わせ
function pickNumber() { }
function updatePlayerList() { }

// イベントハンドラ: on + イベント名
socket.on('number_picked', (data) => { });

// DOM操作: わかりやすい変数名
const pickButton = document.getElementById('pickButton');
const numberDisplay = document.querySelector('.number-display');
```

### ファイル構成規則

```
server.js          # サーバーロジック、WebSocket処理
public/
  index.html       # ホスト画面 (PC/タブレット)
  player.html      # プレイヤー画面 (スマホ)
  sounds/          # 効果音ファイル
```

## 重要な実装パターン

### 1. 計算式生成ロジック

```javascript
// 演算子の重み付け（加算が2倍）
const operators = ['+', '+', '-', '×', '÷'];

// 重複回避: 10回試行してダメなら残りから選択
// 残り20個以下は直接選択モードに自動切替
```

### 2. WebSocket イベント命名規則

- **クライアント → サーバー**: `動詞_目的語` (例: `pick_number`, `status_change`)
- **サーバー → クライアント**: `名詞_過去分詞` (例: `number_picked`, `player_joined`)

### 3. エラーハンドリング

- エラー時は必ず **コンソールログ** を出力
- ユーザーには **わかりやすいメッセージ** を表示
- WebSocket切断時は **自動再接続** を試行

### 4. 効果音再生

```javascript
// ユーザー操作後に音声を有効化（ブラウザポリシー対応）
document.addEventListener('click', () => {
  // 音声コンテキスト初期化
});
```

## 新機能追加時の注意点

### チェックリスト

- [ ] README.md の更新（機能説明、技術仕様）
- [ ] サーバー側とクライアント側の両方に実装
- [ ] WebSocketイベントの送受信を実装
- [ ] エラーハンドリングを追加
- [ ] レスポンシブ対応を確認

### テーマ追加の場合

1. CSS変数を定義
2. テーマ切り替えロジックに追加
3. 全画面で表示確認

## デバッグのヒント

- **WebSocket接続**: ブラウザのDevToolsでネットワークタブを確認
- **音声再生**: コンソールエラーを確認（autoplay policy）
- **QRコード**: スマホとPCが同じWi-Fiに接続されているか確認

## 依存パッケージ

```json
{
  "express": "^5.1.0",
  "socket.io": "^4.8.1",
  "qrcode": "^1.5.4"
}
```

## 起動方法

```bash
npm install
npm start
# http://localhost:3000 でアクセス
```

## WSL2環境での注意

- `localhost:3000` でWindowsからアクセス可能
- スマホからは **WindowsのIPアドレス** でアクセス
- ファイアウォール設定でポート3000を開放

---

**コード変更時は、既存の動作を壊さないよう最小限の修正を心がけてください。**
