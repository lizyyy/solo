# 社区乡土植物种子库后端服务

一个专为社区乡土植物种子库设计的本地后端服务，支持志愿者录入种子批次、采集地点管理、含水率检测、萌发测试追踪、冷藏柜格位管理和换种申请。

## 功能特性

- **志愿者管理**: 管理种子采集志愿者信息
- **采集地点管理**: 记录种子采集地点的位置、生境类型等信息
- **乡土植物名录**: 维护乡土植物物种信息，支持外来种识别
- **种子批次管理 (核心功能)**:
  - 录入种子批次信息（物种、采集地点、采集人、数量等）
  - 自动质量检查
  - 入库登记到冷藏格位
  - 人工复核和改判
  - 重新评估状态
- **自动质量检查**:
  - **来源缺失检查**: 检查采集地点是否存在、是否活跃，志愿者是否活跃
  - **含水率超标检查**: 检查种子含水率是否超过物种阈值（默认≤8%）
  - **萌发率过低检查**: 检查萌发率是否低于物种阈值（默认≥50%）
  - **格位容量不足检查**: 检查冷藏格位是否有可用空间
  - **外来种误放检查**: 检查物种是否为乡土种，禁止外来种入库
  - **同批次重复登记**: 检查批次号是否已存在
- **萌发测试管理**: 记录和追踪种子萌发测试结果
- **换种申请管理**:
  - 入库申请：新采集种子入库
  - 换出申请：种子出库（科研合作、种苗交换等）
  - 审核流程：自动检查后人工确认
- **人工复核**: 支持对自动评估结果进行人工改判
- **重新计算状态**: 修改相关数据后重新进行质量评估
- **导出功能**:
  - Markdown 格式保育交接单
  - JSON 格式审计包
- **审计日志**: 所有关键操作自动记录审计日志

## 技术栈

- **运行环境**: Node.js
- **Web 框架**: Express.js
- **数据库**: SQLite3 (本地文件存储)
- **日期处理**: Moment.js
- **UUID 生成**: uuid

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库和示例数据

首次运行需要创建数据目录并导入示例数据：

```bash
# 创建数据目录
mkdir -p data exports

# 运行示例数据脚本（会自动创建数据库表并插入示例数据）
node scripts/seed-data.js
```

### 3. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动。

### 开发模式

使用 nodemon 自动重启：

```bash
npm run dev
```

## API 文档

### 基础路径

所有 API 都以 `/api` 为前缀。

### 志愿者管理 (Volunteers)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/volunteers` | 获取所有志愿者列表 |
| GET | `/api/volunteers/:id` | 获取指定志愿者详情 |
| POST | `/api/volunteers` | 创建志愿者 |
| PUT | `/api/volunteers/:id` | 更新志愿者信息 |
| DELETE | `/api/volunteers/:id` | 删除志愿者 |

**请求示例 - 创建志愿者**:
```json
{
  "name": "张采集",
  "role": "采集志愿者",
  "contact": "zhang@example.com",
  "status": "活跃"
}
```

### 采集地点管理 (Collection Sites)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/collection-sites` | 获取所有采集地点列表 |
| GET | `/api/collection-sites/:id` | 获取指定采集地点详情 |
| GET | `/api/collection-sites/code/:siteCode` | 按地点编码查询 |
| POST | `/api/collection-sites` | 创建采集地点 |
| PUT | `/api/collection-sites/:id` | 更新采集地点信息 |
| DELETE | `/api/collection-sites/:id` | 删除采集地点 |

**请求示例 - 创建采集地点**:
```json
{
  "site_code": "SITE-001",
  "site_name": "北京松山自然保护区",
  "location": "北京市延庆区",
  "latitude": 40.55,
  "longitude": 115.82,
  "habitat": "山地森林",
  "elevation": 800,
  "description": "温带落叶阔叶林保护区",
  "status": "活跃"
}
```

### 冷藏柜和格位管理 (Cold Storages)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/cold-storages` | 获取所有冷藏柜列表 |
| GET | `/api/cold-storages/:id` | 获取指定冷藏柜详情 |
| GET | `/api/cold-storages/code/:cabinetCode` | 按柜号查询 |
| GET | `/api/cold-storages/slots/available` | 获取所有可用格位 |
| GET | `/api/cold-storages/slots/:slotId` | 获取指定格位详情 |
| POST | `/api/cold-storages` | 创建冷藏柜记录 |
| POST | `/api/cold-storages/:id/slots` | 批量创建格位 |
| PUT | `/api/cold-storages/:id` | 更新冷藏柜信息 |
| DELETE | `/api/cold-storages/:id` | 删除冷藏柜记录 |

