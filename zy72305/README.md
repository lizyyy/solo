# 蒙特卡洛库存波动 - 批注追踪系统

## 快速安装启动

### 1. 环境要求
- Python 3.7+
- Flask 3.0.0

### 2. 安装步骤

```bash
# 进入项目目录
cd /Users/lzy/pro/solo/workspaces/zy72305

# 安装依赖
python3 -m pip install -r requirements.txt
# 或直接：
python3 -m pip install Flask==3.0.0

# 删除旧数据库（如有）以启用新字段
rm -f inventory_analysis.db

# 启动应用
python3 app.py
```

启动后访问：**http://127.0.0.1:5001**

---

## 系统边界规则

### 核心边界判断
代码位置：[service.py:195-205](file:///Users/lzy/pro/solo/workspaces/zy72305/service.py#L195-L205)

```
阈值 Threshold = 0.15
浮点精度比较：abs(value - threshold) < 1e-9
```

| 数值范围 | 判断结果 | 处理方式 |
|---------|---------|---------|
| value < 0.15 | `normal`（正常） | 自动判定，无需复核 |
| **value = 0.15** | **`pending_teacher_review`** | **边界值，不急着归正常，留给任课老师复核** |
| value > 0.15 | `warning`（异常） | 自动判定，无需复核 |

### 边界值在代码中的判断流程
1. 导入批注时若带 `boundary_value=0.15`，调用 `evaluate_boundary_case()`
2. 标记 `is_boundary_case = 1`，`needs_teacher_review = 1`
3. 自动进入**反例列表**，类型为 `boundary` + `teacher_pending`
4. 任课老师在详情页填写复核结论，选择最终判定 normal/warning
5. 老师确认后自动清除边界标记，退出反例列表（若其他反例类型也已处理）

---

## 反例类型与同步机制

代码位置：[service.py:50-80](file:///Users/lzy/pro/solo/workspaces/zy72305/service.py#L50-L80)

每次写入处理记录后，系统调用 `_sync_counterexample_flags()` 自动计算并同步反例类型：

| 反例类型 key | 标签 | 触发条件 |
|------------|------|---------|
| `boundary` | 边界值待复核 | `is_boundary_case = 1` |
| `teacher_pending` | 待老师最终确认 | `needs_teacher_review = 1` |
| `missing_sample` | 缺少抽样名单 | 在 sampling_list 中找不到关联记录 |
| `note_modified` | 备注被人工修改 | `note_modified_count > 0` |

三种场景都会进入反例列表：**边界值、缺样本、备注被修改**。所有操作（导入、补录、改备注、复核、回滚）都会触发同步，反例类型和详情状态、报告摘要保持一致。

---

## 完整操作流程（推荐走一次）

### 📌 第一步：导入老师批注
1. 打开首页 http://127.0.0.1:5001
2. 点击 **「📥 导入老师批注」**
3. 默认示例包含4条批注：
   - 第42行：波动值 0.12（<0.15 → normal）
   - **第56行：波动值 0.15（=阈值 → 边界值，进入反例）**
   - 第78行：波动值 0.18（>0.15 → warning）
   - 第93行：波动值 0.10（normal）
4. 点击「确认导入」
5. **此时观察：**
   - 报告摘要：反例总数 = 4（第56行边界值，另外3条缺抽样名单）
   - 第56行同时带「边界值待复核」+「待老师最终确认」标签

### 📌 第二步：实验助理小穆补录抽样名单
1. 点击 **「📎 补录抽样名单」**
2. 默认示例关联 comment_id=1（第42行）和 comment_id=3（第78行）
3. 点击「确认补录」
4. **此时观察：**
   - 反例列表 → 两条已关联抽样的记录（#1、#3）`missing_sample` 标记消失
   - 反例数量从4降到2（第56行、第93行仍缺抽样）
   - 第56行仍然是反例（因为边界值待复核）

### 📌 第三步：修改备注（制造 note_modified 反例）
1. 打开任意一条记录详情（如记录#1）
2. 在「实验助理修改备注」框输入新备注，例如「对照聊天记录再核对一遍」
3. 点击「💾 保存备注」
4. **此时观察：**
   - 记录#1新增 `note_modified` 反例类型
   - 历史增加「v2 实验助理修改备注」，显示改前改后
   - 备注修改次数从 0 变成 1

### 📌 第四步：任课老师复核边界值（第56行）
1. 从反例列表点击「边界值待复核」筛选
2. 打开记录#2详情（第56行边界值 0.15）
3. 在「任课老师复核」框：
   - 复核人：任课老师
   - 复核结论：「样本证据充足，按业务经验判定为正常」
   - 最终判定：选择 `normal - 判定为正常`
4. 点击「✅ 提交复核（最终判定）」
5. **此时观察：**
   - 边界值提醒横幅消失
   - 当前状态从 pending_teacher_review → normal
   - `is_boundary_case` 清零，`needs_teacher_review` 清零
   - 反例列表中该记录 `boundary` + `teacher_pending` 类型被清除
   - 历史记录新增一条 v* 「任课老师复核并最终判定」

### 📌 第五步：回滚验证（恢复老师复核真实变更）
1. 继续在记录#2详情页，找到「变更历史」
2. 找到刚执行的「任课老师复核并最终判定」那一条，点击 **「↩️ 回滚到此版本」**
3. 在弹窗中：
   - 确认回滚内容（包含 status、teacher_review_result 等真实字段，不只是备注）
   - 操作人输入：任课老师
   - 点击「确认回滚」
4. **此时观察回滚结果弹框：**
   - `current_status: "normal" → "pending_teacher_review"`
   - `teacher_review_result: "样本证据..." → null`
   - `teacher_reviewer: "任课老师" → null`
   - `is_boundary_case: 0 → 1`
   - `needs_teacher_review: 0 → 1`
5. 页面刷新后：
   - 边界值提醒重新出现，状态恢复为待老师复核
   - 历史新增一条 v* 「回滚至版本#...」（咖啡色徽章，不可再回滚）
   - 反例列表重新出现该记录

### 📌 第六步：任课老师再次确认（完结验证）
1. 重新对记录#2提交老师复核，这次判定为 `warning - 异常`
2. 反例列表对应记录的边界类型被清除
3. 如果也补录了抽样名单并清空备注修改计数 → 最终完全退出反例列表

---

## 回滚范围说明

回滚基于 **变更前的完整快照**（`change_history.full_snapshot_before`字段），恢复以下真实字段：

代码位置：[service.py:436-442](file:///Users/lzy/pro/solo/workspaces/zy72305/service.py#L436-L442)

| 字段 | 含义 |
|------|------|
| `current_status` | 处理状态（normal / warning / pending...） |
| `boundary_value` / `threshold_value` | 边界值与阈值 |
| `is_boundary_case` | 是否为边界值（触发反例） |
| `needs_teacher_review` | 是否待老师复核（触发反例） |
| `teacher_review_result` | 老师复核结论文字 |
| `teacher_reviewer` / `teacher_review_at` | 复核人与时间 |
| `assistant_operator` / `assistant_note` | 助理与备注 |
| `is_counterexample` / `counterexample_types` | 反例标记与类型 |
| `note_modified_count` | 备注修改次数（触发反例） |

回滚本身也会写入一条 `operation_type = 'rollback'` 的历史，完整可审计。

---

## 三段追踪对应的数据来源

任课老师复查时，按下面三段追证据，不用翻聊天记录：

### ① 老师批注来源
表：`teacher_comments`
- `source_file`：批注来自哪个文件（如 蒙特卡洛库存波动.docx）
- `original_line_number`：**原始行号**（任课老师追问时回到证据的关键）
- `original_content`：该行原文内容
- `comment_text`：老师批注原文

### ② 抽样名单补录
表：`sampling_list`
- `sample_id` / `sample_name`：样本编号、名称
- `comment_id`：关联到哪一条批注
- `supplementary_note`：补录备注（如「群内补录」）
- `supplementary_operator` / `supplementary_at`：谁、什么时候补的

### ③ 人工确认
表：`processing_records` + `change_history`
- `current_status`：最终状态
- `is_boundary_case`：是否边界值
- `teacher_review_result`：老师最终结论
- `assistant_note`：助理备注（每次改动都有历史）
- `change_history`：逐版本快照，支持回滚

---

## 防重复导入

代码位置：[service.py:112-121](file:///Users/lzy/pro/solo/workspaces/zy72305/service.py#L112-L121)

判重组合：**来源文件 + 原始行号 + 批注文本**

重复导入会自动跳过并在结果中返回 skipped 列表，不会让「蒙特卡洛库存波动」数量翻倍。

---

## 页面导航

| 页面 | URL | 用途 |
|-----|-----|-----|
| 批注列表 | `/` | 总览 + 报告摘要 + 导入/补录按钮 |
| 反例列表 | `/counterexamples` | 反例清单 + 按类型筛选 |
| 记录详情 | `/record/<id>` | 三段追踪 + 修改备注 + 老师复核 + 回滚 |

---

## API 接口（供脚本/自动化使用）

| 接口 | 方法 | 用途 |
|-----|------|-----|
| `/api/import_comments` | POST | 导入老师批注 |
| `/api/supplementary_sampling` | POST | 补录抽样名单 |
| `/api/update_note/<record_id>` | POST | 修改助理备注 |
| `/api/teacher_review/<record_id>` | POST | 任课老师提交复核 |
| `/api/rollback/<record_id>` | POST | 回滚到指定 history_id 版本 |

---

## 文件结构

```
zy72305/
├── app.py                      # Flask 入口 + 路由
├── models.py                   # SQLite 表结构 + 迁移 + 快照
├── service.py                  # 核心业务逻辑（边界规则/回滚/反例/同步）
├── requirements.txt            # 依赖
├── inventory_analysis.db       # SQLite 数据库（首次启动自动生成）
├── README.md                   # 本文档
└── templates/
    ├── index.html              # 批注列表首页
    ├── counterexamples.html    # 反例列表页
    └── detail.html             # 记录详情页（三段追踪 + 回滚）
```
