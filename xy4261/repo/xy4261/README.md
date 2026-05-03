# Cue 安全预演台

小剧场灯光师的专业桌面工具，用于演出前的 Cue 安全预演和技术复核。

## 功能特性

- 📊 **时间轴可视化** - 直观显示所有 Cue 的时间分布、淡入淡出效果
- 🔌 **通道冲突检测** - 实时检测 DMX 通道占用冲突
- ⚡ **功率峰值监控** - 实时计算并警告总功率超载
- 🌑 **黑场安全检查** - 检测意外黑场或黑场窗口问题
- 🎚️ **淡变冲突预警** - 检测两个 Cue 淡入淡出互相打架的情况
- 🔒 **Cue 编辑与锁定** - 支持编辑 Cue 参数，锁定关键 Cue 防止误改
- 💾 **本地持久化** - 项目保存到本地 JSON 文件
- 📄 **技术复核单导出** - 一键导出 Markdown 格式的技术复核报告

## 技术架构

项目采用模块化架构，代码结构清晰：

```
src/
├── main/                    # Electron 主进程
│   ├── main.ts             # 主进程入口
│   └── preload.ts          # 预加载脚本（安全桥接）
│
├── renderer/                # React 渲染进程
│   ├── components/          # UI 组件
│   │   ├── MenuBar.tsx     # 菜单栏
│   │   ├── Timeline.tsx    # 时间轴可视化
│   │   ├── CueList.tsx     # Cue 列表
│   │   ├── CueEditor.tsx   # Cue 编辑器
│   │   ├── ValidationPanel.tsx  # 验证结果面板
│   │   └── FixturePanel.tsx    # 灯具/Patch 面板
│   │
│   ├── contexts/            # React Context
│   │   └── AppContext.tsx  # 全局状态管理
│   │
│   ├── styles/              # 样式
│   │   └── global.css       # 全局样式
│   │
│   ├── types/               # 类型声明
│   │   └── global.d.ts      # 全局类型扩展
│   │
│   ├── App.tsx              # 主应用组件
│   ├── index.tsx            # 入口文件
│   └── index.html           # HTML 模板
│
└── shared/                  # 共享模块（主进程和渲染进程共用）
    ├── models/              # 数据模型
    │   ├── types.ts         # TypeScript 类型定义
    │   └── index.ts         # 模型工具函数
    │
    └── services/            # 核心服务
        ├── csvParser.ts     # CSV 解析器
        ├── jsonParser.ts    # JSON 解析器
        ├── validator.ts     # 数据验证器
        ├── ruleEngine.ts    # 规则引擎（核心检测逻辑）
        ├── storage.ts       # 状态存储
        └── exporter.ts      # Markdown 导出器
```

## 核心模块说明

### 1. 数据模型层 (`src/shared/models/`)

定义了所有核心数据结构：

- **Fixture** - 灯具定义（名称、型号、通道数、功率、类型等）
- **PatchEntry** - Patch 表条目（灯具与 DMX 通道的映射）
- **Cue** - Cue 定义（编号、时间、淡入淡出、锁定状态、黑场标记等）
- **Project** - 项目集合（包含所有灯具、Patch、Cue 和设置）
- **ValidationError** - 验证错误结构
- **RuleEngineResult** - 规则引擎检测结果

### 2. 解析校验层 (`src/shared/services/`)

- **csvParser.ts** - 解析 Cue 时间轴 CSV 文件
- **jsonParser.ts** - 解析灯具和 Patch 的 JSON 配置
- **validator.ts** - 数据完整性验证（灯具、Patch、Cue 的格式检查）

### 3. 规则引擎 (`src/shared/services/ruleEngine.ts`)

**这是项目的核心**，实现了四大检测功能：

#### 通道冲突检测 (`checkChannelConflicts`)
- 分析所有 Cue 中灯具的通道占用情况
- 检测同一时间点同一 Universe 内是否有多个灯具占用相同通道
- 输出冲突的时间范围和涉及的灯具

