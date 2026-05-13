# 数据质量规则 API - 补充说明

## 一、API 主要边界

### 1.1 功能边界
- **支持的规则类型**：5 种
  - `null_rate` - 空值率检查
  - `uniqueness` - 唯一性检查
  - `value_range` - 取值范围检查
  - `daily_fluctuation` - 日环比波动检查
  - `cross_table_consistency` - 跨表金额一致性检查

- **不支持的功能（已知边界）**：
  - 不支持 SQL 自定义表达式规则
  - 不支持实时流式数据检查（仅批处理）
  - 不支持规则模板/继承机制
  - 不支持规则分组/标签管理
  - 不支持告警通知（短信、邮件、钉钉等）
  - 不支持多租户隔离
  - 不支持权限控制/RBAC

### 1.2 数据边界
- **异常样本分页**：每页最多 100 条样本存储，查询时支持分页参数
- **任务去重**：基于 `dataset_id + rule_ids + check_date` 生成 hash，相同组合视为同一任务
- **质量分计算**：仅基于 `passed` 和 `failed` 规则计算，`config_error` 不计入分子分母
- **复发检测**：仅检测被标记为 `false_positive` 的样本再次出现的情况

### 1.3 阈值配置边界
| 规则类型 | 必填配置 | 取值范围 |
|---------|---------|---------|
| null_rate | max_null_rate | 0.0 - 1.0 |
| uniqueness | min_unique_ratio | 0.0 - 1.0 |
| value_range | min_value 或 max_value | 任意数值 |
| daily_fluctuation | max_increase_ratio 或 max_decrease_ratio | > 0 |
| cross_table_consistency | max_diff_ratio | 0.0 - 1.0 |

### 1.4 接口边界
- 所有接口返回格式统一为 `{code, message, data}`
- code=0 表示成功，code>0 表示失败
- 分页接口统一使用 `page` 和 `per_page` 参数
- 日期格式统一为 ISO 8601（YYYY-MM-DD）

---

## 二、一个失败路径

### 2.1 场景描述
用户配置了一个"取值范围"规则，阈值配置有误，导致检查任务执行失败。

### 2.2 步骤
1. **创建数据集**
```bash
curl -X POST http://localhost:5001/api/v1/datasets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试订单表",
    "source_type": "mysql",
    "connection_info": "...",
    "table_name": "orders"
  }'
```

2. **创建错误配置的规则**（threshold_config 中缺少 min_value/max_value）
```bash
curl -X POST http://localhost:5001/api/v1/rules \
  -H "Content-Type: application/json" \
  -d '{
    "dataset_id": 1,
    "rule_name": "错误的金额范围检查",
    "rule_type": "value_range",
    "column_name": "amount",
    "threshold_config": "{}"
  }'
```

3. **触发检查任务**
```bash
curl -X POST http://localhost:5001/api/v1/check-tasks \
  -H "Content-Type: application/json" \
  -d '{"dataset_id": 1}'
```

4. **查看任务结果**
```bash
curl http://localhost:5001/api/v1/check-tasks/1
```

### 2.3 预期行为
- 第 2 步接口应返回错误：`"value_range 规则的阈值配置不完整或无效"`
- 如果绕过了配置验证（如直接操作数据库），第 4 步的结果中应看到 `result_type = 'config_error'`
- 日报统计中 `config_errors` 字段会统计这类错误
- 质量分计算时会排除这个规则

### 2.4 失败路径流程图
```
创建规则 → 阈值验证失败 ← 返回错误
                      ↓
                  用户修正配置
                      ↓
                  重新创建规则 ✓
```

---

## 三、一次重复执行路径

### 3.1 场景描述
数据团队自动化脚本每天定时触发检查任务，但由于网络波动导致重复提交了相同的任务。

### 3.2 步骤
1. **准备环境**：已创建数据集和规则

2. **第一次提交任务**
```bash
curl -X POST http://localhost:5001/api/v1/check-tasks \
  -H "Content-Type: application/json" \
  -d '{
    "dataset_id": 1,
    "check_date": "2024-01-15"
  }'
```

**返回结果**：
```json
{
  "code": 0,
  "message": "检查任务已创建",
  "data": {
    "task_id": 1,
    "status": "pending",
    "is_duplicate": false
  }
}
```

3. **10 秒后，由于脚本重试，再次提交相同任务**
```bash
curl -X POST http://localhost:5001/api/v1/check-tasks \
  -H "Content-Type: application/json" \
  -d '{
    "dataset_id": 1,
    "check_date": "2024-01-15"
  }'
```

**返回结果**：
```json
{
  "code": 0,
  "message": "任务已存在，返回已有的任务",
  "data": {
    "task_id": 1,
    "status": "running",
    "is_duplicate": true
  }
}
```

4. **查询任务详情**（id 始终是 1，不会创建新任务）
```bash
curl http://localhost:5001/api/v1/check-tasks/1
```

### 3.3 去重机制
- **去重键**：`task_hash = SHA256(dataset_id + sorted(rule_ids) + check_date)`
- **数据库约束**：`task_hash` 字段有唯一索引
- **行为**：
  - 不存在 → 创建新任务，返回 `is_duplicate: false`
  - 已存在 → 返回已有任务，返回 `is_duplicate: true`，不重复执行

### 3.4 重复执行路径流程图
```
第一次提交 → 计算 hash → 检查数据库 → 不存在 → 创建任务(id=1) → 执行中
                                                       ↑
第二次提交 → 计算相同 hash → 检查数据库 → 已存在 → 返回已有任务(id=1) ← 不会重复执行
```

### 3.5 注意事项
- 如果想强制重新执行，需要指定不同的 `check_date` 或手动删除旧任务
- 不同的 `rule_ids` 组合会生成不同的 hash，视为不同任务
- 任务状态变化不影响去重判断（即使已 completed，相同参数再次提交仍返回该任务）

---

## 四、复查指南（下一轮直接照着查）

### 4.1 边界检查清单
- [ ] 规则类型只能是 5 种之一
- [ ] threshold_config 必须是合法 JSON
- [ ] 各规则类型的阈值字段必须完整且在有效范围内
- [ ] 跨表规则必须指定 target_dataset_id 和 target_column_name
- [ ] 异常样本存储最多 100 条
- [ ] 质量分计算排除 config_error

### 4.2 失败路径复查
```
步骤：
1. POST /rules 提交 value_range 规则，threshold_config = "{}"
2. 预期：返回 400 错误，提示配置不完整
3. 如果创建成功（绕过验证），POST /check-tasks 触发检查
4. GET /check-tasks/{id} 查看结果
5. 预期：result_type = 'config_error'
6. POST /daily-reports/generate 生成日报
7. 预期：config_errors > 0，质量分正确
```

### 4.3 重复执行路径复查
```
步骤：
1. POST /check-tasks，记录返回的 task_id 和 is_duplicate
2. 等待 5 秒（让任务开始执行）
3. 再次 POST /check-tasks，使用完全相同的参数
4. 预期：返回相同的 task_id，is_duplicate = true
5. GET /check-tasks 列表
6. 预期：只有 1 条任务记录
7. 检查任务状态（running/completed）
8. 预期：任务只执行一次
```

### 4.4 复发检测复查
```
步骤：
1. 执行检查任务，产生异常样本
2. POST /anomaly-samples/{id}/confirm，标记为 false_positive
3. 再次执行相同检查任务（相同数据）
4. GET /check-results/{result_id}/samples
5. 预期：新样本的 is_recurrence = true
6. 生成日报
7. 预期：recurrence_count > 0
```
