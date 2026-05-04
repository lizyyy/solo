# RF频点预检工具

一个专为小型演出音响师设计的本地无线麦频点预检工具。帮助检测频点冲突、互调干扰、禁用频段问题，并提供处理意见记录功能。

## 功能特性

- **频点冲突检测**：检测同频冲突、频点距离过近
- **互调干扰检测**：检测2阶和3阶互调干扰
- **禁用频段检测**：导入场地禁用频段，检测频点是否合规
- **备用频点检查**：检查主设备是否配置了备用频点
- **Web界面**：可视化展示冲突，记录处理意见
- **数据持久化**：SQLite本地存储，所有数据本地保存
- **导出功能**：
  - 导出Markdown频点表
  - 导出CSV频点表
  - 导出CSV冲突整改清单

## 快速开始

### 安装依赖

```bash
npm install
```

### 初始化数据库

```bash
node src/cli/index.js init
```

### 导入示例数据

```bash
node src/cli/index.js import examples/frequencies.csv -b examples/forbidden-bands.json -n "示例演出会话" -c
```

### 启动Web服务器

```bash
node src/cli/index.js server
```

然后在浏览器中访问 http://localhost:3000

## 命令行使用说明

### 查看所有命令

```bash
node src/cli/index.js --help
```

### 导入频点数据

```bash
# 基本导入
node src/cli/index.js import /path/to/frequencies.csv

# 带禁用频段
node src/cli/index.js import /path/to/frequencies.csv -b /path/to/forbidden.json

# 自定义会话名称并立即检测
node src/cli/index.js import /path/to/frequencies.csv -n "2024跨年演出" -c
```

### 执行检测

```bash
node src/cli/index.js check <会话ID>
```

### 查看会话列表

```bash
node src/cli/index.js list
```

### 启动Web界面

```bash
# 默认端口3000
node src/cli/index.js server

# 指定端口
node src/cli/index.js server -p 8080
```

### 删除会话

```bash
node src/cli/index.js delete <会话ID>
```

## 数据格式说明

### 频点CSV格式

| 字段 | 必填 | 说明 | 示例值 |
|------|------|------|--------|
| device_name | 是 | 设备名称 | 主唱麦克1 |
| type | 是 | 设备类型 | microphone / iem / intercom |
| frequency | 是 | 频率(MHz) | 580.125 |
| channel | 否 | 通道号 | CH01 |
| is_backup | 否 | 是否备用 | true / false |
| manufacturer | 否 | 品牌 | Shure |
| model | 否 | 型号 | SLX24/SM58 |
| notes | 否 | 备注 | 主舞台左侧 |

**设备类型说明：**
- `microphone` / `mic` / `麦克风` / `话筒` - 无线麦克风
- `iem` / `in-ear` / `监听` / `耳返` - 监听耳返
- `intercom` / `comm` / `对讲` / `radio` - 对讲机

### 禁用频段JSON格式

```json
[
  {
    "name": "电视塔发射频段",
    "freq_start": 598.0,
    "freq_end": 606.0,
    "reason": "当地电视台发射塔占用",
    "priority": 2
  }
]
```

| 字段 | 说明 |
|------|------|
| name | 频段名称 |
| freq_start / start / min | 起始频率 |
| freq_end / end / max | 结束频率 |
| reason | 禁用原因 |
| priority | 优先级(数值越高越重要) |

## 检测规则说明

### 检测类型

1. **同频冲突 (same_frequency)**
   - 检测两个设备使用完全相同的频点
   - 严重程度：严重

2. **距离过近 (proximity_critical)**
   - 频点间距 < 0.025 MHz
   - 严重程度：严重

3. **距离较近 (proximity_warning)**
   - 0.025 MHz ≤ 频点间距 < 1.0 MHz
   - 严重程度：高危

4. **禁用频段 (forbidden_band)**
   - 频点落在禁用频段范围内
   - 严重程度：严重

5. **互调干扰 (intermodulation)**
   - 检测2阶和3阶互调产物
   - 2阶: f1±f2
   - 3阶: 2f1-f2, 2f2-f1, f1+2f2, 2f1+f2
   - 严重程度：根据距离判断

