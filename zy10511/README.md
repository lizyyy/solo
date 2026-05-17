# 测试账号借用管理 API

多人共用测试账号管理系统，解决账号状态不清、设备占用冲突、回归测试互相污染等问题。

## ✨ 核心特性

- **账号租约管理**: 默认8小时租约，超时自动回收
- **设备绑定**: 账号与设备一对一绑定，冲突自动检测
- **状态追踪**: 完整的借用历史和操作日志
- **异常处理**: 强制回收、人工修正、异常记录
- **数据导出**: 多维度CSV格式导出
- **本地存储**: JSON文件持久化，无需数据库

## 🚀 快速启动

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化样例数据

```bash
npm run init-data
```

初始化后将创建5个测试账号：
- TEST-USER-001: 支付测试账号 - 微信支付
- TEST-USER-002: 支付测试账号 - 支付宝
- TEST-USER-003: 登录测试账号 - 管理员权限
- TEST-USER-004: 登录测试账号 - 普通用户权限
- TEST-USER-005: 接口测试账号 - 完整权限

### 3. 启动服务

```bash
npm start
```

服务启动后访问: http://localhost:3000

## 📡 API 接口

### 基础接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 健康检查 |
| GET | /api/status | 服务状态 |

### 账号管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/accounts | 创建账号 |
| GET | /api/accounts | 查询所有账号 |
| GET | /api/accounts/:accountNumber | 查询单个账号 |
| GET | /api/accounts/:accountNumber/history | 借用历史 |
| GET | /api/accounts/:accountNumber/logs | 操作日志 |

### 借用管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/accounts/:accountNumber/borrow | 借用账号 |
| POST | /api/accounts/:accountNumber/return | 归还账号 |
| POST | /api/accounts/check-overdue | 检测并回收超时账号 |

### 异常处理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/accounts/:accountNumber/manual-correct | 人工修正 |
| POST | /api/accounts/:accountNumber/force-recover | 强制回收 |
| GET | /api/accounts/abnormal/records | 异常记录列表 |
| GET | /api/accounts/conflict/:device | 设备冲突检测 |

### 数据导出

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/accounts/export/accounts | 导出账号列表 |
| POST | /api/accounts/export/borrow-history | 导出借用历史 |
| POST | /api/accounts/export/operation-logs | 导出操作日志 |
| POST | /api/accounts/export/abnormal-records | 导出异常记录 |
| POST | /api/accounts/export/full-report | 导出完整报告 |
| GET | /api/accounts/export/files | 已导出文件列表 |

## 📋 cURL 调用示例

### 1. 健康检查

```bash
curl http://localhost:3000/api/health
```

### 2. 创建账号

```bash
curl -X POST http://localhost:3000/api/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "accountNumber": "TEST-USER-006",
    "description": "新建测试账号",
    "operator": "admin",
    "tags": ["test", "new"]
  }'
```

### 3. 查询所有账号

```bash
curl http://localhost:3000/api/accounts
```

按状态筛选:
```bash
curl "http://localhost:3000/api/accounts?status=available"
```

按借用人筛选:
```bash
curl "http://localhost:3000/api/accounts?borrower=zhangsan"
```

### 4. 借用账号

```bash
curl -X POST http://localhost:3000/api/accounts/TEST-USER-001/borrow \
  -H "Content-Type: application/json" \
  -d '{
    "borrower": "zhangsan",
    "purpose": "支付模块回归测试",
    "device": "MBP-2024-ZS",
    "leaseHours": 4
  }'
```

### 5. 归还账号

```bash
curl -X POST http://localhost:3000/api/accounts/TEST-USER-001/return \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "zhangsan",
    "borrowReport": "支付模块测试完成，所有用例通过"
  }'
```

### 6. 查询借用历史

```bash
curl http://localhost:3000/api/accounts/TEST-USER-001/history
```

### 7. 查询操作日志

```bash
curl http://localhost:3000/api/accounts/TEST-USER-001/logs
```

### 8. 人工修正账号状态

