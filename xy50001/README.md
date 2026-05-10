# 春秋游安全放行台

一个面向班主任和年级组的本地 Web 应用，用于管理春秋游等集体活动的学生安全信息。

## 功能特性

### 核心功能
- **学生管理**: 增删改查学生信息，按班级分类
- **健康标签**: 记录过敏、疾病、特殊需求等健康信息
- **活动方案**: 创建和管理春游/秋游活动，配置车辆、老师和座位分配
- **风险检测**: 自动检测未授权、有禁忌、未分配座位的学生
- **人工改判**: 支持对风险项进行人工放行，并记录改判原因
- **数据导入**: 支持 CSV 和 JSON 格式的批量导入
- **清单导出**: 
  - 出发清单（Markdown/CSV）：按车辆分组的学生名单
  - 风险清单（Markdown/CSV）：问题学生列表
  - 家长确认单（Markdown/CSV）：给家长签字确认的清单

### 数据库模型
- `students`: 学生基本信息
- `consents`: 家长同意书
- `health_tags`: 健康标签（过敏、疾病等）
- `teachers`: 带队老师
- `vehicles`: 车辆信息
- `activities`: 活动方案
- `activity_vehicles`: 活动-车辆关联
- `activity_assignments`: 学生座位分配
- `risk_overrides`: 风险人工改判记录

## 环境要求

- Node.js >= 18.0.0
- npm 或 yarn

