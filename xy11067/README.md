# 托育园保健室晨检隔离 API 系统

## 项目概述

本系统为托育园保健室提供完整的晨检隔离管理API服务，支持单条人工录入和批量补录，具备兄妹同园接触史联动提醒和晨检报表一致性检查功能。

## 核心功能

### 1. 晨检管理
- ✅ 单条人工晨检录入
- ✅ 批量晨检数据导入
- ✅ 按日期查询晨检记录
- ✅ 晨检数据导出（CSV格式）

### 2. 隔离管理
- ✅ 单条隔离记录录入
- ✅ 批量隔离记录导入
- ✅ 结束隔离操作
- ✅ 活跃隔离列表查询
- ✅ 隔离记录导出

### 3. 智能提醒与校验
- ✅ **兄妹同园接触史联动提醒**：录入时自动检测同园兄弟姐妹并给出处理建议
- ✅ **晨检报表一致性检查**：自动检测数据完整性和一致性，提示需要补充的材料
- ✅ 数据合法性校验

### 4. 统计报表
- ✅ 每日晨检统计报表
- ✅ 分班级统计
- ✅ 异常情况汇总

## 技术栈

- **后端框架**: Node.js + Express
- **数据库**: SQLite
- **数据导出**: csv-writer

## 快速开始

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

### 5. 运行测试

```bash
chmod +x tests/test-api.sh
./tests/test-api.sh
```

## API 接口文档

### 健康检查

```bash
curl http://localhost:3000/api/health
```

### 晨检管理

#### 单条晨检录入

```bash
curl -X POST http://localhost:3000/api/health-check/single \
  -H "Content-Type: application/json" \
  -d '{
    "child_id": "C20240001",
    "check_date": "2024-05-18",
    "check_time": "08:10:00",
    "checker_name": "李医生",
    "body_temperature": 36.5,
    "has_fever": 0,
    "cough": 0,
    "runny_nose": 0,
    "sore_throat": 0,
    "diarrhea": 0,
    "vomiting": 0,
    "rash": 0,
    "conjunctivitis": 0,
    "hand_foot_mouth": 0,
    "spirit_status": "良好",
    "appetite_status": "良好",
    "sleep_status": "良好",
    "is_allowed_entry": 1,
    "check_result": "正常",
    "remarks": "晨检无异常"
  }'
```

**返回说明**:
- `siblingAlert`: 兄妹接触提醒（如存在兄弟姐妹）
- `consistency`: 报表一致性检查结果
- `missingMaterials`: 需要补充的材料列表

#### 批量晨检录入

```bash
curl -X POST http://localhost:3000/api/health-check/batch \
  -H "Content-Type: application/json" \
  -d '{
    "records": [
      {
        "child_id": "C20240001",
        "check_date": "2024-05-18",
        "check_time": "08:10:00",
        "checker_name": "李医生",
        "body_temperature": 36.5,
        "is_allowed_entry": 1,
        "check_result": "正常"
      }
    ]
  }'
```

#### 查询某日晨检记录

```bash
curl http://localhost:3000/api/health-check/date/2024-05-18
```

### 隔离管理

#### 单条隔离录入

```bash
curl -X POST http://localhost:3000/api/isolation/single \
  -H "Content-Type: application/json" \
  -d '{
    "child_id": "C20240002",
    "start_date": "2024-05-18",
    "start_time": "08:30:00",
    "isolation_reason": "发热37.8℃，伴咳嗽流涕",
    "isolation_type": "临时观察",
    "isolation_location": "保健室隔离间",
    "symptoms": "发热、咳嗽、流涕",
    "diagnosis": "上呼吸道感染",
    "body_temperature": 37.8,
    "guardian_notified": 1,
    "notification_method": "电话",
    "checker_name": "李医生",
    "remarks": "家长已接回"
  }'
```

#### 批量隔离录入

```bash
curl -X POST http://localhost:3000/api/isolation/batch \
  -H "Content-Type: application/json" \
  -d '{
    "records": [
      {
        "child_id": "C20240001",
        "start_date": "2024-05-18",
        "start_time": "08:30:00",
        "isolation_reason": "发热",
        "isolation_type": "居家观察",
        "checker_name": "李医生"
      }
    ]
  }'
```

#### 查询活跃隔离列表

```bash
curl http://localhost:3000/api/isolation/active
```

#### 结束隔离

```bash
curl -X PUT http://localhost:3000/api/isolation/ISO20240518001/end \
  -H "Content-Type: application/json" \
  -d '{
    "end_date": "2024-05-21",
    "end_reason": "痊愈，体温正常3天",
    "checker_name": "李医生"
  }'
```

### 数据导出

#### 导出晨检记录

