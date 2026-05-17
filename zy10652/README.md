# 开放平台审核应用权限降级服务

## 启动步骤

### 1. 安装依赖
```bash
npm install
```

### 2. 初始化数据库
```bash
npm run init-db
```

### 3. 插入测试数据
```bash
npm run seed
```

### 4. 启动服务
```bash
npm start
```
服务启动在 http://localhost:3000

## 状态说明
- `normal` - 正常
- `downgrade_pending` - 降级待确认
- `downgraded` - 已降级
- `restore_request` - 恢复申请

## API 接口 & curl 命令

---

### 一、完整流程测试 (APP_FLOW_001)

#### 1. 创建应用
```bash
curl -X POST http://localhost:3000/api/applications \
  -H "Content-Type: application/json" \
  -d '{
    "app_id": "APP_FLOW_001",
    "app_name": "流程测试应用",
    "owner": "测试员",
    "permissions": [
      {"permission_key": "api.read", "permission_name": "接口读取", "original_level": 3, "target_level": 1},
      {"permission_key": "api.write", "permission_name": "接口写入", "original_level": 3, "target_level": 1}
    ]
  }'
```

#### 2. 查看应用列表
```bash
curl http://localhost:3000/api/applications?page=1&limit=10
```

#### 3. 提交降级申请（无冲突）
```bash
curl -X POST http://localhost:3000/api/applications/APP_FLOW_001/downgrade \
  -H "Content-Type: application/json" \
  -d '{
    "downgrade_reason": "接口调用异常，需要降权观察",
    "audit_opinion": "同意进入待审核状态",
    "operator": "审核员A",
    "old_token_high_permission": false
  }'
```

#### 4. 查看应用详情
```bash
curl http://localhost:3000/api/applications/APP_FLOW_001
```

#### 5. 审核通过，执行降级
```bash
curl -X POST http://localhost:3000/api/applications/APP_FLOW_001/approve-downgrade \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "审核员B",
    "audit_opinion": "情况属实，执行降级"
  }'
```

#### 6. 提交恢复申请
```bash
curl -X POST http://localhost:3000/api/applications/APP_FLOW_001/request-restore \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "应用开发者",
    "reason": "问题已修复，申请恢复权限"
  }'
```

#### 7. 审核恢复
```bash
curl -X POST http://localhost:3000/api/applications/APP_FLOW_001/restore \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "审核员B",
    "audit_opinion": "验证通过，恢复权限"
  }'
```

#### 8. 查看状态历史
```bash
curl http://localhost:3000/api/applications/APP_FLOW_001/history
```

---

### 二、冲突记录测试 (APP_CONFLICT_001)

#### 1. 创建应用
```bash
curl -X POST http://localhost:3000/api/applications \
  -H "Content-Type: application/json" \
  -d '{
    "app_id": "APP_CONFLICT_001",
    "app_name": "冲突测试应用",
    "owner": "测试员"
  }'
```

#### 2. 提交降级申请（有冲突 - 旧token带高权限）
```bash
curl -X POST http://localhost:3000/api/applications/APP_CONFLICT_001/downgrade \
  -H "Content-Type: application/json" \
  -d '{
    "downgrade_reason": "存在安全风险需要降级",
    "audit_opinion": "检测到高权限旧token",
    "operator": "审核员A",
    "old_token_high_permission": true
  }'
```

#### 3. 查看详情（验证冲突标记）
```bash
curl http://localhost:3000/api/applications/APP_CONFLICT_001
```

---

### 三、导入坏行测试

#### 1. 创建测试CSV文件 (test_import.csv)
```csv
app_id,app_name,owner,status
APP_IMPORT_001,导入成功应用,导入者,normal
,缺少app_id的应用,导入者,normal
APP_IMPORT_003,,缺少名称的应用,normal
APP_IMPORT_004,缺少owner的应用,,normal
APP_IMPORT_005,导入成功应用2,导入者2,downgrade_pending
```

#### 2. 执行导入
```bash
curl -X POST http://localhost:3000/api/import \
  -F "file=@test_import.csv"
```

---

### 四、导出测试
```bash
curl -o export.csv http://localhost:3000/api/export
```

按状态过滤导出：
```bash
curl -o export_downgraded.csv "http://localhost:3000/api/export?status=downgraded"
```

---

### 五、统计和查询

#### 查看状态统计
```bash
curl http://localhost:3000/api/status-stats
```

#### 按状态筛选列表
```bash
curl "http://localhost:3000/api/applications?status=downgraded"
```

---

## 验收核对清单

执行上述测试后，请核对：

### 1. 完整流转 (APP_FLOW_001)
- [ ] 应用创建成功，初始状态为 normal
- [ ] 提交降级后状态变为 downgrade_pending
- [ ] 审核通过后状态变为 downgraded
- [ ] 申请恢复后状态变为 restore_request
- [ ] 审核恢复后状态回到 normal
- [ ] 历史记录包含所有状态变更

### 2. 冲突记录 (APP_CONFLICT_001)
- [ ] 提交时 conflict_detected = true
- [ ] 详情中能看到 conflict_details 字段
- [ ] 降级记录中标记了 old_token_high_permission = 1

### 3. 导入坏行
- [ ] 导入结果显示 success = 2, failed = 3
- [ ] 错误列表中标明了每行的具体错误原因
- [ ] APP_IMPORT_001 和 APP_IMPORT_005 成功导入

### 4. 列表、详情、历史、导出互相对应
- [ ] 列表显示的状态与详情一致
- [ ] 历史记录条数与实际流转次数一致
- [ ] 导出CSV文件内容与列表数据一致
- [ ] 冲突标记在导出文件中正确显示

---

## 一键运行测试
```bash
npm test
```
