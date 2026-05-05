# 非遗漆器湿房管理REST API

一个用于管理非遗漆器工作室湿房的本地REST API系统，实现作品、漆层、工序、湿房温湿度、复核签名的统一管理，并具备违规检测和数据导出功能。

## 功能特性

### 核心功能
- **作品管理**：管理订单、作品信息、客户信息
- **漆层管理**：管理每层漆的类型、厚度、颜色、状态
- **工序管理**：灰胎、底漆、髹涂、打磨、描金五道工序的状态跟踪
- **湿房监控**：温湿度读数记录和超窗检测
- **复核管理**：师傅签名复核记录
- **交接备注**：学徒间交接记录

### 智能检测
1. **未干透检测**：检查工序间干燥时间是否达标
2. **温湿度超窗检测**：检查湿房温湿度是否在正常范围
3. **签名缺失检测**：检查完成的漆层是否有师傅签名
4. **打磨漏检检测**：检查描金前打磨工序是否完成

### 数据导出
- **Markdown交接单**：生成格式化的交接文档
- **JSON审计包**：完整的数据导出，用于审计和备份

## 快速开始

### 环境要求
- Node.js 14+
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 初始化数据库

```bash
npm run init-db
```

### 导入示例数据

```bash
npm run import-examples
```

### 一键设置（初始化+导入示例数据）

```bash
npm run setup
```

### 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动。

## API 接口

### 健康检查

```bash
# 获取系统状态和配置
curl http://localhost:3000/api/health
```

### 作品管理

```bash
# 获取所有作品
curl http://localhost:3000/api/artworks

# 获取单个作品详情（包含层次、交接、违规）
curl http://localhost:3000/api/artworks/1

# 创建作品
curl -X POST http://localhost:3000/api/artworks \
  -H "Content-Type: application/json" \
  -d '{
    "order_number": "LQ-TEST-001",
    "artwork_name": "测试作品",
    "client_name": "测试客户",
    "type": "脱胎漆器",
    "start_date": "2026-05-01"
  }'

# 更新作品
curl -X PUT http://localhost:3000/api/artworks/1 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed"
  }'
```

### 漆层管理

```bash
# 获取所有漆层
curl http://localhost:3000/api/layers

# 按作品获取漆层
curl "http://localhost:3000/api/layers?artwork_id=1"

# 获取单个漆层详情
curl http://localhost:3000/api/layers/1

# 创建漆层
curl -X POST http://localhost:3000/api/layers \
  -H "Content-Type: application/json" \
  -d '{
    "artwork_id": 1,
    "layer_number": 1,
    "lacquer_type": "生漆",
    "thickness": "薄",
    "color": "黑色"
  }'
```

### 工序管理

```bash
# 获取所有工序
curl http://localhost:3000/api/processes

# 按漆层获取工序
curl "http://localhost:3000/api/processes?layer_id=1"

# 创建工序
curl -X POST http://localhost:3000/api/processes \
  -H "Content-Type: application/json" \
  -d '{
    "layer_id": 1,
    "process_type": "灰胎",
    "start_time": "2026-05-01 08:00:00",
    "end_time": "2026-05-02 18:00:00",
    "status": "completed",
    "operator_name": "学徒小王"
  }'
```

### 湿房读数

```bash
# 获取所有读数
curl http://localhost:3000/api/wetroom

# 按柜号获取
curl "http://localhost:3000/api/wetroom?cabinet_id=A01"

# 按时间范围获取
curl "http://localhost:3000/api/wetroom?start_time=2026-05-01&end_time=2026-05-02"

# 添加读数
curl -X POST http://localhost:3000/api/wetroom \
  -H "Content-Type: application/json" \
  -d '{
    "cabinet_id": "A01",
    "reading_time": "2026-05-05 08:00:00",
    "temperature": 22.5,
    "humidity": 72,
    "recorded_by": "学徒小王"
  }'
```

### 复核管理

```bash
# 获取所有复核记录
curl http://localhost:3000/api/reviews

# 创建复核记录
curl -X POST http://localhost:3000/api/reviews \
  -H "Content-Type: application/json" \
  -d '{
    "layer_id": 1,
    "reviewer_name": "张师傅",
    "review_date": "2026-05-05",
    "signature": "张三",
    "status": "approved",
    "comments": "质量合格，可进入下一道工序"
  }'
```

### 违规检测

```bash
# 执行全面违规检测
curl -X POST http://localhost:3000/api/violations/check

# 获取所有违规记录
curl http://localhost:3000/api/violations

# 获取未解决的违规
curl "http://localhost:3000/api/violations?resolved=false"

# 获取严重违规
curl "http://localhost:3000/api/violations?severity=critical"

# 获取违规统计
curl http://localhost:3000/api/violations/stats/summary

# 标记违规为已解决
curl -X PUT http://localhost:3000/api/violations/1/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "resolved_by": "张师傅",
    "resolution_notes": "已重新干燥并检查质量"
  }'
```

### 数据导入

```bash
# 导入订单CSV
curl -X POST http://localhost:3000/api/import/orders \
  -F "file=@./examples/orders.csv"

# 导入湿房JSON
curl -X POST http://localhost:3000/api/import/wetroom \
  -F "file=@./examples/wetroom_readings.json"

# 导入漆层工序CSV
curl -X POST http://localhost:3000/api/import/layers \
  -F "file=@./examples/layer_processes.csv"

# 导入交接备注文本
curl -X POST http://localhost:3000/api/import/handover \
  -F "file=@./examples/handover_notes.txt"
```

