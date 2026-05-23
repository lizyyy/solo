# 健身房私教课消课API服务

一个完整的健身房私教课消课管理后端API服务，提供REST接口、本地持久化存储和完整的数据追溯能力。

## ✨ 核心功能

### 📊 数据模型
- **会员管理** - 会员基本信息管理
- **教练管理** - 教练信息和专长管理
- **课程包管理** - 课程套餐定义
- **会员卡管理** - 会员购卡、课时管理
- **预约管理** - 课程预约、取消
- **请假管理** - 会员请假申请与审批
- **代课管理** - 教练代课申请与确认
- **消课记录** - 课时消耗记录
- **人工修正** - 课时异常调整记录
- **异常日志** - 所有异常操作的原始记录

### 🔒 核心业务规则
- **课时冻结** - 支持会员卡冻结/解冻
- **代课确认** - 代课申请需审批确认
- **取消窗口** - 距离开课24小时内无法请假
- **重复消课拦截** - 防止同一预约重复消课
- **事务保证** - 所有关键操作数据库事务保证

### 📈 报表导出
- 消课记录明细报表
- 教练业绩统计
- 会员卡使用情况汇总
- CSV格式导出

## 🛠️ 技术栈

- **运行时**: Node.js
- **Web框架**: Express.js
- **数据库**: SQLite (本地文件存储)
- **数据格式**: JSON
- **报表导出**: CSV

## 📁 项目结构

```
gym-private-lesson-api/
├── package.json
├── src/
│   ├── server.js              # 服务入口
│   ├── config/
│   │   └── database.js        # 数据库配置
│   ├── routes/
│   │   └── index.js           # API路由
│   ├── services/
│   │   ├── basicService.js    # 基础数据服务
│   │   ├── membershipCardService.js  # 会员卡服务
│   │   ├── appointmentService.js     # 预约服务
│   │   ├── courseConsumptionService.js # 消课服务
│   │   ├── leaveService.js    # 请假服务
│   │   ├── substituteService.js # 代课服务
│   │   ├── reportService.js   # 报表服务
│   │   └── exceptionService.js # 异常日志服务
│   └── scripts/
│       ├── initDatabase.js    # 数据库初始化
│       ├── seedData.js        # 样例数据导入
│       └── testApi.js         # API集成测试
└── data/
    └── gym.db                 # SQLite数据库文件 (自动创建)
```

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

### 3. 导入样例数据

```bash
npm run seed-data
```

### 4. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动

### 5. 运行集成测试（服务启动后执行）

```bash
npm run test-api
```

## 🔗 API接口说明

### 健康检查
```
GET /api/health
```

### 会员管理
```
GET    /api/members              # 获取所有会员
GET    /api/members/:id          # 获取单个会员
POST   /api/members              # 创建会员
```

### 教练管理
```
GET    /api/coaches              # 获取所有教练
GET    /api/coaches/:id          # 获取单个教练
POST   /api/coaches              # 创建教练
```

### 课程包管理
```
GET    /api/course-packages      # 获取所有课程包
POST   /api/course-packages      # 创建课程包
```

### 会员卡管理
```
POST   /api/membership-cards                         # 创建会员卡
GET    /api/membership-cards/:id                     # 获取会员卡详情
GET    /api/members/:memberId/membership-cards       # 获取会员的所有会员卡
POST   /api/membership-cards/:id/freeze              # 冻结会员卡
POST   /api/membership-cards/:id/unfreeze            # 解冻会员卡
POST   /api/membership-cards/:id/manual-correction   # 人工修正课时
GET    /api/membership-cards/:id/corrections         # 获取修正记录
```

### 预约管理
```
POST   /api/appointments                             # 创建预约
GET    /api/appointments/:id                         # 获取预约详情
GET    /api/members/:memberId/appointments           # 获取会员预约列表
POST   /api/appointments/:id/cancel                  # 取消预约
```

### 消课管理
```
POST   /api/course-consumptions                      # 消课
GET    /api/course-consumptions/:id                  # 获取消课详情
GET    /api/membership-cards/:cardId/consumptions    # 获取会员卡消课记录
```

### 请假管理
```
POST   /api/leaves                                   # 申请请假
POST   /api/leaves/:id/approve                       # 批准请假
POST   /api/leaves/:id/reject                        # 拒绝请假
GET    /api/leaves/:id                               # 获取请假详情
```

### 代课管理
```
POST   /api/substitutes                              # 申请代课
POST   /api/substitutes/:id/confirm                  # 确认代课
POST   /api/substitutes/:id/reject                   # 拒绝代课
GET    /api/substitutes/:id                          # 获取代课详情
```

### 报表管理
```
GET    /api/reports/consumptions                     # 消课记录报表
GET    /api/reports/consumptions/export              # 导出CSV报表
GET    /api/reports/coach-statistics                 # 教练统计
GET    /api/reports/members/:memberId/card-summary   # 会员卡汇总
```

### 异常日志
```
GET    /api/exceptions                               # 获取异常日志
```

## 🔍 数据追溯能力

系统设计了完整的数据追溯链：

```
预约记录 → 消课记录 → 会员卡剩余课时
         ↓
    异常日志 (原始输入、错误信息、处理结果)
         ↓
    人工修正记录 (修正前、修正后、原因、操作人)
```

所有异常情况都保存在 `exception_logs` 表中，包含：
- 操作类型
- 原始输入数据
- 错误信息
- 错误代码
- 处理结果
- 关联记录ID和类型
- 操作人
- 时间戳

## 📝 核心业务流程示例

### 消课流程

1. 验证预约状态是否为"已预约"
2. 检查会员卡状态和剩余课时
3. 检查是否已消课（防重复）
4. 创建消课记录（记录消课前/后课时数）
5. 更新会员卡剩余课时
6. 更新预约状态为"已完成"
7. 全部操作在数据库事务中完成

### 异常处理示例

```javascript
// 重复消课会被拦截，并记录异常日志
{
  "operation_type": "consume_course",
  "raw_input": "{\"appointment_id\": \"...\", \"operator\": \"...\"}",
  "error_message": "该预约已消课，请勿重复操作",
  "error_code": "DUPLICATE_CONSUMPTION",
  "processing_result": "REJECTED",
  "related_record_id": "...",
  "related_record_type": "course_consumption"
}
```

## ⚙️ 配置说明

- **取消窗口**: 24小时（可在 `courseConsumptionService.js` 中修改）
- **端口**: 3000（可通过环境变量PORT修改）
- **数据库路径**: `data/gym.db`

## 🧪 测试覆盖

- ✅ 健康检查
- ✅ 基础数据CRUD
- ✅ 会员卡创建
- ✅ 预约创建
- ✅ 正常消课流程
- ✅ 重复消课拦截
- ✅ 课时冻结/解冻
- ✅ 请假申请与审批
- ✅ 代课申请与确认
- ✅ 人工修正课时
- ✅ 异常日志记录
- ✅ 数据追溯验证
- ✅ 报表导出功能

## 📄 许可证

MIT
