# 手部康复节拍教练

给社区康复治疗师用的本地交互训练工具 - 帮助患者在家进行手部康复训练。

## 功能特性

- **训练方案编辑**：自定义动作序列、节拍速度、重复次数
- **实时节拍/动作判定**：跟着节拍做动作，系统自动检测正确性
- **疼痛和暂停记录**：训练中随时记录疼痛程度和暂停情况
- **训练历史保存**：所有训练记录本地存储，永不丢失
- **复盘图表**：可视化展示训练数据，分析进步趋势
- **Markdown 报告**：一键导出完整训练报告，方便存档

## 技术栈

- **运行时**: Electron (桌面应用)
- **前端框架**: React 18
- **语言**: TypeScript
- **构建工具**: Vite
- **测试框架**: Jest
- **图表库**: Recharts

## 项目结构

```
xy4150/
├── src/
│   ├── main/                    # Electron 主进程
│   │   └── main.ts              # 主入口
│   ├── renderer/                # Electron 渲染进程 (React)
│   │   ├── App.tsx              # 应用主组件
│   │   ├── main.tsx             # 渲染入口
│   │   ├── index.css            # 全局样式
│   │   └── components/          # UI 组件
│   │       ├── PlanList.tsx     # 方案列表
│   │       ├── PlanEditor.tsx   # 方案编辑器
│   │       ├── TrainingView.tsx # 训练界面
│   │       ├── SessionList.tsx  # 历史列表
│   │       └── SessionDetail.tsx # 复盘详情
│   └── shared/                  # 共享模块
│       ├── types.ts             # 类型定义
│       ├── constants.ts         # 常量
│       ├── utils.ts             # 工具函数
│       ├── TrainingStateMachine.ts # 训练状态机
│       ├── InputAdapter.ts      # 输入适配器
│       ├── ScoringEngine.ts     # 评分引擎
│       ├── StorageManager.ts    # 存储管理
│       └── ReportGenerator.ts   # 报告生成
├── tests/                       # 单元测试
│   ├── utils.test.ts
│   └── ScoringEngine.test.ts
├── package.json
├── tsconfig.json
├── tsconfig.main.json
├── tsconfig.renderer.json
├── vite.config.ts
├── jest.config.js
└── README.md
```

## 核心模块说明

### 1. 训练状态机 (TrainingStateMachine)

有限状态机模式，管理训练完整生命周期：

```
idle → countdown → active → paused → completed
         ↓            ↓
         ←←←←←←←←←←←←←
```

**关键回调**：
- `onBeat(beatNumber)` - 节拍触发
- `onActionExpected(stepIndex, actionId)` - 期望动作
- `onActionResult(result)` - 动作判定结果
- `onPhaseChange(phase)` - 状态切换
- `onComplete()` - 训练完成

### 2. 输入适配器 (InputAdapter)

适配器模式，支持多种输入源：

- **KeyboardInputAdapter**: 键盘输入 (F=握拳, P=张掌, N=捏合)
- **CameraInputAdapter**: 摄像头输入 (预留接口)

```typescript
// 使用示例
const adapter = new KeyboardInputAdapter();
adapter.init((action) => {
  stateMachine.handleInputEvent(action);
});
```

### 3. 评分引擎 (ScoringEngine)

三维度评分体系：

| 维度 | 权重 | 计算方式 |
|------|------|----------|
| 准确率 | 50% | 正确动作 / 总动作数 |
| 时间精准度 | 30% | 平均时间偏差映射 |
| 节奏稳定性 | 20% | 时间偏差标准差映射 |

### 4. 存储管理 (StorageManager)

策略模式，支持多种存储：

- **LocalStorageProvider**: 浏览器 localStorage
- **MemoryStorageProvider**: 内存存储 (用于测试)

### 5. 报告生成器 (ReportGenerator)

模板方法模式，生成 Markdown 报告：

```markdown
# 训练报告

## 基本信息
- 训练方案: 基础力量训练
- 训练时间: 2024-01-15 10:30

## 综合评分
- 准确率: 85%
- 时间精准度: 78分
- 综合评分: 82分
```

## 安装与运行

### 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0

### 安装依赖

```bash
cd /Users/mac/pro/solocoder/pro/xy4150/repo/xy4150
npm install
```

### 开发模式运行

```bash
npm run dev
```

这会同时启动 Vite 开发服务器和 Electron。

### 构建生产版本

```bash
npm run build
npm start
```

### 运行测试

```bash
npm test
```

### 代码检查

```bash
npm run lint
```

## 验证流程

### 1. 基础验证

1. 运行 `npm install` - 确认依赖安装成功
2. 运行 `npm run dev` - 确认应用启动
3. 运行 `npm test` - 确认单元测试通过

### 2. 功能验证

#### 验证训练方案管理

1. 启动应用后，进入"训练方案"页面
2. 点击"新建方案"按钮
3. 填写方案名称："我的训练方案"
4. 设置 BPM：60 (每分钟60拍 = 每秒1拍)
5. 设置每小节节拍数：4
6. 添加步骤：
   - 步骤1: 握拳, 4拍
   - 步骤2: 张掌, 4拍
   - 步骤3: 捏合, 4拍
