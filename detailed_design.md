# SpaceMind 詳細設計書

## 1. システム概要

SpaceMindは3Dマインドマップを作成・編集するためのアプリケーションです。PythonとReactを組み合わせたデスクトップアプリケーションとして実装されています。

## 2. システムアーキテクチャ

### 2.1 全体構成

```mermaid
graph TB
    Frontend[Reactフロントエンド]
    Backend[Pythonバックエンド]
    FileSystem[ファイルシステム]
    
    Frontend <--> |Eel| Backend
    Backend <--> FileSystem
```

- **フロントエンド**: React + TypeScript
- **バックエンド**: Python + Eel
- **通信方式**: Eelによるブラウザ-Python間通信

### 2.2 主要コンポーネント

```mermaid
graph TB
    MindMap[MindMapGraph<br>ノード・リンクデータ保持]
    Index[index.tsx<br>データ仲介・状態管理]
    NodeEdit[NodeEditor]
    LinkEdit[LinkEditor]
    TreeDraw[TreeDrawer]
    Python[PythonBackend]
    
    MindMap <--> |データ参照・更新| Index
    Index --> NodeEdit
    Index --> LinkEdit
    Index --> TreeDraw
    NodeEdit --> Python
    LinkEdit --> Python
    TreeDraw --> Python
```

#### データフロー
- MindMapGraphコンポーネントがノードとリンクのデータを保持
- index.tsxがMindMapGraphとエディター間のデータ仲介を担当
- 各エディターはindex.tsxを介してデータの参照・更新を実行

## 3. コンポーネント詳細

### 3.1 Pythonバックエンド (main.py)

#### 主要機能
- ファイルシステム操作（JSON読み書き）
- ノード画像生成（HTML+CSSからPNG画像生成）
- Eelによるフロントエンド通信

#### ノード画像生成プロセス
1. ノードの内容とスタイルをHTML+CSSで定義
2. アイコン画像がある場合、base64形式で直接HTMLに埋め込み
3. HTMLをPNG画像に変換（Windows: wkhtmltoimage, その他: WeasyPrint）
4. 画像の透明度とラウンド処理
5. 生成した画像をノードの表示用アセットとして保存

#### 重要なメソッド
- `select_file_dialog()`: ファイル選択ダイアログの表示
- `load_json(path)`: JSONファイルの読み込み
- `save_json(data, path)`: JSONファイルの保存
- `generate_images(node_data)`: ノード画像の生成
- `process_base64_image(base64_str, max_size)`: アイコン画像のリサイズ処理

### 3.2 マインドマップグラフ (MindMapGraph.tsx)

#### 主要機能
- 3Dグラフの描画と操作
- ノード・リンクデータの保持と管理
- インタラクティブな編集機能
- 複数ノード選択機能
- ノードのコピー&ペースト機能

#### データ管理
- `graphData`: ノードとリンクのデータを保持する状態
- `selectedNode`: 現在選択中のノードを管理
- `selectedNodeList`: 複数選択されたノードを管理
- `copiedNodeRef`: コピーされたノードの参照を保持（useRefで管理）

#### 重要なメソッド
- `copyNode`: 選択中のノードをコピーしてバッファに保存
- `getCopiedNode`: コピーされたノードのディープコピーを取得
- `addNode`: 新規ノードを追加（ペースト操作で使用）
  - コピー元の位置から少しずらして配置
  - 新規IDを割り当て
  - スタイル、アイコン、期限などの属性を保持

#### 重要なコンポーネント
- `ForceGraph3D`: 3Dグラフの描画エンジン
- `nodeThreeObjectImageTexture`: ノードの3D表示処理
- `handleClick`: ノードクリック時の処理
- `handleNodeDrag`: ノードドラッグ時の処理

### 3.3 ノードエディタ (NodeEditor.tsx)

#### 主要機能
- ノード内容の編集
- ノードスタイルの設定
- アイコン画像の設定（ドラッグ&ドロップ対応）
- ノードの削除
- 期限の設定
- 重要度の設定
- 緊急度の設定

#### UI要素
- テキスト入力エリア
- スタイル選択ドロップダウン
- アイコン画像アップロードエリア（プレビュー表示付き）
- 期限入力フィールド（datetime-local形式）
- 重要度選択ドロップダウン（未選択、1:最低～5:最高）
- 緊急度選択ドロップダウン（未選択、1:最低～5:最高）
- 操作ボタン（OK、キャンセル、削除）

#### アイコン画像処理フロー
```mermaid
sequenceDiagram
    participant User
    participant NodeEditor
    participant Python
    
    User->>NodeEditor: 画像ドラッグ&ドロップ
    NodeEditor->>NodeEditor: FileReader処理
    NodeEditor->>NodeEditor: base64変換
    NodeEditor->>NodeEditor: プレビュー表示
    NodeEditor->>Python: ノード保存（base64データ含む）
    Python->>Python: 画像リサイズ処理
    Python->>Python: ノード画像生成（アイコン埋め込み）
    Python-->>NodeEditor: 処理完了
```

