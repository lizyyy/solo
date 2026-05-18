# 校园宿舍维修队宿舍维修合并 API

基于 Node.js + Express 的校园宿舍维修记录管理系统，专注于维修记录合并、异常处理和班组交接复核流程。

## 功能特性

### 核心功能
- ✅ **维修记录CRUD** - 完整的报修记录管理
- ✅ **记录合并功能** - 同寝室多条报修合并处理
- ✅ **CSV导入导出** - 批量数据处理
- ✅ **周报统计** - 按时间段统计维修数据

### 异常处理重点
- ✅ **同寝室重复报修冲突检测** - 防止不同队伍接同寝室报修
- ✅ **版本控制机制** - 禁止静默覆盖，支持乐观锁
- ✅ **跨周合并警告** - 周报统计一致性保障

### 班组交接复核口径
- 📝 **临时改动** - 现场紧急处理记录
- ✅ **负责人确认** - 队长审核确认
- 📦 **最终归档** - 管理员完成结案存档

## 快速开始

### 环境要求
- Node.js >= 16.0.0
- npm 或 yarn

### 安装依赖
```bash
npm install
```

### 初始化样例数据
```bash
npm run init
```

### 启动服务
```bash
npm start
```
服务将在 http://localhost:3000 启动

### 运行完整测试流程
```bash
npm test
```

## API 接口文档

### 基础信息
- 基础URL: `http://localhost:3000/api/v1`
- 数据格式: JSON
- 字符编码: UTF-8

### 健康检查
```bash
GET /health
```

### 维修记录接口

#### 1. 查询维修记录列表
```bash
GET /api/v1/repair-records
```

**查询参数:**
- `building` - 宿舍楼号
- `roomNumber` - 房间号
- `status` - 状态 (pending/in_progress/merged/completed)
- `assignedTeam` - 分配队伍

#### 2. 创建维修记录
```bash
POST /api/v1/repair-records
Content-Type: application/json

{
  "building": "3号楼",
  "roomNumber": "302",
  "repairType": "水电",
  "description": "水龙头漏水",
  "reporter": "张三",
  "reporterPhone": "13800138000",
  "assignedTeam": "水电维修一组",
  "priority": "high"
}
```

#### 3. 合并维修记录
```bash
POST /api/v1/repair-records/merge
Content-Type: application/json

{
  "recordIds": ["RR1234567890000", "RR1234567890001"],
  "primaryRecordId": "RR1234567890000",
  "mergeOperator": "管理员",
  "mergeReason": "同寝室多条报修合并处理"
}
```

**错误码说明:**
- `DORM_TEAM_CONFLICT` - 同寝室记录被分给不同队伍，无法合并
- `VERSION_CONFLICT` - 记录已被他人修改
- `INVALID_MERGE_REQUEST` - 合并请求参数错误

#### 4. 班组交接复核（三阶段）
```bash
POST /api/v1/repair-records/{id}/review
Content-Type: application/json

{
  "stage": "temporary_change",
  "operator": "李师傅",
  "operatorRole": "维修员",
  "changes": { "original": "...", "temporary": "..." },
  "comments": "备注说明",
  "confirmationSignature": "操作员签名标识"
}
```

**stage 可选值:**
- `temporary_change` - 临时改动
- `manager_confirm` - 负责人确认
- `final_archive` - 最终归档

#### 5. 导入维修记录
```bash
POST /api/v1/repair-records/import
Content-Type: application/json

{
  "records": [
    {
      "building": "1号楼",
      "roomNumber": "101",
      "repairType": "水电",
      "description": "灯不亮",
      "reporter": "学生A"
    }
  ],
  "dryRun": false,
  "importOperator": "管理员"
}
```

#### 6. 导出CSV
```bash
GET /api/v1/repair-records/export/csv
```

#### 7. 周报统计
```bash
GET /api/v1/repair-records/report/weekly?weekStart=2024-05-01&weekEnd=2024-05-07
```

### 维修队伍接口

```bash
# 查询所有队伍
GET /api/v1/repair-teams

# 创建队伍
POST /api/v1/repair-teams
{
  "name": "水电维修三组",
  "leader": "王师傅",
  "members": ["赵师傅", "钱师傅"],
  "buildingArea": ["7号楼", "8号楼"]
}

# 班组交接
POST /api/v1/repair-teams/{id}/handover
{
  "toTeam": "水电维修二组",
  "handoverRecords": ["RR123...", "RR456..."],
  "operator": "张队长",
  "remarks": "人员调整交接"
}
```

## 测试用例（验收标准）

### 📌 用例1: 正常记录合并
- **场景**: 3号楼302宿舍两条报修（水龙头+日光灯）都分配给水电维修一组
- **操作**: 执行合并
- **预期**: 合并成功，生成合并历史记录

### 📌 用例2: 冲突记录（同寝室不同队伍）
- **场景**: 3号楼302宿舍空调遥控器报修分配给水电维修二组
- **操作**: 尝试与另外两条记录合并
- **预期**: 返回 `DORM_TEAM_CONFLICT` 错误，提示先统一分配队伍

### 📌 用例3: 导入坏行
- **场景**: 导入数据中包含缺少必填字段的记录
- **操作**: 执行批量导入
- **预期**: 部分成功部分失败，返回详细的成功/失败行号和原因

## 数据存储

数据以JSON文件本地存储在 `src/data/` 目录:
- `repair-records.json` - 维修记录
- `repair-teams.json` - 维修队伍

## 错误响应格式

```json
{
  "status": "error",
  "errorCode": "DORM_TEAM_CONFLICT",
  "message": "同寝室重复报修被分给不同维修队伍，无法直接合并",
  "details": {
    "conflicts": [...],
    "resolution": "请先统一分配队伍后再进行合并操作"
  },
  "timestamp": "2024-05-15T10:00:00.000Z",
  "path": "/api/v1/repair-records/merge"
}
```

## 目录结构

```
.
├── src/
│   ├── models/          # 数据模型
│   │   ├── RepairRecord.js
│   │   └── RepairTeam.js
│   ├── routes/          # API路由
│   │   ├── repairRecords.js
│   │   └── repairTeams.js
│   ├── middleware/      # 中间件
│   │   └── errorHandler.js
│   ├── utils/           # 工具函数
│   │   └── mergeValidator.js
│   ├── scripts/         # 脚本
│   │   ├── init-data.js
│   │   └── test-flow.js
│   ├── data/            # 数据存储
│   └── server.js        # 服务入口
├── package.json
└── README.md
```
