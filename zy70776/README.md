# 发布清单核对缺项分级后端API

用于自动化检查发布清单中的制品、迁移脚本、回滚步骤等缺项并分级，支持审计追踪和负责人汇总。

## 功能特性

- ✅ 发布清单CRUD和状态流转管理
- ✅ 制品存在性自动校验
- ✅ 迁移脚本完整性检查（含回滚方案）
- ✅ 回滚步骤完整性检查
- ✅ 问题缺项四级分级（CRITICAL/HIGH/MEDIUM/LOW）
- ✅ 按负责人汇总问题统计
- ✅ 人工修正标记和审计日志
- ✅ 报告导出功能
- ✅ 异常路径保留原始输入和处理记录

## 快速启动

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 访问API文档

打开浏览器访问: http://localhost:8000/docs

## 造数脚本

创建测试数据目录和文件:

```bash
# 创建测试制品目录
mkdir -p /tmp/test_artifacts

# 创建一个存在的制品
echo "test artifact content" > /tmp/test_artifacts/app-v1.0.0.jar

# 创建一个存在的迁移脚本
echo "CREATE TABLE test (id INT);" > /tmp/test_artifacts/migration-v1.sql
```

## API 主流程调用示例 (curl)

### 1. 创建发布清单 (包含故意遗漏的项)

```bash
curl -X POST "http://localhost:8000/api/v1/checklists/" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "v1.0.0",
    "title": "订单系统发布",
    "description": "2024年Q1版本发布",
    "owner": "zhangsan",
    "raw_input": "原始提交的发布清单内容",
    "artifacts": [
      {"name": "订单服务JAR包", "path": "/tmp/test_artifacts/app-v1.0.0.jar", "version": "v1.0.0"},
      {"name": "支付服务JAR包", "path": "/tmp/test_artifacts/payment-v1.0.0.jar", "version": "v1.0.0"}
    ],
    "migration_scripts": [
      {"name": "订单表结构变更", "path": "/tmp/test_artifacts/migration-v1.sql", "description": "新增订单索引", "rollback_available": false}
    ],
    "rollback_steps": [
      {"step_order": 1, "description": "停止订单服务", "owner": "lisi"},
      {"step_order": 2, "description": "回滚数据库变更", "owner": null}
    ]
  }'
```

### 2. 查询所有发布清单

```bash
curl "http://localhost:8000/api/v1/checklists/"
```

### 3. 推进状态到待审核

```bash
curl -X PATCH "http://localhost:8000/api/v1/checklists/1/status?new_status=pending_review&operator=zhangsan&conclusion=清单编制完成"
```

### 4. 生成核对报告

```bash
curl -X POST "http://localhost:8000/api/v1/checklists/1/reports?generated_by=audit_system"
```

### 5. 查看核对报告

```bash
curl "http://localhost:8000/api/v1/reports/1"
```

### 6. 人工修正问题项

```bash
curl -X PATCH "http://localhost:8000/api/v1/reports/1/items/fix" \
  -H "Content-Type: application/json" \
  -d '{
    "item_id": 1,
    "fixed": true,
    "fixed_by": "zhangsan",
    "fix_note": "已补充支付服务JAR包到制品目录"
  }'
```

### 7. 按负责人汇总统计

```bash
curl "http://localhost:8000/api/v1/reports/1/summary-by-owner"
```

### 8. 导出报告为文本

```bash
curl "http://localhost:8000/api/v1/reports/1/export" -o report.txt
```

### 9. 撤回发布清单

```bash
curl -X POST "http://localhost:8000/api/v1/checklists/1/withdraw?operator=manager&reason=发现严重安全漏洞需要重新评估"
```

### 10. 关闭发布清单

```bash
curl -X POST "http://localhost:8000/api/v1/checklists/1/close?operator=manager&reason=发布完成，清单归档"
```

## 冲突路径/异常场景示例

### 场景1: 查询不存在的清单

```bash
curl "http://localhost:8000/api/v1/checklists/9999"
# 返回: 404 Not Found - "Checklist not found"
```

### 场景2: 对不存在的清单生成报告

```bash
curl -X POST "http://localhost:8000/api/v1/checklists/9999/reports?generated_by=test"
# 返回: 404 Not Found
```

### 场景3: 修正不存在的报告项

```bash
curl -X PATCH "http://localhost:8000/api/v1/reports/1/items/fix" \
  -H "Content-Type: application/json" \
  -d '{"item_id": 9999, "fixed": true, "fixed_by": "test"}'
# 返回: 404 Not Found - "Report item 9999 not found"
```

### 场景4: 导出不存在的报告

```bash
curl "http://localhost:8000/api/v1/reports/9999/export"
# 返回: 404 Not Found - "Report not found"
```

## 问题分级说明

| 级别 | 说明 | 示例 |
|------|------|------|
| CRITICAL | 严重阻断发布 | 制品不存在、无迁移脚本、无回滚步骤 |
| HIGH | 高风险需要整改 | 迁移脚本无回滚方案 |
| MEDIUM | 中等风险建议整改 | 回滚步骤无负责人 |
| LOW | 低风险可选整改 | 描述不完整等 |

## 状态流转说明

```
draft → pending_review → reviewing → approved
                                      ↓
                                   rejected
                    ↓
                 withdrawn ← (任意状态)
                    ↓
                 closed ← (任意状态)
```

## 运行测试

```bash
# 运行所有测试
pytest app/tests/ -v

# 运行特定测试
pytest app/tests/test_checklists.py -v

# 生成测试覆盖率报告
pytest app/tests/ --cov=app --cov-report=html
```

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI主入口
│   ├── database.py          # 数据库配置
│   ├── models/              # SQLAlchemy数据模型
│   │   ├── __init__.py
│   │   ├── checklist.py     # 清单相关模型
│   │   ├── report.py        # 报告相关模型
│   │   └── audit.py         # 审计日志模型
│   ├── schemas/             # Pydantic请求/响应模型
│   │   ├── __init__.py
│   │   ├── checklist.py
│   │   └── report.py
│   ├── services/            # 业务逻辑层
│   │   ├── __init__.py
│   │   ├── checklist_service.py
│   │   └── report_service.py
│   ├── api/                 # API路由层
│   │   ├── __init__.py
│   │   ├── checklists.py
│   │   └── reports.py
│   └── tests/               # 测试用例
│       ├── __init__.py
│       ├── conftest.py
│       ├── test_checklists.py
│       └── test_reports.py
├── requirements.txt
├── pyproject.toml
├── README.md
└── release_checklist.db     # SQLite数据库文件(运行后生成)
```

## 审计日志

所有关键操作都会记录审计日志，包括:
- 状态变更（记录原始状态和处理结论）
- 清单更新（记录更新前的原始数据）
- 人工修正（记录修正前后状态和处理说明）

审计日志可通过数据库直接查询，用于追责和回溯。