**请求示例 - 创建冷藏柜**:
```json
{
  "cabinet_code": "CS-001",
  "cabinet_name": "长期冷藏柜A",
  "location": "种子库一楼A区",
  "total_slots": 50,
  "temperature": -18.0,
  "humidity": 30.0,
  "status": "正常"
}
```

**请求示例 - 批量创建格位**:
```json
{
  "slots": [
    { "slot_code": "CS-001-R1C1", "row_number": 1, "column_number": 1, "max_capacity": 10 },
    { "slot_code": "CS-001-R1C2", "row_number": 1, "column_number": 2, "max_capacity": 10 }
  ]
}
```

### 种子批次管理 (Seed Batches) - 核心功能

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/seed-batches` | 获取所有种子批次列表 |
| GET | `/api/seed-batches/:id` | 获取指定批次详情（含萌发测试） |
| GET | `/api/seed-batches/batch/:batchNumber` | 按批次号查询 |
| POST | `/api/seed-batches` | 创建种子批次（自动质量检查） |
| POST | `/api/seed-batches/:id/register` | 入库登记到格位 |
| PUT | `/api/seed-batches/:id` | 更新种子批次 |
| PUT | `/api/seed-batches/:id/override` | 人工改判评估结果 |
| PUT | `/api/seed-batches/:id/recheck` | 重新计算评估状态 |
| DELETE | `/api/seed-batches/:id` | 删除种子批次 |

#### 创建种子批次（自动质量检查）

**请求示例**:
```json
{
  "batch_number": "BATCH-2024-001",
  "species_id": 1,
  "collection_site_id": 1,
  "volunteer_id": 1,
  "collection_date": "2024-10-15",
  "quantity_grams": 500,
  "moisture_content": 6.5,
  "initial_germination_rate": 75.0,
  "storage_slot_id": 1,
  "notes": "松山保护区采集，质量优良",
  "actor": "张采集"
}
```

**自动检查项**:
1. **外来种误放**: 检查物种 native_status 字段是否为"乡土种"
2. **同批次重复登记**: 检查 batch_number 是否已存在
3. **来源缺失**:
   - 采集地点是否存在
   - 采集地点状态是否为"活跃"
   - 志愿者是否存在（如果指定）
   - 志愿者状态是否为"活跃"（如果指定）
4. **含水率超标**: 检查 moisture_content > 物种 moisture_threshold (默认8%)
5. **萌发率过低**: 检查 initial_germination_rate < 物种 germination_threshold (默认50%)
6. **格位容量不足**: 检查存储格位是否有可用空间

**响应示例 - 高风险**:
```json
{
  "id": 3,
  "batch_number": "BATCH-2024-003",
  "message": "种子批次创建成功",
  "batch_assessment": "高风险",
  "status": "待复核",
  "risks": ["含水率超标", "萌发率过低"],
  "risk_details": [
    "含水率 9.5% 超过该物种阈值 7.0%",
    "萌发率 45.0% 低于该物种阈值 50.0%"
  ]
}
```

**响应示例 - 中风险**:
```json
{
  "id": 5,
  "batch_number": "BATCH-2024-005",
  "message": "种子批次创建成功",
  "batch_assessment": "中风险",
  "status": "待确认",
  "risks": ["萌发率过低"],
  "risk_details": [
    "萌发率 35.0% 低于该物种阈值 40.0%"
  ]
}
```

**响应示例 - 正常**:
```json
{
  "id": 1,
  "batch_number": "BATCH-2024-001",
  "message": "种子批次创建成功",
  "batch_assessment": "正常",
  "status": "待入库",
  "risks": [],
  "risk_details": []
}
```

#### 入库登记

**请求示例**:
```json
{
  "storage_slot_id": 4,
  "actor": "王保管员"
}
```

#### 人工改判

如果管理员认为自动评估不准确，可以进行人工改判：

**请求示例**:
```json
{
  "override_reason": "经重新检测，实际含水率为6.8%，在阈值范围内。萌发率低是因为测试条件差异。",
  "new_assessment": "正常",
  "actor": "陈组长"
}
```

**new_assessment 选项**:
- `正常` - 评估为正常，状态变为"待入库"
- `中风险` - 评估为中风险，状态变为"待确认"
- `高风险` - 评估为高风险，状态变为"待复核"

#### 重新计算状态

修改相关数据（如含水率、萌发率）后，可以重新进行质量评估：

**请求示例**:
```json
{
  "actor": "张采集"
}
```

这会：
1. 清除之前的人工改判标记
2. 重新执行所有质量检查
3. 记录审计日志

**响应示例**:
```json
{
  "message": "重新评估完成",
  "batch_id": 3,
  "previous_assessment": "高风险",
  "new_assessment": "正常",
  "new_status": "待入库",
  "risks": [],
  "risk_details": [],
  "manual_override_cleared": true
}
```

### 萌发测试管理 (Germination Tests)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/germination-tests` | 获取所有萌发测试列表 |
| GET | `/api/germination-tests/:id` | 获取指定测试详情 |
| POST | `/api/germination-tests` | 创建萌发测试（自动更新批次萌发率） |
| PUT | `/api/germination-tests/:id` | 更新测试记录 |
| DELETE | `/api/germination-tests/:id` | 删除测试记录 |