### 数据导出

```bash
# 导出单个作品交接单（JSON格式）
curl http://localhost:3000/api/export/handover/1

# 下载单个作品交接单（Markdown文件）
curl -o handover-1.md "http://localhost:3000/api/export/handover/1?format=download"

# 导出所有作品交接单
curl http://localhost:3000/api/export/handover-all

# 下载所有作品交接单
curl -o handover-all.md "http://localhost:3000/api/export/handover-all?format=download"

# 导出完整审计包（JSON）
curl http://localhost:3000/api/export/audit

# 下载审计包文件
curl -o audit-all.json "http://localhost:3000/api/export/audit?format=download"

# 导出单个作品的审计包
curl "http://localhost:3000/api/export/audit?artwork_id=1"
```

## 完整验证流程

### 1. 初始化和导入数据

```bash
# 安装依赖
npm install

# 初始化数据库并导入示例数据
npm run setup

# 启动服务
npm start
```

### 2. 验证基础API

打开新的终端窗口，执行以下命令：

```bash
# 检查服务状态
curl http://localhost:3000/api/health

# 查看导入的作品
curl http://localhost:3000/api/artworks

# 查看导入的漆层
curl http://localhost:3000/api/layers

# 查看湿房读数
curl http://localhost:3000/api/wetroom
```

### 3. 执行违规检测

```bash
# 执行全面违规检测
curl -X POST http://localhost:3000/api/violations/check

# 查看检测到的违规
curl http://localhost:3000/api/violations

# 查看违规统计
curl http://localhost:3000/api/violations/stats/summary
```

**预期检测到的违规：**
1. **未干透进入下一层**：底漆完成后仅2小时就开始髹涂（要求24小时）
2. **描金前打磨漏检**：描金已完成但打磨仍在进行中
3. **湿房温湿度超窗**：部分柜号的温度/湿度超出正常范围

### 4. 验证导出功能

```bash
# 导出第一个作品的交接单
curl http://localhost:3000/api/export/handover/1

# 下载交接单文件
curl -o test-handover.md "http://localhost:3000/api/export/handover/1?format=download"

# 导出完整审计包
curl -o test-audit.json "http://localhost:3000/api/export/audit?format=download"

# 查看生成的文件
cat test-handover.md
```

### 5. 添加复核签名并验证

```bash
# 查看第一个作品的详情，获取layer_id
curl http://localhost:3000/api/artworks/1

# 为漆层添加复核签名（假设layer_id为1）
curl -X POST http://localhost:3000/api/reviews \
  -H "Content-Type: application/json" \
  -d '{
    "layer_id": 1,
    "reviewer_name": "张师傅",
    "review_date": "2026-05-05",
    "signature": "张三",
    "status": "approved",
    "comments": "质量合格"
  }'

# 更新漆层状态为完成
curl -X PUT http://localhost:3000/api/layers/1 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed"
  }'

# 重新执行违规检测，查看签名缺失问题是否已解决
curl -X POST http://localhost:3000/api/violations/check
```

## 配置说明

### 工序干燥时间配置

在 `src/services/violationChecker.js` 中配置：

```javascript
const DRYING_HOURS = {
  '灰胎': 48,   // 48小时
  '底漆': 24,   // 24小时
  '髹涂': 36,   // 36小时
  '打磨': 0,    // 无需干燥
  '描金': 0     // 无需干燥
};
```

### 湿房温湿度范围

```javascript
const WETROOM_LIMITS = {
  minHumidity: 60,    // 最低湿度 60%
  maxHumidity: 85,    // 最高湿度 85%
  minTemperature: 18, // 最低温度 18°C
  maxTemperature: 28  // 最高温度 28°C
};
```

## 数据模型

### 核心数据表

| 表名 | 说明 |
|------|------|
| artworks | 作品表（订单信息） |
| layers | 漆层表（每层漆的信息） |
| processes | 工序表（灰胎、底漆、髹涂、打磨、描金） |
| wetroom_readings | 湿房读数表 |
| reviews | 复核签名表 |
| handover_notes | 交接备注表 |
| violations | 违规记录表 |

## 目录结构

```
.
├── data/                   # SQLite数据库目录
├── examples/              # 示例数据文件
│   ├── orders.csv         # 订单示例
│   ├── wetroom_readings.json  # 湿房读数示例
│   ├── layer_processes.csv    # 漆层工序示例
│   └── handover_notes.txt     # 交接备注示例
├── src/
│   ├── database/          # 数据库相关
│   │   ├── database.js    # 数据库连接
│   │   └── schema.js      # 表结构定义
│   ├── routes/            # API路由
│   │   ├── artworks.js
│   │   ├── layers.js
│   │   ├── processes.js
│   │   ├── wetroom.js
│   │   ├── reviews.js
│   │   ├── violations.js
│   │   ├── import.js
│   │   └── export.js
│   ├── services/          # 业务逻辑
│   │   ├── violationChecker.js  # 违规检测
│   │   ├── importService.js     # 数据导入
│   │   └── exportService.js     # 数据导出
│   ├── scripts/           # 脚本工具
│   │   ├── init-db.js     # 数据库初始化
│   │   └── import-examples.js  # 导入示例数据
│   └── index.js           # 主入口
├── uploads/               # 临时上传目录
├── package.json
└── README.md
```

## 许可证

MIT License
