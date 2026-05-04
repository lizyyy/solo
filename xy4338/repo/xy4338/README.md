# 🎵 演出资料包巡检器

社区合唱团演出资料包自动化巡检工具，确保每场演出前下发的资料包完整、版本一致、时间准确。

## ✨ 功能特性

### 🔍 核心巡检功能

1. **声部完整性校验**
   - 自动检测分声部乐谱（女高、女低、男高、男低）
   - 识别缺失声部和重复声部
   - 支持中英文关键词识别（女高/Soprano、男低/Bass等）

2. **文件版本匹配校验**
   - 从文件名自动提取版本号（如 `v1.2`、`版本2.1`）
   - 检测版本不匹配的文件
   - 识别未包含版本号的文件

3. **走台提示时间越界校验**
   - 解析CSV文件中的时间格式（HH:MM:SS、MM:SS、秒数）
   - 检查时间是否超过预设阈值（默认1小时）
   - 识别无法解析的时间格式

### 💾 数据存储

- **本地SQLite数据库**：所有巡检记录自动持久化
- **风险追踪**：记录每次巡检发现的问题
- **备注管理**：支持添加处理备注

### 🌐 HTTP接口服务

- **RESTful API**：提供完整的HTTP接口
- **风险查看**：查看所有巡检记录和风险详情
- **备注管理**：添加、查看处理备注
- **导出功能**：导出Markdown交接单和JSON审计包

### 📤 导出功能

1. **Markdown交接单**
   - 格式化的巡检报告
   - 风险分级展示
   - 自动生成巡检结论和建议

2. **JSON审计包**
   - 完整的结构化数据
   - 包含所有文件信息、风险、备注
   - 便于程序处理和存档

## 📋 项目结构

```
xy4338/
├── src/
│   ├── cli/
│   │   └── index.js          # 命令行入口
│   ├── config/
│   │   └── index.js          # 配置文件
│   ├── core/
│   │   └── inspector.js      # 核心巡检逻辑
│   ├── db/
│   │   └── index.js          # 数据库管理
│   ├── exporters/
│   │   ├── index.js          # 导出器索引
│   │   ├── markdown.js       # Markdown导出
│   │   └── json.js           # JSON导出
│   ├── server/
│   │   ├── app.js            # Express应用
│   │   └── index.js          # 服务入口
│   └── validators/
│       ├── index.js          # 校验器索引
│       ├── voicePart.js      # 声部校验
│       ├── version.js        # 版本校验
│       └── walkthrough.js    # 走台时间校验
├── examples/                  # 示例数据
│   ├── 2026-05-01_春季演唱会有问题/
│   │   ├── 走台提示.csv
│   │   ├── 人员名单.csv
│   │   ├── 乐谱/
│   │   │   ├── 女高_v1.1.pdf
│   │   │   ├── 女低_v1.0.pdf  # 版本不匹配
│   │   │   └── 男高_v1.1.pdf  # 缺少男低
│   │   └── 音频/
│   │       └── 春季演唱会伴奏_v1.1.mp3
│   └── 2026-05-01_春季演唱会正确版/
│       ├── 走台提示.csv
│       ├── 人员名单.csv
│       ├── 乐谱/
│       │   ├── 女高_v1.2.pdf
│       │   ├── 女低_v1.2.pdf
│       │   ├── 男高_v1.2.pdf
│       │   └── 男低_v1.2.pdf
│       └── 音频/
│           └── 春季演唱会伴奏_v1.2.mp3
├── data/                      # 数据库目录
├── exports/                   # 导出文件目录
├── package.json
└── README.md
```

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 命令行使用

#### 扫描并巡检资料包

```bash
# 基本使用
node src/cli/index.js scan examples/2026-05-01_春季演唱会有问题

# 导出Markdown和JSON
node src/cli/index.js scan examples/2026-05-01_春季演唱会有问题 \
  --export-markdown exports/report.md \
  --export-json exports/report.json

# JSON格式输出
node src/cli/index.js scan examples/2026-05-01_春季演唱会正确版 --json
```

#### 查看巡检记录

```bash
# 列出所有记录
node src/cli/index.js list

# 查看指定记录详情
node src/cli/index.js show 1

# 添加备注
node src/cli/index.js note 1 "已修复版本不匹配问题" --author "张团长"

# 标记风险已解决
node src/cli/index.js resolve 1

# 导出记录
node src/cli/index.js export 1 --markdown exports/report.md --json exports/report.json
```

### 3. 启动HTTP服务

```bash
# 默认端口 3000
node src/server/index.js

# 指定端口
node src/server/index.js --port 8080

# 指定主机地址
node src/server/index.js -p 3001 -h 0.0.0.0
```

服务启动后访问 http://localhost:3000 查看API文档。

## 🔧 API接口

### 健康检查

```
GET /api/health
```

### 仪表盘统计

```
GET /api/dashboard
```

### 巡检记录

```
# 获取列表
GET /api/inspections?limit=50&offset=0

# 获取详情
GET /api/inspections/:id

# 创建新巡检
POST /api/inspections
Content-Type: application/json
{
  "path": "/path/to/package"
}
```

### 风险管理

```
# 获取巡检的风险列表
GET /api/inspections/:id/risks

# 标记风险已解决
PUT /api/risks/:id/resolve
```

### 备注管理

