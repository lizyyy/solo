# 县档案馆闭架调阅窗口后端服务

## 项目概述

本项目是为县档案馆闭架调阅窗口开发的本地后端 API 服务，用于管理调阅申请、库房温湿度、密级授权、虫霉处理和出库封签等档案管理业务。

## 功能特性

1. **数据导入**：支持 CSV 和 JSON 格式的数据导入
2. **调阅申请状态查询**：自动判断是否可调阅、需补授权、需先隔离处理或要主管复核
3. **人工复核**：支持保存复核意见和备注
4. **审计日志**：完整记录所有操作，支持 JSON 格式导出

## 技术栈

- **后端框架**：Flask 3.0
- **数据库**：SQLite
- **ORM**：SQLAlchemy 2.0
- **数据处理**：Pandas
- **Python 版本**：3.8+

## 项目结构

```
xy4514/
├── app.py                  # Flask 应用主入口
├── config.py               # 配置文件
├── models.py               # 数据模型
├── requirements.txt        # Python 依赖
├── sample_data/            # 示例数据
│   ├── access_requests.csv
│   ├── access_requests.json
│   ├── temperature_humidity.csv
│   ├── security_clearances.csv
│   ├── pest_mold_treatments.csv
│   └── outbound_seals.csv
├── uploads/                # 上传文件存储目录（自动创建）
├── exports/                # 导出文件存储目录（自动创建）
└── archives.db             # SQLite 数据库文件（首次运行时创建）
```

## 安装部署

### 1. 环境准备

确保已安装 Python 3.8 或更高版本。

### 2. 创建虚拟环境

```bash
# 创建虚拟环境
python3 -m venv venv

# 激活虚拟环境
# macOS/Linux:
source venv/bin/activate
# Windows:
# venv\Scripts\activate
```

### 3. 安装依赖

```bash
pip install -r requirements.txt
```

### 4. 启动服务

```bash
python app.py
```

服务启动后将在 `http://localhost:5000` 运行。

## API 接口说明

### 健康检查

```
GET /api/health
```

检查服务是否正常运行。

**响应示例：**
```json
{
    "status": "healthy",
    "database": "connected",
    "timestamp": "2024-01-20T10:30:00.123456"
}
```

### 数据导入

```
POST /api/import/<data_type>
```

导入 CSV 或 JSON 格式的数据。

**路径参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| data_type | string | 数据类型，可选值：`access_request`, `temperature_humidity`, `security_clearance`, `pest_mold_treatment`, `outbound_seal` |

**请求体：** `multipart/form-data` 格式，包含 `file` 字段。

**请求示例（cURL）：**
```bash
# 导入调阅申请 CSV
curl -X POST -F "file=@sample_data/access_requests.csv" \
  http://localhost:5000/api/import/access_request

# 导入调阅申请 JSON
curl -X POST -F "file=@sample_data/access_requests.json" \
  http://localhost:5000/api/import/access_request
```

**响应示例：**
```json
{
    "success": true,
    "imported_count": 5,
    "errors": [],
    "message": "导入完成，成功5条，失败0条"
}
```

### 查询调阅申请状态

```
GET /api/request/<request_no>
```

根据申请单号查询调阅状态，自动判断是否可调阅、需补授权、需先隔离处理或要主管复核。

**路径参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| request_no | string | 申请单号 |

**请求头（可选）：**

| 头字段 | 说明 |
|--------|------|
| X-Operator | 操作人名称，用于审计日志 |

**请求示例：**
```bash
curl http://localhost:5000/api/request/REQ2024001
```

**响应示例：**
```json
{
    "request_info": {
        "id": 1,
        "request_no": "REQ2024001",
        "request_date": "2024-01-15",
        "requester_name": "张三",
        "requester_department": "县政府办公室",
        "archive_category": "文书档案",
        "archive_no": "X-WS-2020-001",
        "archive_title": "县政府2020年年度工作报告",
        "security_level": "公开",
        "status": "pending"
    },
    "evaluation": {
        "request_no": "REQ2024001",
        "status": "approved",
        "status_description": "可以调阅",
        "issues": [],
        "can_access": true,
        "needs_authorization": false,
        "needs_quarantine": false,
        "needs_supervisor": false
    },
    "reviews": []
}
```

