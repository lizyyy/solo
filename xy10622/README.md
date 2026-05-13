# 公益时长补录审核系统

前后端一体的公益时长补录审核管理工具，确保志愿者档案、队长确认和荣誉兑换的数据一致性。

## 功能特性

- ✅ 统计卡片：待审核、已通过、已拒绝、缺签退、补录总时长
- 🔍 搜索过滤：按志愿者、活动名称、状态、日期范围筛选
- 📋 复核面板：补录审核、缺签退处理
- 📊 数据校验：活动签到自动校验（缺签退、时长异常等）
- 📝 修改历史：保留志愿者档案、活动签到、队长确认的修改前后值
- 📤 导出报告：支持按责任人和处理时间筛选导出Excel
- 🔒 数据一致性：审核通过后同步更新志愿者档案、队长确认和签到记录

## 技术栈

- **后端**: Node.js + Express + SQLite
- **前端**: HTML + CSS + JavaScript (Bootstrap 5)
- **Excel导出**: ExcelJS

## 本地启动

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库（首次运行）

```bash
npm run init-db
```

这会创建数据库表并插入样例测试数据。

### 3. 启动服务

```bash
npm start
```

服务启动后，访问: **http://localhost:3000**

开发模式（自动重启）:
```bash
npm run dev
```

## 主要 API 接口

### 统计信息
```
GET /api/audit/statistics
```
返回各状态审核数量、缺签退数量、补录总时长

### 审核列表
```
GET /api/audit/audits?volunteerName=&activityName=&status=&startDate=&endDate=
```
支持多条件筛选查询

### 缺签退列表
```
GET /api/audit/missing-checkouts
```
获取待处理的缺签退记录

### 校验活动签到
```
GET /api/audit/validate-checkin/:checkinId
```
校验签到记录是否存在异常（缺签退、时长异常等）

### 处理缺签退
```
POST /api/audit/process-missing-checkout
Body: { checkinId, approvedHours, notes, handledBy }
```
处理缺签退记录，补录时长

### 保存补录审核
```
POST /api/audit/save-audit
Body: { auditId, status, approvedHours, handledBy }
```
通过或拒绝补录审核，审核通过后自动同步：
- 更新活动签到时长和状态
- 更新志愿者累计时长
- 更新队长确认记录
- 记录所有修改历史

### 导出报告
```
GET /api/audit/export-report?handledBy=&startTime=&endTime=
```
导出Excel报告，支持按责任人和时间范围筛选

### 修改历史查询
```
GET /api/audit/volunteer-history/:volunteerId
GET /api/audit/checkin-history/:checkinId
GET /api/audit/confirmation-history/:confirmationId
```
查询各模块的修改历史记录

## 测试数据

初始化数据库后，系统包含以下样例数据：

### 志愿者数据（5条）
- 张三、李四、王五、赵六、王队长
- 每条包含累计时长

### 活动数据（4个）
- 社区环保活动（2024-01-15）
- 敬老院慰问（2024-01-20）
- 图书馆志愿服务（2024-01-25）
- 马拉松志愿者（2024-02-01）

### 活动签到（8条）
- 已确认的签到记录
- 待审核的补录记录
- 缺签退的异常记录

### 补录审核（2条）
- 1条待审核（ID: 1）
- 1条已通过（ID: 2）

### 缺签退（2条）
- 1条待处理（ID: 1）
- 1条已处理（ID: 2）

### 荣誉兑换（3条）
- 一星志愿者、二星志愿者等

## 会失败的操作示例

### 场景1：审核不存在的记录

**操作步骤**：
1. 直接调用API审核一个不存在的ID
2. 或在前端尝试操作已被删除的记录

**API调用**：
```bash
curl -X POST http://localhost:3000/api/audit/save-audit \
  -H "Content-Type: application/json" \
  -d '{"auditId": 9999, "status": "approved", "approvedHours": 3}'
```

**预期结果**：
```json
{
  "success": false,
  "message": "审核记录不存在"
}
```

### 场景2：处理不存在的缺签退记录

**API调用**：
```bash
curl -X POST http://localhost:3000/api/audit/process-missing-checkout \
  -H "Content-Type: application/json" \
  -d '{"checkinId": 9999, "approvedHours": 3}'
```

**预期结果**：
```json
{
  "success": false,
  "message": "签到记录不存在"
}
```

### 场景3：缺少必要参数

**API调用**：
```bash
curl -X POST http://localhost:3000/api/audit/save-audit \
  -H "Content-Type: application/json" \
  -d '{"status": "approved"}'
```

**预期结果**：
```json
{
  "success": false,
  "message": "缺少必要参数"
}
```

## 项目结构

```
.
├── package.json
├── README.md
├── server/
│   ├── index.js              # 服务入口
│   ├── database/
│   │   ├── db.js             # 数据库操作封装
│   │   └── schema.sql        # 数据库表结构
│   ├── controllers/
│   │   └── auditController.js # 审核业务逻辑
│   ├── routes/
│   │   └── auditRoutes.js    # API路由
│   └── scripts/
│       └── init-db.js        # 数据库初始化脚本
└── public/
    ├── index.html            # 前端页面
    └── app.js                # 前端逻辑
```

## 数据库表结构

### 核心业务表
- `volunteers`: 志愿者档案
- `activities`: 活动信息
- `activity_checkins`: 活动签到记录
- `captain_confirmations`: 队长确认记录
- `missing_checkouts`: 缺签退记录
- `supplemental_audits`: 补录审核记录
- `honor_redemptions`: 荣誉兑换记录

### 历史记录表（审计追踪）
- `volunteer_history`: 志愿者档案修改历史
- `checkin_history`: 签到记录修改历史
- `confirmation_history`: 队长确认修改历史

## 使用说明

### 补录审核流程
1. 在「补录审核」标签页查看待审核列表
2. 点击「详情」查看完整信息和校验结果
3. 输入核定时长，点击「通过审核」或「拒绝审核」
4. 系统自动同步更新志愿者档案、队长确认等相关数据

### 缺签退处理流程
1. 切换到「缺签退处理」标签页
2. 点击「处理」按钮
3. 输入核定时长和备注
4. 确认后系统自动补录时长并生成待审核记录

### 导出报告
1. 点击「导出报告」按钮
2. 可选择按责任人和时间范围筛选
3. 点击「导出Excel」下载报告

## 数据一致性保证

系统通过以下机制确保数据一致性：

1. **事务处理**：审核通过后在同一事务中更新所有相关表
2. **历史追踪**：所有修改都记录修改前后值，支持追溯
3. **自动计算**：志愿者累计时长自动重新计算，避免累加错误
4. **状态同步**：各模块状态同步更新（待审核→已确认）
