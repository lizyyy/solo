# 项目验证指南

## 问题修复说明

已修复以下问题：

### 1. 路由顺序问题
**问题**: 动态路由 `/:reservationId` 早于 `/export/csv` 和 `/order/:orderId`，导致静态路由被截获

**修复**: 在 `backend/src/routes/reservation.ts` 中调整路由顺序，静态路由（`/export/csv`, `/order/:orderId`）现在优先于动态路由 `/:reservationId`

### 2. 后台定时扫描任务
**问题**: 没有后台自动扫描释放过期预占的功能

**修复**: 在 `backend/src/server.ts` 中添加了：
- 后台自动扫描任务，默认每 60 秒执行一次
- 通过 `TIMEOUT_SCAN_INTERVAL` 环境变量可配置扫描间隔
- 支持优雅关闭（SIGTERM/SIGINT）
- 健康检查接口返回扫描状态
- 日志记录已处理的过期预占单数量

### 3. 依赖和脚本可运行性
**问题**: `tsc` 或 `ts-node: command not found` 错误

**修复**: 
- 所有脚本使用 `npx` 前缀确保本地依赖可运行
- 添加 `dotenv` 支持环境变量配置
- 创建 `.env.example` 作为配置模板
- 所有脚本均更新为使用 `npx` 调用

## 验证步骤

### 第一步：安装依赖

```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 第二步：初始化数据库

```bash
cd backend
npm run init:db
```

### 第三步：运行测试验证

```bash
cd backend
npm test
```

预期测试覆盖：
- ✅ 创建库存池
- ✅ 获取库存池信息
- ✅ 创建预占单（库存扣减验证）
- ✅ 重复预占幂等性（同一订单不重复扣减）
- ✅ 库存不足时的错误处理
- ✅ 确认预占（库存扣减验证）
- ✅ 释放预占（订单取消场景）
- ✅ 库存流水记录完整性
- ✅ 释放记录查询
- ✅ 统计数据查询
- ✅ 按状态筛选预占单
- ✅ 超时任务自动处理

### 第四步：启动后端服务

```bash
cd backend
npm run dev
```

**验证自动扫描**: 
- 启动日志中应显示：`Starting automatic timeout scanner (interval: 60000ms)`
- 访问 http://localhost:3001/health 应返回 `autoTimeoutScan: "enabled"`
- 创建一个短时间过期的预占单，等待到期后应自动释放

### 第五步：构建后端

```bash
cd backend
npm run build
```

### 第六步：构建前端

```bash
cd frontend
npm run build
```

## API 验证示例

### 1. 验证导出 CSV 路由（未被截获）
```bash
curl -X GET "http://localhost:3001/api/reservations/export/csv"
```
**预期**: 返回 CSV 格式数据，而不是 404 或单个预占单详情

### 2. 验证按订单号查询路由（未被截获）
```bash
curl -X GET "http://localhost:3001/api/reservations/order/TEST_ORDER_001"
```
**预期**: 返回该订单号下的所有预占单列表，而不是单个预占单详情

### 3. 验证健康检查接口
```bash
curl -X GET "http://localhost:3001/health"
```
**预期**: 返回包含 `autoTimeoutScan: "enabled"` 和 `scanIntervalMs` 的 JSON

### 4. 验证超时自动释放
```bash
# 创建一个 2 秒后过期的预占单
curl -X POST "http://localhost:3001/api/reservations" \
  -H "Content-Type: application/json" \
  -d '{"orderId":"TEST_TIMEOUT_001","poolId":"test-pool-id","quantity":1,"expireSeconds":2}'

# 等待 5 秒后查询
curl -X GET "http://localhost:3001/api/reservations"
```
**预期**: 60 秒内（默认扫描间隔）该预占单状态变为 `RELEASED`

## 修改文件清单

- `backend/src/routes/reservation.ts` - 修复路由顺序
- `backend/src/server.ts` - 添加后台定时扫描任务
- `backend/package.json` - 使用 npx 确保脚本可运行，添加 dotenv 依赖
- `backend/src/scripts/runTests.ts` - 添加 dotenv 支持
- `backend/src/scripts/initDb.ts` - 添加 dotenv 支持
- `backend/.env.example` - 新增环境变量配置模板
- `frontend/package.json` - 使用 npx 确保 vite 脚本可运行
- `README.md` - 更新 API 文档和启动说明
