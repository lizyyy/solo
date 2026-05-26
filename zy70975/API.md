# 社区活动名额候补 API 服务

## 项目说明

基于 Node.js + Express + SQLite 的轻量级 API 服务，用于处理社区活动名额候补申请，支持亲子课和老人课两种活动类型。

## 核心功能

1. **材料提交与重复识别**：同一批材料重复提交时自动识别并返回原有结果
2. **报名状态管理**：支持待处理、已通过、已拒绝、已取消四种状态
3. **操作审计日志**：记录所有状态变更的操作人、原因、变更前后内容
4. **查询统计**：按社区、活动类型、状态等多维度筛选和统计
5. **数据导出**：支持 JSON 和 CSV 格式导出，包含完整处理信息

## 快速启动

```bash
# 安装依赖
npm install

# 启动服务
npm start
```

服务启动后访问：`http://localhost:3000/api/health`

## API 接口列表

### 1. 提交材料

**POST** `/api/submissions`

提交一批报名材料，系统自动检测是否重复提交。

**请求参数：**
```json
{
  "submitter": "张三",           // 提交人姓名
  "community": "阳光社区",        // 所属社区
  "applications": [              // 申请列表
    {
      "applicant_name": "李明",   // 申请人姓名
      "id_card": "110101199001011234",  // 身份证号
      "phone": "13800138001",     // 联系电话
      "activity_type": "parent_child",  // 活动类型: parent_child(亲子课) / elderly(老人课)
      "relationship": "父子",      // 与申请人关系（亲子课必填）
      "remark": "孩子5岁"          // 备注
    }
  ]
}
```

**响应示例：**
- 首次提交：`isDuplicate: false`，返回新创建的批次和申请记录
- 重复提交：`isDuplicate: true`，返回原有处理结果

### 2. 变更申请状态

**PUT** `/api/applications/:id/status`

审批或取消申请，自动记录审计日志。

**请求参数：**
```json
{
  "status": "approved",      // 目标状态: pending/approved/rejected/cancelled
  "operator": "李四",         // 操作人
  "reason": "材料齐全，符合条件",  // 变更原因
  "remark": "已通知家长"       // 新备注（可选）
}
```

### 3. 查询审计日志

**GET** `/api/applications/:id/audit-logs`

查询单条申请的所有操作历史记录。

**响应示例：**
```json
{
  "logs": [
    {
      "id": 1,
      "operator": "李四",
      "operation_type": "status_change",
      "old_status": "pending",
      "new_status": "approved",
      "old_remark": "孩子5岁",
      "new_remark": "已通知家长",
      "reason": "材料齐全，符合条件",
      "operate_time": "2026-05-26 23:05:19"
    }
  ]
}
```

### 4. 查询提交批次列表

**GET** `/api/submissions`

支持分页和多条件筛选。

**查询参数：**
- `community`: 社区名称
- `activity_type`: 活动类型
- `status`: 申请状态
- `start_date`: 开始日期
- `end_date`: 结束日期
- `page`: 页码，默认 1
- `page_size`: 每页条数，默认 20

### 5. 查询批次详情

**GET** `/api/submissions/:id`

查询单个提交批次的详情及所有申请记录。

### 6. 统计数据

**GET** `/api/statistics`

查看汇总统计和按社区分组统计。

**查询参数：**
- `community`: 社区名称
- `start_date`: 开始日期
- `end_date`: 结束日期

### 7. 数据导出

**GET** `/api/export`

导出所有申请数据，支持 JSON 和 CSV 格式。

**查询参数：**
- `format`: 导出格式，`json` 或 `csv`，默认 json
- `community`: 社区名称
- `activity_type`: 活动类型
- `status`: 申请状态
- `start_date`: 开始日期
- `end_date`: 结束日期

**导出字段包含：**
- 批次号、社区、提交人、提交时间
- 申请人姓名、身份证、电话
- 活动类型（亲子课/老人课）、关系
- 状态、报名时间、取消时间
- 最后处理人、最后处理时间、备注

## 数据模型

### submissions 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| batch_no | TEXT | 批次号（唯一） |
| content_hash | TEXT | 内容哈希（用于重复检测） |
| submitter | TEXT | 提交人 |
| submit_time | DATETIME | 提交时间 |
| community | TEXT | 社区 |
| total_applications | INTEGER | 申请总数 |
| status | TEXT | 批次状态 |

### applications 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| submission_id | INTEGER | 关联批次ID |
| applicant_name | TEXT | 申请人姓名 |
| id_card | TEXT | 身份证号 |
| phone | TEXT | 联系电话 |
| activity_type | TEXT | 活动类型 |
| relationship | TEXT | 与申请人关系 |
| status | TEXT | 状态：pending/approved/rejected/cancelled |
| register_time | DATETIME | 报名时间 |
| cancel_time | DATETIME | 取消时间 |
| last_handler | TEXT | 最后处理人 |
| last_handle_time | DATETIME | 最后处理时间 |
| remark | TEXT | 备注 |

### audit_logs 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| application_id | INTEGER | 关联申请ID |
| operator | TEXT | 操作人 |
| operation_type | TEXT | 操作类型：create/status_change |
| old_status | TEXT | 变更前状态 |
| new_status | TEXT | 变更后状态 |
| old_remark | TEXT | 变更前备注 |
| new_remark | TEXT | 变更后备注 |
| reason | TEXT | 变更原因 |
| operate_time | DATETIME | 操作时间 |

## 测试脚本

运行完整的API测试：
```bash
./test-api.sh
```
