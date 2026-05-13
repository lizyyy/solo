# 门店试妆过敏禁忌管理系统

## 项目概述

解决门店试妆依赖表格管理、无法追溯的问题，提供全栈Web应用：
- 顾问排班、试用品库存、客户过敏史数据化
- 试妆项目过敏风险自动检测
- 完整的操作时间线追溯
- 支持批量导入导出

## 技术栈

**后端:**
- Node.js + Express
- SQLite (文件数据库，无需额外安装)
- ExcelJS / xlsx (导入导出)

**前端:**
- React 18 + Vite
- Ant Design 5
- Axios

## 快速启动

### 1. 安装依赖

```bash
# 后端依赖
cd backend
npm install

# 前端依赖
cd ../frontend
npm install
```

### 2. 初始化数据库&造测试数据

```bash
cd backend
npm run seed
```

造数完成后，数据库位于 `backend/data/makeup-allergy.db`

测试数据包含：
- 3位顾问 + 今日排班
- 4个产品（含酒精/香料等成分）
- 4位客户（2位有过敏史）

### 3. 启动服务

**启动后端 (端口 3001):**
```bash
cd backend
npm start
```

**启动前端 (端口 3000):**
```bash
cd frontend
npm run dev
```

### 4. 访问系统

打开浏览器访问: http://localhost:3000

## 四大演示路径

点击首页右上角「演示功能」按钮，可体验四条业务路径：

### ✅ 成功路径
**场景:** 陈小姐试妆，选择张美容（今日值班）和水润粉底液（无过敏成分）

**流程:**
1. 检查顾问今日排班 ✅
2. 检查产品库存 ✅
3. 检查过敏史（客户无过敏） ✅
4. 创建试妆项目 ✅
5. 扣减库存 ✅
6. 记录操作日志

### 🚫 拦截路径
**场景:** 周女士（酒精过敏）试妆，选择持妆口红（含酒精成分）

**流程:**
1. 检查顾问排班 ✅
2. 检查库存 ✅
3. 检查过敏史 ❌ 检测到酒精过敏
4. 拦截并记录日志
5. 回滚事务

### 👨‍💼 人工修正路径
**场景:** 拦截后，经理确认客户签署知情同意书，人工通过

**流程:**
1. 执行拦截路径
2. 调用人工审核接口
3. 状态更新为「人工通过」
4. 记录操作人

### 🔄 重复提交路径
**场景:** 网络延迟导致前端重复提交相同的试妆请求

**流程:**
1. 第一次请求：正常创建
2. 第二次请求（相同requestId）：
   - 检测到重复请求
   - 直接返回已有数据，不重复创建
   - 记录重复提交日志
3. 保证数据一致性（幂等性）

## 功能说明

### 试妆项目列表
- **筛选:** 按状态、日期范围筛选
- **导出:** 导出Excel报告
- **导入:** 批量导入试妆项目
- **状态:** 已通过/已拦截/人工通过/待处理

### 操作日志
- 完整记录所有操作
- 包含失败原因
- 支持导出
- 重启后数据持久化

## API接口文档

### 基础接口
```
GET  /api/consultants     # 获取顾问列表
GET  /api/products        # 获取产品列表  
GET  /api/customers       # 获取客户列表
GET  /api/sessions        # 获取试妆项目
GET  /api/logs            # 获取操作日志
```

### 试妆管理
```
POST /api/sessions        # 创建试妆项目
# 请求体: { requestId, customerId, consultantId, productId, date, operator }

POST /api/sessions/:id/override  # 人工修正
# 请求体: { notes, operator }
```

### 导入导出
```
GET  /api/export/sessions # 导出试妆项目Excel
GET  /api/export/logs     # 导出日志Excel
POST /api/import/sessions # 批量导入试妆项目
```

### 演示接口
```
POST /api/demo/success    # 成功路径演示
POST /api/demo/blocked    # 拦截路径演示
POST /api/demo/manual     # 人工修正演示
POST /api/demo/duplicate  # 重复提交演示
```

## 业务规则说明

### 1. 客户过敏史变更
- 过敏史存储在 `customers.allergy_history` (JSON格式)
- 变更时更新 `updated_at` 时间戳
- 后续试妆自动使用最新过敏史

### 2. 试妆项目异常处理
- 检测到过敏风险自动拦截
- 记录详细的冲突信息
- 支持人工复核通过

### 3. 成交订单复核
- 试妆通过后可创建订单
- 支持订单状态审核
- 记录审核意见

### 4. 重复操作幂等性
- 使用 `requestId` 作为幂等键
- 相同请求重复提交返回已有数据
- 记录重复提交日志

### 5. 失败原因追溯
- 所有失败操作记录详细原因
- 操作日志完整保留
- 支持按状态筛选查看

## 项目结构

```
.
├── backend/
│   ├── src/
│   │   ├── server.js          # 服务入口
│   │   ├── database.js        # 数据库配置
│   │   ├── routes.js          # API路由
│   │   ├── seed.js            # 造数脚本
│   │   └── services/
│   │       ├── makeupService.js   # 业务逻辑
│   │       └── exportService.js   # 导出服务
│   ├── data/                  # SQLite数据库目录
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── main.jsx           # 入口文件
│   │   └── App.jsx            # 主应用
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```

## 注意事项

1. **数据持久化:** SQLite数据库文件位于 `backend/data/`，重启后数据不丢失
2. **演示数据:** 运行 `npm run seed` 会插入测试数据，支持重复运行
3. **端口配置:** 后端默认3001，前端默认3000，可在配置文件修改
4. **API代理:** 前端开发环境已配置 `/api` 代理到后端

## 常见问题

**Q: 数据库文件在哪里?**
A: `backend/data/makeup-allergy.db`，SQLite文件，可使用DB Browser for SQLite查看

**Q: 如何重置演示数据?**
A: 删除数据库文件后重新运行 `npm run seed` 即可

**Q: 导入Excel的格式要求?**
A: 列名: customerId, consultantId, productId, date (YYYY-MM-DD)
