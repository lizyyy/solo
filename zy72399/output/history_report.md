# 高压喷淋覆盖校验 - 复盘记录

**生成时间**: 2026-06-06 23:24:44
**当前阶段**: diagram_update

## 处理历史

### 1. step1_import
- 时间: 2026-06-06T23:24:43.598221
- sensor_count: 3
- photo_count: 0
- record_count: 3

### 2. step2_photo_review
- 时间: 2026-06-06T23:24:43.598293
- photo_count: 3
- reviewer: 老唐

### 3. step3_diagram_update
- 时间: 2026-06-06T23:24:43.598320
- quality_review_count: 1

## 记录详情

### 记录 REC_S-001_20260605100000
- 传感器: S-001
- 采样时间: 2026-06-05 10:00:00
- 覆盖率: 92.5%
- 口径: new
- 状态: normal
- 数据来源: sensor_import

### 记录 REC_S-002_20260605101500
- 传感器: S-002
- 采样时间: 2026-06-05 10:15:00
- 覆盖率: 88.0%
- 口径: new
- 状态: missing_half_hour
- 数据来源: sensor_import
- 复核人: 质检员

### 记录 REC_S-003_20260604144500
- 传感器: S-003
- 采样时间: 2026-06-04 14:45:00
- 覆盖率: 85.5%
- 口径: old
- 状态: supplemented
- 数据来源: photo_supplement

## 重新运行命令

```bash
# 运行完整校验流程
python -m spray_verification.cli run-full

# 仅运行正常材料校验
python -m spray_verification.cli run-normal

# 仅运行错口径材料校验
python -m spray_verification.cli run-conflict

# 仅运行补录材料校验
python -m spray_verification.cli run-supplement
```