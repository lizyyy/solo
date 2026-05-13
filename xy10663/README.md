# 门诊检验预约报告系统

一个完整的全栈 Web 应用，用于管理门诊检验预约，包括异常看板、批量导入、列表筛选和导出功能。

## 功能特性

### 核心功能
- **异常看板**: 实时展示预约状态统计、异常改约记录、近7日预约趋势
- **预约列表**: 分页展示所有预约记录，支持多条件筛选
- **批量导入**: 支持 CSV/Excel 文件批量导入预约数据，提供导入模板
- **患者提醒**: 自动汇总明日需要提醒的患者，支持批量发送提醒

### 业务规则
- **空腹要求校验**: 自动检查空腹项目的采样时间是否合理
- **改约异常处理**: 改约次数超过2次自动标记为异常
- **人工调整留痕**: 所有修改操作都记录操作日志，保留修改前后值
- **状态计算**: 自动计算预约状态（未到诊等）

### 导出功能
- 支持按责任人筛选导出
- 支持按处理时间范围筛选导出
- 导出字段包含：患者信息、检验项目、空腹要求、改约次数、操作人、操作时间等

## 技术栈

### 后端
- Node.js + Express
- SQLite3 数据库（数据持久化，重启不丢失）
- multer 文件上传
- csv-parser/xlsx 解析
- json2csv 导出

### 前端
- 原生 HTML5 + JavaScript
- Tailwind CSS
- Font Awesome 图标

## 项目结构

```
xy10663/
├── backend/
│   ├── src/
│   │   ├── server.js          # 主服务入口
│   │   ├── database.js        # 数据库连接
│   │   └── routes/
│   │       ├── appointments.js # 预约API
│   │       └── import.js      # 导入API
│   ├── scripts/
│   │   ├── init-db.js         # 初始化数据库表
│   │   └── seed-data.js       # 生成演示数据
│   ├── data/                  # 数据库文件目录
│   └── package.json
└── frontend/
    ├── index.html             # 主页面
    └── app.js                 # 前端逻辑
```

## 快速开始

### 1. 后端安装与启动

```bash
cd backend
npm install

# 初始化数据库表
npm run init-db

# 生成演示数据
npm run seed-data

# 启动服务
npm start
# 或开发模式（自动重启）
npm run dev
```

后端服务将在 `http://localhost:3000` 启动。

### 2. 前端访问

直接在浏览器打开 `frontend/index.html` 文件即可。

或使用任何静态文件服务器：
```bash
cd frontend
python3 -m http.server 8080
# 然后访问 http://localhost:8080
```

## API 接口

### 预约管理
- `GET /api/appointments` - 获取预约列表（支持分页和筛选）
- `GET /api/appointments/:id` - 获取单个预约详情
- `GET /api/appointments/dashboard` - 获取看板数据
- `GET /api/appointments/abnormal` - 获取异常改约记录
- `POST /api/appointments` - 创建预约
- `PUT /api/appointments/:id` - 更新预约
- `POST /api/appointments/:id/reschedule` - 改约
- `GET /api/appointments/:id/logs` - 获取操作日志
- `GET /api/appointments/export/csv` - 导出CSV

### 提醒管理
- `GET /api/appointments/reminders/pending` - 获取明日待提醒患者
- `POST /api/appointments/reminders/send` - 批量发送提醒

### 空腹校验
- `GET /api/appointments/fasting/validate/:id` - 验证空腹要求

### 导入功能
- `POST /api/import` - 上传文件批量导入
- `GET /api/import/template` - 下载导入模板

## 数据库表结构

### appointments（预约表）
- id: 主键
- patient_id: 患者ID
- patient_name: 患者姓名
- phone: 联系电话
- lab_item: 检验项目
- lab_item_code: 项目代码
- sampling_window: 采样窗口
- fasting_required: 是否需要空腹
- fasting_hours: 空腹小时数
- appointment_date: 预约日期
- appointment_time: 预约时间
- status: 预约状态
- report_status: 报告状态
- reminder_sent: 是否已发送提醒
- reminder_count: 提醒次数
- created_at: 创建时间
- updated_at: 更新时间

### reschedule_logs（改约日志表）
- id: 主键
- appointment_id: 预约ID（外键）
- old_appointment_date: 原预约日期
- new_appointment_date: 新预约日期
- old_appointment_time: 原预约时间
- new_appointment_time: 新预约时间
- old_sampling_window: 原采样窗口
- new_sampling_window: 新采样窗口
- old_lab_item: 原检验项目
- new_lab_item: 新检验项目
- old_fasting_required: 原空腹要求
- new_fasting_required: 新空腹要求
- reason: 改约原因
- operator: 操作人
- is_abnormal: 是否异常
- abnormal_note: 异常说明
- created_at: 创建时间

### adjustment_logs（调整日志表）
- id: 主键
- appointment_id: 预约ID（外键）
- field_name: 修改字段名
- old_value: 原值
- new_value: 新值
- reason: 修改原因
- operator: 操作人
- created_at: 创建时间

### operators（操作人表）
- id: 主键
- name: 操作人姓名（唯一）
- role: 角色
- created_at: 创建时间

## 使用说明

### 看板页面
- 查看预约状态统计卡片
- 查看异常改约记录（红色高亮）
- 查看近7日预约趋势图

### 预约列表
- 支持按患者姓名、检验项目、状态、报告状态、日期范围筛选
- 支持按责任人和处理时间筛选导出
- 点击眼睛图标查看详情（含操作日志和空腹校验）
- 点击日历图标进行改约操作

### 批量导入
- 先下载模板，按模板填写数据
- 拖拽文件到上传区域或点击选择文件
- 支持 CSV 和 Excel 格式
- 导入完成后显示成功/失败统计和错误详情

### 患者提醒
- 自动展示明日需要提醒的患者
- 显示空腹要求提示
- 支持勾选患者后批量发送提醒

## 演示数据

系统已预置以下演示数据：
- 50条预约记录（包含不同状态和报告状态）
- 15条改约记录（部分标记为异常）
- 10条调整记录
- 4位操作人：张三（管理员）、李四、王五、赵六

## 注意事项

1. 数据库文件位于 `backend/data/clinic-lab.db`，SQLite 文件，重启数据不丢失
2. 上传的文件会自动解析，不会永久存储
3. 导出的 CSV 文件编码为 UTF-8 with BOM，支持 Excel 直接打开
4. 改约超过2次会自动标记为异常，在看板页面高亮显示