```bash
curl http://localhost:3000/api/export/health-check/2024-05-18
```

**关键业务列**: 儿童编号、儿童姓名、班级、体温、晨检结果

#### 导出隔离记录

```bash
curl http://localhost:3000/api/export/isolation
```

**关键业务列**: 儿童编号、儿童姓名、班级、隔离原因、隔离状态、联系电话

#### 获取日报统计

```bash
curl http://localhost:3000/api/export/daily-report/2024-05-18
```

## 核心业务字段说明

### 儿童信息表
| 字段 | 说明 |
|------|------|
| child_id | 儿童编号 |
| name | 姓名 |
| gender | 性别 |
| birth_date | 出生日期 |
| class_name | 班级 |
| guardian_name | 监护人姓名 |
| guardian_phone | 联系电话 |
| address | 家庭住址 |
| allergies | 过敏史 |
| special_conditions | 特殊情况 |

### 晨检记录表
| 字段 | 说明 |
|------|------|
| check_id | 晨检编号 |
| child_id | 儿童编号 |
| check_date | 晨检日期 |
| check_time | 晨检时间 |
| checker_name | 晨检人员 |
| body_temperature | 体温 |
| has_fever | 是否发热 |
| cough/runny_nose/sore_throat | 咳嗽/流涕/咽痛 |
| diarrhea/vomiting | 腹泻/呕吐 |
| rash/conjunctivitis | 皮疹/结膜炎 |
| hand_foot_mouth | 手足口 |
| spirit_status | 精神状态 |
| appetite_status | 食欲状态 |
| sleep_status | 睡眠状态 |
| is_allowed_entry | 是否允许入园 |
| check_result | 晨检结果 |

### 隔离记录表
| 字段 | 说明 |
|------|------|
| isolation_id | 隔离编号 |
| child_id | 儿童编号 |
| check_id | 关联晨检编号 |
| start_date/start_time | 隔离开始时间 |
| end_date/end_time | 隔离结束时间 |
| isolation_reason | 隔离原因 |
| isolation_type | 隔离类型 |
| isolation_location | 隔离地点 |
| symptoms | 症状 |
| diagnosis | 诊断 |
| guardian_notified | 是否已通知家长 |
| is_ended | 是否已结束 |

## 兄妹接触史联动提醒

当录入晨检或隔离记录时，系统会自动检测该儿童是否有兄弟姐妹同在园所：

**触发条件**: 儿童存在兄弟姐妹关系且共同居住

**返回信息**:
- 兄弟姐妹姓名和班级
- 建议操作：
  1. 立即排查兄妹当日接触史
  2. 补充兄妹晨检记录
  3. 评估是否需要同步隔离观察
  4. 记录同住接触情况说明

## 报表一致性检查

系统自动检查晨检记录的完整性和一致性：

**检查项**:
- 晨检人员签名是否缺失
- 体温测量记录是否缺失
- 精神/食欲/睡眠状态评估是否完整
- 发热标记与体温值是否一致
- 隔离结果是否对应隔离记录
- 家长通知记录是否完整

**返回信息**:
- 不一致项列表
- 缺失材料列表
- 下一步操作建议

## 目录结构

```
.
├── src/
│   ├── server.js              # 主服务入口
│   ├── database.js            # 数据库连接
│   ├── routes/
│   │   ├── healthCheck.js     # 晨检管理路由
│   │   ├── isolation.js       # 隔离管理路由
│   │   └── export.js          # 导出功能路由
│   ├── services/
│   │   └── validationService.js  # 验证服务（兄妹提醒、一致性检查）
│   └── scripts/
│       ├── init-db.js         # 数据库初始化脚本
│       └── seed-data.js       # 样例数据脚本
├── data/                      # 数据库文件目录
├── exports/                   # 导出文件目录
├── tests/
│   └── test-api.sh            # API测试脚本
├── package.json
└── README.md
```

## 样例数据

系统预置5名儿童的样例数据，其中包含1对兄弟姐妹（C20240001张小明和C20240002张小美），可用于测试兄妹接触提醒功能。

## 注意事项

1. 晨检结果可选值：正常、观察、隔离、接回、送医
2. 隔离类型可选值：医学隔离、居家观察、班级隔离、临时观察
3. 通知方式可选值：电话、微信、短信、书面
4. 精神/食欲/睡眠状态可选值：良好、一般、较差

## 完整测试流程

执行以下命令可体验完整闭环：

```bash
# 1. 安装依赖
npm install

# 2. 初始化数据库
npm run init-db

# 3. 导入样例数据
npm run seed-data

# 4. 启动服务
npm start

# 5. 新开终端，运行测试脚本
cd /path/to/project
./tests/test-api.sh
```
