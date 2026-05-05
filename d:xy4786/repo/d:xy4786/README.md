# 食堂点餐系统数据迁移API

用于学校食堂点餐系统从旧版升级到新版的数据迁移服务，确保套餐、窗口、过敏原标签和默认角色等种子数据的一致性。

## 功能特性

- **一键初始化**: 快速初始化数据库和所有种子数据
- **旧库样例导入**: 模拟旧版系统数据，用于测试迁移流程
- **预检差异**: 检查当前数据与预期种子数据的差异
- **应用迁移**: 自动对齐数据，支持预检模式和实际应用
- **重跑种子**: 幂等操作，不重复写入，只更新变化的数据
- **一致性报告**: 导出JSON/Markdown格式的详细报告
- **人工修复记录**: 自动记录所有数据修正操作

## 技术栈

- **框架**: FastAPI
- **数据库**: SQLite
- **语言**: Python 3.9+

## 快速开始

### 安装依赖

```bash
pip3 install fastapi uvicorn pydantic python-multipart
```

### 启动服务

```bash
python3 main.py
```

服务将在 `http://localhost:8000` 启动。

### 访问API文档

启动后访问:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## 数据库结构

### 迁移元数据表

| 表名 | 说明 |
|------|------|
| `migration_versions` | 迁移版本记录 |
| `batch_records` | 初始化批次记录 |
| `seed_inventory` | 种子清单（含hash校验） |
| `manual_fixes` | 人工修复记录 |

### 业务数据表

| 表名 | 说明 |
|------|------|
| `packages` | 套餐表 |
| `windows` | 窗口表 |
| `allergens` | 过敏原标签表 |
| `roles` | 系统角色表（含默认角色） |

## API接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 服务根路径，返回接口列表 |
| GET | `/health` | 健康检查 |
| POST | `/api/init` | 一键初始化 |
| POST | `/api/import-old` | 导入旧库样例 |
| GET | `/api/precheck` | 预检差异 |
| POST | `/api/migrate` | 应用迁移 |
| POST | `/api/rerun-seeds` | 重跑种子（幂等） |
| GET | `/api/report` | 导出一致性报告 |
| GET | `/api/stats` | 数据统计 |

---

## Curl 验证命令

### 1. 健康检查

```bash
curl -s http://localhost:8000/health
```

**预期响应:**
```json
{"status":"healthy","database":"connected"}
```

---

### 2. 正常初始化

```bash
curl -s -X POST http://localhost:8000/api/init -H "Content-Type: application/json"
```

**预期响应:**
```json
{
  "success": true,
  "batch_number": "BATCH_20260505230556",
  "message": "初始化完成",
  "details": {
    "windows_count": 5,
    "allergens_count": 6,
    "roles_count": 4,
    "packages_count": 8
  }
}
```

**验证要点:**
- 返回 `success: true`
- 包含批次号 `batch_number`
- 初始化数据数量：5窗口、6过敏原、4角色、8套餐

---

### 3. 重复执行初始化（幂等性验证）

```bash
curl -s -X POST http://localhost:8000/api/init -H "Content-Type: application/json"
```

**预期响应:**
```json
{
  "success": true,
  "batch_number": "BATCH_20260505230601",
  "message": "初始化完成",
  "details": {
    "windows_count": 5,
    "allergens_count": 6,
    "roles_count": 4,
    "packages_count": 8
  }
}
```

**验证要点:**
- 仍然返回 `success: true`
- 生成新的批次号（不同的时间戳）
- 数据不会重复创建，使用 `INSERT OR REPLACE` 保证幂等

---

### 4. 预检差异（数据一致场景）

```bash
curl -s http://localhost:8000/api/precheck
```

