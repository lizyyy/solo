# 知情同意版本 API - 使用说明

## 项目启动

### 1. 安装依赖
```bash
# 根目录安装后端依赖
npm install

# 安装前端依赖
cd frontend && npm install && cd ..
```

### 2. 初始化测试数据
```bash
node backend/init-data.js
```

### 3. 启动后端服务
```bash
node backend/server.js
```
后端运行在: http://localhost:3001

### 4. 启动前端服务（新开终端）
```bash
cd frontend && npm start
```
前端运行在: http://localhost:3000

---

## API 接口列表

### 基础地址: http://localhost:3001/api

### 1. 模板管理

#### 发布新模板 (POST /templates)
```bash
curl -X POST http://localhost:3001/api/templates \
  -H "Content-Type: application/json" \
  -d '{
    "version": "v3.0",
    "title": "手术知情同意书(第三版)",
    "content": "本人已知晓手术全部风险及术后康复要求...",
    "applicable_scope": "所有手术患者",
    "published_by": "admin"
  }'
```

**关键规则**:
- 重复发布相同版本号会被拦截，返回400错误
- 历史签署不会被新模板覆盖

#### 查询所有模板 (GET /templates)
```bash
curl http://localhost:3001/api/templates
```

#### 查询指定版本模板 (GET /templates/:version)
```bash
curl http://localhost:3001/api/templates/v1.0
```

---

### 2. 签署管理

#### 患者签署 (POST /signatures)
```bash
curl -X POST http://localhost:3001/api/signatures \
  -H "Content-Type: application/json" \
  -d '{
    "template_version": "v2.0",
    "patient_id": "P004",
    "patient_name": "赵六",
    "signature_data": "signature_p004_v2_xyz789"
  }'
```

**规则**:
- 同一患者对同一版本只能有一个有效签署
- 签署后会自动完成对应的待处理补签任务

#### 查询患者签署记录 (GET /signatures/patient/:patient_id)
```bash
curl http://localhost:3001/api/signatures/patient/P001
```

#### 撤回签署 (POST /signatures/:id/withdraw)
```bash
curl -X POST http://localhost:3001/api/signatures/1/withdraw \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "患者信息有误，需重新签署"
  }'
```

---

### 3. 补签任务管理

#### 生成补签任务 (POST /resign-tasks/generate)
```bash
curl -X POST http://localhost:3001/api/resign-tasks/generate \
  -H "Content-Type: application/json" \
  -d '{
    "new_template_version": "v2.0",
    "reason": "模板已更新至v2.0，所有签署旧版本的患者需要补签"
  }'
```

**功能**:
- 会为所有签署了旧版本且状态为active的患者生成补签任务
- 自动去重，不会重复生成相同的待处理任务

#### 查询补签任务 (GET /resign-tasks)
```bash
# 查询所有任务
curl http://localhost:3001/api/resign-tasks

# 按患者筛选
curl "http://localhost:3001/api/resign-tasks?patient_id=P001"

# 按状态筛选
curl "http://localhost:3001/api/resign-tasks?status=pending"
```

---

### 4. 患者状态查询

#### 查询患者完整状态 (GET /patient-status/:patient_id)
```bash
curl http://localhost:3001/api/patient-status/P001
```

**返回字段说明**:
- `status`: 患者状态
  - `up-to-date`: 已签署最新版本，无需补签
  - `needs-resign`: 需要补签（有待处理任务）
  - `outdated-but-no-task`: 版本非最新，但无补签任务
  - `not-signed`: 未签署任何版本
- `active_signature`: 当前有效的签署记录
- `all_signatures`: 所有签署历史（包括撤回的）
- `pending_resign_tasks`: 待处理的补签任务
- `resign_reason`: 补签原因（如果需要补签）
- `no_resign_reason`: 无需补签的原因

---

### 5. 导出签署证明

#### 导出PDF证明 (GET /export/proof/:signature_id)
```bash
# 在浏览器中打开或使用curl下载
curl -o proof.pdf http://localhost:3001/api/export/proof/1
```

---

## 场景复现指南

### 场景1：旧版已签，新版未签（需要补签）- 患者 P001(张三)

**状态**: 已签署v1.0，有v2.0补签任务

