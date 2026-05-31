# 星座覆盖缺口 - 使用说明

## 快速开始

```bash
# 1. 处理遥测样本数据
python coverage.py run ./telemetry_samples

# 2. 查看处理状态
python coverage.py status

# 3. 检查时间窗口重叠
python coverage.py overlaps

# 4. 导出任务简报
python coverage.py briefing
```

---

## 一、遥测片段样例放置

### 目录结构
```
telemetry_samples/
├── telemetry_*.json          # 遥测系统数据
├── payload_plan_*.json       # 载荷计划数据
├── schedule_*.json           # 总体调度数据
└── manual_correction_*.json  # 人工更正数据
```

### 数据格式要求
每条记录必须包含以下字段：

```json
{
  "id": "",
  "satellite": "SAT-01",
  "start_time": "2026-05-31T08:00:00",
  "end_time": "2026-05-31T08:15:00",
  "status": "pending",
  "source": {
    "type": "telemetry",
    "system": "遥测系统A",
    "file": "telemetry_01.json",
    "import_time": "2026-05-31T08:16:00"
  },
  "content": {
    "task_type": "成像任务",
    "time_system": "UTC"
  },
  "pending_reason": "",
  "tags": ["成像"]
}
```

### 支持的来源类型
| 类型 | 说明 |
|------|------|
| `telemetry` | 遥测数据 |
| `payload_plan` | 载荷计划 |
| `schedule` | 总体调度 |
| `manual` | 人工更正 |

### 时间制说明
- **UTC**: 协调世界时
- **BJT**: 北京时间 (UTC+8)
- 系统会自动检测不同来源的时间制差异，标记为待处理

---

## 二、查看窗口重叠

### 命令
```bash
python coverage.py overlaps
```

### 重叠判定规则
1. 同一卫星的两条记录
2. 时间区间存在交集
3. 来源系统不同（遥测 vs 计划 vs 调度）

### 重叠原因分类
| 原因 | 处理建议 |
|------|----------|
| 时间制混用（UTC vs BJT） | 统一转换后再核对 |
| 计划调整未同步 | 以最新人工更正为准 |
| 真实冲突 | 需总体协调 |

### 查看重叠详情
```bash
# 列出所有待处理记录
python coverage.py list --status pending

# 查看具体记录详情
python coverage.py show <记录ID>
```

---

## 三、导出任务简报前复核流程

### 第一步：运行批量处理
```bash
# 安全模式运行（验证幂等性）
python coverage.py run ./telemetry_samples --safe
```
✓ 确认：重复运行结果一致，数据无变化

### 第二步：检查统计状态
```bash
python coverage.py status
```
复核清单：
- [ ] **pending 状态**：确认所有待处理原因合理
- [ ] **duplicate 状态**：确认重复标记正确
- [ ] **late_arrival 状态**：确认晚到数据是否影响分析
- [ ] **各来源分布**：确认数据完整性

### 第三步：检查窗口重叠
```bash
python coverage.py overlaps
```
复核清单：
- [ ] 确认重叠是否为时间制混用导致
- [ ] 载荷计划与遥测实际执行是否一致
- [ ] 总体调度与载荷计划是否存在冲突

### 第四步：人工处理异常
```bash
# 标记为已解决
python coverage.py resolve <记录ID> --reason "时间制已统一转换，确认正常" --actor "张三"

# 标记为废弃
python coverage.py discard <记录ID> --reason "重复数据，已存在主记录" --actor "李四"
```

### 第五步：导出最终简报
```bash
python coverage.py briefing --output final_briefing.json
```

**简报包含内容：**
1. 导出时间与统计摘要
2. 待处理记录列表（含来源、原因）
3. 窗口重叠明细（跨系统对比）
4. 复核检查清单

---

## 四、批量处理特性

### 幂等性保证
- 基于文件哈希的检查点机制
- 相同输入重复运行，输出结果一致
- 不会重复导入相同文件
- 不会越跑越多、越改越乱

### 审计追踪
每条记录的完整变更历史：
```
[时间] 操作人: 状态变更
  原因: xxx
```

### 数据持久化
- 记录存储：`./data/records.json`
- 检查点：`./data/.checkpoint.json`
- 重置命令：`python coverage.py reset`

---

## 五、状态说明

| 状态 | 说明 |
|------|------|
| `pending` | 待处理，需要人工确认 |
| `normal` | 正常，自动校验通过 |
| `late_arrival` | 晚到附件，数据补传 |
| `duplicate` | 重复项，已标记主记录 |
| `manual_corrected` | 人工更正 |
| `time_conflict` | 时间冲突 |
| `resolved` | 已解决 |
| `discarded` | 已废弃 |

---

## 六、典型工作流

```
任务计划软件
      ↓
导出遥测片段 → 放入 telemetry_samples/
      ↓
coverage run ./telemetry_samples  # 批量处理
      ↓
coverage status                    # 检查状态
      ↓
coverage overlaps                  # 检查重叠
      ↓
coverage resolve/discard           # 人工处理
      ↓
coverage briefing                  # 导出简报
      ↓
联调窗口复核
```