## 本地启动

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3001` 启动

### 3. 访问应用

打开浏览器访问: http://localhost:3001

## 快速验证流程

### 步骤 1: 导入示例数据

1. 启动应用后，点击顶部导航的 **导入** 标签
2. 点击 **导入示例数据** 按钮
3. 确认导入，系统会添加预设的学生、老师、车辆和健康标签数据

或者也可以使用 `samples/` 目录下的示例文件手动导入：
- `students.csv` - 学生名单
- `teachers.csv` - 老师名单  
- `vehicles.csv` - 车辆信息
- `full_data.json` - 包含所有数据的综合 JSON

### 步骤 2: 创建活动方案

1. 点击 **活动方案** 标签
2. 点击 **创建活动** 按钮
3. 填写活动信息：
   - 活动名称：如 "2024年春季春游 - 白云山"
   - 活动类型：春游/秋游
   - 日期：选择日期
   - 集合点：如 "学校正门"
4. 点击 **保存**

### 步骤 3: 分配车辆和学生

1. 在活动列表中，点击活动的 **管理** 按钮
2. 勾选要使用的车辆，并为每辆车选择带队老师
3. 从学生列表中选择要参加活动的学生（按住 Ctrl/Cmd 可多选）
4. 点击 **保存分配**

### 步骤 4: 风险检测

1. 点击 **风险检测** 标签
2. 选择要检测的活动
3. 点击 **检测风险** 按钮
4. 系统会列出以下风险类型：
   - 🔴 未授权（高风险）：未提交家长同意书
   - 🟡 健康禁忌（中风险）：有过敏或疾病标签
   - 🟡 未分配（中风险）：未分配车辆座位

5. 如需人工改判：
   - 勾选 **人工改判放行** 复选框
   - 填写改判原因（可选）
   - 系统会自动保存，刷新页面也不会丢失

### 步骤 5: 导出清单

1. 点击 **导出** 标签
2. 选择要导出的活动
3. 点击对应类型的导出按钮：

**出发清单**
- 包含：车辆信息、司机、带队老师、学生座位分配
- 适合：出发前司机和老师核对人数

**风险清单**
- 包含：所有风险学生列表
- 适合：年级组核对重点关注对象

**家长确认单**
- 包含：学生车辆信息、座位号、带队老师
- 适合：打印出来给家长签字确认

## 数据文件说明

### SQLite 数据库

应用使用 SQLite 本地数据库，文件名为 `data.db`，首次运行时自动创建。

- **位置**: 项目根目录下的 `data.db`
- **备份**: 直接复制此文件即可备份所有数据
- **重置**: 删除 `data.db` 文件重新启动应用即可重置

### 示例数据

`samples/` 目录包含可直接使用的示例数据：

| 文件 | 内容 |
|------|------|
| students.csv | 10 名示例学生，来自 3 个班级 |
| teachers.csv | 5 名老师，包含年级组长和班主任 |
| vehicles.csv | 4 辆大巴，含司机信息 |
| full_data.json | 完整的综合示例数据 |

### CSV 导入格式

#### 学生名单 (students)
```csv
name,student_id,class_name,gender,phone,parent_phone
张三,2023001,初一(1)班,男,13800138001,13900139001
```

#### 老师名单 (teachers)
```csv
name,phone,role
王老师,13700137001,年级组长
```

#### 车辆信息 (vehicles)
```csv
plate_number,capacity,driver_name,driver_phone
粤A12345,45,陈师傅,13600136001
```

#### 同意书 (consents)
```csv
student_id,activity_id,status,signed_by
1,1,approved,张父
```

#### 健康标签 (health)
```csv
student_id,tag_type,tag_value,severity
1,allergy,花生过敏,high
```

### JSON 导入格式

```json
{
  "students": [
    {"name": "张三", "student_id": "2023001", "class_name": "初一(1)班", ...}
  ],
  "teachers": [...],
  "vehicles": [...],
  "activities": [...],
  "health_tags": [...],
  "consents": [...]
}
```

## API 接口

### 学生管理
- `GET /api/students` - 获取学生列表（支持 class_name, activity_id 查询参数）
- `POST /api/students` - 添加学生
- `PUT /api/students/:id` - 更新学生
- `DELETE /api/students/:id` - 删除学生

### 活动管理
- `GET /api/activities` - 获取活动列表
- `POST /api/activities` - 创建活动
- `GET /api/activities/:id` - 获取活动详情
- `PUT /api/activities/:id` - 更新活动（含车辆和学生分配）

### 风险检测
- `GET /api/risk/:activity_id` - 获取活动风险列表
- `POST /api/risk/override` - 设置人工改判

### 导出
- `GET /api/export/departure/:activity_id` - 出发清单数据
- `GET /api/export/risk/:activity_id` - 风险清单数据
- `GET /api/export/parent-confirm/:activity_id` - 家长确认单数据

### 导入
- `POST /api/import/csv` - CSV 导入（需要 type 和 file 字段）
- `POST /api/import/json` - JSON 导入

## 项目结构

```
├── public/              # 前端静态文件
│   ├── css/
│   │   └── style.css    # 样式文件
│   ├── js/
│   │   └── app.js       # 前端业务逻辑
│   └── index.html       # 主页面
├── samples/             # 示例数据文件
│   ├── students.csv
│   ├── teachers.csv
│   ├── vehicles.csv
│   └── full_data.json
├── temp/                # 临时上传文件目录
├── database.js          # SQLite 数据库层
├── server.js            # Express 服务器
├── package.json         # 项目依赖
└── data.db              # SQLite 数据库（自动生成）
```

## 常见问题

### 1. 数据会丢失吗？
不会。所有数据都保存在本地 `data.db` 文件中，刷新页面或重启服务器都不会丢失。

### 2. 如何重置数据？
停止服务器，删除 `data.db` 文件，然后重新启动即可。

### 3. 可以在多台电脑使用吗？
可以。复制 `data.db` 文件到另一台电脑的项目目录即可。

### 4. 如何添加家长同意书？
目前通过 CSV 导入 `consents` 类型的数据来记录家长同意状态。后续版本可能会增加界面操作。

### 5. 健康标签有哪些类型？
- `allergy` - 过敏
- `disease` - 疾病
- `special` - 特殊需求
- `other` - 其他

## 技术栈

- **后端**: Node.js + Express
- **数据库**: SQLite (better-sqlite3)
- **前端**: 原生 HTML/CSS/JavaScript（无框架依赖，加载快）
- **文件上传**: multer

## License

MIT
