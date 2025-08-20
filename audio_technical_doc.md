# リズムゲーム 音声処理技術解説

## 概要
このリズムゲームでは、Web Speech APIとWeb Audio APIを組み合わせて、リアルタイムで音声フィードバックを提供しています。2つの異なるAPIを使用することで、音声合成と電子音を並列で再生し、豊かな音響体験を実現しています。

## 使用している音声API

### 1. Web Speech API (音声合成)
音声によるフィードバックを生成するために`speechSynthesis` APIを使用しています。

#### 実装箇所
- `playHitSound()` (game.js:211-248): ヒット時に"yeah!"を再生
- `playMissSound()` (game.js:270-306): ミス時に"oh no"を再生

#### 並列再生の工夫
- `speechSynthesis.cancel()` (game.js:213, 272) で前の音声をキャンセル
- 即座に新しい音声を開始することで遅延を防止
- 女性ボイスを優先的に選択（game.js:222-235）

### 2. Web Audio API (効果音)
純粋な電子音を生成するために`AudioContext`を使用しています。

#### 実装箇所
- game.js:251-267: ヒット時のキラキラ音（正弦波、1500-2400Hz）
- game.js:309-325: ミス時のブザー音（のこぎり波、80Hz）

#### 並列再生の仕組み
- Web Audio APIは完全に独立したオーディオグラフで動作
- `oscillator` → `gainNode` → `destination` のルーティング構造
- 各効果音は独自のタイミングで開始・停止可能

## speechSynthesis API 詳細解説

### 1. SpeechSynthesisUtterance オブジェクト
音声合成の基本単位として、読み上げるテキストと音声パラメータを設定します。

```javascript
const utterance = new SpeechSynthesisUtterance('yeah!');
utterance.rate = 1.2;    // 速度 (0.1-10, デフォルト1)
utterance.pitch = 1.3;   // ピッチ (0-2, デフォルト1)
utterance.volume = 0.7;  // 音量 (0-1, デフォルト1)
utterance.voice = voice; // 音声エンジン
```

### 2. 動的パラメータ調整
スコアに応じて音声パラメータを動的に変化させています（game.js:216-217）：

```javascript
utterance.rate = 1.2 + (points / 300) * 0.5;   // PERFECT時は1.7
utterance.pitch = 1.3 + (points / 300) * 0.5;  // PERFECT時は1.8
```

これにより、高得点時にはより高く速い声で、低得点時には通常の声でフィードバックを提供します。

### 3. 音声エンジンの選択
優先順位付きで最適な音声を選択しています（game.js:221-245）：

1. **女性音声を優先検索**: 名前に'female', 'samantha', 'victoria', 'karen', 'zira'等を含む音声
2. **代替音声**: 女性音声が見つからない場合は英語音声を選択
3. **ピッチ調整**: ピッチを上げて女性的な声に近づける（最大値2.0）

### 4. キュー管理とレスポンス改善
```javascript
speechSynthesis.cancel();  // 既存のキューをクリア
speechSynthesis.speak(utterance);  // 即座に新しい音声を開始
```

**問題点**: 通常、音声はキューに追加され、前の音声が終わるまで待機する
**解決策**: `cancel()`で即座にキューをクリアし、遅延なく新しい音声を再生

### 5. 初期化の工夫
音声エンジンの遅延読み込みに対応（game.js:82-85）：

```javascript
if (speechSynthesis.getVoices().length === 0) {
    speechSynthesis.addEventListener('voiceschanged', () => {
        this.prepareVoices();
    }, { once: true });
}
```

- ブラウザによっては音声リストが非同期で読み込まれる
- `voiceschanged`イベントで音声が利用可能になったタイミングで初期化

### 6. ブラウザ互換性対策
- **大文字小文字の正規化**: 音声名を小文字に変換して比較
- **複数ベンダー対応**: Google, Microsoft等の異なる音声名パターンをチェック
- **パラメータ制限**: `pitch`の最大値を2に制限（`Math.min(2, pitch)`）

## 重要な技術ポイント

### AudioContext初期化
game.js:93-95でユーザー操作後に初期化（ブラウザのAutoplay Policy対応）：
```javascript
if (!this.audioContext) {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
}
```

### 音声の事前準備
game.js:34-90で初回読み込み時に音声エンジンを初期化し、初回再生の遅延を回避。

### パフォーマンス最適化
- 音声キューのクリアで即座に再生
- 短い効果音（0.1-0.15秒）で重複を回避
- Web Audio APIで低レイテンシーの効果音を実現

## まとめ
この実装により、以下を実現しています：
- 音声合成と電子音が干渉せずに同時再生
- レスポンシブな音声フィードバック
- ブラウザや環境の違いを吸収した安定動作
- スコアに応じた動的な音声表現