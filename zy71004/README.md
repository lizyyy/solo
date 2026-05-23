# 博物馆借展品况 API

## 项目概述

博物馆外借展品回馆时，策展、运输和保险三方都留了照片，但划痕责任总说不清。本服务提供完整的品况版本管理、照片证据链、责任状态机、重复登记幂等、结论导出等功能。

## 技术栈

- **Go 1.20+** - REST API 服务
- **SQLite3** - 本地持久化存储
- **标准库 net/http** - HTTP 服务

## 核心设计

### 数据模型

#### 1. 主记录 (exhibit_records)
- 展品编号、借展合同
- 当前版本号、责任状态
- 最终结论、处理人信息
- 幂等键 (防止重复登记)

#### 2. 品况版本 (condition_versions)
- 多版本品况记录（出馆、运输节点、回馆等）
- 检查点、检查时间、品况描述
- 划痕信息、保险备注
- 前版本关联（形成版本链）
- 变更摘要

#### 3. 照片证据 (photo_evidences)
- 照片哈希、URL
- 提供方（策展/运输/保险）
- 照片时间（可缺失）、时间验证标记
- 版本关联（证据链）

#### 4. 版本差异 (version_diffs)
- 字段级变更记录
- 新旧值对比
- 变更人、变更时间

#### 5. 责任结论 (liability_conclusions)
- 责任方、理由、置信度
- 状态、复核人、复核时间
- 复核意见

#### 6. 操作日志 (operation_logs)
- 完整操作审计
- 前后状态对比
- 操作人、备注

### 责任状态机

```
pending → imported → validated → processing → confirmed → closed
              ↓          ↓            ↓          ↓
           rejected    disputed    disputed   disputed
              ↓          ↓            ↓          ↓
            (revoked)  (revoked)   (revoked)   (revoked)
```

状态转换规则：
- **pending (待处理)** → imported, revoked
- **imported (已导入)** → validated, rejected, revoked
- **validated (已校验)** → processing, disputed, revoked
- **processing (处理中)** → confirmed, disputed, revoked
- **disputed (有异议)** → processing, confirmed, rejected, revoked
- **confirmed (已确认)** → closed, disputed, revoked
- **rejected (已驳回)** → processing, revoked
- **closed (已结案)** → revoked
- **revoked (已撤销)** → pending

## API 接口

### 导入与查询

#### POST /api/records - 导入展品记录
```json
{
  "exhibit_no": "EXH-2024-001",
  "contract_no": "CTR-BJ-2024-056",
  "check_point": "outbound",
  "check_time": "2024-05-01T10:00:00Z",
  "condition_desc": "出馆检查，品相完好",
  "has_scratch": false,
  "insurance_remark": "保险覆盖全程",
  "transport_node": "北京博物馆",
  "idempotent_key": "unique-key-001"
}
```
- Headers: `X-Operator: curator_zhang`
- 支持幂等性：相同 `idempotent_key` 重复提交返回已存在记录

#### GET /api/records - 列表查询
- 参数: `limit`, `offset`

#### GET /api/records/{id} - 详情查询
- 返回记录信息 + 所有版本历史

### 状态流转

#### POST /api/records/{id}/validate - 校验
- 状态: imported → validated

#### POST /api/records/{id}/process - 开始处理
- 状态: validated → processing

#### POST /api/records/{id}/dispute - 提出异议
- 状态: * → disputed

#### POST /api/records/{id}/confirm-liability - 确认责任
```json
{
  "version_id": 2,
  "liable_party": "transport",
  "liable_reason": "运输节点照片显示新增划痕",
  "confidence": 0.85
}
```

#### POST /api/records/{id}/reject - 驳回
```json
{ "reason": "证据不足" }
```

#### POST /api/records/{id}/close - 结案
```json
{ "conclusion": "运输方承担70%责任" }
```

#### POST /api/records/{id}/revoke - 撤销
```json
{ "reason": "重新调查" }
```

### 版本管理

#### POST /api/records/{id}/versions - 创建新版本
```json
{
  "check_point": "inbound",
  "check_time": "2024-05-15T14:30:00Z",
  "condition_desc": "回馆检查，发现划痕",
  "has_scratch": true,
  "scratch_location": "正面左上角",
  "scratch_size": "3cm x 0.5cm",
  "insurance_remark": "保险范围包含",
  "transport_node": "上海博物馆",
  "change_summary": "回馆品况更新，发现划痕",
  "photos": [...]
}
```

#### GET /api/records/{id}/diffs - 版本差异
- 字段级变更历史

### 照片证据

#### GET /api/versions/{versionId}/photos - 获取版本照片
- 照片证据链

### 复核

#### POST /api/conclusions/{id}/review - 复核结论
```json
{
  "approved": true,
  "comment": "证据充分，同意结论"
}
```

### 报告导出

#### GET /api/records/{id}/export/json - JSON 报告
- 完整数据导出

#### GET /api/records/{id}/export/csv - CSV 报告
- 结构化报表

### 统计

#### GET /api/statistics - 统计数据
- 各状态记录数量

## 运行方式

```bash
# 编译
go build -o museum-api .

# 运行
./museum-api

# 服务启动在 :8080
```

## 核心特性

### ✅ 已实现
1. **品况版本管理** - 多版本链，前版本关联
2. **照片证据链** - 按版本组织，提供方标识
3. **责任状态机** - 9种状态，完整转换规则
4. **重复登记幂等** - idempotent_key 防重
5. **导入接口** - 完整导入 + 幂等检查
6. **列表/详情接口** - 基础查询
7. **本地持久化** - SQLite 全量存储

### 🔄 持续完善
1. 校验、处理、撤销、复核完整接口
2. 差异对比详情
3. CSV/JSON 报告生成
4. 操作日志查询
5. 照片上传与时间校验

## 数据库表结构

```
exhibit_records (主记录)
└── condition_versions (品况版本)
    ├── photo_evidences (照片证据)
    └── version_diffs (版本差异)
└── liability_conclusions (责任结论)
└── operation_logs (操作日志)
```
