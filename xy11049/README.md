# 园艺养护队巡检管理系统

## 项目概述

本系统专为园艺养护队设计，提供巡检记录的导入、查询、冲突检测和导出功能，重点解决：
- 同一绿植多次复发问题未升级处理
- 巡检看板数据一致性
- 禁止静默覆盖原有记录

## 技术栈

- Node.js + Express
- SQLite 本地持久化
- CSV 导入导出

## 安装和启动

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

### 3. 运行验收测试

```bash
npm test
```

### 4. 启动服务

```bash
npm start
# 开发模式
npm run dev
```

服务运行在 http://localhost:3000

## API 接口文档

### 1. 系统健康检查

```
GET /api/health
```

### 2. 查询巡检记录列表

```
GET /api/inspections
```

查询参数：
- `team_code`: 养护队编号
- `plant_code`: 绿植编号
- `start_date`: 开始日期
- `end_date`: 结束日期
- `record_status`: 记录状态
- `has_conflicts`: 是否只查询有冲突的记录 (true/false)
- `limit`: 返回数量限制

### 3. 查询单条巡检记录详情

```
GET /api/inspections/:id
```

### 4. 查询记录操作历史

```
GET /api/inspections/:id/history
```

### 5. 创建巡检记录

```
POST /api/inspections
Content-Type: application/json

{
    "record_no": "INS-20240518-001",
    "team_code": "TEAM-001",
    "plant_code": "PLANT-E001",
    "inspector_name": "巡检员姓名",
    "inspection_date": "2024-05-18",
    "inspection_time": "09:30:00",
    "weather_condition": "晴",
    "temperature": 25.5,
    "plant_health_status": "健康",
    "issue_type": "病虫害-叶斑病",
    "issue_description": "问题描述",
    "issue_severity": "严重",
    "recurrence_count": 2,
    "upgrade_flag": false,
    "treatment_measure": "处理措施",
    "treatment_person": "处理人",
    "follow_up_date": "2024-05-20",
    "record_status": "待处理",
    "operator": "操作人员"
}
```

### 6. 更新巡检记录

```
PUT /api/inspections/:id
Content-Type: application/json

{
    "record_status": "已完成",
    "board_sync_status": "已同步",
    "force_update": false,
    "operator": "操作人员"
}
```

注意：如果存在严重冲突，需要设置 `force_update=true` 才能强制更新。

### 7. 导出巡检报表

```
GET /api/inspections/export/report
```

支持与列表接口相同的筛选参数。

### 8. CSV 批量导入

```
POST /api/inspections/import/csv
Content-Type: multipart/form-data

file: [CSV文件]
operator: "操作人员"
```

CSV 文件支持的列名（中英文均可）：
- 记录编号 / record_no
- 养护队编号 / team_code
- 绿植编号 / plant_code
- 巡检人员 / inspector_name
- 巡检日期 / inspection_date
- 巡检时间 / inspection_time
- 天气 / weather_condition
- 温度 / temperature
- 健康状态 / plant_health_status
- 问题类型 / issue_type
- 问题描述 / issue_description
- 严重程度 / issue_severity
- 复发次数 / recurrence_count
- 是否升级 / upgrade_flag
- 处理措施 / treatment_measure
- 处理人 / treatment_person
- 跟进日期 / follow_up_date
- 记录状态 / record_status

## 验收测试数据

测试数据文件位于 `tests/test_data/inspection_test.csv`，包含三条记录：

1. **正常记录** (INS-TEST-NORMAL-001)：标准巡检记录，无冲突
2. **冲突记录** (INS-TEST-CONFLICT-001)：同一绿植叶斑病复发2次但未升级，严重且未同步看板
3. **坏行记录** (INS-TEST-BADROW-001)：养护队编号无效，字段缺失

## 冲突检测规则

### 1. 同一绿植多次复发未升级

- 检测条件：同一绿植、同一问题类型、30天内、复发次数≥2次、未标记升级
- 严重级别：高
- 处理方式：阻塞操作，除非强制更新

### 2. 看板一致性问题

- 检测条件：记录状态为"待升级"但看板状态为"未同步"
- 严重级别：中
- 处理方式：记录历史，提示用户

### 3. 记录编号重复

- 检测条件：record_no 已存在
- 严重级别：高
- 处理方式：阻塞操作

### 4. 字段验证

- 检测条件：必填字段缺失
- 严重级别：中
- 处理方式：记录历史，提示用户

## 数据模型

### maintenance_teams（养护队）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| team_code | VARCHAR(20) | 养护队编号（唯一） |
| team_name | VARCHAR(100) | 养护队名称 |
| leader_name | VARCHAR(50) | 负责人姓名 |
| leader_phone | VARCHAR(20) | 负责人电话 |
| responsible_area | TEXT | 负责区域 |

### green_plants（绿植）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| plant_code | VARCHAR(50) | 绿植编号（唯一） |
| plant_name | VARCHAR(100) | 绿植名称 |
| plant_type | VARCHAR(50) | 绿植类型 |
| location_area | VARCHAR(100) | 所在区域 |
| location_detail | TEXT | 详细位置 |
| planting_date | DATE | 种植日期 |
| maintenance_level | VARCHAR(20) | 养护级别 |
| status | VARCHAR(20) | 当前状态 |

### inspection_records（巡检记录）

核心表，包含完整巡检字段。

## 目录结构

```
.
├── src/
│   ├── server.js              # 服务入口
│   ├── database/
│   │   ├── db.js             # 数据库连接
│   │   └── schema.sql        # 表结构定义
│   ├── scripts/
│   │   ├── initDB.js         # 数据库初始化脚本
│   │   └── initData.js       # 初始化数据
│   ├── services/
│   │   ├── conflictService.js # 冲突检测服务
│   │   └── inspectionService.js # 巡检业务服务
│   ├── routes/
│   │   └── inspectionRoutes.js # API 路由
│   └── tests/
│       └── acceptance.js     # 验收测试
├── tests/
│   └── test_data/
│       └── inspection_test.csv # 测试CSV数据
├── data/                      # SQLite 数据库文件
├── exports/                   # 导出文件目录
├── uploads/                   # 上传文件临时目录
├── package.json
└── README.md
```
