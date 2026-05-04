# 🖨️ 印务店管理系统

一个本地运行的全栈 Web 应用，专为社区小印务店设计，管理从"客户来稿到交付"的完整业务流程。

## ✨ 功能特性

### 📋 数据模型
- **客户管理** - 客户信息、联系方式、备注
- **订单管理** - 订单全生命周期管理
- **文件记录** - 来稿文件上传记录
- **规格模板** - 常用成品规格预设
- **纸张耗材** - 库存管理、安全库存预警
- **机器设备** - 打印机、裁切机、覆膜机等
- **预检问题** - 文件检查问题记录
- **改单记录** - 订单变更历史

### 🔄 订单状态流转
```
待确认 → 已报价 → 已收款 → 已锁料 → 排产中 → 待取件 → 已交付
                                                          ↓
                                                        已取消
```

### ⚙️ 核心业务逻辑
- **报价计算** - 自动计算用纸量、损耗、工序成本和报价
- **库存锁定** - 收款后锁定纸张库存，取消/改单时释放
- **预检检查** - 模拟文件预检（尺寸不符、分辨率低、无出血、颜色模式风险等）
- **排产冲突** - 检查设备时间冲突

### 📊 页面功能
- **仪表盘** - 订单看板、预检问题队列、库存预警
- **订单管理** - 订单列表、状态操作、详情查看
- **预检问题** - 问题列表、处理标记
- **排产管理** - 设备排程查看
- **纸张库存** - 库存列表、调整功能
- **客户管理** - 客户信息增删改查
- **数据导出** - Markdown / HTML / CSV 格式

### 📄 导出功能
- **今日生产单** - Markdown / HTML / CSV
- **客户取件清单** - Markdown / CSV
- **补纸清单** - Markdown / CSV

## 🛠️ 技术栈

- **后端**: Node.js + Express
- **数据库**: SQLite (better-sqlite3)
- **前端**: 原生 HTML + CSS + JavaScript
- **文件上传**: Multer

## 📦 安装与启动

### 前置要求
- Node.js >= 16.0.0
- npm 或 yarn

### 安装步骤

1. **安装依赖**
```bash
npm install
```

2. **初始化种子数据（可选）**
```bash
npm run seed
```
> 这会创建示例客户、纸张、规格模板、工序、机器设备和一些示例订单。

3. **启动应用**
```bash
npm start
```

4. **访问应用**
```
http://localhost:3000
```

## 🧪 测试与验证

### 运行测试脚本
```bash
npm test
```

测试脚本会验证完整的业务流程：
1. 创建测试客户、纸张、工序
2. 创建订单并测试报价计算
3. 测试完整状态流转
4. 测试库存锁定与释放
5. 测试预检功能
6. 测试排产与冲突检测
7. 测试数据导出功能

### 示例操作流程

#### 1. 新建订单
1. 点击右上角 **"新建订单"** 按钮
2. 填写订单信息：
   - 客户（可选，散客可不选）
   - 取件时间
   - 成品类型
   - 尺寸（宽 × 高）
   - 数量
   - 纸张
   - 工序（可多选）
3. 点击 **"创建订单"**

#### 2. 状态流转操作
在订单列表或订单详情中，可进行以下操作：

| 当前状态 | 可执行操作 |
|---------|-----------|
| 待确认 | 报价确认 |
| 已报价 | 收款 |
| 已收款 | 锁料（锁定库存） |
| 已锁料 | 排产 |
| 排产中 | 生产完成 |
| 待取件 | 客户已取件（交付） |
| 任意非终态 | 取消订单 |

#### 3. 预检检查
1. 打开订单详情
2. 点击 **"执行预检"** 按钮
3. 系统会模拟检测常见问题：
   - 文件缺失
   - 尺寸不符
   - 分辨率过低
   - 无出血位
   - 颜色模式风险

4. 可点击 **"标记处理"** 来标记问题已解决

#### 4. 数据导出
1. 切换到 **"数据导出"** 标签页
2. 选择导出类型：
   - **今日生产单** - Markdown / HTML / CSV
   - **客户取件清单** - Markdown / CSV
   - **补纸清单** - Markdown / CSV
3. 点击对应格式按钮，文件会自动下载或在新标签页打开

## 📁 项目结构

```
zy1112/
├── server.js              # Express 服务器主文件
├── db.js                  # 数据库连接与初始化
├── seed.js                # 种子数据脚本
├── test.js                # 测试脚本
├── package.json           # 项目配置
├── printshop.db           # SQLite 数据库（运行后生成）
├── services/
│   ├── orderService.js    # 订单业务逻辑
│   └── exportService.js   # 导出服务
├── public/
│   ├── index.html         # 前端主页面
│   ├── style.css          # 样式文件
│   └── app.js             # 前端 JavaScript
└── uploads/               # 文件上传目录（运行后生成）
```