**状态说明：**

| status 值 | 说明 |
|-----------|------|
| approved | 可以调阅 |
| needs_authorization | 需补充授权 |
| needs_quarantine | 需先隔离处理 |
| needs_supervisor | 要主管复核 |
| rejected | 拒绝 |

### 提交复核意见

```
POST /api/request/<request_no>/review
```

保存人工复核意见和备注。

**请求体（JSON）：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| review_result | string | 是 | 复核结果，可选值：`通过`, `拒绝`, `需补充授权`, `需先隔离处理`, `要主管复核` |
| reviewer | string | 否 | 复核人，默认为 `system` |
| review_remark | string | 否 | 复核备注 |
| needs_supervisor_review | boolean | 否 | 是否需要主管复核，默认 `false` |
| supervisor_reviewer | string | 否 | 主管复核人 |
| supervisor_remark | string | 否 | 主管复核备注 |

**请求示例：**
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{
    "review_result": "通过",
    "reviewer": "李管理员",
    "review_remark": "资料齐全，符合调阅条件",
    "needs_supervisor_review": false
  }' \
  http://localhost:5000/api/request/REQ2024001/review
```

**响应示例：**
```json
{
    "success": true,
    "message": "复核意见已保存",
    "review": {
        "id": 1,
        "request_id": 1,
        "review_result": "通过",
        "reviewer": "李管理员",
        "review_date": "2024-01-20 10:30:00",
        "review_remark": "资料齐全，符合调阅条件",
        "needs_supervisor_review": false
    }
}
```

### 列出调阅申请

```
GET /api/requests
```

分页列出所有调阅申请。

**查询参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| status | string | 无 | 按状态筛选 |
| page | int | 1 | 页码 |
| per_page | int | 20 | 每页数量 |

**请求示例：**
```bash
# 获取第1页，每页10条
curl "http://localhost:5000/api/requests?page=1&per_page=10"

# 按状态筛选
curl "http://localhost:5000/api/requests?status=pending"
```

### 导出审计日志

```
GET /api/audit/export
```

导出审计日志为 JSON 包。

**查询参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| start_date | string | 开始日期，格式：`YYYY-MM-DD` |
| end_date | string | 结束日期，格式：`YYYY-MM-DD` |
| module | string | 模块筛选 |
| action_type | string | 操作类型筛选 |

**请求示例：**
```bash
# 导出全部审计日志
curl -O http://localhost:5000/api/audit/export

# 按日期范围导出
curl -O "http://localhost:5000/api/audit/export?start_date=2024-01-01&end_date=2024-01-31"

