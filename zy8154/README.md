# 正畸附件放置预演工具 (Ortho 3D Preview)

一个用于口腔正畸医生在粘接前预演托槽/附件位置的 3D 交互工具。

## 功能特性

- 🦷 **3D 可视化**: 使用 Three.js 渲染上下颌牙弓和每颗牙齿的附件
- 📦 **附件微调**: 支持鼠标拖拽附件进行位置微调
- 🔄 **步骤切换**: 按病例步骤切换查看不同阶段的附件放置
- ⚠️ **实时检测**:
  - 邻牙碰撞检测
  - 缺牙编号检查
  - 左右镜像写反检查
  - 唇舌侧范围超出检测
- 📊 **导出报告**: 支持导出 `placement_report.md` 和 `issues.csv`

## 工程架构

项目采用模块化设计，主要包含以下模块：

| 模块 | 文件 | 功能 |
|------|------|------|
| 数据解析 | `src/modules/dataParser.js` | 解析 teeth.json、attachments.csv、placement_rules.yaml |
| 规则引擎 | `src/modules/rulesEngine.js` | 碰撞检测、范围检查、镜像匹配、缺牙检查 |
| 状态管理 | `src/modules/stateManager.js` | 应用状态管理、撤销/重做历史 |
| 导出模块 | `src/modules/exporter.js` | 导出 placement_report.md 和 issues.csv |
| 3D 场景 | `src/modules/scene3D.js` | Three.js 3D 渲染、交互控制 |

## 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

浏览器会自动打开 `http://localhost:5173`

### 构建生产版本

```bash
npm run build
```

## 数据格式说明

### 1. teeth.json (牙齿数据)

描述上下颌每颗牙齿的位置、旋转、尺寸等信息。

```json
{
  "upper": [
    {
      "id": 11,
      "position": 1,
      "quadrant": 1,
      "center": { "x": -0.2, "y": 1.5, "z": 2.45 },
      "rotation": { "x": 0, "y": 0, "z": 0 },
      "size": { "width": 0.45, "height": 0.95, "depth": 0.38 },
      "isMissing": false,
      "buccalRange": { "min": 0.05, "max": 0.35, "ideal": 0.18 },
      "lingualRange": { "min": -0.35, "max": -0.05, "ideal": -0.18 }
    }
  ],
  "lower": [...]
}
```

**字段说明**:
- `id`: FDI 牙位编号 (11-17, 21-27, 31-37, 41-47)
- `position`: 象限内位置 (1-7)
- `quadrant`: 象限 (1-4)
- `center`: 3D 空间中心坐标
- `rotation`: 旋转角度 (弧度)
- `size`: 尺寸 (宽/高/深)
- `isMissing`: 是否缺牙
- `buccalRange`: 唇侧放置范围
- `lingualRange`: 舌侧放置范围

### 2. attachments.csv (附件数据)

描述每个附件的位置、旋转、类型等信息。

```csv
id,tooth_number,step,type,position_x,position_y,position_z,rotation_x,rotation_y,rotation_z,width,height,depth,mirrored,side
att_11_1,11,1,bracket,0.0,0.18,0.0,0.0,0.0,0.0,0.3,0.25,0.08,false,buccal
```

**字段说明**:
| 字段 | 说明 |
|------|------|
| `id` | 附件唯一标识 |
| `tooth_number` | 所在牙位编号 |
| `step` | 步骤编号 |
| `type` | 附件类型 (bracket/button/hook) |
| `position_x/y/z` | 相对牙齿中心的位置 |
| `rotation_x/y/z` | 旋转角度 (弧度) |
| `width/height/depth` | 尺寸 |
| `mirrored` | 是否镜像 (true/false) |
| `side` | 放置侧 (buccal唇侧 / lingual舌侧) |

### 3. placement_rules.yaml (规则配置)

定义检测规则的阈值参数。

```yaml
collision:
  minDistance: 0.1        # 最小安全距离
  checkAdjacentOnly: true  # 只检查相邻牙

range:
  buccal:
    min: 0.05    # 唇侧最小 Y
    max: 0.35    # 唇侧最大 Y
  lingual:
    min: -0.35   # 舌侧最小 Y
    max: -0.05   # 舌侧最大 Y

mirror:
  enableCheck: true           # 启用镜像检查
  symmetryThreshold: 0.15     # 对称差异阈值

missing:
  enableCheck: true           # 启用缺牙检查

steps:
  maxStep: 20          # 最大步骤数
  allowMultiStep: true # 允许多步骤
```

## 使用说明

### 鼠标操作

| 操作 | 功能 |
|------|------|
| 鼠标左键拖拽 | 旋转 3D 视图 |
| 鼠标滚轮 | 缩放视图 |
| 鼠标右键拖拽 | 平移视图 |
| 点击附件 | 选中附件 |
| 拖拽附件 | 微调附件位置 |

### 数据导入

1. 点击左侧面板的「牙齿数据」按钮，选择 `teeth.json`
2. 点击「附件数据」按钮，选择 `attachments.csv`
3. 点击「规则配置」按钮，选择 `placement_rules.yaml`

> 提示: 程序启动时会自动加载示例数据，你可以直接操作查看效果。

### 步骤切换

- 使用 `◀` 和 `▶` 按钮切换步骤
- 或直接在输入框中输入步骤编号

### 导出报告

1. 点击顶部「导出报告」按钮，下载 `placement_report_YYYY-MM-DD.md`
2. 点击「导出问题 CSV」按钮，下载 `issues_YYYY-MM-DD.csv`

## 示例数据

`sample-data/` 目录包含示例数据，用于演示工具功能。示例数据中故意包含一些问题：

- 牙位 11 标记为缺牙，但有附件放置在此位置
- 牙位 13 的附件位置超出唇侧范围 (Y=0.5 > 0.35)

这些问题会被规则引擎自动检测出来。

## 依赖库

| 库 | 版本 | 用途 |
|---|------|------|
| three | ^0.160.0 | 3D 渲染引擎 |
| papaparse | ^5.4.1 | CSV 解析 |
| js-yaml | ^4.1.0 | YAML 解析 |
| vite | ^5.0.0 | 开发/构建工具 |

## 开发说明

### 项目结构

```
ortho-3d-preview/
├── index.html              # 主页面
├── package.json            # 依赖配置
├── vite.config.js          # Vite 配置
├── README.md              # 本文档
├── src/
│   ├── main.js            # 主程序入口
│   ├── styles.css         # 样式文件
│   └── modules/
│       ├── dataParser.js  # 数据解析模块
│       ├── rulesEngine.js # 规则引擎模块
│       ├── stateManager.js # 状态管理模块
│       ├── exporter.js    # 导出模块
│       └── scene3D.js     # 3D 场景模块
└── sample-data/
    ├── teeth.json         # 示例牙齿数据
    ├── attachments.csv    # 示例附件数据
    └── placement_rules.yaml # 示例规则配置
```

### 规则检测类型

| 类型 | 严重程度 | 说明 |
|------|---------|------|
| collision | error | 附件之间发生碰撞 |
| missing_tooth | error | 附件放置在缺牙位或无效牙位 |
| mirror_flag_mismatch | error | 镜像附件的标记不一致 |
| range_violation | warning | 附件位置超出唇/舌侧范围 |
| mirror_attachment_missing | warning | 一侧有附件，镜像侧缺失 |
| position_asymmetry | warning | 附件位置不对称 |

## License

MIT
