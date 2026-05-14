# 支付沙箱对账台

Sandbox Reconciliation Dashboard - 替代临时脚本的专业对账工具

## 项目结构

```
.
├── backend/
│   ├── models.py          # 数据库模型
│   ├── database.py        # 数据库连接配置
│   ├── main.py            # FastAPI 主程序
│   ├── requirements.txt   # Python 依赖
│   └── sandbox_reconciliation.db  # SQLite 数据库（运行后自动生成）
├── frontend/
│   └── index.html         # 前端页面
└── README.md
```

## 快速开始

### 1. 后端启动

```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 启动服务
python main.py
# 或
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

后端服务将在 `http://localhost:8000` 启动

### 2. 前端访问

直接在浏览器中打开 `frontend/index.html` 文件即可，或使用任意静态文件服务：

```bash
cd frontend
python -m http.server 8080
# 然后访问 http://localhost:8080
```

## 核心功能

### 状态流转

订单从创建到完成的完整状态流程：

```
pending (待处理)
    ↓ 录入支付回调
callback_received (回调已接收)
    ↓ 录入退款
refund_processing (退款处理中)
    ↓ 录入账单
    ├─ bill_matched (账单匹配)
    └─ bill_difference (账单差异)
    ↓ 补单操作
reconciled (已对账)
    ↓ 生成报告
completed (已完成)
```

### 补单留痕

所有补单操作都会完整记录：
- 操作类型（人工对账/差异修正/状态调整）
- 处理理由（用于复盘）
- 操作人
- 状态变更前后
- 操作时间

### 账单差异处理流程

1. 录入账单，系统自动计算与订单金额的差异
2. 订单状态变为 `bill_difference`（账单差异）
3. 在详情页查看补单记录时间线
4. 执行补单操作，填写处理理由（必填，便于后续复盘）
5. 状态推进到 `reconciled`（已对账）
6. 生成对账报告，订单完成

## API 接口文档

### 订单相关

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/orders/` | 创建新订单 |
| GET | `/api/orders/` | 查询订单列表（支持筛选） |
| GET | `/api/orders/{id}` | 获取订单详情 |
| GET | `/api/versions/` | 获取所有版本列表 |

### 业务操作

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/orders/{id}/callback/` | 录入支付回调 |
| POST | `/api/orders/{id}/refund/` | 添加退款记录 |
| POST | `/api/orders/{id}/bill/` | 录入账单（自动计算差异） |
| POST | `/api/orders/{id}/replenish/` | 补单操作（留痕） |
| POST | `/api/orders/{id}/report/` | 生成对账报告 |

### 报告与初始化

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/reports/` | 获取对账报告列表 |
| POST | `/api/init-data/` | 初始化测试数据 |

## 被规则挡住的操作示例

### 场景：对已完成的订单执行补单

**操作路径：**
1. 找到状态为 `completed`（已完成）的订单
2. 点击「补单」按钮
3. 填写补单表单并提交
4. 系统返回错误：`规则限制：已完成的订单不允许补单`

**设计意图：**
- 防止已完成对账的订单被意外修改
- 保证最终报告的严肃性和不可篡改性
- 如需修改，需走特殊审批流程（可扩展）

## 数据模型说明

### Order（订单）
- order_no: 订单号（唯一）
- version: 版本号
- amount: 金额
- status: 状态
- raw_input: 原始输入（JSON）
- processed_result: 处理结果（JSON）

### Callback（回调）
- 关联订单
- 回调类型
- 状态
- 原始数据

### Bill（账单）
- 关联订单
- 账单金额
- 差异金额（自动计算）
- 状态

### Replenishment（补单记录）
- 关联订单
- 操作类型
- 处理理由
- 操作人
- 状态变更前后
- 时间戳

### ReconciliationReport（对账报告）
- 关联订单
- 报告编号
- 内容（JSON）
- 状态

## 使用流程示例

### 完整对账流程

1. **初始化数据**
   - 点击页面「初始化数据」按钮
   - 系统自动创建5个不同状态的测试订单

2. **处理账单差异订单**
   - 找到状态为「账单差异」的订单（TEST2024003）
   - 点击「详情」查看完整信息，包括原始输入和处理结果
   - 在补单记录时间线中查看历史操作（如有）

3. **执行补单**
   - 点击「补单」按钮
   - 选择操作类型：「差异修正」
   - 填写处理理由：如「银行手续费导致差异，已核实」
   - 填写操作人姓名
   - 提交确认

4. **生成对账报告**
   - 再次进入详情页，状态已变为「已对账」
   - 点击「生成对账报告」
   - 确认报告内容后提交
   - 订单状态变为「已完成」

5. **验证报告**
   - 在首页「对账报告」表格中查看刚生成的报告
   - 报告与订单一一对应，可追溯

### 测试规则限制

1. 找到状态为「已完成」的订单（TEST2024005）
2. 点击「补单」按钮并提交
3. 系统提示错误：「规则限制：已完成的订单不允许补单」
4. 操作被成功拦截

## 技术栈

- **后端**: Python + FastAPI + SQLAlchemy + SQLite
- **前端**: Vue 3 + Element Plus + Axios (CDN 方式，无需构建)
- **特性**: CORS 支持，自动建表，RESTful API

## 注意事项

1. 本项目使用 SQLite，数据文件存储在 `backend/sandbox_reconciliation.db`
2. 补单理由必须填写，这是审计和复盘的重要依据
3. 已完成的订单无法补单，这是保护机制
4. 所有操作都有时间戳记录，便于追溯