**预期响应（数据一致时）:**
```json
{
  "success": true,
  "has_issues": false,
  "report": {
    "summary": {
      "total_expected": 23,
      "total_actual": 23,
      "matched": 23,
      "missing": 0,
      "mismatched": 0,
      "extra": 0
    },
    "details": {
      "window": {"expected_count": 5, "actual_count": 5, "matched": [...], "missing": [], "mismatched": [], "extra": []},
      "allergen": {"expected_count": 6, "actual_count": 6, "matched": [...], "missing": [], "mismatched": [], "extra": []},
      "role": {"expected_count": 4, "actual_count": 4, "matched": [...], "missing": [], "mismatched": [], "extra": []},
      "package": {"expected_count": 8, "actual_count": 8, "matched": [...], "missing": [], "mismatched": [], "extra": []}
    }
  }
}
```

**验证要点:**
- `has_issues: false` 表示数据完全一致
- `matched: 23` 表示全部匹配
- `missing`, `mismatched`, `extra` 均为 0

---

### 5. 导入旧库样例（模拟数据不一致场景）

```bash
curl -s -X POST http://localhost:8000/api/import-old -H "Content-Type: application/json"
```

**预期响应:**
```json
{
  "success": true,
  "batch_number": "BATCH_20260505230614",
  "message": "旧库样例导入完成",
  "details": {
    "windows_count": 3,
    "allergens_count": 2,
    "roles_count": 2,
    "packages_count": 2
  }
}
```

**说明:** 此操作会覆盖部分数据，创建与预期种子数据不一致的场景：
- WIN001 描述字段不同
- WIN002 名称和描述都不同
- ROLE_STAFF 名称、描述、权限都不同
- PKG001 名称、描述、价格、过敏原都不同
- 额外数据：WIN006、ALLER007、ROLE_TEACHER、PKG009

---

### 6. 预检差异（数据不一致场景）

```bash
curl -s http://localhost:8000/api/precheck
```

**预期响应:**
```json
{
  "success": true,
  "has_issues": true,
  "report": {
    "summary": {
      "total_expected": 23,
      "total_actual": 27,
      "matched": 18,
      "missing": 0,
      "mismatched": 5,
      "extra": 4
    },
    "details": {
      "window": {
        "expected_count": 5, "actual_count": 6,
        "mismatched": [
          {"id": "WIN001", "diff_fields": [{"field": "description", "expected": "供应早餐食品", "actual": "旧版：早餐供应"}]},
          {"id": "WIN002", "diff_fields": [{"field": "name", "expected": "中餐窗口", "actual": "午餐窗口"}, ...]}
        ],
        "extra": [{"id": "WIN006", "data": {...}}]
      },
      ...
    }
  }
}
```

**验证要点:**
- `has_issues: true` 表示存在问题
- `mismatched: 5` 表示5个字段不匹配
- `extra: 4` 表示4个冗余数据（旧库多余数据）

---

### 7. 应用迁移（预检模式 - dry_run=true）

```bash
curl -s -X POST http://localhost:8000/api/migrate -H "Content-Type: application/json" -d '{"dry_run": true}'
```

**预期响应:**
```json
{
  "success": true,
  "dry_run": true,
  "batch_number": "BATCH_20260505230627",
  "message": "迁移预检完成",
  "actions_count": 15,
  "actions": [
    {"action": "UPDATE", "seed_type": "window", "seed_id": "WIN001", "field": "description", "old_value": "旧版：早餐供应", "new_value": "供应早餐食品", "reason": "字段值不匹配"},
    {"action": "UPDATE", "seed_type": "window", "seed_id": "WIN002", "field": "name", "old_value": "午餐窗口", "new_value": "中餐窗口", "reason": "字段值不匹配"},
    ...
    {"action": "FLAG_EXTRA", "seed_type": "window", "seed_id": "WIN006", "data": {...}, "reason": "旧库冗余数据，建议人工确认"},
    ...
  ]
}
```

**验证要点:**
- `dry_run: true` 表示预检模式
- `actions_count: 15` 表示将执行15个操作
- 包含详细的操作列表：UPDATE（更新不匹配字段）和 FLAG_EXTRA（标记冗余数据）
- **注意**: 预检模式不会实际修改数据库

---

### 8. 应用迁移（实际应用 - dry_run=false）

```bash
curl -s -X POST http://localhost:8000/api/migrate -H "Content-Type: application/json" -d '{"dry_run": false}'
```