**请求示例**:
```json
{
  "seed_batch_id": 1,
  "test_date": "2024-10-20",
  "tested_by": "刘测试",
  "seeds_planted": 100,
  "seeds_germinated": 75,
  "test_conditions": "25°C，光照12小时",
  "duration_days": 14,
  "notes": "第一次萌发测试",
  "actor": "刘测试"
}
```

**注意**: 创建或更新萌发测试时，系统会自动计算该批次所有测试的平均萌发率，并更新种子批次的 `initial_germination_rate` 字段。

### 换种申请管理 (Seed Exchanges)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/seed-exchanges` | 获取所有换种申请列表 |
| GET | `/api/seed-exchanges/:id` | 获取指定申请详情 |
| POST | `/api/seed-exchanges` | 创建换种申请 |
| PUT | `/api/seed-exchanges/:id` | 更新申请 |
| PUT | `/api/seed-exchanges/:id/approve` | 审核通过（自动质量检查） |
| PUT | `/api/seed-exchanges/:id/reject` | 驳回申请 |
| PUT | `/api/seed-exchanges/:id/execute` | 执行换种 |
| DELETE | `/api/seed-exchanges/:id` | 删除申请 |

#### 创建换种申请

**请求示例**:
```json
{
  "exchange_type": "换出",
  "seed_batch_id": 1,
  "quantity_grams": 50,
  "requestor": "北京植物园",
  "request_date": "2024-11-01",
  "purpose": "科研合作",
  "actor": "王保管员"
}
```

**exchange_type 选项**:
- `入库` - 新采集种子入库
- `换出` - 种子出库（科研、交换等）

#### 审核换种申请

审核时会自动执行质量检查：

**换出检查**:
- 批次状态是否为"已入库"
- 库存数量是否足够
- 含水率是否超标（中风险）
- 萌发率是否过低（中风险）

**入库检查**:
- 物种是否为乡土种
- 采集地点是否活跃
- 存储格位是否有空间

**请求示例 - 审核通过**:
```json
{
  "approved_by": "陈组长",
  "storage_slot_id": 5,
  "actor": "陈组长"
}
```

**响应示例 - 高风险驳回**:
```json
{
  "error": "审核未通过，存在高风险项",
  "assessment": "高风险",
  "risks": ["外来种误放"],
  "risk_details": [
    "物种 刺槐 (Robinia pseudoacacia) 为 外来种，非乡土种，禁止入库"
  ]
}
```

#### 驳回申请

**请求示例**:
```json
{
  "reject_reason": "申请数量过大，库存不足",
  "actor": "陈组长"
}
```

#### 执行换种

**请求示例**:
```json
{
  "actor": "王保管员"
}
```

### 导出功能 (Export)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/export/markdown/:batchId` | 导出 Markdown 格式保育交接单 |
| GET | `/api/export/audit/:batchId` | 导出 JSON 格式审计包 |
| GET | `/api/export/all-batches` | 获取所有批次汇总统计 |
| GET | `/api/export/statistics` | 获取种子库统计概览 |

#### Markdown 保育交接单

