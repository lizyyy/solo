# 私募销售认购系统 - 快速上手指南

## 先跑什么？

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 运行压力测试（最快看到效果）
python -m tests.test_subscription
```

## 再看哪里？

| 想了解什么 | 看哪个文件 |
|-----------|-----------|
| 核心数据模型 | [models.py](file:///Users/lzy/pro/solo/workspaces/zy71220/private_fund/models.py) |
| 三者一起锁住逻辑 | [cool_off.py](file:///Users/lzy/pro/solo/workspaces/zy71220/private_fund/cool_off.py#L202-L233) |
| 材料过期校验 | [material_validator.py](file:///Users/lzy/pro/solo/workspaces/zy71220/private_fund/material_validator.py) |
| 重复认购拦截 | [duplicate_guard.py](file:///Users/lzy/pro/solo/workspaces/zy71220/private_fund/duplicate_guard.py) |
| 批量文件处理 | [batch_processor.py](file:///Users/lzy/pro/solo/workspaces/zy71220/private_fund/batch_processor.py) |
| 线索串联查询 | [clue_linker.py](file:///Users/lzy/pro/solo/workspaces/zy71220/private_fund/clue_linker.py) |
| 测试用例 | [test_subscription.py](file:///Users/lzy/pro/solo/workspaces/zy71220/tests/test_subscription.py) |

## 核心功能速查

### 1. 批量处理文件
```python
from private_fund.service import PrivateFundService

service = PrivateFundService()
result = service.process_subscription_file("认购数据.xlsx", "操作员张三")
```
- 支持 xlsx/csv/json 格式
- 自动分离正常/脏数据
- 按错误类型分组（冷静期问题/材料问题/回访问题/重复认购）
- 结果输出到 `./output/` 目录

### 2. 三者一起锁住
冷静期、材料、回访必须同时满足才能锁住，缺一不可：
```python
success, messages = service.lock_subscription(order, "操作员")
# 失败时 messages 包含具体原因，不是笼统错误
```

### 3. 线索串联查询
同事交接时说的关键词都能搜：
```python
# 按认购单号查
clues = service.find_clues(orders, "认购单", "TEST001")

# 按投资者ID查所有关联
investor_clues = service.find_by_investor(orders, "INV001")

# 支持关键词：认购单、投资者材料、冷静期、回访录音、打款流水、确认报告
```

### 4. 压力测试
```python
result = service.run_pressure_tests(orders)
# 返回：冷静期未满/材料过期/重复认购 三类详细结果
```

### 5. 报告导出
```python
report, messages = service.export_report(order, "操作员")
# 自动判断是否应该导出：校验不通过的不导出，冷静期未满的不导出
```

## 测试场景覆盖

| 场景 | 测试数据 | 预期结果 |
|------|---------|---------|
| 正常数据 | TEST001 张三 | ✓ 锁住成功，可导出报告 |
| 冷静期未满 | TEST002 李四 | ✗ 显示剩余小时数和结束时间 |
| 材料过期 | TEST003 王五 | ✗ 显示过期材料名、过期天数、过期日期 |
| 重复认购 | TEST004 张三(同INV001) | ✗ 显示同投资者同产品的所有订单号、金额、状态 |
| 冷静期未开始 | TEST005 赵六 | ✗ 提示冷静期未开始 |
| 缺材料+无回访 | TEST006 钱七 | ✗ 分别列出缺少的材料和回访问题 |

## 输出目录说明

```
./output/
├── clean_YYYYMMDD_HHMMSS.xlsx    # 正常通过的数据
├── dirty_YYYYMMDD_HHMMSS.xlsx    # 脏数据，含错误原因列
├── duplicates_YYYYMMDD_HHMMSS.json # 重复认购分组详情
└── summary_YYYYMMDD_HHMMSS.json  # 处理摘要

./reports/
└── confirm_report_*.json  # 确认报告，可通过 verify_report 验证
```

## 常见问题

**Q: 错误信息太笼统怎么办？**
A: 所有错误都附带具体原因，比如"冷静期还剩12.5小时(结束于2026-05-29 14:30:00)"，不会只说"校验失败"。

**Q: 如何快速复查脏数据？**
A: 看 `dirty_*.xlsx` 的"错误原因"列，或看 `summary_*.json` 的分类统计。

**Q: 报告导出了但找不到内容？**
A: 报告导出有取舍逻辑，校验不通过的订单不会导出，会在 messages 里说明跳过原因。