**预期响应:**
```json
{
  "success": true,
  "dry_run": false,
  "batch_number": "BATCH_20260505230634",
  "message": "迁移应用完成",
  "actions_count": 15,
  "actions": [...]
}
```

**验证要点:**
- `dry_run: false` 表示已实际应用
- `success: true` 表示迁移成功
- 迁移完成后再次调用 `/api/precheck` 验证数据一致性

---

### 9. 重跑种子（幂等验证）

```bash
curl -s -X POST http://localhost:8000/api/rerun-seeds -H "Content-Type: application/json"
```

**预期响应:**
```json
{
  "success": true,
  "batch_number": "BATCH_20260505230727",
  "message": "种子重跑完成（幂等）",
  "summary": {
    "total_inserted": 3,
    "total_updated": 0,
    "total_skipped": 23
  },
  "details": {
    "migration": {"total": 3, "inserted": 3, "updated": 0, "skipped": 0},
    "window": {"total": 5, "inserted": 0, "updated": 0, "skipped": 5},
    "allergen": {"total": 6, "inserted": 0, "updated": 0, "skipped": 6},
    "role": {"total": 4, "inserted": 0, "updated": 0, "skipped": 4},
    "package": {"total": 8, "inserted": 0, "updated": 0, "skipped": 8}
  }
}
```

**验证要点:**
- `total_skipped: 23` 表示已有23个数据hash相同，被跳过（幂等）
- `total_inserted: 3` 表示新增3个迁移版本记录
- 重复执行此命令，`skipped` 数量会保持一致

**可选: 指定种子类型重跑**
```bash
curl -s -X POST http://localhost:8000/api/rerun-seeds -H "Content-Type: application/json" -d '{"seed_types": ["window", "package"]}'
```

---

### 10. 导出一致性报告（JSON格式）

```bash
curl -s "http://localhost:8000/api/report?format=json"
```

**预期响应包含:**
- `generated_at`: 报告生成时间
- `status_summary`: 状态概览（一致性状态、数据统计）
- `differences`: 差异详情（与precheck接口相同）
- `batch_history`: 最近10个批次记录
- `seed_inventory_stats`: 种子清单统计
- `manual_fixes`: 最近20条人工修复记录

---

### 11. 导出一致性报告（Markdown格式）

```bash
curl -s "http://localhost:8000/api/report?format=markdown"
```

**返回内容示例:**
```markdown
# 食堂点餐系统数据迁移一致性报告

**生成时间**: 2026-05-05T23:07:39.968026

## 状态概览

- **数据一致性**: ❌ 存在差异
- **活跃窗口**: 6 个
- **过敏原标签**: 7 个
- **系统角色**: 5 个
- **活跃套餐**: 8 个

## 差异详情

- **预期总数**: 23
- **实际总数**: 27
- **匹配**: 23
- **缺失**: 0
- **不匹配**: 0
- **冗余**: 4

### Window

- 预期: 5, 实际: 6
- 匹配: 5, 缺失: 0, 不匹配: 0, 冗余: 1

#### 冗余项（需人工确认）

- **WIN006**: 夜宵窗口

...
```

---

### 12. 数据统计

```bash
curl -s http://localhost:8000/api/stats
```

**预期响应:**
```json
{
  "business_data": {
    "windows": 6,
    "allergens": 7,
    "roles": 5,
    "packages": 9
  },
  "migration_data": {
    "batches": 7,
    "manual_fixes": 11
  },
  "seed_inventory_stats": {
    "allergen": {"applied": 6, "imported": 1},
    "migration": {"applied": 3},
    "package": {"applied": 8, "imported": 1},
    "role": {"applied": 4, "imported": 1},
    "window": {"applied": 5, "imported": 1}
  }
}
```

---

## 迁移回滚机制

### 设计说明

本系统采用 **"软回滚"** 策略，通过以下机制保证数据安全：

1. **批次记录**: 所有操作都记录在 `batch_records` 表中
2. **人工修复日志**: 所有数据修改都记录在 `manual_fixes` 表中，包含：
   - 种子类型和ID
   - 修改的字段名
   - 旧值和新值
   - 修改原因
   - 关联的批次号

