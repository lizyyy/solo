# 小区团购预售订单管理系统

一个为小区团购团长设计的本地可运行预售订单管理工具，支持商品维护、订单管理、缺货替换处理和CSV导入导出。

## 功能特性

### 核心功能
- **商品维护**：添加、编辑、删除团购商品，设置价格、单位、分类和库存
- **订单管理**：录入用户订单，支持编辑、删除，按状态和取货时间筛选
- **缺货替换**：标记商品缺货，创建替换记录，支持差价计算，确认后自动更新订单金额
- **发货清单**：按取货时间分组显示订单，支持导出最终发货清单
- **用户状态**：查看每个用户的待付款、已确认、需替换状态

### 数据持久化
- 使用 SQLite 轻量数据库
- 数据保存在本地 `data/groupbuy.db` 文件
- 刷新页面数据不丢失

### CSV 功能
- 订单 CSV 导入（批量导入订单）
- 订单 CSV 导出
- 发货清单 CSV 导出
- 商品 CSV 导出

## 快速开始

### 环境要求
- Node.js >= 14.0.0
- npm 或 yarn

### 安装步骤

1. **安装依赖**
```bash
npm install
```

2. **初始化示例数据（可选）**
```bash
npm run seed
```
这会创建一些示例商品、订单和一个缺货替换示例，方便你快速测试完整流程。

3. **启动服务**
```bash
npm start
```

4. **访问应用**
打开浏览器访问：http://localhost:3000

## 核心流程验证

启动并导入示例数据后，你可以按照以下步骤验证完整流程：

### 1. 查看仪表盘
- 访问首页仪表盘
- 可以看到：
  - 在售商品数量（约9个）
  - 总订单数（约3个）
  - 待付款订单数
  - 待处理替换数量（1个）

### 2. 商品维护
- 点击导航栏「商品维护」
- 可以查看示例商品列表（新鲜草莓、赣南脐橙、土鸡蛋等）
- 尝试：
  - 点击「添加商品」创建新商品
  - 点击铅笔图标编辑现有商品
  - 点击「导出CSV」下载商品列表

### 3. 订单管理
- 点击导航栏「订单管理」
- 可以看到3个示例订单：
  - 张阿姨（周六 09:00-10:00）- 待付款
  - 李叔叔（周六 10:00-11:00）- 待付款
  - 王大姐（周六 16:00-17:00）- 需替换
- 尝试：
  - 点击「新建订单」创建新订单
  - 点击眼睛图标查看订单详情
  - 点击铅笔图标编辑订单
  - 使用筛选功能按状态或取货时间筛选

### 4. 缺货替换处理（核心流程）
- 点击导航栏「缺货替换」
- 可以看到1个待处理的替换请求（王大姐的草莓缺货）
- **接受替换流程**：
  1. 点击「接受替换」按钮
  2. 确认操作
  3. 订单金额会自动更新（草莓28元 → 替代水果A 20元，差价-8元）
  4. 订单状态从「需替换」变回「待付款」

- **如何标记新的缺货**：
  1. 进入「订单管理」
  2. 点击某个订单的「查看」按钮
  3. 在订单项中点击「处理」按钮
  4. 选择替换商品（可选），系统自动计算差价
  5. 点击「确认标记缺货」
  6. 该订单状态变为「需替换」，导航栏显示红色提醒

### 5. 发货清单
- 点击导航栏「发货清单」
- 订单按取货时间分组显示
- 可以看到：
  - 周六 09:00-10:00：张阿姨的订单
  - 周六 10:00-11:00：李叔叔的订单
  - 周六 16:00-17:00：王大姐的订单
- 尝试：
  - 使用下拉框筛选特定取货时间
  - 点击「导出发货清单」下载CSV文件

### 6. 用户状态
- 点击导航栏「用户状态」
- 可以看到每个用户的状态卡片：
  - 王大姐：需替换（红色边框）
  - 张阿姨、李叔叔：待付款（蓝色边框）
- 每个卡片显示：
  - 用户姓名和电话
  - 订单数和总金额
  - 每个订单的详细商品和状态

## API 接口

### 商品相关
- `GET /api/products` - 获取可用商品列表
- `GET /api/products/all` - 获取所有商品列表
- `GET /api/products/:id` - 获取单个商品详情
- `POST /api/products` - 创建商品
- `PUT /api/products/:id` - 更新商品
- `DELETE /api/products/:id` - 删除商品

### 订单相关
- `GET /api/orders` - 获取订单列表（支持 status, pickup_time 查询参数）
- `GET /api/orders/:id` - 获取订单详情
- `POST /api/orders` - 创建订单
- `PUT /api/orders/:id` - 更新订单
- `DELETE /api/orders/:id` - 删除订单
- `PUT /api/orders/:orderId/items/:itemId` - 更新订单项（替换状态）

### 取货时间段
- `GET /api/pickup-slots` - 获取取货时间段列表
- `POST /api/pickup-slots` - 创建取货时间段
- `PUT /api/pickup-slots/:id` - 更新取货时间段
- `DELETE /api/pickup-slots/:id` - 删除取货时间段

### 缺货替换
- `GET /api/replacements` - 获取替换记录列表
- `GET /api/replacements/pending` - 获取待处理的替换记录
- `GET /api/replacements/:id` - 获取单个替换记录
- `POST /api/replacements` - 创建替换记录
- `PUT /api/replacements/:id/accept` - 接受替换
- `PUT /api/replacements/:id/reject` - 拒绝/取消替换