6. **无备用频点 (no_backup)**
   - 主设备没有配置备用频点
   - 严重程度：中等

7. **备用距离 (backup_proximity)**
   - 备用频点与主频点距离过近
   - 严重程度：轻微

### 严重程度等级

- **严重 (critical)**：必须处理，否则演出可能出问题
- **高危 (high)**：强烈建议处理
- **中等 (medium)**：建议处理
- **轻微 (low)**：可根据现场情况决定

## 项目结构

```
.
├── data/                    # 数据库存储目录
├── examples/               # 示例数据
│   ├── frequencies.csv     # 示例频点数据
│   └── forbidden-bands.json # 示例禁用频段
├── src/
│   ├── cli/                # 命令行工具
│   │   └── index.js
│   ├── config/             # 配置文件
│   │   └── index.js
│   ├── db/                 # 数据库相关
│   │   ├── init.js         # 数据库初始化
│   │   └── models.js       # 数据模型
│   ├── public/             # 前端静态文件
│   │   └── index.html      # Web界面
│   ├── server/             # 后端服务
│   │   └── index.js        # Express服务器
│   └── services/           # 核心服务
│       ├── dataImporter.js # 数据导入
│       ├── exporter.js     # 数据导出
│       └── frequencyChecker.js # 频点检测
├── package.json
└── README.md
```

## API接口说明

### 会话管理

- `GET /api/sessions` - 获取所有会话
- `GET /api/sessions/:id` - 获取单个会话详情
- `POST /api/sessions` - 创建新会话
- `DELETE /api/sessions/:id` - 删除会话

### 检测功能

- `POST /api/sessions/:id/check` - 执行频点检测

### 频点管理

- `GET /api/sessions/:id/frequencies` - 获取频点列表
- `POST /api/sessions/:id/frequencies` - 添加频点

### 冲突管理

- `GET /api/sessions/:id/conflicts` - 获取冲突列表
- `POST /api/conflicts/:id/resolve` - 记录处理意见
- `GET /api/conflicts/:id/notes` - 获取处理记录

### 导出功能

- `GET /api/sessions/:id/export/markdown` - 导出Markdown频点表
- `GET /api/sessions/:id/export/csv` - 导出CSV频点表
- `GET /api/sessions/:id/export/conflicts` - 导出CSV冲突清单

## 配置说明

可通过环境变量或修改 `src/config/index.js` 配置：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| PORT | 3000 | Web服务端口 |
| DB_PATH | data/rf-checker.db | 数据库路径 |

## 互调检测原理

### 什么是互调干扰？

当两个或多个强信号同时进入非线性设备（如功放、混频器）时，会产生新的频率分量，这些新分量可能落在工作频段内造成干扰。

### 常用互调阶数

- **2阶互调**：f1 ± f2
  - 影响：通常落在工作频段外，影响较小

- **3阶互调**：2f1 - f2, 2f2 - f1
  - 影响：最危险，容易落在工作频段内
  - 检测重点：必须重点排查

### 互调检测示例

假设三个频点：
- f1 = 580.0 MHz
- f2 = 581.0 MHz
- f3 = 582.0 MHz

计算互调产物：
- 2f2 - f1 = 2×581 - 580 = 582 MHz → 与f3冲突！

这就是经典的"相邻三频点"互调问题。

## 最佳实践建议

1. **频点间距**
   - 建议保持至少 1 MHz 间距
   - 安全距离 >= 1.0 MHz

2. **备用频点**
   - 重要设备建议配置1-2个备用频点
   - 备用频点应与主频点保持足够距离

3. **禁用频段**
   - 提前联系场馆获取禁用频段信息
   - 包含电视塔、手机基站、WiFi频段等

4. **现场验证**
   - 预检工具只是辅助
   - 现场必须使用频谱分析仪实际扫描
   - 开启所有设备后监听确认无干扰

## 许可证

MIT License

## 技术栈

- **后端**: Node.js + Express
- **数据库**: SQLite (better-sqlite3)
- **前端**: 原生 HTML/CSS/JavaScript
- **CLI**: Commander.js
- **CSV**: csv-parser / csv-writer
