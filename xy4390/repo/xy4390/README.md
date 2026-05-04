# 社区药箱用药提醒系统

一个为社区药箱志愿小组设计的用药提醒和补药交接管理系统。

## 功能特性

### 核心功能

1. **老人管理** - 管理需要服药提醒的老人信息
   - 姓名、年龄、房间号
   - 联系电话、紧急联系人
   - 健康状况备注

2. **药品管理** - 管理药箱中的药品信息
   - 药品名称、规格
   - 生产厂家、分类
   - 药品描述

3. **服药计划管理** - 制定和管理老人的服药计划
   - 选择老人和药品
   - 设置剂量、服药时间
   - 设置频率（每天/工作日/周末）
   - 设置开始和结束日期
   - 激活/停用状态

4. **今日服药清单** - 查看和管理当日服药任务
   - 生成当日提醒记录
   - 查看待处理、已提醒、漏服统计
   - 标记提醒状态（已提醒/漏服）
   - 记录志愿者姓名和备注

5. **库存管理** - 管理药品库存
   - 查看当前库存和预警阈值
   - 低库存预警提醒
   - 增加/减少库存
   - 设置预警阈值

6. **补药任务** - 处理库存不足的药品
   - 自动检测低库存并创建任务
   - 查看待处理和已完成任务
   - 分配志愿者
   - 标记任务完成并更新库存

7. **交接记录** - 记录志愿者之间的药品交接
   - 记录交接人、接收人
   - 记录交接数量
   - 记录交接时间和备注

8. **数据导出** - 导出老人服药记录
   - 按老人选择导出
   - 导出近7天的提醒记录
   - 显示异常率统计
   - 支持 CSV 格式下载

### 技术特性

- **后端**: Node.js + Express + SQLite
- **前端**: 原生 HTML/CSS/JavaScript
- **数据库**: SQLite（无需单独安装数据库服务器）
- **API**: RESTful 接口设计

## 项目结构

```
xy4390/
├── backend/                 # 后端代码
│   ├── app.js              # 主应用入口
│   ├── database.js         # 数据库配置和初始化
│   ├── package.json        # 依赖配置
│   ├── routes/             # API 路由
│   │   ├── elderly.js      # 老人管理
│   │   ├── medicines.js    # 药品管理
│   │   ├── plans.js        # 服药计划
│   │   ├── inventory.js    # 库存管理
│   │   ├── handover.js     # 交接记录
│   │   ├── reminders.js    # 提醒记录
│   │   └── replenish.js    # 补药任务
│   ├── seeders/            # 种子数据
│   │   └── seed.js         # 测试数据
│   └── data/               # 数据库文件目录
│       └── medication.db   # SQLite 数据库（运行后生成）
├── frontend/               # 前端代码
│   ├── index.html          # 主页面
│   ├── css/
│   │   └── style.css       # 样式文件
│   └── js/
│       └── app.js          # 前端逻辑
└── README.md               # 本文档
```

## 快速开始

### 环境要求

- Node.js (推荐 v16+)
- npm 或 yarn

### 安装步骤

1. **进入后端目录并安装依赖**

```bash
cd backend
npm install
```

2. **（可选）填充种子数据**

```bash
npm run seed
```

这会向数据库中添加：
- 5 位老人
- 8 种药品
- 12 条服药计划
- 8 条库存记录
- 21 条历史提醒记录
- 3 条交接记录
- 3 条补药任务

3. **启动服务器**

```bash
npm start
```

或者使用开发模式（自动重启）：

```bash
npm run dev
```

4. **访问系统**

打开浏览器访问：http://localhost:3000

## API 接口文档

### 老人管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/elderly | 获取所有老人 |
| GET | /api/elderly/:id | 获取单个老人 |
| POST | /api/elderly | 创建老人 |
| PUT | /api/elderly/:id | 更新老人 |
| DELETE | /api/elderly/:id | 删除老人 |

### 药品管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/medicines | 获取所有药品 |
| GET | /api/medicines/:id | 获取单个药品 |
| POST | /api/medicines | 创建药品 |
| PUT | /api/medicines/:id | 更新药品 |
| DELETE | /api/medicines/:id | 删除药品 |

### 服药计划

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/plans | 获取所有计划 |
| GET | /api/plans/today | 获取今日计划 |
| GET | /api/plans/:id | 获取单个计划 |
| POST | /api/plans | 创建计划 |
| PUT | /api/plans/:id | 更新计划 |
| DELETE | /api/plans/:id | 删除计划 |