访问 `GET /api/export/markdown/1` 会生成包含以下内容的 Markdown 文件：

- **基本信息表格**: 批次编号、物种名称、采集地点、志愿者、入库状态、批次评估
- **人工改判信息**: 如有改判，显示改判原因和改判人
- **种子质量指标**: 含水率、萌发率、种子数量，带阈值对比和状态标识
- **冷藏存储信息**: 冷藏柜编号、位置、温度、湿度、格位编号和使用情况
- **萌发测试记录**: 所有测试详情（测试日期、测试人、播种数、萌发数、萌发率、测试条件）
- **换种记录**: 该批次的所有换种申请历史
- **风险评估详情**: 所有风险项的详细说明
- **备注**: 批次备注信息
- **操作日志**: 最近10条审计日志

文件保存在 `exports/` 目录下，命名格式：`seed-conservation-{批次号}-{时间戳}.md`

**响应示例**:
```json
{
  "message": "Markdown 保育交接单生成成功",
  "filename": "seed-conservation-BATCH-2024-001-20241104153000.md",
  "filepath": "/path/to/exports/seed-conservation-BATCH-2024-001-20241104153000.md",
  "content": "# 乡土植物种子保育交接单\n\n## 基本信息\n\n| 项目 | 内容 |\n|------|------|\n| 批次编号 | BATCH-2024-001 |\n| 物种名称 | 油松 (Pinus tabuliformis) |\n...（完整的 Markdown 内容）"
}
```

#### JSON 审计包

访问 `GET /api/export/audit/1` 会生成完整的审计数据包，包含：

- **版本信息**: 包版本和生成时间
- **批次摘要**: 批次ID、编号、状态、评估结果、创建/更新时间
- **物种信息**: 学名、俗名、乡土种状态、含水率阈值、萌发率阈值
- **采集信息**: 采集地点、坐标、生境、采集日期、志愿者信息
- **种子质量**: 数量、含水率、萌发率、状态评估
- **存储信息**: 冷藏柜信息、格位信息、使用情况
- **萌发测试历史**: 所有测试记录详情
- **换种申请历史**: 所有申请记录
- **风险分析**: 评估结果、人工改判记录、风险详情
- **完整审计日志**: 所有操作历史（操作人、时间、详情、评估结果）

文件保存在 `exports/` 目录下，命名格式：`audit-package-{批次号}-{时间戳}.json`

#### 批次汇总统计

访问 `GET /api/export/all-batches` 获取所有批次的统计概览：

```json
{
  "generated_at": "2024-11-04 15:30:00",
  "total_batches": 5,
  "status_summary": {
    "pending": 0,
    "to_confirm": 1,
    "to_review": 2,
    "in_storage": 2,
    "out_storage": 0
  },
  "assessment_summary": {
    "normal": 2,
    "medium": 1,
    "high": 2
  },
  "native_status_summary": {
    "native": 4,
    "alien": 1
  },
  "batches": [...]
}
```

#### 统计概览

访问 `GET /api/export/statistics` 获取种子库整体统计：

```json
{
  "generated_at": "2024-11-04 15:30:00",
  "species_count": 6,
  "batch_count": 5,
  "total_storage_grams": 800,
  "active_volunteers": 5,
  "cabinet_count": 4,
  "avg_germination_rate": 65.5,
  "native_distribution": [
    { "native_status": "乡土种", "count": 4 },
    { "native_status": "外来种", "count": 1 }
  ],
  "top_sites": [
    { "site_name": "北京松山自然保护区", "count": 2 },
    { "site_name": "河北小五台山", "count": 2 },
    { "site_name": "天津八仙山", "count": 1 }
  ],
  "top_species": [
    { "common_name": "油松", "count": 1 },
    { "common_name": "蒙古栎", "count": 1 },
    { "common_name": "白桦", "count": 1 },
    { "common_name": "元宝枫", "count": 1 },
    { "common_name": "刺槐", "count": 1 }
  ]
}
```

## 数据库结构

系统使用 SQLite 数据库，文件位于 `data/native-plant-seed-bank.db`。

### 主要数据表

1. **volunteers** - 志愿者信息
   - id, name, role, contact, status, created_at

2. **collection_sites** - 采集地点
   - id, site_code, site_name, location, latitude, longitude, habitat, elevation, description, status