**复现步骤**:
```bash
# 1. 发布v1.0模板
curl -X POST http://localhost:3001/api/templates \
  -H "Content-Type: application/json" \
  -d '{"version": "v1.0", "title": "模板1", "content": "...", "published_by": "admin"}'

# 2. P001签署v1.0
curl -X POST http://localhost:3001/api/signatures \
  -H "Content-Type: application/json" \
  -d '{"template_version": "v1.0", "patient_id": "P001", "patient_name": "张三", "signature_data": "..."}'

# 3. 发布v2.0模板
curl -X POST http://localhost:3001/api/templates \
  -H "Content-Type: application/json" \
  -d '{"version": "v2.0", "title": "模板2", "content": "...", "published_by": "admin"}'

# 4. 生成v2.0的补签任务
curl -X POST http://localhost:3001/api/resign-tasks/generate \
  -H "Content-Type: application/json" \
  -d '{"new_template_version": "v2.0", "reason": "模板更新"}'

# 5. 查询P001状态（看到需要补签）
curl http://localhost:3001/api/patient-status/P001
```

---

### 场景2：已签最新版（无需补签）- 患者 P002(李四)

**状态**: 已签署v2.0（最新版），无需补签

**复现步骤**:
```bash
# 1. 确保v2.0模板已存在
# 2. P002直接签署v2.0
curl -X POST http://localhost:3001/api/signatures \
  -H "Content-Type: application/json" \
  -d '{"template_version": "v2.0", "patient_id": "P002", "patient_name": "李四", "signature_data": "..."}'

# 3. 查询P002状态（看到无需补签）
curl http://localhost:3001/api/patient-status/P002
```

---

### 场景3：撤回后重签 - 患者 P003(王五)

**状态**: 有撤回的v2.0记录，当前有效签署是v1.0

**复现步骤**:
```bash
# 1. P003签署v2.0
curl -X POST http://localhost:3001/api/signatures \
  -H "Content-Type: application/json" \
  -d '{"template_version": "v2.0", "patient_id": "P003", "patient_name": "王五", "signature_data": "..."}'

# 2. 撤回该签署（假设签署ID为3）
curl -X POST http://localhost:3001/api/signatures/3/withdraw \
  -H "Content-Type: application/json" \
  -d '{"reason": "信息有误，需重新签署"}'

# 3. P003重新签署v1.0
curl -X POST http://localhost:3001/api/signatures \
  -H "Content-Type: application/json" \
  -d '{"template_version": "v1.0", "patient_id": "P003", "patient_name": "王五", "signature_data": "..."}'

# 4. 查询P003状态（看到历史签署记录）
curl http://localhost:3001/api/patient-status/P003
```

---

### 场景4：重复发布拦截

**验证规则**: 相同版本号不能重复发布
```bash
# 第一次发布v1.0（成功）
curl -X POST http://localhost:3001/api/templates \
  -H "Content-Type: application/json" \
  -d '{"version": "v1.0", "title": "测试", "content": "...", "published_by": "admin"}'

# 第二次发布v1.0（失败，返回400）
curl -X POST http://localhost:3001/api/templates \
  -H "Content-Type: application/json" \
  -d '{"version": "v1.0", "title": "测试", "content": "...", "published_by": "admin"}'
```

---

## 数据库结构

### templates（模板表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| version | TEXT | 版本号（唯一） |
| title | TEXT | 模板标题 |
| content | TEXT | 模板内容 |
| applicable_scope | TEXT | 适用范围 |
| is_active | BOOLEAN | 是否启用 |
| created_at | DATETIME | 创建时间 |
| published_by | TEXT | 发布人 |

### signatures（签署表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| template_id | INTEGER | 模板ID（外键） |
| template_version | TEXT | 模板版本号 |
| patient_id | TEXT | 患者ID |
| patient_name | TEXT | 患者姓名 |
| signature_data | TEXT | 签署数据 |
| signed_at | DATETIME | 签署时间 |
| status | TEXT | 状态(active/withdrawn) |
| withdrawn_at | DATETIME | 撤回时间 |
| withdrawn_reason | TEXT | 撤回原因 |

### resign_tasks（补签任务表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| patient_id | TEXT | 患者ID |
| patient_name | TEXT | 患者姓名 |
| old_template_id | INTEGER | 旧模板ID |
| old_template_version | TEXT | 旧模板版本 |
| new_template_id | INTEGER | 新模板ID |
| new_template_version | TEXT | 新模板版本 |
| reason | TEXT | 补签原因 |
| status | TEXT | 状态(pending/completed) |
| created_at | DATETIME | 创建时间 |
| completed_at | DATETIME | 完成时间 |
