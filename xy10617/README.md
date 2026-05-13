# 二手书寄售结算系统

## 项目简介

这是一个完整的二手书寄售业务管理系统，涵盖从书籍入库、品相估价、降价审批、销售记录、退货验收，到最终结算打款的全流程闭环管理。

## 核心功能

### 1. 寄售人管理
- 寄售人信息的增删改查
- 批量导入寄售人信息
- 银行账户信息管理

### 2. 书籍管理
- 书籍信息录入（关联寄售人）
- 品相估价（记录品相描述、估价）
- 降价申请与审批流程
- 上架待售
- 书籍详情页（完整的状态时间线）

### 3. 销售管理
- 销售记录录入
- 自动计算佣金和寄售人分成（默认30%佣金）
- 销售平台记录（线下门店、微信小程序、闲鱼等）
- 销售异常处理

### 4. 退货管理
- 退货申请录入
- 退货验收流程
- 人工处理标记
- 验收结果记录

### 5. 结算管理
- 按寄售人、按时间周期生成结算单
- 结算明细查看
- 标记已打款
- 导出CSV结算报表
- 按责任人、处理时间筛选

### 6. 状态时间线
- 记录每个状态变更的原因
- 保存修改前后的值对比
- 记录操作人、操作时间
- 完整的审计追踪

### 7. 幂等性保障
- 关键操作支持幂等性
- 通过X-Idempotency-Key头防止重复提交

## 技术栈

### 后端
- Node.js + Express
- SQLite3 数据库
- CSV 解析与导出
- UUID 主键生成

### 前端
- React 18
- Vite 构建工具
- Ant Design 组件库
- React Router 路由
- Axios HTTP 客户端
- Day.js 日期处理

## 项目结构

```
used-book-consignment/
├── backend/
│   ├── src/
│   │   ├── app.js              # 主应用入口
│   │   ├── routes/
│   │   │   └── index.js        # API 路由
│   │   ├── controllers/        # 控制器
│   │   ├── models/             # 数据模型
│   │   ├── middleware/         # 中间件
│   │   └── utils/              # 工具函数
│   ├── data/                   # SQLite 数据库文件
│   └── package.json
└── frontend/
    ├── src/
    │   ├── main.jsx            # React 入口
    │   ├── App.jsx             # 主应用组件
    │   ├── pages/              # 页面组件
    │   └── services/           # API 服务
    ├── index.html
    ├── vite.config.js
    └── package.json
```

## 快速开始

### 1. 初始化数据库

```bash
cd backend
npm install
npm run init-db
```

### 2. 导入样例数据

```bash
node src/utils/seedData.js
```

### 3. 启动后端服务

```bash
npm start
# 或开发模式
npm run dev
```

后端服务将在 http://localhost:3001 启动

### 4. 启动前端服务

```bash
cd ../frontend
npm install
npm run dev
```

前端服务将在 http://localhost:3000 启动

## API 接口列表

### 寄售人接口
- `GET /api/consignors` - 获取寄售人列表
- `GET /api/consignors/:id` - 获取寄售人详情
- `POST /api/consignors` - 创建寄售人（支持幂等）
- `PUT /api/consignors/:id` - 更新寄售人
- `POST /api/consignors/batch` - 批量导入寄售人

### 书籍接口
- `GET /api/books` - 获取书籍列表
- `GET /api/books/:id` - 获取书籍详情（含时间线、估价、销售记录）
- `POST /api/books` - 创建书籍（支持幂等）
- `POST /api/books/evaluate` - 品相估价
- `POST /api/books/price-reduction` - 申请降价
- `POST /api/books/price-reduction/approve` - 审批降价
- `POST /api/books/for-sale` - 标记上架待售

### 销售接口
- `GET /api/sales` - 获取销售记录列表
- `POST /api/sales` - 创建销售记录（支持幂等）
- `POST /api/sales/exception` - 处理销售异常
- `POST /api/returns` - 创建退货记录（支持幂等）
- `POST /api/returns/inspect` - 退货验收

### 结算接口
- `GET /api/settlements` - 获取结算单列表
- `GET /api/settlements/:id` - 获取结算单详情
- `POST /api/settlements` - 生成结算单
- `POST /api/settlements/:id/paid` - 标记已打款
- `GET /api/settlements/:id/export` - 导出结算单CSV

## 书籍状态流转

```
待估价(pending_evaluation) 
    ↓ 估价完成
已估价(evaluated) 
    ↓ 上架 / 申请降价→审批
待售(for_sale) 
    ↓ 售出
已售出(sold)
    ↓ 退货申请
退回(returned)
    ↓ 验收通过/不通过
验收通过(inspection_passed) / 验收不通过(inspection_failed)
```

## 分账规则

- 默认平台佣金：30%
- 寄售人分成：70%
- 佣金 = 售价 × 佣金率
- 寄售人分成 = 售价 - 佣金

## 使用说明

### 完整业务流程示例

1. **创建寄售人**：在寄售人管理页面添加寄售人信息
2. **录入书籍**：在书籍管理页面添加书籍，关联寄售人
3. **品相估价**：进入书籍详情页，点击"品相估价"，填写品相信息和估价
4. **上架待售**：估价完成后，点击"上架出售"将书籍标记为待售
5. **申请降价（可选）**：如书籍滞销，可申请降价并审批
6. **确认售出**：书籍卖出后，点击"确认售出"记录销售信息
7. **处理退货（可选）**：如有退货，录入退货信息并验收
8. **生成结算单**：在结算管理页面，选择寄售人和时间周期生成结算单
9. **导出报表**：查看结算明细，导出CSV文件进行打款
10. **标记打款**：实际打款后，在系统中标记结算单为"已打款"

### 导出的CSV报表格式

| 书籍名称 | 作者 | 售价 | 平台佣金 | 寄售人分成 |
|---------|------|------|---------|-----------|
| 活着 | 余华 | 23.40 | 7.02 | 16.38 |
| ... | ... | ... | ... | ... |
| 合计 | - | 89.20 | 26.76 | 62.44 |

## 数据安全与审计

- 所有状态变更都记录在时间线中
- 修改前后的值都被保存，可追溯
- 操作人、操作时间完整记录
- 支持幂等性，防止重复操作
