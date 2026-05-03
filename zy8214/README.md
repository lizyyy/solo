# 🎭 剧院舞台灯光 Cue 表预演工具

一个基于 Vite + TypeScript 的本地舞台灯光 Cue 表预演工具，帮助灯光师在实际演出前预览和校验灯光程序。

## ✨ 功能特性

- 📁 **多格式导入**: 支持灯具通道 (JSON)、Cue 表 (CSV)、场景规则 (YAML)
- 📊 **时间轴预览**: 可视化展示每个 Cue 的淡入淡出和持续时间
- ⚠️ **风险检测**: 自动检测以下潜在问题：
  - 同一 DMX 通道重复占用
  - 淡入淡出重叠
  - 黑场过长
  - 缺少安全灯
- 🎯 **风险定位**: 点击风险项自动跳转到对应 Cue
- 📤 **报告导出**: 支持 Markdown 和 JSON 格式的复核报告
- 🧪 **内置样本数据**: 包含完整的演示数据用于快速上手

## 📦 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

浏览器会自动打开 `http://localhost:5173`

### 3. 体验功能

- 点击 **"加载样本数据"** 按钮体验完整功能
- 或导入自己的数据文件

## 📁 数据格式说明

### 1. 灯具通道配置 (JSON)

```json
[
  {
    "id": "fixture-1",
    "name": "主顶光 - 左",
    "universe": 1,
    "channels": [
      {
        "id": "f1-ch1",
        "name": "Dimmer",
        "dmxAddress": 1,
        "type": "dimmer",
        "fixtureId": "fixture-1"
      },
      {
        "id": "f1-ch2",
        "name": "Red",
        "dmxAddress": 2,
        "type": "red",
        "fixtureId": "fixture-1"
      }
    ]
  }
]
```

**通道类型 (type)**:
- `dimmer` - 调光
- `red`, `green`, `blue`, `white`, `amber`, `uv` - 颜色通道
- `pan`, `tilt` - 移动通道
- `gobo`, `color`, `strobe` - 效果通道
- `safety` - 安全灯
- `other` - 其他

### 2. Cue 表 (CSV)

```csv
id,number,name,startTime,fadeIn,fadeOut,duration,notes,channel_f1-ch1,channel_f1-ch2
cue-1,1,开场 - 全黑,0,0,0,2,开场黑场,0,0
cue-2,2,面光亮起,2,3,0,5,演员入场,200,255
```

**字段说明**:
- `id`: Cue 唯一标识
- `number`: Cue 编号
- `name`: Cue 名称
- `startTime`: 开始时间 (秒)
- `fadeIn`: 淡入时间 (秒)
- `fadeOut`: 淡出时间 (秒)
- `duration`: 持续时间 (秒)
- `notes`: 备注
- `channel_*`: 通道值 (0-255)，格式为 `channel_通道ID`

### 3. 场景规则 (YAML)

```yaml
# 黑场超过此时间（秒）会触发警告
blackoutThreshold: 5

# 是否启用安全灯检查
requiresSafetyLight: true

# 安全灯的通道 ID 列表
safetyLightChannels:
  - f6-ch1
  - f7-ch1

# 最大允许的淡入重叠时间（秒）
maxFadeOverlap: 2
```

## 🏗️ 项目结构

```
src/
├── components/          # UI 组件
│   ├── App.ts          # 主应用组件
│   ├── FileUpload.ts   # 文件上传组件
│   ├── Timeline.ts     # 时间轴组件
│   ├── RiskList.ts     # 风险清单组件
│   ├── CueDetails.ts   # Cue 详情组件
│   ├── ChannelMap.ts   # 通道占用图组件
│   └── ExportModal.ts  # 导出模态框
├── data/
│   └── sampleData.ts   # 样本数据
├── parsers/             # 数据解析器
│   ├── jsonParser.ts   # JSON 解析 (灯具配置)
│   ├── csvParser.ts    # CSV 解析 (Cue 表)
│   └── yamlParser.ts   # YAML 解析 (场景规则)
├── store/
│   └── index.ts        # 状态管理
├── types/
│   └── index.ts        # TypeScript 类型定义
├── validators/          # 规则校验器
│   ├── channelConflictValidator.ts   # 通道冲突检测
│   ├── fadeOverlapValidator.ts      # 淡入淡出重叠检测
│   ├── blackoutValidator.ts         # 黑场检测
│   ├── safetyLightValidator.ts      # 安全灯检测
│   └── ruleEngine.ts                # 规则引擎
├── main.ts             # 入口文件
└── style.css           # 样式文件
```

## 🎯 使用指南

### 导入数据

1. 点击欢迎页面的文件上传区域，或拖拽文件到指定位置
2. 支持同时选择多个文件（灯具 JSON、Cue 表 CSV、规则 YAML）
3. 或点击 **"加载样本数据"** 使用内置演示数据

### 时间轴操作

- **播放/暂停**: 点击播放按钮预览 Cue 序列
- **重置**: 返回到开始位置
- **缩放**: 使用 +/- 按钮调整时间轴缩放
- **点击定位**: 点击时间轴任意位置跳转到该时间点
- **选择 Cue**: 点击 Cue 块查看详细信息

### 风险检查

右侧边栏显示三类信息：

1. **风险清单**
   - 显示检测到的所有问题
   - 按严重程度排序（严重 > 警告 > 提示）
   - 点击风险项自动跳转到对应 Cue

2. **Cue 详情**
   - 显示选中 Cue 的详细信息
   - 包含时间参数和所有通道值

3. **通道占用**
   - 显示 DMX 通道映射
   - 高亮显示冲突和占用情况
   - 实时显示当前通道值

### 导出报告

1. 点击顶部 **"导出报告"** 按钮
2. 选择导出格式：
   - **Markdown**: 适合阅读和文档保存
   - **JSON**: 适合程序处理
3. 预览报告内容
4. 点击 **"下载报告"** 保存文件

## ⚠️ 风险类型说明

| 类型 | 描述 | 严重程度 |
|------|------|----------|
| 通道冲突 | 同一 DMX 地址被多个灯具通道占用 | 警告 |
| 淡入淡出重叠 | Cue 之间的淡入淡出时间重叠 | 提示/警告/严重 |
| 黑场过长 | 所有调光通道值为 0 的时间超过阈值 | 警告 |
| 缺少安全灯 | Cue 中安全灯通道未设置或值为 0 | 严重/警告 |

## 🧪 样本数据说明

内置样本数据包含以下场景用于演示：

- **8 个灯具**: 顶光、面光、摇头灯、安全灯
- **9 个 Cue**: 包含开场、转场、高潮、谢幕等场景
- **预设风险**: 
  - DMX 地址 1 冲突（用于测试通道冲突检测）
  - Cue 6 长黑场（用于测试黑场警告）
  - Cue 9 无安全灯（用于测试安全灯检查）

## 🛠️ 构建和部署

### 构建生产版本

```bash
npm run build
```

构建产物将输出到 `dist/` 目录

### 预览生产版本

```bash
npm run preview
```

## 📋 技术栈

- **Vite 6** - 前端构建工具
- **TypeScript** - 类型安全
- **js-yaml** - YAML 解析
- **papaparse** - CSV 解析

## 📝 更新日志

### v1.0.0
- 初始版本发布
- 支持 JSON/CSV/YAML 数据导入
- 时间轴预览和播放控制
- 四类风险检测
- Markdown/JSON 报告导出
- 内置样本数据

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
