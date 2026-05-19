# 换电运营值班系统

客服单智能分类与管理系统，支持自动识别柜门打不开、扫码失败、空仓误报等问题类型。

## 功能特性

- 🔍 **智能分类**: 自动识别问题类型（柜门打不开、扫码失败、空仓误报、电池故障、系统故障）
- 👥 **角色权限**: 支持管理员、值班员、查看员三种角色，权限控制精细
- 📝 **审计日志**: 所有操作都记录审计日志，支持追溯
- 🔒 **数据脱敏**: 敏感字段（手机号、姓名）自动脱敏，保护隐私
- 💾 **本地持久化**: SQLite本地数据库，重启服务数据不丢失
- 📊 **统计分析**: 按状态、问题类型统计工单数据
- 📤 **导入导出**: 支持CSV格式批量导入导出

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务启动后访问: http://localhost:3000

### 3. 导入样例数据

打开新终端，执行：

```bash
npm run import sample
```

将导入10条包含各种问题类型的样例工单。

### 4. 复核工单

使用API复核工单（需要先启动服务）：

```bash
# 复核工单ID为1的工单
curl -X POST http://localhost:3000/api/tickets/1/review \
  -H "Content-Type: application/json" \
  -H "X-User-ID: 2" \
  -d '{"resolution": "已联系维修人员处理，柜门机械故障已修复"}'
```

### 5. 导出数据

```bash
npm run export
# 或按条件导出
npm run export -- --status pending --problemType door_error
```

## 默认用户

系统初始化时会自动创建以下用户：

| 用户名 | 真实姓名 | 角色 | 用户ID | 权限 |
|--------|----------|------|--------|------|
| admin | 系统管理员 | admin | 1 | 全部权限 |
| operator1 | 张三 | operator | 2 | 创建、查看、编辑、分类、复核、导出 |
| operator2 | 李四 | operator | 3 | 创建、查看、编辑、分类、复核、导出 |

## API接口说明

所有接口都需要在请求头中携带 `X-User-ID` 进行身份认证。

### 客服单管理

| 方法 | 路径 | 说明 | 需要权限 |
|------|------|------|----------|
| GET | /api/tickets | 查询客服单列表 | ticket:read |
| GET | /api/tickets/:id | 查询客服单详情 | ticket:read |
| POST | /api/tickets | 创建客服单 | ticket:create |
| PUT | /api/tickets/:id | 更新客服单 | ticket:update |
| POST | /api/tickets/:id/classify | 分类客服单 | ticket:classify |
| POST | /api/tickets/:id/review | 复核客服单 | ticket:review |
| GET | /api/tickets/statistics | 统计数据 | ticket:read |

### 审计日志

| 方法 | 路径 | 说明 | 需要权限 |
|------|------|------|----------|
| GET | /api/audit | 查询审计日志 | audit:read |

## 问题类型说明

| 类型代码 | 说明 | 关键词 |
|----------|------|--------|
| door_error | 柜门打不开 | 柜门、门、打不开、卡住、关不上、锁 |
| scan_failure | 扫码失败 | 扫码、扫不上、二维码、扫描、识别 |
| empty_bin_false_alarm | 空仓误报 | 空仓、误报、没有电池、显示空 |
| battery_error | 电池故障 | 电池、电瓶、换电、无法换电 |
| system_error | 系统故障 | 系统、app、软件、服务器、网络 |
| other | 其他 | 未匹配到以上关键词 |

## 使用示例

### 查询客服单列表

```bash
curl "http://localhost:3000/api/tickets?page=1&pageSize=10&status=pending" \
  -H "X-User-ID: 2"
```

### 创建新客服单

```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -H "X-User-ID: 2" \
  -d '{
    "ticketNo": "TK20240102001",
    "customerName": "测试用户",
    "customerPhone": "13900139000",
    "stationId": "ST006",
    "stationName": "成都武侯换电站",
    "description": "柜门无法打开，按钮无响应",
    "priority": "high"
  }'
```

### 查看统计数据

```bash
curl http://localhost:3000/api/tickets/statistics \
  -H "X-User-ID: 2"
```

## 项目结构

```
.
├── src/
│   ├── app.js              # 应用入口
│   ├── config/
│   │   ├── database.js     # 数据库配置
│   │   └── logger.js       # 日志配置
│   ├── models/             # 数据模型
│   ├── controllers/        # 控制器
│   ├── routes/             # 路由
│   ├── services/           # 业务服务
│   ├── middleware/         # 中间件
│   └── utils/              # 工具函数
├── scripts/
│   ├── importData.js       # 数据导入脚本
│   └── exportData.js       # 数据导出脚本
├── data/
│   ├── sampleData.json     # 样例数据
│   └── database.sqlite     # SQLite数据库文件
├── logs/                   # 日志目录
├── exports/                # 导出文件目录
└── package.json
```

## 数据脱敏说明

系统对以下敏感字段进行自动脱敏：
- **手机号**: 138****8001（中间4位脱敏）
- **客户姓名**: 张***（保留首字）

脱敏发生在：
- API返回数据
- 导出的CSV文件
- 系统日志

## 审计日志记录内容

- 操作人、操作时间、IP地址
- 操作类型（create/update/delete/classify/review/import/export）
- 变更前后的数据对比
- 操作备注

## 注意事项

1. 首次启动会自动创建数据库和默认用户角色
2. 数据库文件位于 `data/database.sqlite`，可直接备份
3. 日志文件位于 `logs/` 目录
4. 导出文件默认保存在 `exports/` 目录