```
# 获取备注列表
GET /api/inspections/:id/notes

# 添加备注
POST /api/inspections/:id/notes
Content-Type: application/json
{
  "content": "备注内容",
  "createdBy": "张团长"
}
```

### 导出功能

```
# 导出Markdown
GET /api/inspections/:id/export/markdown

# 导出JSON（下载）
GET /api/inspections/:id/export/json?download=true
```

## 📁 文件命名规范

为了确保巡检器能正确识别，建议按以下规范命名文件：

### 分声部乐谱

格式：`{声部名}_v{版本号}.pdf`

示例：
- `女高_v1.2.pdf`
- `男低_v2.0.pdf`
- `Soprano_v1.1.pdf` （英文也支持）

支持的声部关键词：
- **女高**: 女高、Soprano、高音部
- **女低**: 女低、Alto、低音部、女中音
- **男高**: 男高、Tenor、男高音
- **男低**: 男低、Bass、男低音

### 版本号格式

支持以下版本号格式：
- `v1.0`、`V1.0`、`v1.0.0`
- `版本1.2`、`版本2.0.1`
- 直接数字：`1.0`、`2.1.3`

### 走台提示CSV

建议包含以下列（关键词识别，不区分大小写）：
- 时间列：时间、time、时长、duration、开始时间、结束时间

支持的时间格式：
- `HH:MM:SS` 如 `01:30:45`
- `MM:SS` 如 `45:30`
- 秒数 如 `2730`

## 💾 数据库结构

### inspections (巡检记录表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| package_name | TEXT | 资料包名称 |
| package_path | TEXT | 资料包路径 |
| inspected_at | DATETIME | 巡检时间 |
| status | TEXT | 状态 (passed/warning/failed/pending) |
| total_risks | INTEGER | 总风险数 |
| critical_risks | INTEGER | 严重风险数 |
| warning_risks | INTEGER | 警告风险数 |
| notes | TEXT | 备注 |

### risks (风险表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| inspection_id | INTEGER | 关联巡检ID |
| type | TEXT | 风险类型 |
| severity | TEXT | 严重程度 (critical/warning/info) |
| category | TEXT | 分类 |
| message | TEXT | 描述信息 |
| file_path | TEXT | 关联文件路径 |
| details | TEXT | 详细信息 (JSON) |
| is_resolved | INTEGER | 是否已解决 |
| resolved_at | DATETIME | 解决时间 |

### notes (备注表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| inspection_id | INTEGER | 关联巡检ID |
| risk_id | INTEGER | 关联风险ID (可选) |
| content | TEXT | 备注内容 |
| created_by | TEXT | 创建者 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

## ⚙️ 配置选项

可以通过环境变量或修改 `src/config/index.js` 进行配置：

| 配置项 | 环境变量 | 默认值 | 说明 |
|--------|----------|--------|------|
| 数据库路径 | INSPECT_DB_PATH | data/inspector.db | SQLite数据库文件路径 |
| 服务端口 | INSPECT_PORT | 3000 | HTTP服务端口 |
| 服务主机 | INSPECT_HOST | localhost | HTTP服务监听地址 |

## 📝 使用示例

### 示例1：巡检有问题的资料包

```bash
$ node src/cli/index.js scan examples/2026-05-01_春季演唱会有问题

🎵 开始巡检资料包: /path/to/examples/2026-05-01_春季演唱会有问题

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 巡检结果汇总:

   资料包: 2026-05-01_春季演唱会有问题
   文件数: 6

   状态: ❌ 未通过

   风险统计:
     🔴 严重: 3
     🟡 警告: 1
     📊 总计: 4

📄 检测到的分声部乐谱:
   • 女高: 女高_v1.1.pdf
   • 女低: 女低_v1.0.pdf
   • 男高: 男高_v1.1.pdf

📌 检测到的版本基准: v1.1

⚠️ 版本不匹配的文件:
   • 女低_v1.0.pdf: 当前 v1.0 (期望 v1.1)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ 风险明细:

🔴 严重风险:
   1. [完整性] 缺少分声部乐谱: 男低
   2. [版本] 检测到版本不匹配。参考版本: 1.1
   3. [越界] 发现 1 个时间值超过最大值 1:00:00

🟡 警告风险:
   1. [版本] 未找到走台提示CSV文件

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ 巡检完成，存在严重风险，必须修复！

📊 巡检记录ID: 1
📍 建议: 启动服务查看详细报告: inspect-server
```

### 示例2：巡检正确的资料包

```bash
$ node src/cli/index.js scan examples/2026-05-01_春季演唱会正确版

🎵 开始巡检资料包: /path/to/examples/2026-05-01_春季演唱会正确版

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 巡检结果汇总:

   资料包: 2026-05-01_春季演唱会正确版
   文件数: 7

   状态: ✅ 通过

   风险统计:
     🔴 严重: 0
     🟡 警告: 0
     📊 总计: 0

📄 检测到的分声部乐谱:
   • 女高: 女高_v1.2.pdf
   • 女低: 女低_v1.2.pdf
   • 男高: 男高_v1.2.pdf
   • 男低: 男低_v1.2.pdf

📌 检测到的版本基准: v1.2

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 巡检完成，资料包检查通过！

📊 巡检记录ID: 2
📍 建议: 启动服务查看详细报告: inspect-server
```

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request 来改进这个工具。

## 📄 许可证

MIT License

---

**注意**：示例数据中的PDF和音频文件都是占位文件，实际使用时请替换为真实文件。