### 3.4 リンクエディタ (LinkEditor.tsx)

#### 主要機能
- リンク名の編集
- リンクの削除
- 接続ノードの確認・選択

#### UI要素
- リンク名入力フィールド
- 接続ノード表示
- 操作ボタン（OK、キャンセル、削除）

### 3.5 ツリードロワー (TreeDrawer.tsx)

#### 主要機能
- ノード検索
- ファイル操作
- 検索結果の表示

#### UI要素
- 検索入力フィールド
- 検索結果リスト
- ファイル操作ボタン
- 保存ボタン

## 4. データ構造

### 4.1 ノードデータ
```typescript
interface NodeData {
    id: number;
    name: string;
    img: string;
    group?: number;
    style_id: number;
    x?: number;
    y?: number;
    z?: number;
    fx?: number;
    fy?: number;
    fz?: number;
    size_x: number;
    size_y: number;
    deadline?: string;  // 期限（YYYY-MM-DDTHH:mm形式）
    priority?: number | null;  // 重要度（未選択、または1:最低～5:最高）
    urgency?: number | null;  // 緊急度（未選択、または1:最低～5:最高）
    icon_img?: string;  // アイコン画像（base64形式）
    createdAt: string;  // 作成日時（ISO 8601形式）
    updatedAt: string;  // 更新日時（ISO 8601形式）
}
```

### 4.2 リンクデータ
```typescript
interface LinkData {
    index: number;
    source: NodeData;
    target: NodeData;
    name: string;
}
```

## 5. 主要な処理フロー

### 5.1 ノード作成フロー
```mermaid
sequenceDiagram
    participant User
    participant MindMap
    participant Index
    participant NodeEditor
    participant Python
    
    User->>MindMap: ノード作成操作
    MindMap->>MindMap: 新規ノードデータ作成
    MindMap->>Index: ノードデータ通知
    Index->>NodeEditor: エディタ表示
    NodeEditor->>Index: 編集内容保存
    Index->>Python: ノード情報保存
    Python->>Python: 画像生成
    Python->>Index: 更新完了通知
    Index->>MindMap: データ更新
```

### 5.2 ファイル保存フロー
```mermaid
sequenceDiagram
    participant User
    participant TreeDrawer
    participant Index
    participant MindMap
    participant Python
    participant FileSystem
    
    User->>TreeDrawer: 保存ボタン押下
    TreeDrawer->>Index: 保存要求
    Index->>MindMap: データ取得要求
    MindMap->>Index: グラフデータ返却
    Index->>Python: 保存要求（JSONデータ）
    Python->>Python: JSONデータ整形
    Python->>FileSystem: ファイル保存
    Python->>Index: 完了通知
    Index->>TreeDrawer: 完了通知
```

### 5.3 ノードコピー&ペーストフロー
```mermaid
sequenceDiagram
    participant User
    participant Index as index.tsx
    participant MindMap as MindMapGraph
    
    User->>Index: Ctrl + C
    Index->>MindMap: copyNode実行
    MindMap->>MindMap: 選択中ノードをバッファに保存
    
    User->>Index: Ctrl + V
    Index->>MindMap: getCopiedNode実行
    MindMap->>MindMap: ノードのディープコピー作成
    MindMap->>MindMap: 新規ID割り当て
    MindMap->>MindMap: 位置をずらして配置
    MindMap->>MindMap: グラフデータに追加
    MindMap-->>Index: 完了通知
```

## 6. 技術スタック

### 6.1 フロントエンド
- React
- TypeScript
- Three.js (3D描画)
- Ant Design (UIコンポーネント)

### 6.2 バックエンド
- Python
- Eel (ブラウザ通信)
- PIL (画像処理)

## 7. 拡張性と制約

### 7.1 拡張性
- ノードスタイルの追加が容易
- 新しい操作モードの追加が可能
- データ構造の拡張が可能

### 7.2 制約
- ブラウザ依存の制限
- ローカルファイルシステムへのアクセスはPython側で実施
- 画像生成処理はOSによって異なる実装が必要

### 7.3 ノード表示仕様
- アイコン画像がある場合、ノード名の上部に表示（最大幅500px、アスペクト比保持）
- ノード名は中央に表示（改行・空白を保持）
- 期限が設定されている場合、ノード名の下部に赤字で表示
- 重要度が設定されている場合（未選択以外）、期限の下に青字で★マークを表示（1～5個）
- 緊急度が設定されている場合（未選択以外）、重要度の下に緑字で★マークを表示（1～5個）
- スタイルに応じた枠線とカラーリングを適用

## 8. キー操作イベントハンドラ

### 8.1 イベントハンドラの設計

