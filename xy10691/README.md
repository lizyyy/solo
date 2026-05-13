# 园区会议访客餐核销系统

基于 Node.js + React 的全栈会议餐核销管理系统，支持订餐变更拦截、领餐核销留痕、重复回调去重等核心功能。

## 功能特性

### 核心业务功能
- **会议日程管理**：创建、编辑、查看会议信息
- **访客名单管理**：访客信息录入、订餐状态管理
- **餐标规则配置**：标准餐费、VIP餐费、变更截止时间设置
- **订餐变更拦截**：
  - 会议开始前24小时内禁止变更
  - 已领餐访客禁止取消订餐
- **领餐核销**：
  - 支持单人核销
  - 已核销禁止重复操作
  - 操作留痕审计
- **重复回调去重**：基于 callbackId 的幂等性保证
- **费用汇总**：自动统计订餐人数、核销人数、预计费用
- **报告导出**：导出包含责任节点的 Excel 报告

### 审计与追溯
- 所有修改操作记录前后值
- 操作人、时间、描述完整记录
- 时间线展示完整业务流程
- 支持按责任人、时间筛选

## 技术栈

### 后端
- Node.js + Express
- 内存数据存储（可扩展为数据库）
- Moment.js 时间处理
- XLSX Excel 导出

### 前端
- React 18
- Ant Design 5
- Axios HTTP 客户端
- XLSX Excel 导出

## 项目结构

```
.
├── backend/
│   ├── server.js          # 后端服务入口 & API路由
│   ├── models.js          # 数据模型 & 样例数据
│   └── package.json       # 后端依赖
├── frontend/
│   ├── public/
│   │   └── index.html     # HTML入口
│   ├── src/
│   │   ├── App.js         # 主应用组件
│   │   ├── index.js       # React入口
│   │   └── components/    # 业务组件
│   │       ├── MeetingList.js      # 会议列表
│   │       ├── MeetingDetail.js    # 会议详情
│   │       ├── MealVerification.js # 核销弹窗
│   │       └── OrderChange.js      # 变更弹窗
│   └── package.json       # 前端依赖
├── package.json           # 根项目配置
└── README.md
```

## 快速开始

### 安装依赖

```bash
# 安装根项目依赖
npm install

# 安装后端依赖
cd backend && npm install && cd ..

# 安装前端依赖
cd frontend && npm install && cd ..
```

### 启动项目

```bash
# 同时启动前后端（推荐）
npm run dev

# 或者分别启动：
# 启动后端服务 (端口 3001)
cd backend && npm start

# 启动前端开发服务器 (端口 3000)
cd frontend && npm start
```

访问 http://localhost:3000 即可使用系统。

## 核心功能演示

### 1. 正常流程
1. 查看会议列表，点击"详情"进入会议
2. 在"访客名单"标签页查看访客信息
3. 对未领餐的访客点击"核销"，完成领餐确认
4. 在"时间线"标签页查看操作记录
5. 点击"导出报告"生成 Excel 报告

### 2. 问题流程测试
1. **订餐变更拦截**：尝试对已领餐访客进行变更，系统会拦截
2. **重复核销拦截**：尝试对已核销访客再次核销，系统提示不可重复操作
3. **重复回调测试**：在核销弹窗点击"模拟重复回调"，验证幂等性

### 3. 复核流程
1. 所有核销操作完成后
2. 点击"复核完成"按钮
3. 会议状态变为"已复核"
4. 导出最终报告

## API 接口说明

### 会议相关
- `GET /api/meetings` - 获取会议列表
- `GET /api/meetings/:id` - 获取会议详情
- `PUT /api/meetings/:id` - 更新会议信息
- `GET /api/meetings/:id/visitors` - 获取会议访客列表
- `GET /api/meetings/:id/timeline` - 获取会议时间线
- `GET /api/meetings/:id/expense-summary` - 获取费用汇总
- `POST /api/review` - 复核会议

### 访客相关
- `POST /api/visitors` - 添加访客
- `PUT /api/visitors/:id` - 更新访客信息

### 餐标规则
- `GET /api/meetings/:id/meal-rules` - 获取餐标规则
- `PUT /api/meal-rules/:id` - 更新餐标规则

### 核销与变更
- `POST /api/meal-verifications` - 领餐核销（支持 callbackId 幂等）
- `POST /api/order-changes` - 订餐变更

### 报告与日志
- `GET /api/report/:meetingId` - 获取报告数据
- `GET /api/operation-logs` - 获取操作日志（支持按责任人、时间筛选）

## 数据模型

### Meeting（会议）
- id: 唯一标识
- title: 会议名称
- date: 会议日期
- startTime/endTime: 起止时间
- location: 会议地点
- organizer: 组织者
- status: 状态 (draft/scheduled/ongoing/completed/reviewed)
- expectedVisitors: 预计访客数
- previousValues: 修改前值（用于审计）

### Visitor（访客）
- id: 唯一标识
- meetingId: 所属会议ID
- name: 姓名
- company: 公司
- phone: 电话
- mealType: 餐型 (standard/vip)
- hasMeal: 是否订餐
- verified: 是否已领餐
- previousValues: 修改前值

### MealRule（餐标规则）
- id: 唯一标识
- meetingId: 所属会议ID
- standardPrice: 标准餐费
- vipPrice: VIP餐费
- deadlineHours: 变更截止时间（会议前小时数）

### OperationLog（操作日志）
- id: 唯一标识
- type: 操作类型
- entityId: 实体ID
- entityType: 实体类型
- operator: 操作人
- oldValue: 旧值
- newValue: 新值
- description: 描述
- timestamp: 时间戳

## 关键实现说明

### 1. 订餐变更拦截逻辑
```javascript
// 后端 server.js 中实现
const meetingDateTime = moment(`${meeting.date} ${meeting.startTime}`);
const now = moment();
const hoursDiff = meetingDateTime.diff(now, 'hours');

if (hoursDiff < deadlineHours) {
  // 拦截：距离会议开始不足N小时
}

if (visitor.verified) {
  // 拦截：已领餐，无法取消
}
```

### 2. 重复回调去重（幂等性）
```javascript
// 后端 server.js 中实现
const deduplicationCache = new Map();

if (callbackId) {
  if (deduplicationCache.has(callbackId)) {
    // 返回已处理结果，不重复执行
  }
}

// 处理完成后缓存
deduplicationCache.set(callbackId, verification);
```

### 3. 修改留痕
所有实体都包含 `previousValues` 字段，记录修改前的完整数据。操作日志同时记录 oldValue 和 newValue，支持完整审计追溯。

## 扩展建议

1. **持久化存储**：当前使用内存存储，可接入 MySQL/MongoDB 等数据库
2. **用户认证**：添加登录认证，记录真实操作人
3. **微信集成**：支持扫码核销、微信通知
4. **报表增强**：添加更多统计图表、支持 PDF 导出
5. **批量操作**：支持批量导入访客、批量核销
6. **消息队列**：高并发场景下引入消息队列处理核销请求

## License

MIT