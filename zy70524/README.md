# 账号冒用风险API

客服账号安全风控系统，用于检测和处理异地登录、设备异常等账号冒用风险事件。

## 功能特性

- **风险事件创建**：支持创建登录风险事件，自动计算风险评分和等级
- **多维度查询**：按账号、风险等级、状态、时间范围等条件查询
- **状态机流转**：完整的风险事件处理流程（detected → analyzing → pending_disposition → disposition_applied → review_required → reviewing → resolved/dismissed）
- **处置动作**：支持告警、强制下线、重置密码、锁定账号、要求MFA等
- **人工复核**：支持人工审核和误报标记
- **人工修正**：支持修正风险分数、等级等信息
- **异常处理**：记录失败原因和处理依据
- **历史追踪**：完整记录所有字段变更历史
- **数据导出**：支持CSV格式导出所有事件

## 数据模型

### 核心实体

1. **账号 (Accounts)**：客服账号基本信息
2. **设备指纹 (Device Fingerprints)**：设备唯一性标识和特征
3. **登录地点 (Login Locations)**：IP地理位置信息
4. **风险事件 (Risk Events)**：风险事件主记录
5. **处置动作 (Disposition Actions)**：处置执行记录
6. **复核结论 (Review Conclusions)**：人工审核结论
7. **事件历史 (Event History)**：所有变更记录

### 风险等级

- **critical (80-100)**：高危风险，需立即处理
- **high (60-79)**：高风险，需重点关注
- **medium (40-59)**：中等风险，常规处理
- **low (10-39)**：低风险，观察即可

### 处置动作类型

- `alert_only`：仅发送告警通知
- `force_logout`：强制当前会话下线
- `password_reset`：要求用户重置密码
- `account_lock`：临时锁定账号
- `mfa_required`：强制启用多因素认证

## 快速开始

### 安装依赖

```bash
npm install
```

### 初始化数据库

```bash
npm run init-db
```

### 导入样例数据

```bash
node scripts/seed-data.js
```

### 启动服务

```bash
npm start
```

服务默认运行在 `http://localhost:3000`

## API 接口

### 1. 创建风险事件

```http
POST /api/risk-events
Content-Type: application/json

{
  "account_no": "CS001",
  "username": "张三",
  "department": "客服一部",
  "role": "高级客服",
  "event_type": "suspicious_login",
  "ip_address": "203.0.113.50",
  "ip_blacklisted": false,
  "location": {
    "country": "中国",
    "province": "北京市",
    "city": "北京市",
    "district": "朝阳区",
    "latitude": 39.9042,
    "longitude": 116.4074,
    "isp": "中国联通"
  },
  "device_fingerprint": {
    "fingerprint_hash": "abc123def456xyz789",
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "screen_resolution": "1920x1080",
    "timezone": "Asia/Shanghai",
    "language": "zh-CN",
    "platform": "Win32",
    "canvas_fingerprint": "canvas_hash_001",
    "webgl_fingerprint": "webgl_hash_001",
    "fonts": "Arial,Helvetica,sans-serif",
    "plugins": "Chrome PDF Plugin",
    "ip_address": "203.0.113.50"
  }
}
```

### 2. 查询风险事件列表

```http
GET /api/risk-events?account_no=CS001&risk_level=high&status=pending_disposition
```

### 3. 获取单个事件详情

```http
GET /api/risk-events/{event_id}
```

### 4. 获取事件历史记录

```http
GET /api/risk-events/{event_id}/history
```

### 5. 获取处置动作记录

```http
GET /api/risk-events/{event_id}/dispositions
```

### 6. 获取复核结论

```http
GET /api/risk-events/{event_id}/review
```

### 7. 状态流转

```http
POST /api/risk-events/{event_id}/transition
Content-Type: application/json

{
  "new_status": "analyzing",
  "operator": "admin",
  "operator_type": "human",
  "reason": "开始人工分析"
}
```

### 8. 执行处置动作

```http
POST /api/risk-events/{event_id}/disposition
Content-Type: application/json

{
  "action_type": "force_logout",
  "operator": "admin",
  "operator_type": "human",
  "reason": "异地登录，强制下线"
}
```

### 9. 提交复核结论

```http
POST /api/risk-events/{event_id}/review
Content-Type: application/json

{
  "reviewer": "security_audit_01",
  "review_result": "confirmed_risk",
  "review_comment": "确认为账号冒用，已通知用户",
  "is_false_positive": false
}
```

### 10. 人工修正

```http
POST /api/risk-events/{event_id}/manual-correct
Content-Type: application/json

{
  "risk_score": 65,
  "risk_level": "high",
  "event_type": "abnormal_behavior",
  "operator": "security_admin",
  "reason": "根据上下文信息调整风险等级"
}
```

### 11. 异常处理

```http
POST /api/risk-events/{event_id}/exception
Content-Type: application/json

{
  "failure_reason": "IP归属地查询失败，无法准确判断",
  "operator": "system"
}
```

### 12. 导出CSV

```http
GET /api/risk-events/export/csv?risk_level=critical
```

### 13. 获取完整导出详情

```http
GET /api/risk-events/{event_id}/export/detail
```

### 14. 获取元数据

```http
GET /api/risk-events/meta/statuses
GET /api/risk-events/meta/dispositions
GET /api/risk-events/meta/review-results
GET /api/risk-events/meta/export-fields
```

## 健康检查

```http
GET /health
```

## 项目结构

```
.
├── package.json
├── README.md
├── data/                   # SQLite数据库文件目录
├── scripts/               # 脚本目录
│   ├── init-db.js        # 数据库初始化脚本
│   └── seed-data.js      # 样例数据脚本
└── src/                   # 源代码目录
    ├── app.js            # 应用入口
    ├── config/
    │   └── database.js   # 数据库配置
    ├── routes/
    │   └── riskEvents.js # 风险事件路由
    └── services/
        ├── riskEventService.js    # 风险事件服务
        ├── riskScoringService.js  # 风险评分服务
        ├── stateMachineService.js # 状态机服务
        └── exportService.js       # 导出服务
```

## 数据持久化

所有数据存储在SQLite数据库中，重启服务数据不会丢失。数据库文件位于 `data/risk.db`。

## 技术栈

- **Node.js**：运行环境
- **Express**：Web框架
- **SQLite3**：数据库
- **Joi**：参数校验
- **json2csv**：CSV导出
- **uuid**：唯一ID生成
- **moment**：时间处理
- **helmet/cors**：安全中间件
