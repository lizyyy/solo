# 药店会员中台慢病权益续期 API

## 项目说明

药店会员中台慢病权益续期服务，支持多系统接入、冲突检测、历史记录追踪、批量导入导出等功能。

### 核心特性

- **冲突规则**: 同一组合会员+病种+权益包，不同来源系统创建时提示冲突，相同来源系统重复创建被唯一约束拦截
- **历史记录**: 所有操作记录操作来源、操作者、操作时间、变更内容
- **状态流转**: pending(待处理) → renewal_apply(续期申请) → effective(有效) → suspended(暂停)
- **资料校验**: 会员资料过期或材料不全时自动拦截，提示缺失材料

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化基础数据

```bash
npm run seed
```

初始化内容：
- 3个会员（M001张三资料有效，M002李四资料过期，M003王五资料有效）
- 3个病种（HTN高血压、DM糖尿病、CHD冠心病）
- 3个权益包（基础包、尊享包、VIP包）

### 3. 启动服务

```bash
npm start
```

服务运行在 http://localhost:3000

### 4. 运行测试

```bash
# 先启动服务，再开新终端运行
npm test
```

## API 文档

### 健康检查

```bash
curl http://localhost:3000/health
```

### 创建续期记录

```bash
curl -X POST http://localhost:3000/api/renewal \
  -H "Content-Type: application/json" \
  -d '{
    "memberId": "会员ID",
    "diseaseId": "病种ID",
    "benefitPackageId": "权益包ID",
    "materials": "diagnosis_proof,medical_record",
    "sourceSystem": "POS_System",
    "operator": "admin",
    "remark": "线下门店申请"
  }'
```

**材料说明**:
- `diagnosis_proof`: 诊断证明
- `medical_record`: 病历资料

### 获取续期列表

```bash
# 分页查询
curl "http://localhost:3000/api/renewal?page=1&pageSize=20"

# 按会员筛选
curl "http://localhost:3000/api/renewal?memberId=xxx"

# 按状态筛选
curl "http://localhost:3000/api/renewal?status=effective"
```

### 获取续期详情

```bash
curl http://localhost:3000/api/renewal/{记录ID}
```

### 获取历史记录

```bash
curl http://localhost:3000/api/renewal/{记录ID}/history
```

### 审核通过

```bash
curl -X PUT http://localhost:3000/api/renewal/{记录ID}/approve \
  -H "Content-Type: application/json" \
  -d '{
    "sourceSystem": "Admin_System",
    "operator": "manager"
  }'
```

### 暂停权益

```bash
curl -X PUT http://localhost:3000/api/renewal/{记录ID}/suspend \
  -H "Content-Type: application/json" \
  -d '{
    "sourceSystem": "Admin_System",
    "operator": "manager",
    "reason": "会员主动申请暂停"
  }'
```

### 批量导入CSV

```bash
curl -X POST http://localhost:3000/api/renewal/import \
  -F "file=@test_data/import_test.csv" \
  -F "sourceSystem=Batch_System" \
  -F "operator=batch_admin"
```

CSV格式:
```csv
member_no,disease_code,package_code,materials
M001,HTN,PKG_A,diagnosis_proof,medical_record
```

### 获取导入坏行记录

```bash
# 查询指定批次
curl "http://localhost:3000/api/renewal/bad-records?batchNo=BATCH_xxx"

# 查询全部坏行
curl http://localhost:3000/api/renewal/bad-records
```

### 导出CSV

```bash
# 导出全部
curl -O -J http://localhost:3000/api/renewal/export/csv

# 按状态筛选导出
curl -O -J "http://localhost:3000/api/renewal/export/csv?status=effective"
```

## 验收场景

### 场景1: 完整流程流转

1. 创建续期申请（状态: renewal_apply）
2. 审核通过（状态: effective）
3. 暂停权益（状态: suspended）
4. 查看历史记录（3条记录: 创建、审核、暂停）

### 场景2: 冲突记录

1. POS系统创建张三的高血压权益
2. HIS系统尝试创建张三相同的高血压权益 → 返回冲突警告
3. 相同系统再次尝试创建 → 被唯一约束拦截

### 场景3: 导入坏行

测试CSV包含:
- 正常行: M001、M003（材料齐全）
- 坏行: M999(会员不存在)、INVALID病种、INVALID权益包、空会员号、M002(资料过期拦截)

## 数据模型

### members (会员表)
- id, member_no, name, phone, id_card, data_expiry_date, created_at, updated_at

### diseases (病种表)
- id, code, name, description, created_at

### benefit_packages (权益包表)
- id, code, name, description, validity_days, created_at

### renewal_records (续期记录表)
- id, member_id, disease_id, benefit_package_id, status, materials, source_system, operator, start_date, end_date, remark, created_at, updated_at

### renewal_history (续期历史表)
- id, renewal_record_id, action, old_status, new_status, source_system, operator, change_content, created_at

### import_bad_records (导入坏行表)
- id, import_batch_no, row_data, error_message, created_at

## 目录结构

```
.
├── src/
│   ├── app.js              # 应用入口
│   ├── config/
│   │   └── database.js     # 数据库配置
│   ├── routes/
│   │   └── renewalRoutes.js # 路由配置
│   ├── services/
│   │   ├── renewalService.js # 续期业务逻辑
│   │   └── importExportService.js # 导入导出服务
│   └── utils/
│       └── date.js         # 日期工具
├── scripts/
│   ├── seed.js             # 数据初始化
│   └── test.js             # 自动化测试
├── test_data/
│   └── import_test.csv     # 测试导入数据
├── data/                   # SQLite数据库目录
├── uploads/                # 上传文件目录
└── package.json
```