```mermaid
sequenceDiagram
    participant User
    participant Index as index.tsx
    participant MindMap as MindMapGraph
    participant Python as PythonBackend
    
    User->>Index: キー入力
    Index->>Index: keyFunction実行
    alt Ctrl + S
        Index->>Index: handleSave呼び出し
        Index->>MindMap: getGraphData
        MindMap-->>Index: グラフデータ
        Index->>Python: save_data
        Python-->>Index: 保存結果
    else Delete
        Index->>MindMap: getSelectedNode/getSelectedNodeList
        MindMap-->>Index: 選択中ノード
        Index->>MindMap: deleteNode実行
    end
```

### 8.2 キー操作一覧

#### グローバルキー操作
- **Ctrl + S**: 現在のマインドマップを保存
  - index.tsxでキャッチし、handleSave関数を実行
  - MindMapGraphからデータを取得しPythonバックエンドで保存
  - 保存結果をメッセージで表示
- **Ctrl + C**: 選択中のノードをコピー
  - MindMapGraphのcopyNode関数を実行
  - 選択中のノードの情報を内部バッファに保存
- **Ctrl + V**: コピーしたノードをペースト
  - MindMapGraphのgetCopiedNode関数でコピーされたノードを取得
  - 新規ノードとして追加（位置はコピー元からずらして配置）
  - コピー時の属性（スタイル、アイコン、期限など）を保持

#### ノード操作
- **Delete**: 選択中のノードを削除
  - index.tsxでキャッチし、選択中のノードを取得
  - 単一選択の場合はgetSelectedNodeで取得
  - 複数選択の場合はgetSelectedNodeListで取得
  - 取得したノードをMindMapGraphのdeleteNode関数で削除

### 8.3 エディター表示中のキー操作制御

#### 設計方針
- エディター（モーダル・ドロワー）表示中はグローバルキー操作を無効化
- 各エディターの状態をindex.tsxで管理
- キー操作前にエディターの表示状態をチェック

```mermaid
sequenceDiagram
    participant User
    participant Index as index.tsx
    participant Editor as エディター
    participant MindMap as MindMapGraph

    User->>Index: キー入力
    Index->>Index: エディター表示状態チェック
    alt エディター表示中
        Index-->>User: キー操作を無効化
    else エディター非表示
        Index->>MindMap: キー操作に応じた処理実行
        MindMap-->>Index: 処理結果
    end
```

#### 実装ポイント
1. エディター状態管理
```typescript
// index.tsxでの状態管理
const [isNodeEditorOpen, setIsNodeEditorOpen] = useState(false);
const [isLinkEditorOpen, setIsLinkEditorOpen] = useState(false);
const [isTreeDrawerOpen, setIsTreeDrawerOpen] = useState(false);
```

2. エディターコンポーネントの実装
```typescript
interface EditorProps {
    onClose: () => void;  // エディターを閉じる際の状態更新用
    // その他のProps
}
```

3. キー操作制御
```typescript
const keyFunction = useCallback((event: any) => {
    // エディター表示中はキー操作を無効化
    if (isNodeEditorOpen || isLinkEditorOpen || isTreeDrawerOpen) return;
    
    // 以降、通常のキー操作処理
}, [isNodeEditorOpen, isLinkEditorOpen, isTreeDrawerOpen]);
```

### 8.4 実装方針
- キー操作のイベントハンドラはindex.tsxで一元管理
- useEffectでコンポーネントマウント時にイベントリスナーを登録
- キー操作に応じて適切なコンポーネントのメソッドを呼び出し
- 各機能の実装は対応するコンポーネントに委譲

## 9. 設計注意事項

### 9.1 モーダル・ドロワー実装時の注意点

1. 状態管理
- モーダルやドロワーの表示状態は必ずindex.tsxで管理する
- 各コンポーネントの内部状態（isOpen等）は使用しない
- 表示状態の変更は必ずonCloseプロパティ経由で行う

2. キー操作の制御
- モーダルやドロワーを実装する際は、必ずindex.tsxの状態管理に組み込む
- グローバルキー操作との競合を防ぐため、表示状態をkeyFunctionで考慮する
- テキスト入力フィールドでのキー操作（Enter等）は、エディター表示中でも有効とする

3. コンポーネント設計
```typescript
// 推奨実装パターン
interface EditorComponentProps {
    onClose: () => void;  // 必須
    // その他の必要なProps
}

const EditorComponent = ({ onClose, ...props }) => {
    // 内部でのモーダル状態管理は行わない
    // すべての閉じる操作でonCloseを呼び出す
};
```

4. 実装チェックリスト
- [ ] index.tsxで表示状態を管理するstateを追加
- [ ] コンポーネントにonCloseプロパティを追加
- [ ] すべての閉じる操作（OK、キャンセル、×ボタン等）でonCloseを呼び出す
- [ ] keyFunctionで表示状態をチェックする条件に追加
