# 无人船横摇周期估算质检工具

## 一、安装与启动

### 环境要求
- Python 3.8+

### 安装依赖
```bash
cd /path/to/zy72360
pip install -r requirements.txt
```

### 启动与运行测试
```bash
# 运行完整操作路径测试（覆盖所有场景）
python3 run_full_test.py

# 运行后检查 data/session_test.json 是否生成（暂停续局功能）
ls -la data/
```

## 二、核心功能

本工具用于无人船横摇周期估算的质量检验，重点解决以下问题：
1. **温度校准记录一晚后到**：采样间隔说明先导入，校准记录晚到，自动触发冲突检测
2. **安全提醒与历史记录一致**：所有操作围绕同一条 record_id 关联更新
3. **冲突不自动拍板**：列出冲突证据，由质检员小白人工选择确认/驳回/修正
4. **传感器编号变更**：不急着归正常，留给安全员复核
5. **暂停续局**：支持保存/恢复整个会话，断点续做

## 三、完整操作路径（三步流程）

### 第一步：导入采样间隔说明
```python
from src import QualityWorkflow
wf = QualityWorkflow()

result = wf.step1_import_sampling_record({
    "record_id": "SAMPLE-001",
    "ship_id": "SHIP-A",
    "sensor_id": "SENSOR-A01",
    "sampling_interval": 0.05,
    "sampling_start_time": "2026-06-08T20:00:00",
    "sampling_end_time": "2026-06-08T22:00:00",
    "roll_periods": [12.5, 12.3, 12.6],
    "import_user": "操作员张三"
})
```
- 返回：状态、版本号、关联链接、是否需人工关注

### 第二步：导入温度校准记录，列出冲突证据
```python
cal_result = wf.step2_import_calibration_and_check({
    "calibration_id": "CAL-A001",
    "ship_id": "SHIP-A",
    "sensor_id": "SENSOR-A01",
    "calibration_time": "2026-06-08T18:00:00",
    "effective_sampling_interval": 0.04,  # 与采样说明0.05s矛盾
    "calibration_temperature": 32.5,
    "operator": "校准员李四"
})
# cal_result 包含受影响记录列表和每条冲突证据
```
- **不自动处理**，列出每条冲突：
  - 原始采样值（采样声明）
  - 校准有效值（温度校准后）
  - 差异描述
  - 冲突ID

**质检员小白处理冲突（三选一）：**
```python
# 选项1：确认以采样记录为准
wf.resolve_conflict(conflict_id, "以采样记录为准", "质检员小白")

# 选项2：驳回以校准数据为准
wf.resolve_conflict(conflict_id, "以校准数据为准", "质检员小白")

# 选项3：修正为折中值，留给安全员复核
wf.resolve_conflict(
    conflict_id, 
    "冲突存在，折中处理", 
    "质检员小白",
    handler_after="安全员王五复核后归档",  # 明确下一步找谁
    correct_value=0.045                     # 指定改后值
)
```

### 第三步：更新安全提醒，留给安全员复核
```python
safety = wf.step3_update_safety_reminders("质检员小白")
```
每条安全提醒包含：
- 级别（高/中）、标题、详细说明
- 关联的记录ID、冲突ID
- **原始说法**（采样记录声明的值）
- **改后说法**（校准或修正后的值）
- **下一步找谁**（明确交接人）

**安全员复核（仍需人工，不自动归正常）：**
```python
wf.review_safety_reminder(
    reminder_id, 
    "安全员王五", 
    is_approved=True,
    review_note="现场核查正常，确认归档"
)
```
- 复核通过：状态→正常/已确认
- 复核不通过：保留待处理，退回数据提供方

## 四、暂停续局

### 保存当前会话（暂停）
```python
wf.save_session("data/night_shift_session.json", "夜间批次-6月8日")
```
- 保存所有记录、校准、冲突、提醒、历史日志
- 生成JSON格式快照

### 恢复会话（续做）
```python
wf2 = QualityWorkflow()
wf2.load_session("data/night_shift_session.json")
```
- 恢复后同一条 record_id 的：
  - 状态一致 ✓
  - 采样间隔一致 ✓
  - 版本号一致 ✓
  - 关联冲突/提醒/校准一致 ✓

## 五、到处同步更新（同一条record_id）

所有接口从同一份数据源读取，保证：

| 接口 | 状态同步 | 版本同步 | 待提醒数同步 |
|------|---------|---------|------------|
| 仪表盘列表 (`get_dashboard`) | ✓ | ✓ | ✓ |
| 详情页 (`get_record_detail`) | ✓ | ✓ | ✓ |
| 摘要统计 (`summary`) | ✓ | ✓ | ✓ |
| 导出报告 (`export_record`) | ✓ | ✓ | ✓ |
| 历史记录 (`get_history`) | 按record_id过滤 | - | - |

## 六、人工复核信息完整保留

对需要复核的记录（如SAMPLE-001），在详情页通过 `get_record_detail()` 返回：

```json
{
  "review_infos": [
    {
      "field": "sampling_interval",
      "original_value": 0.05,        // 原始说法
      "corrected_value": 0.045,      // 改后的值
      "reason": "冲突处理：确认冲突存在，采用折中0.045s", // 处理原因
      "handled_by": "质检员小白",    // 处理人
      "next_handler": "安全员王五复核后归档", // 下一步找谁
      "result": "确认冲突存在，采用折中0.045s"
    }
  ],
  "status_tracking": {
    "current_status": "已修正",     // 不提前归"正常"
    "needs_manual_review": true,    // 明确标注需人工复核
    "next_handler": "安全员王五复核后归档"
  }
}
```

## 七、自检覆盖

| 自检项 | 说明 | 触发时机 |
|-------|------|---------|
| 重复导入检测 | 同record_id不允许二次导入 | step1导入时 |
| 传感器编号变更识别 | 同一船舶传感器ID变化，标记"待安全员复核" | step1导入时 |
| 补录后重算验证 | 补录前后估算值对比记录 | 补录后计算时 |
| 导出一致性检查 | MD5签名校验导出数据与原始数据一致 | 导出时 |

## 八、文件结构

```
zy72360/
├── src/
│   ├── __init__.py          # 统一导出入口
│   ├── models.py            # 数据模型：SamplingRecord, TemperatureCalibration, ReviewInfo 等
│   ├── conflict_detector.py # 采样间隔 vs 校准值 冲突检测
│   ├── self_check.py        # 四项自检
│   └── workflow.py          # QualityWorkflow 核心工作流（三步流程+暂停续局）
├── run_full_test.py         # 完整操作路径测试脚本（推荐运行）
├── data/                    # 会话快照保存目录
├── requirements.txt         # 依赖列表
└── README.md                # 本文件
```

## 九、典型场景测试结果

运行 `python3 run_full_test.py` 覆盖以下场景：

1. ✓ 正常材料导入 → 状态正常，无冲突
2. ✓ 错口径材料导入 → 触发冲突+列出证据+不自动拍板
3. ✓ 质检员选择折中修正 → 保留原始说法+改后值+原因+下一步找谁
4. ✓ 更新安全提醒 → 包含原始说法+改后说法+交接人
5. ✓ **暂停续局** → 保存/恢复后所有字段完全一致
6. ✓ 续局后检查：列表/详情/摘要/导出/历史 全部同步
7. ✓ 传感器重启编号变更 → 留待安全员复核，不提前归正常
8. ✓ 安全员现场复核 → 复核通过才归正常
9. ✓ 补录材料重算 → 主记录关联补录ID+重算估算值
10. ✓ 最终9项核心核对项全部通过