7. 设置重复次数：2
8. 点击"保存"
9. 验证方案列表中显示新创建的方案

#### 验证实时训练

1. 在方案列表中点击某个方案的"开始训练"
2. 观察倒计时 (3-2-1)
3. 进入训练后，按以下按键模拟动作：
   - `F` 键 = 握拳
   - `P` 键 = 张掌
   - `N` 键 = 捏合
4. 在节拍前后按键，观察"正确/错误"提示
5. 点击"暂停"按钮，确认训练暂停
6. 点击"疼痛记录"按钮，记录疼痛等级 (1-5)
7. 完成训练后，自动跳转至历史记录

#### 验证历史记录与复盘

1. 进入"训练历史"页面
2. 查看所有训练记录的概览
3. 点击某条记录的"查看详情"
4. 验证以下内容：
   - 综合评分展示
   - 动作统计 (正确/错误/遗漏)
   - 特殊记录 (疼痛/暂停)
   - 步骤详情图表
   - 时间分布饼图
   - 动作表现柱状图
5. 点击"导出报告"按钮，确认生成 Markdown 文件

#### 验证键盘映射

在训练界面中测试：
- 按 `F` - 应该识别为"握拳"动作
- 按 `P` - 应该识别为"张掌"动作
- 按 `N` - 应该识别为"捏合"动作

### 3. 测试文件说明

| 测试文件 | 测试内容 |
|----------|----------|
| `tests/utils.test.ts` | 工具函数单元测试 |
| `tests/ScoringEngine.test.ts` | 评分引擎完整测试 |

## 使用说明

### 动作说明

| 按键 | 动作 | 描述 |
|------|------|------|
| F | 握拳 | 手指弯曲成拳 |
| P | 张掌 | 手掌完全张开 |
| N | 捏合 | 拇指与食指捏合 |

### 评分标准

- **准确率**: 正确动作占总动作数的百分比
- **时间精准度**: 根据平均时间偏差计算 (偏差越小分数越高)
- **节奏稳定性**: 根据时间偏差的标准差计算 (波动越小分数越高)
- **综合评分**: 加权平均 (准确率50% + 时间30% + 节奏20%)

### 疼痛等级

| 等级 | 含义 |
|------|------|
| 1 | 轻微不适 |
| 2 | 轻度疼痛 |
| 3 | 中度疼痛 |
| 4 | 较重疼痛 |
| 5 | 剧烈疼痛 |

## 示例训练方案

应用首次启动时会自动创建3个示例方案：

1. **基础力量训练** - 简单的握拳-张掌循环，适合初学者
2. **精细动作训练** - 包含捏合动作，锻炼精细控制
3. **全面康复训练** - 三种动作组合，完整训练方案

## 快捷键

| 按键 | 功能 | 适用场景 |
|------|------|----------|
| F | 握拳动作 | 训练界面 |
| P | 张掌动作 | 训练界面 |
| N | 捏合动作 | 训练界面 |
| 空格 | 暂停/继续 | 训练界面 |

## 扩展开发

### 添加新的输入源

实现 `InputAdapter` 接口：

```typescript
class MyInputAdapter implements InputAdapter {
  private callback: ((action: HandActionType) => void) | null = null;

  init(actionCallback: (action: HandActionType) => void): void {
    this.callback = actionCallback;
  }

  start(): void {
    // 启动输入监听
  }

  stop(): void {
    // 停止输入监听
  }

  destroy(): void {
    // 清理资源
  }
}
```

### 自定义评分规则

继承 `ScoringEngine` 或修改权重：

```typescript
// 修改评分权重
calculateOverallScore(): number {
  const accuracy = this.calculateAccuracy();
  const timing = this.calculateTimingScore();
  const rhythm = this.calculateRhythmScore();
  // 自定义权重
  return accuracy * 0.6 + timing * 0.25 + rhythm * 0.15;
}
```

## 常见问题

### Q: 为什么训练时没有声音？

A: 请检查系统音量，并确保浏览器/应用有权限播放音频。训练界面的"音频开关"按钮应处于开启状态。

### Q: 数据存储在哪里？

A: 数据存储在 Electron 应用的 localStorage 中，位置通常在：
- macOS: `~/Library/Application Support/hand-rehab-trainer/`

### Q: 如何导出/导入训练方案？

A: 在"训练方案"页面，点击方案右侧的"导出"按钮可导出为 JSON 文件。点击"导入方案"按钮可选择 JSON 文件导入。

### Q: 如何重置所有数据？

A: 在应用中删除所有方案和历史记录，或删除应用数据目录。

## 许可证

本项目仅供学习和研究使用。

---

## 开发日志

### 已完成功能

- ✅ 项目初始化 (Electron + React + TypeScript + Vite)
- ✅ 核心类型定义
- ✅ 训练状态机
- ✅ 输入适配器 (键盘 + 摄像头接口)
- ✅ 评分引擎
- ✅ 存储管理
- ✅ 报告生成器
- ✅ 训练方案列表/编辑器
- ✅ 实时训练界面
- ✅ 历史记录列表
- ✅ 复盘详情页面
- ✅ 图表可视化
- ✅ 单元测试
- ✅ README 文档