3. **native_species** - 乡土植物名录
   - id, species_code, scientific_name, common_name, family, genus, species, native_status, conservation_status, seed_collection_season, moisture_threshold, germination_threshold, description
   - **关键字段**:
     - `native_status`: 乡土种状态（乡土种/外来种/归化种等）
     - `moisture_threshold`: 含水率阈值（默认8.0%）
     - `germination_threshold`: 萌发率阈值（默认50.0%）

4. **cold_storages** - 冷藏柜
   - id, cabinet_code, cabinet_name, location, total_slots, temperature, humidity, status, description

5. **storage_slots** - 冷藏格位
   - id, cold_storage_id, slot_code, row_number, column_number, max_capacity, current_usage, status

6. **seed_batches** - 种子批次（核心表）
   - id, batch_number, species_id, collection_site_id, volunteer_id, collection_date, quantity_grams, moisture_content, initial_germination_rate, storage_slot_id, status, batch_assessment, assessment_details, manual_override, override_reason, override_by, notes, created_at, updated_at
   - **关键字段**:
     - `status`: 状态（待入库/待确认/待复核/已入库/已出库）
     - `batch_assessment`: 评估结果（正常/中风险/高风险）
     - `assessment_details`: 风险详情（JSON数组）
     - `manual_override`: 是否人工改判
     - `override_reason`: 改判原因
     - `override_by`: 改判人

7. **germination_tests** - 萌发测试
   - id, seed_batch_id, test_date, tested_by, seeds_planted, seeds_germinated, germination_rate, test_conditions, duration_days, notes

8. **seed_exchanges** - 换种申请
   - id, exchange_number, exchange_type, seed_batch_id, quantity_grams, requestor, request_date, purpose, status, approved_by, approval_date, exchange_date, assessment_before, assessment_details, notes, created_at, updated_at

9. **audit_logs** - 审计日志
   - id, batch_id, exchange_id, action, actor, details, assessment, assessment_details, timestamp

## 示例数据说明

运行 `node scripts/seed-data.js` 会插入以下示例数据：

### 志愿者 (5条)
- 张采集 - 采集志愿者
- 李鉴定 - 种子鉴定员
- 王保管员 - 库房管理员
- 陈组长 - 项目组长
- 刘测试 - 萌发测试员

### 采集地点 (4条)
- SITE-001: 北京松山自然保护区（活跃，山地森林）
- SITE-002: 河北小五台山（活跃，高山草甸）
- SITE-003: 天津八仙山（活跃，次生林）
- SITE-004: 废弃采集点（**已关闭**，用于测试来源缺失检查）

### 物种 (6条)
- SP-001: 油松（乡土种，无危，含水率阈值8%，萌发率阈值60%）
- SP-002: 蒙古栎（乡土种，无危，含水率阈值7.5%，萌发率阈值55%）
- SP-003: 白桦（乡土种，无危，**含水率阈值7%**，**萌发率阈值50%**）
- SP-004: 元宝枫（乡土种，无危，含水率阈值8%，萌发率阈值45%）
- SP-005: 刺槐（**外来种**，入侵风险，用于测试外来种误放检查）
- SP-006: 金银忍冬（乡土种，无危，含水率阈值8.5%，**萌发率阈值40%**）

### 冷藏柜 (4条)
- CS-001: 长期冷藏柜A（正常，-18°C，湿度30%）
- CS-002: 长期冷藏柜B（正常，-18°C，湿度30%）
- CS-003: 中期冷藏柜（正常，4°C，湿度45%）
- CS-004: 待维修冷藏柜（**故障**，暂时停用）

### 冷藏格位 (30条)
- 每个冷藏柜创建10个格位，共30个
- 格式：`{柜号}-R{行号}C{列号}`，如 `CS-001-R1C1`

### 种子批次 (5条)
1. **BATCH-2024-001**: 油松 - 正常 - 已入库
   - 含水率6.5% < 阈值8% ✅
   - 萌发率75% > 阈值60% ✅
   - 格位：CS-001-R1C1

2. **BATCH-2024-002**: 蒙古栎 - 正常 - 已入库
   - 含水率7.2% < 阈值7.5% ✅
   - 萌发率65% > 阈值55% ✅
   - 格位：CS-001-R1C2

3. **BATCH-2024-003**: 白桦 - **高风险** - 待复核
   - 含水率9.5% > 阈值7% ❌（高风险）
   - 萌发率45% < 阈值50% ❌（中风险）
   - 格位：CS-001-R2C1（已占用，用于测试）