### CSV 导入导出
- `GET /api/csv/orders` - 导出订单CSV
- `GET /api/csv/shipping-list` - 导出发货清单CSV（支持 pickup_time 参数）
- `GET /api/csv/products` - 导出商品CSV
- `POST /api/csv/import/orders` - 导入订单CSV（multipart/form-data）

### 其他
- `GET /api/health` - 健康检查
- `GET /api/stats` - 获取统计数据

## 订单状态流转

```
pending (待付款)
    |
    +-- 标记缺货 --> needs_replacement (需替换)
    |                   |
    |                   +-- 接受替换 --> pending (待付款，金额已更新)
    |                   |
    |                   +-- 拒绝替换 --> pending (待付款)
    |
    +-- 确认付款 --> confirmed (已确认)
```

## 项目结构

```
zy1009/
├── data/                    # 数据库文件目录（运行时自动创建）
│   └── groupbuy.db         # SQLite 数据库文件
├── public/                  # 前端静态文件
│   ├── css/
│   │   └── style.css       # 自定义样式
│   ├── js/
│   │   └── app.js          # 前端应用逻辑
│   └── index.html          # 主页面
├── server/                  # 后端代码
│   ├── db/
│   │   ├── index.js        # 数据库连接和初始化
│   │   └── seed.js         # 示例数据种子
│   ├── routes/
│   │   ├── products.js     # 商品API路由
│   │   ├── orders.js       # 订单API路由
│   │   ├── pickup-slots.js # 取货时间API路由
│   │   ├── replacements.js # 替换API路由
│   │   └── csv.js          # CSV导入导出API路由
│   └── index.js            # Express 服务器入口
├── package.json             # 项目配置
└── README.md               # 本文档
```

## 数据模型

### Products (商品表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键，UUID |
| name | TEXT | 商品名称 |
| price | REAL | 单价 |
| unit | TEXT | 单位（如：斤/盒/袋） |
| category | TEXT | 分类 |
| stock_quantity | INTEGER | 库存数量 |
| is_available | INTEGER | 是否可用（0/1） |
| description | TEXT | 描述 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### Orders (订单表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键，UUID |
| user_name | TEXT | 用户名 |
| user_phone | TEXT | 联系电话 |
| pickup_time | TEXT | 取货时间 |
| total_amount | REAL | 订单总金额 |
| status | TEXT | 状态（pending/confirmed/needs_replacement） |
| notes | TEXT | 备注 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### OrderItems (订单项表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键，UUID |
| order_id | TEXT | 订单ID（外键） |
| product_id | TEXT | 商品ID |
| product_name | TEXT | 商品名称（冗余存储） |
| price | REAL | 单价 |
| quantity | INTEGER | 数量 |
| subtotal | REAL | 小计 |
| replacement_status | TEXT | 替换状态（none/pending/confirmed） |
| replacement_product_id | TEXT | 替换商品ID |
| replacement_product_name | TEXT | 替换商品名称 |
| replacement_price | REAL | 替换商品价格 |
| price_difference | REAL | 差价 |
| notes | TEXT | 备注 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### Replacements (替换记录表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键，UUID |
| order_item_id | TEXT | 订单项ID（外键） |
| original_product_id | TEXT | 原商品ID |
| original_product_name | TEXT | 原商品名称 |
| suggested_product_id | TEXT | 推荐替换商品ID |
| suggested_product_name | TEXT | 推荐替换商品名称 |
| price_difference | REAL | 差价 |
| is_accepted | INTEGER | 是否已接受（0/1） |
| notes | TEXT | 备注 |
| created_at | DATETIME | 创建时间 |

### PickupSlots (取货时间段表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键，UUID |
| slot_time | TEXT | 时间段（唯一） |
| description | TEXT | 描述 |
| is_active | INTEGER | 是否启用（0/1） |
| created_at | DATETIME | 创建时间 |

## 自定义配置

### 修改端口
默认端口为 3000，可以通过环境变量修改：
```bash
PORT=8080 npm start
```

### 数据库路径
默认数据库保存在 `data/groupbuy.db`，可以在 `server/db/index.js` 中修改路径。

## 常见问题

### Q: 数据会丢失吗？
A: 不会。数据保存在 SQLite 数据库文件 `data/groupbuy.db` 中，重启服务、刷新页面都不会丢失。

### Q: 如何备份数据？
A: 直接复制 `data/groupbuy.db` 文件即可。需要恢复时，将备份文件放回原位置。

### Q: 如何清空所有数据重新开始？
A: 删除 `data/groupbuy.db` 文件，重启服务会自动创建空数据库。或者运行：
```bash
npm run seed
```
这会先清空所有数据，然后重新创建示例数据。

### Q: 如何添加新的取货时间段？
A: 目前需要直接操作数据库或调用 API。可以使用以下 curl 命令：
```bash
curl -X POST http://localhost:3000/api/pickup-slots \
  -H "Content-Type: application/json" \
  -d '{"slot_time":"周一 10:00-11:00","description":"周一上午"}'
```

### Q: 导入订单的CSV格式是什么？
A: CSV 需要包含以下列：
- 用户名（必填）
- 联系电话（可选）
- 取货时间（必填）
- 商品名称（必填）
- 单价（必填，数字）
- 数量（必填，整数）
- 备注（可选）

同一用户同一取货时间的多个商品会自动合并为一个订单。

## 技术栈

### 后端
- Node.js + Express
- SQLite3（数据库）
- json2csv（CSV导出）
- csv-parser（CSV导入）
- multer（文件上传）
- uuid（生成唯一ID）

### 前端
- 原生 HTML/CSS/JavaScript
- Bootstrap 5（UI框架）
- Bootstrap Icons（图标）

## 许可证

MIT License
