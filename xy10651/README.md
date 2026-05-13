# 影院场务清洁排班系统

## 项目简介

这是一个完整的影院场务清洁排班全栈系统，包含影厅排片管理、岗位技能管理、散场清洁、设备巡检、换班记录、未覆盖岗位等功能模块。

## 核心功能

### 1. 影厅排片
- 创建、编辑、查看排片信息
- 状态流转：待放映 -> 放映中 -> 已结束
- 放映结束自动创建清洁任务
- 修改前后值记录

### 2. 散场清洁
- 清洁任务列表和详情
- 人员分配（技能匹配校验）
- 状态流转：待分配 -> 清洁中 -> 待复核 -> 已通过/已驳回
- 时间线展示
- 修改前后值记录

### 3. 设备巡检
- **拦截机制**：清洁任务未完成时无法开始巡检
- 巡检项目逐项检查
- 发现问题自动创建未覆盖岗位记录
- 问题解决流程

### 4. 换班记录
- **留痕机制**：所有换班操作都有审计记录
- **重复回调处理**：60秒内重复调用会被拦截
- 回调次数统计

### 5. 岗位技能
- 岗位和技能管理
- 人员分配时进行技能匹配校验

### 6. 未覆盖岗位
- 设备巡检发现问题自动创建
- 专人解决流程

### 7. 报告导出
- 责任节点统计
- 按责任人和处理时间筛选
- Excel导出功能
- 操作审计日志

## 业务流程

### 正常流程
排片创建 -> 开始放映 -> 结束放映 -> 清洁任务创建 -> 分配人员 -> 开始清洁 -> 完成清洁 -> 开始巡检 -> 完成巡检 -> 复核通过

### 问题流程
排片创建 -> 放映结束 -> 清洁任务 -> 开始巡检 -> 发现问题 -> 创建未覆盖岗位 -> 安排维修人员 -> 解决问题 -> 完成巡检

### 复核流程
清洁完成 -> 待复核状态 -> 复核通过/驳回 -> 已通过/已驳回状态

## 技术栈

### 后端
- Node.js + Express
- SQLite 数据库
- ExcelJS (导出Excel)

### 前端
- Vue 3 + Vue Router
- Element Plus UI组件库
- Axios HTTP客户端
- Vite 构建工具

## 快速开始

### 1. 安装依赖
```bash
npm run setup
```

### 2. 启动开发环境
```bash
npm run dev
```

### 3. 访问系统
- 前端地址：http://localhost:5173
- 后端API：http://localhost:3000

## 项目结构

```
.
├── server/                 # 后端代码
│   ├── database/           # 数据库配置
│   ├── routes/             # API路由
│   ├── middleware/         # 中间件
│   ├── utils/              # 工具函数
│   ├── scripts/            # 初始化脚本
│   └── index.js            # 入口文件
├── client/                 # 前端代码
│   ├── src/
│   │   ├── views/          # 页面组件
│   │   ├── api/            # API封装
│   │   ├── router/         # 路由配置
│   │   ├── App.vue         # 根组件
│   │   └── main.js         # 入口文件
│   ├── index.html
│   └── vite.config.js
├── package.json
└── README.md
```

## API 接口

### 排片相关
- GET /api/screenings - 获取排片列表
- GET /api/screenings/:id - 获取排片详情
- POST /api/screenings - 创建排片
- PUT /api/screenings/:id - 更新排片
- POST /api/screenings/:id/start - 开始放映
- POST /api/screenings/:id/end - 结束放映

### 清洁相关
- GET /api/cleaning - 获取清洁任务列表
- GET /api/cleaning/:id - 获取清洁任务详情
- POST /api/cleaning/:id/assign - 分配人员
- POST /api/cleaning/:id/start - 开始清洁
- POST /api/cleaning/:id/complete - 完成清洁
- POST /api/cleaning/:id/review - 复核清洁

### 巡检相关
- GET /api/inspections - 获取巡检列表
- POST /api/inspections/:id/start - 开始巡检
- POST /api/inspections/:id/update-item - 更新巡检项
- POST /api/inspections/:id/complete - 完成巡检
- POST /api/inspections/:id/resolve - 解决问题

### 换班相关
- GET /api/shifts - 获取换班列表
- POST /api/shifts - 创建换班
- POST /api/shifts/:id/approve - 批准换班
- POST /api/shifts/:id/reject - 拒绝换班
- POST /api/shifts/:id/callback - 回调（带防重复）

### 报告相关
- GET /api/reports/summary - 获取报告摘要
- GET /api/reports/export - 导出Excel报告

## 核心机制说明

### 设备巡检拦截
```javascript
// 必须清洁完成才能开始巡检
if (cleaning && cleaning.status !== 'completed') {
  return res.status(400).json({ error: '清洁未完成，无法开始设备巡检' });
}
```

### 重复回调处理
```javascript
// 60秒内的重复调用会被拦截
const timeDiff = currentTime - lastCallbackTime;
if (timeDiff < 60000 && callbackCount > 0) {
  return res.status(429).json({ error: '回调过于频繁，请稍后再试' });
}
```

### 技能匹配校验
```javascript
// 分配人员时校验技能是否匹配
const requiredSkills = '清洁,巡检';
if (!validateSkillMatch(staff.skills, requiredSkills)) {
  return res.status(400).json({ error: '员工技能不匹配，无法分配' });
}
```

## 测试数据

初始化后系统包含以下测试数据：
- 3个影厅（1号厅、2号厅、3号厅）
- 4个员工（张三、李四、王五、赵六）
- 4个岗位（清洁员、巡检员、设备维修、值班经理）
- 3个排片（不同状态）
- 3个清洁任务（不同状态）
