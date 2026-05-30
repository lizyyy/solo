# 手势魔法音阶战 — 交接说明

## 5 分钟跑通

```bash
npm install
npm run dev
# 浏览器打开 http://localhost:5173
```

1. 主页选难度 → 点「开始游戏」
2. 倒计时 3 秒后摄像头启动（需授权），跟着音阶做手势
3. 游戏结束自动跳回放页，可查看事件日志 + 证据链 + 导出 JSON

## 手势对照

| 音阶 | 手势 | emoji |
|------|------|-------|
| Do  | 握拳 | ✊ |
| Re  | 竖食指 | ☝️ |
| Mi  | 剪刀手 | ✌️ |
| Fa  | 三指 | 🤟 |
| Sol | 四指 | 🖖 |
| La  | 五指张开 | 🖐️ |
| Si  | 竖大拇指 | 👍 |

## 关键文件

| 文件 | 职责 |
|------|------|
| `src/types/game.ts` | 所有类型定义 + 音阶/手势映射表 |
| `src/store/gameStore.ts` | Zustand 全局状态（分数、节拍、事件列表） |
| `src/engine/gestureEngine.ts` | MediaPipe 21 关键点 → 7 种手势识别 |
| `src/engine/audioEngine.ts` | Web Audio API 音阶发音 + 正确/错误音效 |
| `src/engine/eventLog.ts` | 事件创建 / 摘要 / JSON 导出 |
| `src/pages/Play.tsx` | 游戏主循环：节拍驱动 → 手势捕获 → 判定 → 反馈 → 下一拍 |
| `src/pages/Replay.tsx` | 回放页：成绩单 + 时间线 + 证据面板 |
| `src/components/EvidencePanel.tsx` | 证据链面板：手势数据 / 音阶判定 / 节拍同步三段式 |

## 证据链结构

每个事件 (`GameEvent`) 同时包含三组数据，保证不断链：

```
事件摘要 "第2回合第3拍 ✗ 错误 期望Sol 实际La 偏移85ms"
  ├─ gesture: { landmarks[21], recognizedGesture, confidence }
  ├─ scale:   { expected, actual, isCorrect, confidence }
  └─ beat:    { expectedTime, actualTime, offsetMs, isOnBeat }
```

- **手势误识别**：看 `gesture.landmarks` 原始坐标 + `confidence`
- **节拍延迟**：看 `beat.offsetMs` 实际偏移量
- **音阶跳级**：看 `scale.expected` vs `scale.actual`，事件写入后只读不覆盖

## 游戏循环流程

```
scheduleNextBeat()
  → 播放节拍点击音 + 音阶音
  → 等待 75% 拍长（手势捕获窗口）
  → processBeat()：取当前手势 → 判定正确/错误/超时
    → 记录 GameEvent（不可篡改）
    → 显示反馈动画 1 秒
  → clearFeedback() → nextBeat() → scheduleNextBeat() 递归
```

## 难度配置

| 难度 | 每回合拍数 | 音序长度 | BPM |
|------|-----------|---------|-----|
| 简单 | 4 | 单音 | 60 |
| 普通 | 8 | 连续 2 音 | 80 |
| 困难 | 12 | 连续 4 音 | 100 |

## 常见问题

- **摄像头启动失败**：检查浏览器权限，localhost 必须 HTTPS 或 127.0.0.1
- **手势识别不准**：调整 `gestureEngine.ts` 的 `AMBIGUITY_THRESHOLD`（当前 0.05），或 MediaPipe `minDetectionConfidence`（当前 0.7）
- **节拍节奏不对**：调整 `Play.tsx` 中 `beatIntervalMs * 0.75` 的手势捕获窗口比例
- **导出日志**：回放页点「导出全部日志」或证据面板的导出按钮，输出完整 JSON