```bash
curl -X POST http://localhost:3000/api/accounts/TEST-USER-001/manual-correct \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "admin",
    "status": "available",
    "currentBorrower": null,
    "currentDevice": null,
    "reason": "账号异常离线，人工重置状态"
  }'
```

### 9. 强制回收账号

```bash
curl -X POST http://localhost:3000/api/accounts/TEST-USER-001/force-recover \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "admin",
    "reason": "使用人已离职，需紧急回收"
  }'
```

### 10. 检测设备冲突

```bash
curl http://localhost:3000/api/accounts/conflict/MBP-2024-ZS
```

### 11. 导出完整报告

```bash
curl -X POST http://localhost:3000/api/accounts/export/full-report
```

## ⚠️ 异常路径示例

以下是被拦截的异常场景示例：

### 1. 借用已被占用的账号

```bash
# 先借用一次
curl -X POST http://localhost:3000/api/accounts/TEST-USER-001/borrow \
  -H "Content-Type: application/json" \
  -d '{
    "borrower": "zhangsan",
    "purpose": "测试",
    "device": "MBP-ZS"
  }'

# 再次借用同一账号（会被拦截）
curl -X POST http://localhost:3000/api/accounts/TEST-USER-001/borrow \
  -H "Content-Type: application/json" \
  -d '{
    "borrower": "lisi",
    "purpose": "其他测试",
    "device": "MBP-LS"
  }'
```

返回错误:
```json
{
  "success": false,
  "error": "账号 TEST-USER-001 已被 zhangsan 占用，设备: MBP-ZS"
}
```

### 2. 非借用人归还账号

```bash
# 借用账号
curl -X POST http://localhost:3000/api/accounts/TEST-USER-002/borrow \
  -H "Content-Type: application/json" \
  -d '{
    "borrower": "zhangsan",
    "purpose": "测试",
    "device": "MBP-ZS"
  }'

# 非借用人尝试归还（会被拦截）
curl -X POST http://localhost:3000/api/accounts/TEST-USER-002/return \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "lisi"
  }'
```

返回错误:
```json
{
  "success": false,
  "error": "仅借用人 zhangsan 可归还，或使用 forceReturn 强制归还"
}
```

### 3. 归还未被借用的账号

```bash
curl -X POST http://localhost:3000/api/accounts/TEST-USER-003/return \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "zhangsan"
  }'
```

返回错误:
```json
{
  "success": false,
  "error": "账号 TEST-USER-003 当前未被借用"
}
```

### 4. 查询不存在的账号

```bash
curl http://localhost:3000/api/accounts/NOT-EXISTS-999
```

返回错误:
```json
{
  "success": false,
  "error": "账号不存在"
}
```

### 5. 创建重复的账号

```bash
# 创建账号
curl -X POST http://localhost:3000/api/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "accountNumber": "TEST-DUP-001",
    "description": "测试重复"
  }'

# 再次创建同一账号（会被拦截）
curl -X POST http://localhost:3000/api/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "accountNumber": "TEST-DUP-001",
    "description": "重复创建"
  }'
```

返回错误:
```json
{
  "success": false,
  "error": "账号 TEST-DUP-001 已存在"
}
```

## 📊 账号状态说明

| 状态 | 说明 |
|------|------|
| available | 可用，可被借用 |
| borrowed | 已借用 |
| in_use | 使用中 |
| overdue | 已超时 |
| maintenance | 维护中 |
| abnormal | 异常状态 |

## 📁 数据存储位置

所有数据存储在项目根目录的 `data/` 文件夹下：

```
data/
├── accounts.json          # 账号数据
├── borrow_records.json    # 借用记录
├── operation_logs.json    # 操作日志
├── abnormal_records.json  # 异常记录
└── exports/               # 导出文件目录
    ├── accounts_*.csv
    ├── borrow_history_*.csv
    ├── operation_logs_*.csv
    └── abnormal_records_*.csv
```

## 🔧 开发模式

使用 nodemon 自动重启:

```bash
npm run dev
```
