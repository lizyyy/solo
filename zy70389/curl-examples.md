# 组织架构同步 API - cURL 示例

## 1. 新增员工 (hire)

```bash
curl -X POST http://localhost:3000/api/org-sync/import \
  -H 'Content-Type: application/json' \
  -d '{
    "source": "HR-SYNC-20260513",
    "employees": [
      {
        "employee_id": "emp_2001",
        "action": "hire",
        "name": "赵六",
        "emp_no": "E2001",
        "department_id": "dept_tech",
        "position": "前端工程师",
        "roles": ["employee"]
      }
    ]
  }'
```

## 2. 员工调岗 (transfer)

```bash
curl -X POST http://localhost:3000/api/org-sync/import \
  -H 'Content-Type: application/json' \
  -d '{
    "source": "HR-SYNC-20260513",
    "employees": [
      {
        "employee_id": "emp_1001",
        "action": "transfer",
        "department_id": "dept_ops",
        "position": "技术主管"
      }
    ]
  }'
```

## 3. 部门合并 (merge)

```bash
curl -X POST http://localhost:3000/api/org-sync/import \
  -H 'Content-Type: application/json' \
  -d '{
    "source": "HR-SYNC-20260513",
    "departments": [
      {
        "id": "dept_ops",
        "name": "运维部",
        "action": "merge",
        "target_dept_id": "dept_tech"
      }
    ]
  }'
```

## 4. 离职回收 (terminate) - 敏感角色会被特别标记

```bash
curl -X POST http://localhost:3000/api/org-sync/import \
  -H 'Content-Type: application/json' \
  -d '{
    "source": "HR-SYNC-20260513",
    "employees": [
      {
        "employee_id": "emp_1003",
        "action": "terminate"
      }
    ]
  }'
```

## 5. 重复同步 (同一条离职再次导入)

```bash
# 第二次导入同一条离职，不会重复回收权限
curl -X POST http://localhost:3000/api/org-sync/import \
  -H 'Content-Type: application/json' \
  -d '{
    "source": "HR-SYNC-20260513-DUPLICATE",
    "employees": [
      {
        "employee_id": "emp_1003",
        "action": "terminate"
      }
    ]
  }'
```

## 6. 同员工多条变更 (冲突检测)

```bash
curl -X POST http://localhost:3000/api/org-sync/import \
  -H 'Content-Type: application/json' \
  -d '{
    "source": "HR-SYNC-20260513",
    "employees": [
      {
        "employee_id": "emp_1002",
        "action": "transfer",
        "department_id": "dept_tech",
        "position": "架构师"
      },
      {
        "employee_id": "emp_1002",
        "action": "update",
        "position": "高级架构师"
      }
    ]
  }'
```

## 7. 查询批次列表

```bash
curl http://localhost:3000/api/org-sync/batches
```

## 8. 查询单个批次详情

```bash
curl http://localhost:3000/api/org-sync/batches/{batch_id}
```

## 9. 重试失败的批次

```bash
curl -X POST http://localhost:3000/api/org-sync/batches/{batch_id}/retry
```

## 10. 查询员工部门历史

```bash
curl http://localhost:3000/api/employees/emp_1001/history
```
