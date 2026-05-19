# 园区安保管理系统

一个小而完整的服务端系统，解决访客预约、临时车牌、黑名单核验统一管理问题。

## 核心功能

### 1. 访客预约管理
- 创建访客预约，包含姓名、手机号、车牌号、访问日期时间
- 预约审批流程（待审批 -> 已通过）
- 过期预约自动识别
- 支持门岗信息记录

### 2. 临时车牌管理
- 创建临时车牌，关联访客信息
- 设置有效时间段
- 车牌状态管理（有效/吊销）
- 到期自动失效检查

### 3. 黑名单管理
- 支持手机号、车牌、身份证号三种类型
- 支持设置过期时间
- 添加/移除黑名单
- 核验时自动拦截

### 4. 核验服务
- 手机号核验：检查黑名单 -> 检查有效预约
- 车牌核验：检查黑名单 -> 检查临时车牌 -> 检查预约关联
- 越权放行：记录操作员信息和放行原因
- 每条核验都记录原因和操作结果

### 5. 数据安全
- **手机号脱敏**：API返回和导出文件中自动处理为 `138****8001`
- **敏感字段处理**：后端统一处理，不依赖前端遮罩
- **操作日志**：所有变更操作完整记录

### 6. 报告与导出
- 核验记录导出CSV
- 预约记录导出CSV
- 黑名单导出CSV
- 每日统计报告
- 导出文件自动脱敏

### 7. 数据持久化
- 使用SQLite本地数据库
- 重启服务数据不丢失
- 核验历史永久保存

## 项目结构

```
├── src/
│   ├── app.js                 # Express应用入口
│   ├── config/
│   │   └── index.js           # 配置文件
│   ├── models/
│   │   └── database.js        # SQLite数据库模型
│   ├── services/
│   │   ├── appointmentService.js      # 预约服务
│   │   ├── blacklistService.js        # 黑名单服务
│   │   ├── temporaryPlateService.js   # 临时车牌服务
│   │   ├── verificationService.js     # 核验服务
│   │   └── reportService.js           # 报告导出服务
│   ├── routes/
│   │   ├── appointments.js     # 预约API路由
│   │   ├── blacklist.js        # 黑名单API路由
│   │   ├── plates.js           # 临时车牌API路由
│   │   ├── verification.js     # 核验API路由
│   │   └── reports.js          # 报告API路由
│   ├── utils/
│   │   ├── security.js         # 安全工具（脱敏等）
│   │   └── logger.js           # 日志工具
├── test/
│   ├── verify-system.js        # 完整功能测试
│   └── test-persistence.js     # 数据持久化测试
├── data/                       # SQLite数据库文件
├── logs/                       # 日志文件
├── exports/                    # 导出CSV文件
└── package.json
```

## 快速开始

### 安装依赖
```bash
npm install
```

### 运行完整功能测试
```bash
npm test
# 或
node test/verify-system.js
```

### 验证数据持久化
```bash
# 第一次运行测试生成数据
node test/verify-system.js

# 第二次运行验证数据仍然存在
node test/test-persistence.js
```

### 启动服务
```bash
npm start
```

服务启动在 http://localhost:3000

## API接口

### 预约管理
- `POST /api/appointments` - 创建预约
- `GET /api/appointments` - 查询预约列表
- `GET /api/appointments/:id` - 查询单个预约
- `PUT /api/appointments/:id/approve` - 审批预约
- `PUT /api/appointments/:id/cancel` - 取消预约

### 黑名单管理
- `POST /api/blacklist` - 添加黑名单
- `GET /api/blacklist` - 查询黑名单
- `DELETE /api/blacklist/:id` - 移除黑名单
- `POST /api/blacklist/check` - 核验是否在黑名单

### 临时车牌管理
- `POST /api/plates` - 创建临时车牌
- `GET /api/plates` - 查询临时车牌列表
- `GET /api/plates/:id` - 查询单个车牌
- `PUT /api/plates/:id/revoke` - 吊销车牌

### 核验服务
- `POST /api/verification/phone` - 手机号核验
- `POST /api/verification/plate` - 车牌号核验
- `POST /api/verification/force-allow` - 越权放行
- `GET /api/verification/statistics` - 获取统计数据
- `GET /api/verification/records` - 获取核验记录
- `GET /api/verification/recent` - 获取最近核验记录

### 报告导出
- `GET /api/reports/verification` - 生成核验报告数据
- `GET /api/reports/appointment` - 生成预约报告数据
- `GET /api/reports/blacklist` - 生成黑名单报告数据
- `GET /api/reports/daily` - 生成每日报告
- `POST /api/reports/export/verification` - 导出核验记录CSV
- `POST /api/reports/export/appointment` - 导出预约记录CSV
- `POST /api/reports/export/blacklist` - 导出黑名单CSV

## 核验规则

### 手机号核验流程
1. 检查是否在黑名单中 -> 拦截并记录原因
2. 检查今日是否有已通过的预约 -> 无预约则拦截
3. 检查预约是否已过期 -> 已过期则拦截
4. 全部通过则放行

### 车牌核验流程
1. 检查是否在黑名单中 -> 拦截
2. 检查是否有有效的临时车牌 -> 有则放行
3. 检查是否有预约关联 -> 有有效预约则放行
4. 都不满足则拦截

### 越权放行
- 必须记录操作员信息
- 必须提供详细原因（至少5个字符）
- 记录类型标记为`forced`（人工强制放行）
- 操作日志记录完整信息

## 数据脱敏规则

### 手机号
- 原始：`13800138001`
- 脱敏后：`138****8001`

### 身份证号
- 原始：`110101199001011234`
- 脱敏后：`110101********1234`

### 应用场景
- API返回数据自动脱敏
- CSV导出文件自动脱敏
- 日志记录自动脱敏

## 数据模型

### appointments (预约表)
- id, visitor_id, visitor_name, visitor_phone, plate_number
- visit_date, start_time, end_time, status, gate, notes
- created_at, updated_at, approved_at, cancelled_at

### blacklist (黑名单表)
- id, type(phone/plate/id_card), value, reason
- added_by, added_at, expires_at, is_active, notes

### temporary_plates (临时车牌表)
- id, plate_number, visitor_name, visitor_phone
- valid_from, valid_to, status, appointment_id, issued_by, notes

### verification_records (核验记录表)
- id, verify_type, identifier, result, action, reason
- gate, operator_id, operator_name, details, created_at

### operation_logs (操作日志表)
- id, operator_id, operator_name, operation, module, record_id
- old_value, new_value, ip_address, user_agent, created_at

## 配置说明

在 `src/config/index.js` 中可配置：
- 服务端口
- 数据库路径
- 脱敏规则正则
- 预约时间限制
- 用户角色权限

## 日志说明

系统记录两种类型日志：
1. **操作日志**：记录所有数据变更操作（创建、修改、删除）
2. **核验记录**：记录每次门岗核验的完整信息（包括原因）

所有日志包含：
- 操作人信息
- 操作时间
- 具体操作内容
- IP地址（可选）

## 特点总结

✅ **完整业务流**：预约创建-审批-核验-报告全流程  
✅ **数据持久化**：SQLite本地存储，重启不丢失  
✅ **敏感数据保护**：后端统一脱敏，不依赖前端  
✅ **核验原因可追溯**：每条放行/拦截都有明确原因  
✅ **越权放行监控**：强制记录操作员和原因  
✅ **过期自动处理**：预约/车牌自动过期识别  
✅ **CSV导出功能**：支持各类数据导出，自动脱敏  
✅ **统计分析**：核验成功率、拦截原因分布等统计  
