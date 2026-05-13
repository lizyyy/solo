# 工装尺码换码回收管理系统

全栈Web应用，实现工装管理、换码申请、离职回收、库存管理等功能。

## 功能特性

### 核心功能
- 员工管理：按部门、状态筛选，批量导入导出
- 换码申请：提交、审批、拦截流程，幂等性保证
- 离职回收：正常回收与异常回收，人工复核机制
- 库存管理：库存追踪、差异复核、采购建议
- 操作时间线：完整操作记录，重启后数据保留

### 业务规则
- 换码申请变更：库存不足时自动拦截并记录失败原因
- 离职回收异常：在职员工回收标记为异常，需人工处理
- 库存差异复核：盘点差异记录，支持调整库存
- 重复提交幂等：相同幂等键的请求返回缓存结果

### 四条演示路径
1. **成功流程**：提交换码申请 → 库存充足 → 自动审批通过
2. **拦截流程**：提交换码申请 → 库存不足 → 申请被拦截失败
3. **人工修正**：离职回收 → 员工在职 → 标记异常 → 需人工复核
4. **重复提交**：重复提交 → 检测幂等键 → 返回缓存结果

## 快速开始

### 1. 安装依赖
```bash
npm run init
```

### 2. 初始化造数
```bash
npm run seed
```

### 3. 启动应用
```bash
npm run dev
```

服务启动后：
- 后端API服务：http://localhost:3001
- 前端应用：http://localhost:3000

## API接口文档

### 员工管理
```bash
# 获取员工列表
GET /api/employees?department=技术部&status=active

# 创建员工
POST /api/employees
```

### 换码申请
```bash
# 获取换码申请
GET /api/exchanges?status=pending

# 创建换码申请（幂等）
POST /api/exchanges
Headers: x-idempotency-key: <唯一标识>

# 审批通过
PUT /api/exchanges/:requestId/approve

# 拒绝申请
PUT /api/exchanges/:requestId/reject
```

### 离职回收
```bash
# 获取回收记录
GET /api/recoveries?is_exception=true

# 创建回收记录
POST /api/recoveries

# 确认回收
PUT /api/recoveries/:recoveryId/confirm

# 人工复核
PUT /api/recoveries/:recoveryId/review
```

### 库存管理
```bash
# 获取库存
GET /api/inventory

# 入库
POST /api/inventory/stock

# 采购建议
POST /api/inventory/generate-suggestions
```

### 导入导出
```bash
# 批量导入员工
POST /api/import/employees
Content-Type: multipart/form-data

# 导出数据
GET /api/export/employees
GET /api/export/exchanges
GET /api/export/recoveries
GET /api/export/inventory
GET /api/export/timeline
```

### 演示接口
```bash
# 成功路径演示
POST /api/demo/success

# 拦截路径演示
POST /api/demo/blocked

# 人工修正路径演示
POST /api/demo/manual

# 重复提交路径演示
POST /api/demo/duplicate
```

## 使用说明

### 查看演示
1. 启动应用后访问 http://localhost:3000
2. 点击"演示路径"标签页
3. 依次点击四个演示按钮
4. 切换到"操作时间线"标签页查看完整记录

### 验证幂等性
1. 在演示路径页面，连续点击"重复提交"按钮两次
2. 第二次点击会返回缓存的结果（从响应信息中可看到）

### 导入数据
可以使用项目根目录下的示例CSV文件：
- `sample-employees.csv` - 员工导入示例
- `sample-inventory.csv` - 库存导入示例

## 数据持久化

所有数据存储在 `data/uniform.db` SQLite数据库中，重启服务后数据不会丢失。

时间线记录表 `timeline` 记录所有操作，支持审计追踪。

## 项目结构

```
.
├── backend/
│   ├── server.js          # 服务入口
│   ├── database.js        # 数据库连接
│   ├── models/            # 数据模型
│   ├── routes/            # API路由
│   ├── middleware/        # 中间件
│   ├── utils/             # 工具函数
│   └── scripts/           # 脚本
├── frontend/
│   ├── public/            # 静态资源
│   └── src/               # React源代码
├── data/                  # 数据库文件
├── package.json           # 项目配置
└── README.md              # 本文档
```