## 🗄️ 数据库设计

### 核心表结构

#### customers (客户表)
| 字段 | 类型 | 说明 |
|-----|------|------|
| id | INTEGER | 主键 |
| name | TEXT | 客户姓名 |
| phone | TEXT | 电话 |
| wechat | TEXT | 微信 |
| address | TEXT | 地址 |
| notes | TEXT | 备注 |

#### orders (订单表)
| 字段 | 类型 | 说明 |
|-----|------|------|
| id | INTEGER | 主键 |
| order_no | TEXT | 订单号（唯一） |
| customer_id | INTEGER | 客户ID |
| product_type | TEXT | 产品类型 |
| width/height | REAL | 尺寸 |
| quantity | INTEGER | 数量 |
| paper_id | INTEGER | 纸张ID |
| paper_qty_est | REAL | 预估用纸量 |
| process_ids | TEXT | 工序ID列表(JSON) |
| pickup_time | DATETIME | 取件时间 |
| status | TEXT | 状态 |
| total_cost | REAL | 总成本 |
| total_price | REAL | 报价 |
| paid_amount | REAL | 已收款 |

#### paper_stock (纸张库存表)
| 字段 | 类型 | 说明 |
|-----|------|------|
| id | INTEGER | 主键 |
| name | TEXT | 纸张名称 |
| type | TEXT | 类型（铜版纸/哑粉纸等） |
| size | TEXT | 规格（A4/A3等） |
| weight | INTEGER | 克重 |
| unit_price | REAL | 单价 |
| stock_qty | REAL | 总库存 |
| min_stock | REAL | 安全库存 |

#### precheck_issues (预检问题表)
| 字段 | 类型 | 说明 |
|-----|------|------|
| id | INTEGER | 主键 |
| order_id | INTEGER | 订单ID |
| issue_type | TEXT | 问题类型 |
| severity | TEXT | 严重程度 |
| description | TEXT | 问题描述 |
| expected_value | TEXT | 期望值 |
| actual_value | TEXT | 实际值 |
| status | TEXT | 状态 |

## 🔌 API 接口列表

### 客户管理
- `GET /api/customers` - 获取客户列表
- `GET /api/customers/:id` - 获取客户详情
- `POST /api/customers` - 创建客户
- `PUT /api/customers/:id` - 更新客户

### 订单管理
- `GET /api/orders` - 获取订单列表（支持 status/customer_id/date_from/date_to 筛选）
- `GET /api/orders/:id` - 获取订单详情（含文件、问题、历史、排产）
- `POST /api/orders` - 创建订单
- `PUT /api/orders/:id/status` - 更新订单状态
- `PUT /api/orders/:id` - 修改订单
- `POST /api/orders/:id/upload` - 上传文件
- `POST /api/orders/:id/precheck` - 执行预检

### 纸张库存
- `GET /api/paper-stock` - 获取纸张列表
- `POST /api/paper-stock` - 添加纸张
- `PUT /api/paper-stock/:id/adjust` - 调整库存

### 预检问题
- `GET /api/precheck-issues` - 获取问题列表
- `PUT /api/precheck-issues/:id/resolve` - 标记问题已处理

### 排产管理
- `GET /api/schedule` - 获取排产列表
- `POST /api/schedule` - 创建排产

### 数据导出
- `GET /api/export/today-production?format=md/html/csv` - 今日生产单
- `GET /api/export/pickup-list?format=md/csv` - 取件清单
- `GET /api/export/restock-list?format=md/csv` - 补纸清单

### 仪表盘
- `GET /api/dashboard/stats` - 获取统计数据

## 📝 常见问题

### Q: 如何重置数据库？
删除 `printshop.db` 文件，然后重新运行：
```bash
npm run seed
npm start
```

### Q: 支持哪些导出格式？
- **Markdown** - 方便查看和复制
- **HTML** - 美观的网页格式
- **CSV** - 可导入 Excel

### Q: 订单号生成规则？
订单号格式为：`YYMMDDXXXX`
- `YY` - 年份后两位
- `MM` - 月份
- `DD` - 日期
- `XXXX` - 当日流水号（4位）

例如：`2605040001` 表示 2026年5月4日的第1个订单

### Q: 报价如何计算？
报价 = （纸张成本 × 1.5） + （工序成本 × 1.8）

- 纸张成本 = 纸张单价 × 预估用纸量
- 工序成本 = 工序单价 × 数量
- 最低报价 50 元

### Q: 用纸量如何估算？
用纸量 = 实际用量 × (1 + 损耗率)

- 损耗率默认 5%
- 考虑拼版情况（如名片 A4 纸拼 10 个）

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
