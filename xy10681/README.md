# 赛事志愿者岗位补贴管理系统

基于 Vue3 + Node.js + SQLite 的全栈项目，实现志愿者岗位技能认证、赛段排班、签到签退、物资包管理、补贴发放、异常处理等功能。

## 功能特性

### 核心功能
- **岗位技能管理**：技能认证、审核流程、等级管理
- **赛段排班**：排班管理、状态流转
- **签到签退**：扫码/手动签到、签退、考勤记录
- **物资包管理**：物资发放、拦截机制
- **补贴规则**：规则配置、补贴计算、回调发放
- **异常名单**：异常记录、处理流程、复核机制

### 关键特性
1. **物资包拦截**：存在未发放物资包时，自动拦截补贴发放
2. **补贴规则留痕**：所有补贴操作记录完整审计日志
3. **重复回调不重复扣减**：通过 callback_id 实现幂等性，防止重复发放
4. **修改前后值记录**：所有字段变更均记录旧值和新值
5. **责任节点报告**：支持按责任人、时间筛选导出Excel报告

## 技术栈

### 后端
- Node.js + Express
- SQLite3 数据库
- ExcelJS (Excel导出)
- Moment.js (日期处理)

### 前端
- Vue 3
- Vue Router
- Element Plus
- Axios

## 快速开始

### 环境要求
- Node.js >= 16.x
- npm 或 yarn

### 安装依赖

```bash
# 安装后端依赖
npm install

# 安装前端依赖
cd client
npm install
cd ..

# 或者一键安装
npm run install-all
```

### 启动项目

```bash
# 同时启动后端和前端
npm run dev

# 或者分别启动
npm run server    # 后端服务: http://localhost:5000
npm run client    # 前端服务: http://localhost:3000
```

### 初始化演示数据

1. 访问 http://localhost:3000
2. 点击首页的「初始化演示数据」按钮
3. 系统会自动创建包含3个志愿者的测试数据

## 演示数据说明

### 志愿者
- **张三**：正常流程（已排班→已签到→已签退→物资已发放→补贴已发放）
- **李四**：考勤异常（迟到10分钟，待处理）
- **王五**：物资包拦截（存在未发放物资包，补贴被拦截）

### 功能验证流程

#### 1. 正常流程（张三）
- 查看详情 → 操作时间线：完整的业务流程记录
- 岗位技能：已审核的技能认证
- 赛段排班：已完成的排班记录
- 签到签退：完整的签到签退记录
- 物资包：已发放状态
- 补贴记录：两条已发放的补贴记录

#### 2. 问题流程（李四）
- 异常名单：显示考勤异常记录
- 可点击「处理」按钮处理异常
- 处理后状态变为「已处理」

#### 3. 复核流程（王五）
- 异常名单：显示物资包拦截异常
- 可点击「复核」按钮进行复核
- 复核后状态变为「复核通过」或「复核驳回」

#### 4. 物资包拦截测试
- 进入王五的详情页
- 切换到「补贴记录」标签
- 点击「测试回调发放」按钮
- 系统提示："补贴被拦截：存在未发放物资包！"

#### 5. 重复回调测试
- 在张三的详情页（物资已发放）
- 连续点击多次「测试回调发放」
- 系统会提示"回调已处理，不重复扣减"

#### 6. 修改记录查看
- 在任意模块点击「修改记录」或「审核记录」按钮
- 查看字段修改前后的值对比
- 显示操作人和操作时间

#### 7. 报告导出
- 点击首页「导出报告」按钮
- 可按志愿者、责任人、日期范围筛选
- 导出包含三个工作表的Excel文件：
  - 操作时间线
  - 修改记录（审计日志）
  - 补贴记录

## 项目结构