# 按模块导出
curl -O "http://localhost:5000/api/audit/export?module=调阅申请"
```

**导出的 JSON 格式：**
```json
{
    "export_info": {
        "export_time": "2024-01-20 10:30:00",
        "export_criteria": {
            "start_date": "2024-01-01",
            "end_date": "2024-01-31",
            "module": null,
            "action_type": null
        },
        "total_records": 10
    },
    "audit_logs": [
        {
            "id": 1,
            "action_type": "导入",
            "module": "调阅申请",
            "operator": "system",
            "action_details": "成功导入5条记录",
            "ip_address": "127.0.0.1",
            "created_at": "2024-01-20 10:00:00"
        }
    ]
}
```

## 数据格式说明

### 调阅申请 (Access Request)

| 字段名（中文） | 字段名（英文） | 类型 | 说明 |
|----------------|----------------|------|------|
| 申请单号 | request_no | string | 唯一标识 |
| 申请日期 | request_date | date | 申请日期 |
| 调阅人 | requester_name | string | 调阅人姓名 |
| 部门 | requester_department | string | 所属部门 |
| 身份证号 | requester_id_card | string | 身份证号 |
| 档案类别 | archive_category | string | 档案类别 |
| 档案号 | archive_no | string | 档案编号 |
| 档案标题 | archive_title | string | 档案标题 |
| 年代范围 | archive_date_range | string | 档案年代 |
| 调阅理由 | access_reason | string | 调阅原因 |
| 调阅方式 | access_method | string | 查阅/复制/借出 |
| 调阅时长 | access_duration | string | 调阅时间 |
| 密级 | security_level | string | 公开/内部/秘密/机密/绝密 |

### 密级等级说明

| 密级 | 等级值 | 说明 |
|------|--------|------|
| 公开 | 0 | 无限制 |
| 内部 | 1 | 内部人员可阅 |
| 秘密 | 2 | 需秘密级授权 |
| 机密 | 3 | 需机密级授权 |
| 绝密 | 4 | 需绝密级授权 |

### 库房温湿度标准

| 指标 | 正常范围 | 注意范围 | 异常范围 |
|------|----------|----------|----------|
| 温度 | 14-24℃ | <14 或 >24℃ | <10 或 >28℃ |
| 湿度 | 45-60% | <45 或 >60% | <40 或 >65% |

## 使用示例流程

### 1. 启动服务

```bash
python app.py
```

### 2. 导入基础数据

```bash
# 导入密级授权
curl -X POST -F "file=@sample_data/security_clearances.csv" \
  http://localhost:5000/api/import/security_clearance

# 导入虫霉处理记录
curl -X POST -F "file=@sample_data/pest_mold_treatments.csv" \
  http://localhost:5000/api/import/pest_mold_treatment

# 导入出库封签
curl -X POST -F "file=@sample_data/outbound_seals.csv" \
  http://localhost:5000/api/import/outbound_seal

# 导入温湿度记录
curl -X POST -F "file=@sample_data/temperature_humidity.csv" \
  http://localhost:5000/api/import/temperature_humidity

# 导入调阅申请
curl -X POST -F "file=@sample_data/access_requests.csv" \
  http://localhost:5000/api/import/access_request
```

### 3. 查询申请状态

```bash
# 查询张三的申请（应该可以调阅）
curl http://localhost:5000/api/request/REQ2024001

# 查询李四的申请（需检查密级授权）
curl http://localhost:5000/api/request/REQ2024002

# 查询王五的申请（可能需要主管复核）
curl http://localhost:5000/api/request/REQ2024003
```

### 4. 提交复核意见

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{
    "review_result": "通过",
    "reviewer": "张管理员",
    "review_remark": "申请人授权齐全，档案状态正常，同意调阅"
  }' \
  http://localhost:5000/api/request/REQ2024001/review
```

### 5. 导出审计日志

```bash
curl -O http://localhost:5000/api/audit/export
```

## 注意事项

1. **数据安全**：本系统存储敏感档案信息，请确保服务器安全
2. **备份策略**：建议定期备份 `archives.db` 数据库文件
3. **权限控制**：生产环境建议添加用户认证机制
4. **字符编码**：导入文件请使用 UTF-8 编码

## 故障排查

### 数据库连接问题

确保 SQLite 数据库文件所在目录有写入权限。

### 导入失败

1. 检查文件编码是否为 UTF-8
2. 检查日期格式是否正确（支持 YYYY-MM-DD、YYYY/MM/DD 等格式）
3. 检查必填字段是否有值

### 状态判断异常

确保已正确导入相关的基础数据（密级授权、虫霉处理、出库封签）。

## 维护说明

- 数据库文件：`archives.db`（SQLite 格式，可使用 SQLite 客户端工具查看）
- 日志文件：审计日志存储在 `audit_logs` 表中
- 上传文件：存储在 `uploads/` 目录
- 导出文件：存储在 `exports/` 目录
