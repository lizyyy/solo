# 联邦学习客户端掉队检测系统

## 一、边界规则（写在代码里，不只靠口头约定）

### 1.1 时间窗穿越判定规则

**判定条件**（满足任一即触发）：
- 同一轮次内，特征快照时间跨度 > 24小时
- 训练日志与快照时间差 > 24小时
- 跨天数据混入同一轮次训练

**代码位置**：[detector.py](file:///Users/lzy/pro/solo/workspaces/zy72563/detector.py#L12-L44)

**后果**：
- 效果虚高：跨时间窗数据可能包含不同分布样本，导致评估指标失真
- 必须标记为 `time_window_crossed`，状态自动设为 `pending_review`
- **绝对不能自动归为正常，必须留给实验平台负责人复核**

---

### 1.2 异常判定流程

```
时间窗穿越?
    ├─ 是 → 标记 pending_review → 负责人复核
    └─ 否 → 异常分数 > 0.6?
              ├─ 是 → 标记 suspicious_pattern → 人工确认
              └─ 否 → normal
```

**代码位置**：[detector.py](file:///Users/lzy/pro/solo/workspaces/zy72563/detector.py#L74-L117)

---

### 1.3 怎么判、怎么改、怎么回滚

| 操作 | 方法 | 代码位置 |
|------|------|----------|
| **判定** | `detector.check_boundary_rules()` | [detector.py](file:///Users/lzy/pro/solo/workspaces/zy72563/detector.py#L74-L117) |
| **修改备注** | `manager.update_remarks()` | [manager.py](file:///Users/lzy/pro/solo/workspaces/zy72563/manager.py#L96-L102) |
| **复核** | `manager.review_record()` | [manager.py](file:///Users/lzy/pro/solo/workspaces/zy72563/manager.py#L104-L146) |
| **回滚** | `manager.rollback_record()` | [manager.py](file:///Users/lzy/pro/solo/workspaces/zy72563/manager.py#L148-L154) |
| **查历史** | `manager.get_record_history()` | [manager.py](file:///Users/lzy/pro/solo/workspaces/zy72563/manager.py#L156-L158) |

**复核决定选项**：
- `confirm_dropout` → 确认掉队
- `mark_normal` → 标记正常
- `rollback` → 回滚操作

---

## 二、核心机制

### 2.1 重复导入不翻倍

- 同一 `snapshot_id` 重复导入时自动跳过
- 不会重复创建掉队记录
- **代码位置**：[storage.py](file:///Users/lzy/pro/solo/workspaces/zy72563/storage.py#L43-L51)

### 2.2 历史记录可追溯

- 任何字段修改都留痕（含备注修改）
- 可查看「改前值 → 改后值」完整对比
- 记录修改人、修改时间
- **代码位置**：[storage.py](file:///Users/lzy/pro/solo/workspaces/zy72563/storage.py#L112-L124)

### 2.3 可视化服务复核

- 3D/图表展示时，**必须保留可回溯引用**
- 点击数据点可跳转至：
  - 对应特征快照编号
  - 对应训练日志曲线
- 不能只剩漂亮画面
- **代码位置**：[manager.py](file:///Users/lzy/pro/solo/workspaces/zy72563/manager.py#L198-L202)

---

## 三、标准三步流程

### 流程说明

必须走完以下三步，遇到时间窗穿越**别急着归正常**，留给实验平台负责人复核。

| 步骤 | 操作 | 责任人 |
|------|------|--------|
| **第一步** | 特征快照编号第一次导入 | 系统/数据工程师 |
| **第二步** | 算法工程师小乔补看训练日志曲线 | 小乔 |
| **第三步** | 异常样本页更新，时间窗穿越留待复核 | 系统自动 → 负责人 |

---

## 四、快速开始

### 4.1 安装依赖

```bash
pip install -r requirements.txt
```

### 4.2 运行三步流程演示

```bash
python demo_three_steps.py
```

### 4.3 CLI 命令使用

```bash
# 导入特征快照
python cli.py snapshot import -f sample_snapshots.json -u qiao_xiaoqiao

# 查看快照列表
python cli.py snapshot list

# 查看训练日志
python cli.py log list -c client_A -r 5

# 创建掉队记录（自动检测时间窗穿越）
python cli.py record create -c client_A -r 5 -u qiao_xiaoqiao -m "初始检测"

# 查看待复核记录
python cli.py record pending

# 修改备注（自动留痕）
python cli.py record remarks -r <record_id> -m "新备注内容" -u qiao_xiaoqiao

# 查看历史记录
python cli.py record history -r <record_id>

# 负责人复核
python cli.py record review -r <record_id> -d confirm_dropout -u leader -n "已确认掉队"

# 查看可视化数据（含回溯引用）
python cli.py record viz -r <record_id>

# 查看复盘命令清单
python cli.py record replay -r <record_id>
```

---

## 五、输出物说明

### 5.1 不是功能清单，是可复盘的记录

每条掉队记录包含：
1. 完整的关联快照和日志
2. 修改历史（谁改了什么、什么时候改的）
3. 复核记录和决定
4. **可重新跑的命令清单**

### 5.2 复盘命令示例

```bash
# 查看关联快照
python cli.py snapshot show --snapshot-id snap_001
python cli.py snapshot show --snapshot-id snap_003

# 查看关联日志
python cli.py log show --log-id log_001
python cli.py log show --log-id log_002

# 查看记录详情
python cli.py record show --record-id <record_id>

# 查看修改历史
python cli.py record history --record-id <record_id>
```

---

## 六、项目结构

```
.
├── config.py              # 配置（时间窗、阈值等）
├── models.py              # 数据模型定义
├── storage.py             # 存储管理（去重、持久化）
├── detector.py            # 检测逻辑（时间窗穿越、异常评分）
├── manager.py             # 业务逻辑（复核、回滚、历史）
├── cli.py                 # 命令行接口
├── demo_three_steps.py    # 三步流程演示
├── sample_data.py         # 示例数据生成
├── data/                  # 数据目录
│   ├── snapshots/         # 特征快照
│   ├── training_logs/     # 训练日志
│   ├── dropout_records/   # 掉队记录
│   └── history/           # 历史记录
└── README.md              # 本文档
```

---

## 七、关键配置（可修改）

| 配置项 | 默认值 | 说明 | 文件 |
|--------|--------|------|------|
| `TIME_WINDOW_HOURS` | 24 | 时间窗小时数 | [config.py](file:///Users/lzy/pro/solo/workspaces/zy72563/config.py#L10) |
| `MAX_DROPOUT_THRESHOLD` | 0.3 | 最大掉队比例阈值 | [config.py](file:///Users/lzy/pro/solo/workspaces/zy72563/config.py#L11) |

---

## 八、记住的细节

1. **时间窗穿越 = 效果虚高嫌疑** → 必须 `pending_review`
2. **别急着归正常** → 留给实验平台负责人
3. **改一条备注也留痕** → 历史里能看出改前改后
4. **重复导入不翻倍** → snapshot_id 去重
5. **图表要能回溯** → 点数据点能回到快照或日志
6. **输出可复盘** → 给记录和重跑命令，不给功能清单