```
.
├── server/                 # 后端代码
│   ├── database.js        # 数据库初始化
│   ├── index.js           # 入口文件
│   └── routes/            # API路由
│       ├── volunteerSkills.js    # 岗位技能
│       ├── shiftSchedules.js     # 赛段排班
│       ├── attendance.js         # 签到签退
│       ├── materialPackages.js   # 物资包
│       ├── subsidy.js            # 补贴管理
│       ├── exceptionList.js      # 异常名单
│       ├── timeline.js           # 时间线
│       ├── report.js             # 报告导出
│       └── initData.js           # 初始化数据
├── client/                # 前端代码
│   ├── src/
│   │   ├── pages/        # 页面组件
│   │   │   ├── VolunteerList.vue    # 志愿者列表
│   │   │   ├── VolunteerDetail.vue  # 志愿者详情
│   │   │   └── ReportPage.vue       # 报告页面
│   │   ├── App.vue
│   │   └── main.js
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── package.json
└── README.md
```

## API 接口

### 志愿者
- `GET /api/volunteers` - 获取志愿者列表

### 岗位技能
- `GET /api/volunteer-skills` - 获取技能列表
- `POST /api/volunteer-skills` - 创建技能认证
- `PUT /api/volunteer-skills/:id/status` - 更新技能状态
- `GET /api/volunteer-skills/:id/audit-logs` - 获取审核记录

### 赛段排班
- `GET /api/shift-schedules` - 获取排班列表
- `POST /api/shift-schedules` - 创建排班
- `PUT /api/shift-schedules/:id/status` - 更新排班状态

### 签到签退
- `GET /api/attendance` - 获取考勤列表
- `POST /api/attendance/:id/check-in` - 签到
- `POST /api/attendance/:id/check-out` - 签退

### 物资包
- `GET /api/material-packages` - 获取物资包列表
- `POST /api/material-packages/:id/distribute` - 发放物资包
- `GET /api/material-packages/check-intercept/:volunteer_id` - 检查拦截状态

### 补贴管理
- `GET /api/subsidy-rules` - 获取补贴规则
- `GET /api/subsidy-records` - 获取补贴记录
- `POST /api/subsidy-records/callback` - 回调发放补贴（幂等）

### 异常名单
- `GET /api/exceptions` - 获取异常列表
- `POST /api/exceptions` - 创建异常
- `PUT /api/exceptions/:id/handle` - 处理异常
- `PUT /api/exceptions/:id/review` - 复核异常

### 时间线
- `GET /api/timeline/:volunteer_id` - 获取志愿者操作时间线

### 报告
- `GET /api/report/export` - 导出Excel报告
- `GET /api/audit-logs` - 获取审计日志

## 核心实现细节

### 1. 物资包拦截机制
```javascript
// 补贴发放前检查
db.get('SELECT * FROM material_packages WHERE volunteer_id = ? AND distributed = 0', 
  [volunteer_id], 
  (err, packages) => {
    if (packages) {
      // 存在未发放物资包，拦截并创建异常记录
      return res.status(400).json({ 
        error: '存在未发放物资包，已拦截补贴发放',
        intercepted: true 
      });
    }
    // 正常发放
  }
);
```

### 2. 重复回调不重复扣减
```javascript
// 通过 callback_id 实现幂等性
db.get('SELECT * FROM subsidy_records WHERE callback_id = ?', 
  [callback_id], 
  (err, existing) => {
    if (existing) {
      return res.json({ 
        success: true, 
        message: '回调已处理，不重复扣减',
        existing_record: existing 
      });
    }
    // 创建新补贴记录
  }
);
```

### 3. 修改记录留痕
```javascript
// 更新记录时记录前后值
db.get('SELECT * FROM table WHERE id = ?', [id], (err, oldRecord) => {
  // 更新操作...
  
  // 记录审计日志
  db.run('INSERT INTO audit_logs (module, record_id, field_name, old_value, new_value, operation, operator) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [moduleName, id, fieldName, oldValue, newValue, operation, operator]
  );
});
```

## 注意事项

1. 数据库文件 `volunteer.db` 会自动创建在项目根目录
2. 首次使用请先点击「初始化演示数据」
3. 前端通过 Vite 代理访问后端 API（/api -> http://localhost:5000）
4. 导出的 Excel 文件包含完整的审计记录，便于追溯

## License

MIT