#### 功率峰值检测 (`checkPowerOverload`)
- 计算每个时间点的总功率消耗（考虑淡入淡出的功率渐变）
- 与设置的最大功率阈值比较
- 输出超载的时间点和功率值

#### 黑场问题检测 (`checkBlackoutIssues`)
- 检测黑场 Cue 与其他 Cue 的时间重叠
- 检查 Cue 之间的间隙是否需要黑场过渡
- 输出潜在的黑场误触发风险

#### 淡变冲突检测 (`checkFadeConflicts`)
- 检测相邻 Cue 的淡入淡出是否重叠
- 检查重叠期间是否有相同灯具被控制
- 输出淡变打架的时间范围和涉及的灯具

### 4. 状态存储层 (`src/shared/services/storage.ts`)

- 项目数据的序列化/反序列化
- 版本兼容性检查
- 通过 IPC 与主进程通信进行文件读写

### 5. 导出功能 (`src/shared/services/exporter.ts`)

- 生成详细的 Markdown 技术复核单
- 包含：项目概览、灯具清单、Patch 表、Cue 时间轴、功率分析、通道使用分析、问题详情
- 支持自定义导出选项

## 验证流程

### 1. 安装依赖

```bash
npm install
```

### 2. 开发模式运行

```bash
npm run dev
```

这会同时启动：
- Webpack 开发服务器（端口 3000）
- Electron 主进程

### 3. 构建生产版本

```bash
npm run build
npm run start
```

### 4. 打包应用

```bash
npm run dist
```

## 使用示例数据

项目包含示例数据，位于 `examples/` 目录：

### 示例文件说明

1. **`fixtures.json`** - 灯具定义（5个不同类型的灯具）
   - 面光灯 x2（230W，8通道）
   - 摇头灯 x1（160W，16通道）
   - LED染色条 x1（80W，6通道）
   - 追光灯 x1（2500W，4通道 - 高功率用于测试功率警告）

2. **`cues.csv`** - Cue 时间轴（10个 Cue）
   - 包含淡入淡出效果
   - 包含黑场 Cue
   - 包含锁定的 Cue
   - 故意设置了 Cue 9 和 Cue 10 的淡变重叠

3. **`patches.json`** - Patch 表配置
   - 所有灯具分配到 Universe 1
   - 通道连续分配

4. **`sample-project-with-issues.json`** - 包含问题的完整项目
   - 故意设置了通道冲突（通道 15-16 被两个灯具占用）
   - 追光灯 2500W 超过 3000W 阈值的组合功率
   - 淡变冲突（Cue 9 淡出与 Cue 10 淡入重叠）

### 验证步骤

1. **启动应用**：运行 `npm run dev`
2. **查看内置演示项目**：应用启动后会自动加载一个演示项目
3. **观察验证结果**：
   - 左侧面板底部的"验证结果"面板会显示检测到的问题
   - 演示项目中，追光灯 2500W 与其他灯具组合可能触发功率警告
   - Cue 9 和 Cue 10 的淡变重叠会触发淡变冲突警告

4. **导入示例数据**（可选）：
   - 点击菜单栏的"文件"
   - 选择"打开项目..."
   - 选择 `examples/sample-project-with-issues.json`
   - 观察更多问题检测结果

5. **编辑 Cue**：
   - 在时间轴或 Cue 列表中点击任意 Cue
   - 右侧面板会显示 Cue 编辑器
   - 修改时间、淡入淡出、活跃灯具等参数
   - 观察验证结果的实时更新

6. **导出技术复核单**：
   - 点击菜单栏的"文件"
   - 选择"导出技术复核单..."
   - 选择保存位置
   - 打开生成的 Markdown 文件查看详细报告

## 规则引擎检测逻辑详解

### 通道冲突检测

```
算法流程：
1. 遍历所有 Cue，获取每个 Cue 的活跃灯具
2. 对每个活跃灯具，根据 Patch 表获取其占用的通道范围
3. 记录每个通道在每个 Cue 时间段内的占用状态
4. 检测同一 Universe 内，同一通道是否在重叠时间段内被多个灯具占用
5. 输出冲突详情

检测维度：
- Universe 编号
- 通道号
- 时间范围（开始/结束时间）
- 涉及的灯具 ID
```

