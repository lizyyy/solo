# 图书馆赔偿替代系统

## 项目简介

全栈Web系统，用于处理图书馆借阅逾期、图书破损赔偿、遗失赔偿、替代书验收、减免审批等业务流程，实现读者欠费的全生命周期管理。

## 技术栈

- **后端**: Node.js + Express + SQLite
- **前端**: Vue 3 + Bootstrap 5
- **报表**: ExcelJS 导出Excel

## 项目结构

```
.
├── backend/                 # 后端项目
│   ├── src/
│   │   ├── app.js          # 主入口文件
│   │   ├── routes/         # API路由
│   │   ├── models/         # 数据模型
│   │   └── scripts/        # 数据库脚本
│   └── package.json
├── frontend/               # 前端项目
│   ├── index.html          # 主页面
│   └── app.js              # 前端逻辑
└── README.md
```

## 快速开始

### 1. 环境要求

- Node.js >= 14.0.0
- npm 或 yarn

### 2. 安装依赖

```bash
cd backend
npm install
```

### 3. 初始化数据库

```bash
cd backend
npm run init-db
```

数据库初始化后会自动创建：
- 3名工作人员（张管理员、李老师、王主任）
- 4种破损等级（轻微、一般、严重、遗失）
- 3名读者（张三、李四、王五）
- 4本图书
- 示例借阅记录、欠费记录、异常记录

### 4. 启动后端服务

```bash
cd backend
npm start
```

服务将运行在: http://localhost:3000

### 5. 访问前端

直接在浏览器中打开 `frontend/index.html` 文件，或使用本地Web服务器：

```bash
cd frontend
python -m http.server 8080
# 然后访问 http://localhost:8080
```

## 功能模块

### 1. 数据概览
- 统计卡片：逾期数量、未缴欠费、欠费总额、待处理异常、待处理遗失、待审批减免
- 最近异常记录列表
- 最近欠费记录列表

### 2. 借阅管理
- 查看所有借阅记录
- 按读者、状态、日期范围筛选
- 编辑借阅信息（逾期状态、破损等级、赔偿金额等）
- 修改历史自动记录，支持查看前后值对比

### 3. 异常看板
- 展示系统检测到的异常记录
- 按严重程度（高/中/低）和状态筛选
- 支持标记异常为已解决
- 异常类型：逾期+破损复合、超长逾期等

### 4. 欠费管理
- 查看所有欠费记录
- 按读者、费用类型、缴费状态筛选
- 支持缴费操作
- 支持减免申请

### 5. 赔偿管理

#### 遗失赔偿
- 查看遗失赔偿记录
- 确认赔偿支付

#### 替代书验收
- 添加替代书信息
- 支持验收操作
- 验收通过后自动更新赔偿状态

#### 减免审批
- 查看减免申请列表
- 支持审批操作
- 审批通过后自动更新欠费金额

### 6. 报表导出
- 支持导出借阅记录和欠费记录
- 可按处理人、日期范围筛选
- 可选择包含的费用类型（逾期/破损/遗失）
- 导出格式：Excel (.xlsx)

### 7. 修改日志
- 记录所有关键数据的修改历史
- 显示修改字段的原值和新值
- 记录修改人和修改时间
- 可按表名和记录ID筛选

## 关键API接口

### 统计接口
```
GET /api/statistics     # 获取首页统计数据
```

### 借阅管理
```
GET    /api/borrows              # 获取借阅列表（支持参数筛选）
GET    /api/borrows/:id          # 获取单条借阅详情
PUT    /api/borrows/:id          # 更新借阅信息（记录修改日志）
```

### 欠费管理
```
GET    /api/debts                # 获取欠费列表
POST   /api/debts/calculate      # 计算欠费
PUT    /api/debts/:id/pay        # 缴费操作
```

### 异常管理
```
GET    /api/anomalies            # 获取异常列表
PUT    /api/anomalies/:id/resolve  # 标记异常为已解决
POST   /api/anomalies/check      # 检测借阅异常
```

### 赔偿管理
```
GET    /api/compensations/lost        # 获取遗失赔偿列表
POST   /api/compensations/lost        # 创建遗失赔偿
PUT    /api/compensations/lost/:id/pay  # 确认赔偿支付

GET    /api/compensations/replacement   # 获取替代书列表
POST   /api/compensations/replacement   # 添加替代书
PUT    /api/compensations/replacement/:id/accept  # 验收替代书

GET    /api/compensations/reduction     # 获取减免申请列表
POST   /api/compensations/reduction     # 提交减免申请
PUT    /api/compensations/reduction/:id/approve  # 审批减免
```

### 报表接口
```
GET    /api/reports/export        # 导出Excel报表
GET    /api/reports/summary       # 获取报表汇总数据
```

### 基础数据接口
```
GET    /api/staff                 # 获取工作人员列表
GET    /api/readers               # 获取读者列表
GET    /api/damage-levels         # 获取破损等级列表
```

### 修改日志接口
```
GET    /api/logs                  # 获取修改日志列表
```

## 报表导出方式

### 方式1：通过前端界面
1. 进入"报表导出"页面
2. 选择报表类型（借阅记录/欠费记录）
3. 设置筛选条件（处理人、日期范围、费用类型）
4. 点击"导出Excel报表"按钮
5. 浏览器自动下载报表文件

### 方式2：直接调用API
```bash
# 导出欠费记录
curl "http://localhost:3000/api/reports/export?reportType=debts&includeOverdue=true&includeDamage=true" -o debts.xlsx

# 导出借阅记录
curl "http://localhost:3000/api/reports/export?reportType=borrows&startDate=2024-01-01" -o borrows.xlsx
```

## 数据模型

### 主要数据表
1. **staff**: 工作人员表
2. **readers**: 读者表
3. **books**: 图书表
4. **damage_levels**: 破损等级表
5. **borrow_records**: 借阅记录表
6. **anomalies**: 异常记录表
7. **lost_compensation**: 遗失赔偿表
8. **replacement_books**: 替代书表
9. **reduction_approvals**: 减免审批表
10. **reader_debts**: 读者欠费表
11. **modification_logs**: 修改日志表（记录所有修改的前后值）

## 特色功能

1. **完整的修改审计**：所有关键数据修改都会记录到modification_logs表，保留原值和新值，可追溯。

2. **智能异常检测**：系统自动检测异常情况（如同时逾期和破损、超长逾期等）。

3. **灵活的减免流程**：支持减免申请-审批流程，金额自动计算。

4. **替代书管理**：支持以书代赔的业务场景。

5. **多维度报表**：支持按处理人、时间、费用类型等多维度筛选导出。

## 开发说明

### 启动开发模式
```bash
cd backend
npm run dev
```

### 重置数据库
```bash
cd backend
rm -rf data/*.db
npm run init-db
```

## 浏览器兼容性

- Chrome >= 80
- Firefox >= 75
- Safari >= 13
- Edge >= 80