4. **BATCH-2024-004**: 刺槐 - **高风险** - 待复核
   - **外来种误放** ❌（高风险）
   - 未分配格位

5. **BATCH-2024-005**: 金银忍冬 - **中风险** - 待确认
   - 含水率8.0% = 阈值8.5% ✅
   - 萌发率35% < 阈值40% ⚠️（中风险）
   - 未分配格位

### 萌发测试 (4条)
- 测试1: BATCH-2024-001，播种100，萌发75，萌发率75%
- 测试2: BATCH-2024-001，播种100，萌发78，萌发率78%
- 测试3: BATCH-2024-002，播种50，萌发32，萌发率64%
- 测试4: BATCH-2024-003，播种100，萌发45，萌发率45%

### 换种申请 (3条)
- EX-2024-001: 换出 BATCH-2024-001，50g，北京植物园，待审核
- EX-2024-002: 入库 BATCH-2024-004，150g，王保管员，待审核（外来种，审核会失败）
- EX-2024-003: 换出 BATCH-2024-002，100g，河北林科院，已完成

### 审计日志 (9条)
- 创建种子批次 x5
- 完成换种 x1
- 入库登记 x3

## 状态和评估等级说明

### 种子批次状态

| 状态 | 说明 |
|------|------|
| 待入库 | 新创建，等待入库登记 |
| 待确认 | 评估为中风险，需要人工确认 |
| 待复核 | 评估为高风险，需要人工复核 |
| 已入库 | 已登记到冷藏格位 |
| 已出库 | 已通过换出申请出库 |

### 评估等级

| 等级 | 触发条件 |
|------|----------|
| 正常 | 无任何风险 |
| 中风险 | 仅存在"萌发率过低"、"采集地点非活跃"等非 critical 风险 |
| 高风险 | 存在外来种误放、含水率超标、来源缺失、格位容量不足、同批次重复登记 |

### 触发高风险的检查项

1. **外来种误放**: 物种 native_status 不是"乡土种"
2. **同批次重复登记**: 批次号已存在
3. **来源缺失**:
   - 采集地点不存在
   - 采集地点状态不是"活跃"
   - 志愿者不存在（如果指定）
   - 志愿者状态不是"活跃"（如果指定）
4. **含水率超标**: 含水率 > 物种阈值（默认8%）
5. **格位容量不足**: 格位已满或不存在

### 触发中风险的检查项

1. **萌发率过低**: 萌发率 < 物种阈值（默认50%）

## 自动检查流程

### 创建种子批次时

```
1. 检查物种是否存在
   └─ 不存在 → 高风险：物种信息缺失
   
2. 检查物种是否为乡土种
   └─ 非乡土种 → 高风险：外来种误放
   
3. 检查批次号是否已存在
   └─ 已存在 → 高风险：同批次重复登记
   
4. 检查采集地点
   ├─ 不存在 → 高风险：来源缺失
   └─ 非活跃 → 中风险：来源缺失
   
5. 检查志愿者（如果指定）
   ├─ 不存在 → 高风险：来源缺失
   └─ 非活跃 → 中风险：来源缺失
   
6. 检查含水率（如果提供）
   └─ > 阈值 → 高风险：含水率超标
   
7. 检查萌发率（如果提供）
   └─ < 阈值 → 中风险：萌发率过低
   
8. 检查存储格位（如果指定）
   ├─ 不存在 → 高风险：格位容量不足
   └─ 已满 → 高风险：格位容量不足
```

### 审核换种申请时

**换出申请检查**:
```
1. 检查批次状态
   └─ 非"已入库" → 高风险：批次状态异常
   
2. 检查库存数量
   └─ 库存 < 申请数量 → 高风险：库存不足
   
3. 检查含水率
   └─ > 阈值 → 中风险：含水率超标
   
4. 检查萌发率
   └─ < 阈值 → 中风险：萌发率过低
```

**入库申请检查**:
```
1. 检查物种是否为乡土种
   └─ 非乡土种 → 高风险：外来种误放
   
2. 检查采集地点
   └─ 非活跃 → 中风险：来源缺失
   
3. 检查存储格位（如果指定）
   ├─ 不存在 → 高风险：格位容量不足
   └─ 已满 → 高风险：格位容量不足
```

