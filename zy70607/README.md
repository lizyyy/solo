# 宠物店喂药计划班次确认变更留痕排查CLI工具

## 功能概述
- 宠物档案管理
- 寄养订单管理
- 喂药计划（含剂量版本控制）
- 班次执行确认
- 变更确认与留痕
- 漏喂告警
- 护理报告导出

## 快速开始
```bash
python3 -m pet_med_cli --help
```

## 完整验证流程
```bash
# 1. 查看帮助
python3 -m pet_med_cli --help

# 2. 生成样例数据
python3 sample_data.py

# 3. 验证数据完整性（检查脏数据）
python3 -m pet_med_cli validate --data-dir ./data/dirty

# 4. 查看宠物、订单、计划列表
python3 -m pet_med_cli pet list
python3 -m pet_med_cli order list
python3 -m pet_med_cli plan list

# 5. 记录班次执行
python3 -m pet_med_cli shift record --plan-id PLAN-XXX --date 2026-05-17 --type morning --status administered --by 护士A

# 6. 检查漏喂告警
python3 -m pet_med_cli shift check-missed

# 7. 生成护理报告（含导出）
python3 -m pet_med_cli report generate --order-id ORD-XXX --start 2026-05-17 --end 2026-05-24 --export

# 8. 变更确认流程
python3 -m pet_med_cli plan update --plan-id PLAN-XXX --amount 250 --by 医生
python3 -m pet_med_cli change pending
python3 -m pet_med_cli change confirm --change-id CHG-XXX --by 店长
```