### 查看修复记录

```bash
curl -s "http://localhost:8000/api/report?format=json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d['manual_fixes'], indent=2))"
```

### 手动回滚示例

如果需要回滚某个批次的修改，可以通过 `manual_fixes` 表中的记录手动恢复：

```sql
-- 查询某个批次的所有修复记录
SELECT * FROM manual_fixes WHERE batch_number = 'BATCH_20260505230634';
```

每条记录都包含 `old_value` 字段，可以用于恢复原始数据。

---

## 典型迁移流程

### 完整流程

```bash
# 1. 健康检查
curl -s http://localhost:8000/health

# 2. 导入旧库样例（模拟实际迁移场景）
curl -s -X POST http://localhost:8000/api/import-old -H "Content-Type: application/json"

# 3. 预检差异
curl -s http://localhost:8000/api/precheck

# 4. 应用迁移（先预检）
curl -s -X POST http://localhost:8000/api/migrate -H "Content-Type: application/json" -d '{"dry_run": true}'

# 5. 确认无误后，实际应用迁移
curl -s -X POST http://localhost:8000/api/migrate -H "Content-Type: application/json" -d '{"dry_run": false}'

# 6. 验证一致性
curl -s http://localhost:8000/api/precheck

# 7. 导出报告
curl -s "http://localhost:8000/api/report?format=json"
curl -s "http://localhost:8000/api/report?format=markdown"
```

### 新环境初始化

```bash
# 全新环境一键初始化
curl -s -X POST http://localhost:8000/api/init -H "Content-Type: application/json"

# 验证一致性
curl -s http://localhost:8000/api/precheck
```

---

## 种子数据说明

### 窗口数据 (5个)

| 编码 | 名称 | 楼层 |
|------|------|------|
| WIN001 | 早餐窗口 | 1F |
| WIN002 | 中餐窗口 | 1F |
| WIN003 | 晚餐窗口 | 1F |
| WIN004 | 特色餐窗口 | 2F |
| WIN005 | 清真窗口 | 2F |

### 过敏原标签 (6个)

| 编码 | 名称 | 图标 |
|------|------|------|
| ALLER001 | 花生 | 🥜 |
| ALLER002 | 海鲜 | 🦐 |
| ALLER003 | 乳制品 | 🥛 |
| ALLER004 | 小麦 | 🌾 |
| ALLER005 | 大豆 | 🫘 |
| ALLER006 | 坚果 | 🌰 |

### 系统角色 (4个)

| 编码 | 名称 | 默认角色 | 说明 |
|------|------|----------|------|
| ROLE_ADMIN | 系统管理员 | 否 | 拥有所有权限 |
| ROLE_STAFF | 食堂员工 | 是 | 日常运营人员 |
| ROLE_STUDENT | 学生用户 | 是 | 普通点餐用户 |
| ROLE_KITCHEN | 后厨人员 | 否 | 餐品制作人员 |

### 套餐数据 (8个)

| 编码 | 名称 | 价格 | 窗口 | 过敏原 |
|------|------|------|------|--------|
| PKG001 | 营养早餐A | 8.5 | WIN001 | 小麦、乳制品 |
| PKG002 | 营养早餐B | 6.0 | WIN001 | 小麦、大豆 |
| PKG003 | 经典午餐A | 15.0 | WIN002 | 小麦 |
| PKG004 | 经典午餐B | 14.0 | WIN002 | 花生、小麦 |
| PKG005 | 晚餐套餐A | 12.0 | WIN003 | 小麦 |
| PKG006 | 晚餐套餐B | 13.0 | WIN003 | 小麦 |
| PKG007 | 特色小吃A | 10.0 | WIN004 | 小麦、大豆 |
| PKG008 | 清真套餐A | 15.0 | WIN005 | 小麦 |

---

## 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `DB_PATH` | `canteen_migration.db` | SQLite数据库文件路径 |

**使用示例:**
```bash
DB_PATH=/data/migration.db python3 main.py
```

---

## 许可证

内部使用