### 功率计算逻辑

```
功率计算考虑淡入淡出的渐变效果：

时间段划分：
- Cue 开始时间 → 淡入结束：功率从 0% 线性增加到 100%
- 淡入结束 → 淡出开始：功率保持 100%
- 淡出开始 → Cue 结束：功率从 100% 线性减少到 0%

每个时间点的总功率 = Σ(单个灯具功率 × 当前功率因子)

功率因子计算：
- 淡入阶段：(当前时间 - 开始时间) / 淡入时长
- 稳定阶段：1.0
- 淡出阶段：1.0 - (当前时间 - 淡出开始时间) / 淡出时长
```

### 淡变冲突检测

```
检测条件：
1. Cue A 的淡出时间段 与 Cue B 的淡入时间段 存在重叠
2. Cue A 和 Cue B 控制了 相同的灯具

重叠计算公式：
overlapStart = max(CueA.fadeOutStart, CueB.fadeInStart)
overlapEnd = min(CueA.fadeOutEnd, CueB.fadeInEnd)

if overlapStart < overlapEnd:
    存在淡变重叠
    检查是否有共同活跃灯具
    有 → 输出淡变冲突警告
```

## 配置选项

在应用中可以通过修改项目设置来调整检测阈值：

| 设置项 | 默认值 | 说明 |
|--------|--------|------|
| maxChannelsPerUniverse | 512 | 每个 Universe 的最大通道数 |
| maxPower | 10000W | 系统最大功率限制 |
| powerUnit | W | 功率单位（W/kW） |
| timePrecision | 2 | 时间显示精度（小数位数） |
| blackoutSafetyMargin | 0.5s | 黑场安全裕度 |
| fadeOverlapThreshold | 0.1s | 淡变重叠检测阈值 |

## 开发说明

### 技术栈

- **框架**: Electron + React + TypeScript
- **构建工具**: Webpack
- **状态管理**: React Context + useReducer
- **样式**: CSS Modules（内联 style 标签）

### 项目启动流程

1. Webpack 编译渲染进程代码（React 组件）
2. TypeScript 编译主进程代码
3. Electron 启动主进程
4. 主进程创建 BrowserWindow
5. 加载 Webpack 开发服务器的 URL（开发模式）或本地 HTML 文件（生产模式）

### IPC 通信

主进程和渲染进程通过预加载脚本安全通信：

```
渲染进程 → window.electronAPI.openFile() → 预加载脚本 → IPC 调用 → 主进程
                                                                 ↓
渲染进程 ← 返回结果 ← 预加载脚本 ← IPC 响应 ← 主进程（dialog.showOpenDialog）
```

暴露的 API：
- `openFile(fileType)` - 打开文件选择对话框
- `saveFile(data, defaultPath)` - 保存文件
- `exportMarkdown(content, defaultPath)` - 导出 Markdown

## 故障排除

### 问题：TypeScript 编译错误

**解决方案**：
1. 确保所有依赖已正确安装：`npm install`
2. 检查 tsconfig.json 配置是否正确
3. 运行 `npx tsc --noEmit` 查看详细错误信息

### 问题：Electron 窗口不显示

**解决方案**：
1. 检查主进程代码是否有语法错误
2. 确保渲染进程代码已成功编译
3. 查看控制台输出的错误信息

### 问题：规则引擎不工作

**解决方案**：
1. 检查灯具是否有对应的 Patch 配置
2. 检查 Cue 的 activeFixtures 字段是否包含有效的灯具 ID
3. 验证时间值是否为正数

## 后续扩展建议

1. **添加撤销/重做功能** - 使用 Command 模式
2. **实时功率图表** - 使用 Chart.js 可视化功率曲线
3. **更多导入格式** - 支持 ETC、MA2 等控台的导出格式
4. **打印功能** - 支持直接打印时间轴和复核单
5. **批量操作** - 支持多选 Cue 进行批量修改
6. **灯具模板库** - 预设常见灯具的通道配置

## 许可证

MIT License