## 测试建议

### 测试高风险场景

1. **测试外来种误放检查**:
   - 为物种 ID 5（刺槐，外来种）创建种子批次
   - 预期结果：高风险，状态为"待复核"，风险详情包含"外来种误放"

2. **测试含水率超标检查**:
   - 为物种 ID 3（白桦，阈值7%）创建批次，设置 moisture_content = 9.5
   - 预期结果：高风险，状态为"待复核"

3. **测试来源缺失检查**:
   - 使用采集地点 ID 4（已关闭）创建批次
   - 预期结果：中风险，状态为"待确认"

4. **测试格位容量不足检查**:
   - 创建批次时使用已占用的格位，或先占用所有格位再创建
   - 预期结果：高风险

5. **测试同批次重复登记**:
   - 使用已存在的批次号 "BATCH-2024-001" 创建新批次
   - 预期结果：高风险

### 测试中风险场景

1. **测试萌发率过低检查**:
   - 为物种 ID 6（金银忍冬，阈值40%）创建批次，设置 initial_germination_rate = 35
   - 预期结果：中风险，状态为"待确认"

### 测试人工改判

1. 创建一个高风险批次（如 BATCH-2024-003）
2. 调用 `/override` 接口进行人工改判
   ```json
   {
     "override_reason": "经重新检测，实际含水率为6.8%，在阈值范围内。",
     "new_assessment": "正常",
     "actor": "陈组长"
   }
   ```
3. 检查批次状态变化和审计日志

### 测试重新计算

1. 创建一个高风险批次
2. 更新批次的含水率和萌发率到正常值
3. 调用 `/recheck` 接口
4. 验证风险评估是否更新为正常
5. 验证人工改判标记是否被清除

### 测试换种申请

1. **测试正常换出**:
   - 为 BATCH-2024-001（油松，正常）创建换出申请
   - 审核通过
   - 执行换种
   - 验证库存减少

2. **测试外来种入库审核**:
   - 为 BATCH-2024-004（刺槐，外来种）创建入库申请
   - 尝试审核通过
   - 预期结果：审核失败，提示外来种误放

3. **测试库存不足换出**:
   - 为 BATCH-2024-001 创建换出申请，数量设为 1000g（库存500g）
   - 尝试审核通过
   - 预期结果：审核失败，提示库存不足

### 测试导出功能

1. 访问 Markdown 导出接口 `GET /api/export/markdown/1`
2. 检查生成的文件内容
3. 验证审计包的完整性 `GET /api/export/audit/1`

## 目录结构

```
.
├── app.js                 # 主应用入口
├── package.json           # 项目配置
├── README.md             # 本文档
├── config/
│   └── database.js       # 数据库配置和初始化
├── routes/
│   ├── volunteers.js      # 志愿者路由
│   ├── collection-sites.js # 采集地点路由
│   ├── cold-storages.js   # 冷藏柜格位路由
│   ├── seed-batches.js    # 种子批次路由（核心）
│   ├── germination-tests.js # 萌发测试路由
│   ├── seed-exchanges.js  # 换种申请路由
│   └── export.js          # 导出功能路由
├── scripts/
│   └── seed-data.js      # 示例数据脚本
├── data/                  # 数据库文件目录（运行时创建）
└── exports/               # 导出文件目录（运行时创建）
```

## 注意事项

1. **数据持久化**: 所有数据存储在 `data/native-plant-seed-bank.db` SQLite 文件中，删除此文件将丢失所有数据。

2. **示例数据**: 每次运行 `seed-data.js` 都会追加新数据，如需重置请先删除数据库文件。

3. **日期格式**: 所有日期字段使用 ISO 格式 `YYYY-MM-DD`。

4. **审计日志**: 所有关键操作（创建批次、更新、入库、审核、人工改判、重新计算）都会记录审计日志，包含操作人、时间、详情和评估结果。

5. **阈值配置**: 每个物种可以单独配置含水率阈值和萌发率阈值，创建物种时设置 `moisture_threshold` 和 `germination_threshold` 字段。

6. **格位容量**: 每个格位的容量由 `max_capacity` 字段控制（默认10），当前使用量由 `current_usage` 字段跟踪。

7. **人工改判**: 人工改判后会设置 `manual_override = 1`，调用 `/recheck` 接口会清除此标记并重新评估。

## 许可证

MIT License
