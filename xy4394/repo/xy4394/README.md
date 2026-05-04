# 图书漂流柜 - 归还消毒预审工具

一款本地运行的社区图书漂流柜管理工具，用于管理员在图书上架前进行预审，自动检测异常情况。

## 功能特性

### 📊 数据导入
- **借还记录 (CSV)**：扫码枪导出的借阅/归还记录
- **书本标签 (JSON)**：图书RFID标签状态数据
- **消毒记录 (JSON)**：消毒柜批次消毒记录
- **预约取书单 (JSON)**：用户预约取书记录

### 🔍 自动异常检测
- **逾期检测**：检测借出超过14天未归还的图书
- **重复占用检测**：检测同一本书被多人同时借出、标签状态与记录不一致
- **消毒未完成检测**：检测归还后72小时内未完成消毒的图书
- **同柜取书冲突**：检测同一天同一书柜30分钟内有多个取书预约

### ✅ 复核与决策
- 查看异常详情
- 三种处理决策：
  - **确认异常**：标记为真实异常
  - **驳回**：标记为误报
  - **仅备注**：添加备注后标记为已关注
- 支持添加备注说明
- 数据持久化，刷新不丢失

### 📤 数据导出
- **当天上架清单 (Markdown)**：导出今日归还并已完成消毒的图书清单
- **异常记录 (JSON)**：导出所有异常记录及处理决策

## 安装与运行

### 环境要求
- Node.js 14.0+
- npm 或 yarn

### 安装依赖
```bash
npm install
```

### 启动服务
```bash
npm start
```

启动后访问：http://localhost:3000

## 使用说明

### 1. 导入数据
1. 打开「数据导入」标签页
2. 分别上传以下文件：
   - 借还记录 (CSV格式)
   - 书本标签 (JSON格式)
   - 消毒记录 (JSON格式)
   - 预约取书单 (JSON格式)

### 2. 执行规则检测
点击「执行规则检测」按钮，系统将自动运行所有检测规则。

### 3. 复核异常
1. 切换到「异常列表」标签页
2. 可按「异常类型」和「处理状态」筛选
3. 对每个异常可以：
   - 查看详细信息
   - 输入备注（可选）
   - 选择处理决策：确认异常、驳回、仅备注

### 4. 导出数据
1. 切换到「数据导出」标签页
2. 选择需要导出的类型：
   - 当天上架清单 (Markdown)
   - 异常记录 (JSON)

## 数据格式说明

### 借还记录 (CSV)
| 字段 | 说明 | 示例 |
|------|------|------|
| bookId | 图书ID | B001 |
| bookName | 图书名称 | 活着 |
| borrowerId | 借阅人ID | L001 |
| borrowerName | 借阅人姓名 | 张三 |
| action | 操作类型 | borrow / return |
| time | 操作时间 | 2026-04-01T10:00:00 |
| cabinetId | 书柜ID | C01 |

### 书本标签 (JSON)
```json
[
  {
    "bookId": "B001",
    "bookName": "活着",
    "tagId": "TAG001",
    "status": "in_cabinet",
    "cabinetId": "C01",
    "location": "A01",
    "lastScanTime": "2026-05-04T09:15:00"
  }
]
```

| 字段 | 说明 |
|------|------|
| status | 状态：in_cabinet(在柜) / borrowed(已借出) |

### 消毒记录 (JSON)
```json
[
  {
    "batchId": "BATCH20260504001",
    "bookId": "B002",
    "bookName": "百年孤独",
    "startTime": "2026-05-04T09:30:00",
    "endTime": "2026-05-04T10:00:00",
    "status": "completed",
    "cabinetId": "C01",
    "operator": "管理员A"
  }
]
```

| 字段 | 说明 |
|------|------|
| status | 状态：pending(待消毒) / in_progress(消毒中) / completed(已完成) |

### 预约取书单 (JSON)
```json
[
  {
    "reservationId": "RES20260504001",
    "bookId": "B001",
    "bookName": "活着",
    "borrowerId": "L010",
    "borrowerName": "王十二",
    "pickupTime": "2026-05-04T15:00:00",
    "cabinetId": "C01",
    "status": "pending",
    "createTime": "2026-05-03T10:00:00"
  }
]
```

## 规则说明

### 逾期检测
- 检测条件：借阅记录标记为 `borrow` 且无归还记录
- 逾期阈值：14天
- 计算方式：当前日期 - 借阅日期 > 14天

### 重复占用检测
检测两种情况：
1. **双重借阅**：同一本书在未归还的情况下被再次借出
2. **状态不一致**：标签显示「在柜」但借还记录显示「已借出」

### 消毒未完成检测
- 检测范围：归还时间在72小时内的图书
- 检测条件：没有对应的消毒完成记录
- 消毒状态：completed 才算完成

### 同柜取书冲突检测
- 检测范围：当天的预约取书记录
- 冲突阈值：30分钟内
- 检测逻辑：同一书柜的两个预约时间间隔小于30分钟

## 目录结构

```
xy4394/
├── server.js              # 后端服务
├── package.json           # 项目配置
├── README.md              # 本文档
├── data/                  # 数据存储目录
│   └── app-data.json      # 应用数据（自动生成）
├── public/                # 前端静态文件
│   └── index.html         # 主页面
├── examples/              # 示例数据
│   ├── borrow-records.csv
│   ├── book-tags.json
│   ├── sterilization-records.json
│   └── reservations.json
└── uploads/               # 上传临时目录（自动生成）
```

## API 接口

### 文件上传
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/upload/borrow | 上传借还记录CSV |
| POST | /api/upload/book-tags | 上传书本标签JSON |
| POST | /api/upload/sterilization | 上传消毒记录JSON |
| POST | /api/upload/reservations | 上传预约取书单JSON |

### 数据处理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/process | 执行规则检测 |
| GET | /api/stats | 获取统计数据 |
| DELETE | /api/data/clear | 清空所有数据 |

### 异常管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/anomalies | 获取异常列表（支持 type 和 status 参数） |
| GET | /api/anomalies/:id | 获取单个异常详情 |
| PUT | /api/anomalies/:id/decision | 提交处理决策 |

### 数据导出
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/export/shelf-list | 导出当天上架清单(Markdown) |
| GET | /api/export/anomalies | 导出异常记录(JSON) |

## 示例数据

`examples/` 目录下提供了完整的示例数据，包含各种异常场景：

- **borrow-records.csv**：包含逾期、重复借用、今天归还等场景
- **book-tags.json**：包含在柜、已借出状态的标签
- **sterilization-records.json**：包含已完成、进行中、待处理的消毒记录
- **reservations.json**：包含今天的冲突预约（同一书柜15分钟内两个预约）

可以直接使用这些数据进行测试。

## 注意事项

1. **数据持久化**：所有数据保存在 `data/app-data.json` 文件中，服务重启后不会丢失
2. **刷新不丢失**：前端页面刷新后，数据会从后端重新加载
3. **本地运行**：所有数据存储在本地，不会上传到任何云服务
4. **日期格式**：所有时间字段建议使用 ISO 8601 格式（如 `2026-05-04T10:00:00`）

## 技术栈

- **后端**：Node.js + Express
- **前端**：原生 HTML/CSS/JavaScript
- **数据解析**：csv-parser
- **文件上传**：multer
- **数据存储**：本地 JSON 文件

## 许可证

MIT License