### 库存管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/inventory | 获取所有库存 |
| GET | /api/inventory/low-stock | 获取低库存预警 |
| GET | /api/inventory/:id | 获取单个库存 |
| POST | /api/inventory | 创建库存 |
| PUT | /api/inventory/:id | 更新库存 |
| POST | /api/inventory/:id/add | 增加库存 |
| POST | /api/inventory/:id/remove | 减少库存 |

### 提醒记录

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/reminders | 获取所有提醒（支持筛选） |
| GET | /api/reminders/today | 获取今日提醒 |
| GET | /api/reminders/:id | 获取单个提醒 |
| POST | /api/reminders | 创建提醒 |
| POST | /api/reminders/:id/reminded | 标记已提醒 |
| POST | /api/reminders/:id/missed | 标记漏服 |
| GET | /api/reminders/export/elderly/:id | 导出老人近7天记录 |

### 补药任务

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/replenish | 获取所有任务 |
| GET | /api/replenish/pending | 获取待处理任务 |
| GET | /api/replenish/:id | 获取单个任务 |
| POST | /api/replenish | 创建任务 |
| POST | /api/replenish/auto-create | 自动创建任务 |
| PUT | /api/replenish/:id | 更新任务 |
| POST | /api/replenish/:id/complete | 完成任务 |
| DELETE | /api/replenish/:id | 删除任务 |

### 交接记录

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/handover | 获取所有记录 |
| GET | /api/handover/:id | 获取单个记录 |
| POST | /api/handover | 创建记录 |
| PUT | /api/handover/:id | 更新记录 |
| DELETE | /api/handover/:id | 删除记录 |

## 使用说明

### 日常工作流程

1. **早上上班**
   - 打开「今日服药」页面
   - 点击「生成今日提醒」按钮
   - 查看今日需要提醒的服药清单

2. **服药提醒**
   - 按照时间顺序执行提醒
   - 完成后点击「标记状态」
   - 选择「已提醒」或「漏服」
   - 填写志愿者姓名和备注

3. **库存检查**
   - 定期查看「库存管理」页面
   - 关注低库存警告
   - 点击「检查低库存」进行排查

4. **补药处理**
   - 在「补药任务」页面查看待处理任务
   - 点击「自动创建补药任务」自动生成
   - 完成补药后点击「完成」
   - 系统会自动更新库存

5. **数据导出**
   - 进入「数据导出」页面
   - 选择需要导出的老人
   - 点击「导出数据」查看结果
   - 点击「下载 CSV」保存文件

### 数据状态说明

#### 提醒状态

- **待处理 (pending)**: 提醒尚未执行
- **已提醒 (reminded)**: 已成功提醒老人服药
- **漏服 (missed)**: 未能及时提醒或老人漏服

#### 库存状态

- **正常**: 库存数量 > 预警阈值
- **库存不足**: 库存数量 <= 预警阈值

#### 补药任务状态

- **待处理 (pending)**: 任务尚未完成
- **已完成 (completed)**: 补药已完成，库存已更新

## 数据库表结构

### 主要数据表

1. **elderly** (老人表)
   - id, name, age, room, phone, emergency_contact, notes

2. **medicines** (药品表)
   - id, name, specification, manufacturer, category, description

3. **medication_plans** (服药计划表)
   - id, elderly_id, medicine_id, dosage, time, frequency, start_date, end_date, status, notes

4. **inventory** (库存表)
   - id, medicine_id, quantity, threshold, unit, last_updated, notes

5. **reminder_records** (提醒记录表)
   - id, plan_id, elderly_id, medicine_id, scheduled_time, actual_time, status, volunteer_name, notes

6. **replenish_tasks** (补药任务表)
   - id, medicine_id, current_quantity, required_quantity, status, assigned_to, completed_at, notes

7. **handover_records** (交接记录表)
   - id, medicine_id, from_volunteer, to_volunteer, quantity, handover_time, notes

## 注意事项

1. **数据安全**: 本系统使用本地 SQLite 数据库，请定期备份 `backend/data/medication.db` 文件

2. **首次使用**: 
   - 需要先添加老人、药品信息
   - 然后创建服药计划
   - 每天生成当日提醒

3. **库存预警**: 
   - 默认预警阈值为 10 盒/瓶
   - 可在库存管理页面调整
   - 低于阈值时会自动显示警告

4. **导出功能**:
   - 导出格式为 CSV，可用 Excel 打开
   - 只导出近 7 天的数据
   - 包含异常率统计

## 开发说明

如需修改或扩展系统：

1. **后端 API**: 在 `backend/routes/` 目录下修改对应路由文件
2. **前端界面**: 修改 `frontend/` 目录下的 HTML、CSS、JS 文件
3. **数据库结构**: 修改 `backend/database.js` 中的表定义
4. **种子数据**: 修改 `backend/seeders/seed.js`

## 许可证

本项目仅供学习和内部使用。
