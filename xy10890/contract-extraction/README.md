# 合同条款抽取 API

一个全栈Web应用，用于合同文件的上传、条款抽取、人工修订、风险标注和结果导出。

## 技术栈

- **后端**: Python + FastAPI + SQLAlchemy + SQLite
- **前端**: HTML5 + JavaScript + Bootstrap 5
- **数据库**: SQLite（可扩展到PostgreSQL/MySQL）

## 功能特性

### 核心功能
1. **批量上传合同** - 支持拖拽上传、多文件上传
2. **异步条款抽取** - 后台异步处理，支持重试机制
3. **列表筛选** - 按状态、风险等级、关键词搜索
4. **详情时间线** - 完整的操作历史记录
5. **条款修订** - 支持人工修订和版本历史
6. **风险标注** - 4级风险等级（低/中/高/极高）
7. **版本对比** - 合同状态变更的完整版本记录
8. **报告导出** - 支持Excel、CSV、JSON格式导出

### 数据质量保障
- **脏数据检测** - 文件大小限制、内容清洗、格式验证
- **重复请求防护** - 请求去重机制，防止重复提交
- **补偿动作** - 失败任务自动重试（最多3次）
- **数据完整性** - 事务保障，完整的错误处理

## 项目结构

```
contract-extraction/
├── backend/
│   ├── main.py              # FastAPI主应用
│   ├── models.py            # 数据模型定义
│   ├── schemas.py           # Pydantic模式定义
│   ├── crud.py              # 数据库操作封装
│   ├── services.py          # 业务逻辑服务
│   ├── database.py          # 数据库连接配置
│   ├── config.py            # 应用配置
│   └── requirements.txt     # Python依赖
├── frontend/
│   ├── index.html           # 主页面
│   └── app.js               # 前端逻辑
├── docs/
│   └── 操作手册.md          # 详细操作说明
└── README.md
```

## 数据模型

### 合同 (Contract)
- id, filename, file_path, file_size
- contract_name, party_a, party_b (合同名称、甲方、乙方)
- status: uploaded/extracting/extracted/reviewing/approved/failed
- overall_risk: low/medium/high/critical
- retry_count, error_message, extracted_at

### 条款 (Clause)
- id, contract_id, clause_type_id
- clause_title, original_text, extracted_text, revised_text
- risk_level, risk_reason, confidence_score
- is_approved, approved_by, approved_at

### 其他模型
- ClauseType: 条款类型定义
- ClauseRevision: 条款修订历史
- ContractVersion: 合同版本历史
- TimelineEvent: 操作时间线

## 快速开始

### 后端启动

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API文档地址: http://localhost:8000/docs

### 前端访问

直接在浏览器打开 `frontend/index.html`，或使用静态文件服务器：

```bash
cd frontend
python -m http.server 3000
```

访问: http://localhost:3000

## API 接口说明

### 合同管理
- `POST /api/contracts` - 创建合同
- `GET /api/contracts` - 合同列表（支持分页、筛选、搜索）
- `GET /api/contracts/{id}` - 合同详情
- `PUT /api/contracts/{id}` - 更新合同
- `DELETE /api/contracts/{id}` - 删除合同

### 文件上传
- `POST /api/contracts/upload` - 批量上传合同文件

### 抽取相关
- `POST /api/contracts/extract` - 批量启动抽取
- `POST /api/contracts/{id}/retry` - 重试单个合同
- `POST /api/contracts/bulk-retry` - 批量重试失败任务

### 条款操作
- `PUT /api/clauses/{id}` - 更新条款
- `POST /api/clauses/{id}/revise` - 修订条款
- `POST /api/clauses/{id}/risk` - 标记风险

### 版本管理
- `GET /api/contracts/{id}/versions` - 获取合同版本列表
- `GET /api/contracts/{id}/compare?version_a=1&version_b=2` - 对比两个版本差异

### 导出
- `POST /api/export` - 导出合同报告（支持多格式）

### 统计
- `GET /api/stats` - 获取系统统计数据

## 关键操作路径

### 1. 常规抽取流程
```
上传合同 → 状态: uploaded
    ↓
选择合同 → 点击批量抽取 → 状态: extracting
    ↓
等待抽取完成 → 状态: extracted
    ↓
查看条款 → 人工修订/标记风险
    ↓
状态变更为 approved
    ↓
导出报告
```

### 2. 失败补偿流程
```
抽取失败 → 状态: failed
    ↓
点击"重试失败任务" → 状态: extracting (retry_count+1)
    ↓
重试成功 → 状态: extracted
或
重试3次仍失败 → 需要人工干预
```

### 3. 防重复请求机制
- 相同内容的创建请求在300秒内只会被处理一次
- 相同的抽取请求在60秒内只会被处理一次
- 前端按钮在请求处理中会被禁用

### 4. 脏数据处理
- 文件大小限制: 单个文件不超过50MB
- 文本内容清洗: 去除空字符、统一换行符
- 格式验证: 必填字段检查、数据类型验证
- 置信度范围: 0-1之间的数值验证

## 配置说明

编辑 `backend/.env` 文件：

```env
DATABASE_URL=sqlite:///./contract_extraction.db
UPLOAD_DIR=./uploads
EXPORT_DIR=./exports
```

## 扩展建议

1. **集成真实AI模型**: 替换模拟抽取逻辑，接入LLM（如GPT、Claude等）
2. **用户认证**: 添加JWT认证和权限管理
3. **消息队列**: 使用Celery+Redis处理更复杂的异步任务
4. **OCR支持**: 处理扫描版PDF合同
5. **版本对比可视化**: 条款变更的diff高亮显示
6. **审计日志**: 完整的操作审计记录

## 许可证

MIT License
