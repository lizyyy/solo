# 配置中心服务 - 回滚二次确认功能

## 功能概述

配置中心服务回滚二次确认功能，用于确保配置回滚操作的安全性。特别针对灰度实例和离线实例进行二次确认，避免误操作导致的线上问题。

## 核心特性

1. **回滚二次确认流程**：创建回滚申请 -> 二次确认 -> 执行回滚
2. **实例范围支持**：全部实例、灰度分组、指定实例、离线实例
3. **版本追踪**：记录实例拉取的配置版本，并与发布单/回滚单关联
4. **异常检测**：检测回滚后仍读取新版配置的实例

## API 接口说明

### 1. 创建回滚申请

**接口**：`POST /api/v1/rollback`

**请求参数**：
```json
{
  "app_name": "user-service",
  "config_key": "db.config",
  "target_version": 1,
  "source_version": 2,
  "confirmer": "admin",
  "instance_scope_type": "gray",
  "instance_ids": ["instance-01", "instance-02"],
  "gray_group_id": "gray-group-001",
  "remark": "灰度分组回滚测试"
}
```

**实例范围类型**：
- `all`: 全部实例
- `gray`: 灰度分组
- `specific`: 指定实例
- `offline`: 离线实例

**响应示例**：
```json
{
  "code": 200,
  "message": "创建成功",
  "data": {
    "id": "rollback-uuid-001",
    "app_name": "user-service",
    "config_key": "db.config",
    "target_version": 1,
    "source_version": 2,
    "status": "pending"
  }
}
```

---

### 2. 确认回滚（二次确认）

**接口**：`POST /api/v1/rollback/:id/confirm`

**请求参数**：
```json
{
  "operator": "manager"
}
```

**响应示例**：
```json
{
  "code": 200,
  "message": "确认成功",
  "data": {
    "id": "rollback-uuid-001",
    "status": "confirmed"
  }
}
```

---

### 3. 执行回滚

**接口**：`POST /api/v1/rollback/:id/execute`

**响应示例**：
```json
{
  "code": 200,
  "message": "执行成功",
  "data": {
    "id": "rollback-uuid-001",
    "status": "executed"
  }
}
```

---

### 4. 查询回滚详情

**接口**：`GET /api/v1/rollback/:id`

---

### 5. 查询回滚列表

**接口**：`GET /api/v1/rollback?app_name=user-service`

---

### 6. 查询版本不匹配的实例

**接口**：`GET /api/v1/rollback/:id/mismatched-instances`

**用途**：查询回滚后仍读取新版配置的实例

---

### 7. 记录实例拉取

**接口**：`POST /api/v1/rollback/pull-log`

**请求参数**：
```json
{
  "instance_id": "instance-01",
  "app_name": "user-service",
  "config_key": "db.config",
  "version": 2,
  "release_id": "release-001",
  "rollback_id": "rollback-001",
  "is_gray": true,
  "is_offline": false
}
```

## 测试场景

### 场景一：灰度分组回滚

**目的**：验证灰度分组内的实例回滚流程

**测试步骤**：
1. 创建灰度分组回滚申请
2. 二次确认回滚
3. 执行回滚
4. 记录实例拉取版本
5. 检查版本不匹配的实例

---

### 场景二：离线实例回滚

**目的**：验证离线实例的回滚处理

**测试步骤**：
1. 创建离线实例回滚申请
2. 二次确认回滚
3. 执行回滚
4. 记录离线实例拉取
5. 验证离线标记

---

### 场景三：缓存版本未刷新

**目的**：模拟回滚后部分实例仍读取旧版本的情况

**测试步骤**：
1. 创建回滚申请并执行
2. 部分实例记录为新版本
3. 查询版本不匹配的实例
4. 验证异常检测功能

---

### 场景四：重复确认测试

**目的**：验证状态机正确性，防止重复操作

**测试步骤**：
1. 创建回滚申请
2. 第一次确认（成功）
3. 第二次确认（失败，状态不允许）
4. 验证错误提示

---

### 场景五：回滚后再次发布

**目的**：验证回滚后再次发布新版本的流程

**测试步骤**：
1. 创建并执行回滚
2. 模拟新版本发布
3. 记录实例拉取新版本
4. 验证版本关联关系

## 测试命令

### 启动服务
```bash
cd config-center-service
go mod download
go run cmd/main.go
```

### 运行测试脚本
```bash
# 场景一：灰度分组回滚
bash test/test_gray_group.sh

# 场景二：离线实例回滚
bash test/test_offline_instance.sh

# 场景三：缓存版本未刷新
bash test/test_cache_not_refresh.sh

# 场景四：重复确认测试
bash test/test_duplicate_confirm.sh

# 场景五：回滚后再次发布
bash test/test_rollback_then_release.sh

# 运行全部测试
bash test/run_all_tests.sh
```

## 验收标准

### 正常记录验证
- [ ] 回滚申请创建成功，状态为 pending
- [ ] 二次确认成功，状态为 confirmed
- [ ] 执行回滚成功，状态为 executed
- [ ] 实例拉取记录正确关联 release_id 和 rollback_id

### 异常记录验证
- [ ] 重复确认返回错误提示
- [ ] 状态不正确时执行返回错误
- [ ] 参数校验失败返回 400

### 重复运行验证
- [ ] 多次运行测试，数据不冲突
- [ ] 数据库状态正确
- [ ] 查询结果符合预期

## 数据模型

### RollbackConfirmation（回滚确认单）
- `id`: 主键
- `app_name`: 应用名称
- `config_key`: 配置键
- `target_version`: 目标版本
- `source_version`: 源版本
- `confirmer`: 确认人
- `instance_scope_type`: 实例范围类型
- `instance_ids`: 实例ID列表（JSON）
- `gray_group_id`: 灰度分组ID
- `status`: 状态（pending/confirmed/executed/failed）
- `remark`: 备注
- `created_at`: 创建时间
- `updated_at`: 更新时间
- `confirmed_at`: 确认时间
- `executed_at`: 执行时间

### InstancePullLog（实例拉取日志）
- `id`: 主键
- `app_name`: 应用名称
- `config_key`: 配置键
- `instance_id`: 实例ID
- `pulled_version`: 拉取的版本
- `release_id`: 关联的发布单ID
- `rollback_id`: 关联的回滚单ID
- `is_gray`: 是否灰度实例
- `is_offline`: 是否离线实例
- `pulled_at`: 拉取时间
