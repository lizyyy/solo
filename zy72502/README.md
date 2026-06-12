# 合同条款抽取复核工具

解决 **"低置信度样本被平均指标盖住"** 问题的复核工具。不是空壳演示，从样例数据到报告一条龙。

---

## 快速开始（新人照这个来）

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 一键跑通完整流程（新人照这个来）

```bash
# 方式一：完整端到端测试（推荐，自动验证所有功能）
python test_e2e_flow.py

# 方式二：命令行三步曲
python main.py cli demo --model-version 1.0.0
python main.py cli demo --model-version 1.1.0
python main.py cli compare --v1 1.0.0 --v2 1.1.0

# 方式三：启动小看板（可视化操作）
python main.py web
# 然后浏览器打开 http://localhost:5000
# 点击右上角"生成演示数据"即可
```

### 3. 看看效果

```bash
# 列出所有样本，重点看"被平均掩盖"的
python main.py cli list-samples --masked-only

# 查看某个样本的详细信息（含修改历史）
python main.py cli show SDEMO001

# 查看某个样本的修改历史
python main.py cli history SDEMO001

# 生成对比报告并保存到文件
python main.py cli compare --v1 1.0.0 --v2 1.1.0 --output report.txt

# 小孟补录脱敏备注（带修改原因）
python main.py cli add-note SDEMO001 \
  --note "客户名称已脱敏，置信度低因特征缺失" \
  --reason "响应知识库编辑质询，说明低置信度原因" \
  --added-by "小孟"
```

---

## 核心特性

### 按合同名称对齐（解决sample_id不一致问题）

**问题**：两个版本中同一合同的 sample_id 不同（如 SDEMO001 vs SDEMO001_V2），会被拆成两行。

**解决**：版本对比时按 `contract_name` 对齐，同一合同的两个版本正确匹配。

**效果**：
- 不会出现 `not_exists / not_exists` 分裂
- 同一合同在一行内展示 v1 和 v2 的完整信息
- 按合同名称聚合工单和脱敏备注

### 修改历史可追溯

每次修改都记录：
- 改前文本
- 改后文本
- 修改原因（必填）
- 修改人
- 修改时间

### 补录后自动联动更新

小孟补录脱敏备注后，**不需要重新生成报告**，所有已有的版本对比报告自动更新：
- `has_desensitization_note` 状态自动更新
- `next_action`、`next_owner`、`missing_materials` 自动重新计算
- 按合同名称跨版本同步

### 报告说人话，不是系统日志

每条样本都说明：
- 🎯 **为什么被留下**：比如"低置信度被平均值掩盖，必须人工复核
- 📦 **还缺什么材料**：比如"知识库编辑复核意见、线上反馈工单
- 👤 **下一步找谁**：知识库编辑 / 模型评测同事-小孟
- 📝 **具体做什么**：比如"提交知识库编辑复核被平均值掩盖的样本"

---

## 三种入口方式

### 1. 命令行（适合脚本化）

```bash
# 查看所有命令
python main.py cli --help

# 常用命令：
#   demo            生成演示样例
#   import-samples  导入样本数据(JSON/CSV)
#   import-tickets  导入线上反馈工单
#   add-note        小孟补录脱敏规则备注
#   add-ticket      关联线上反馈工单
#   compare         生成版本对比报告
#   list-samples    列出样本
#   show            查看样本详情
```

### 2. API 接口（适合系统集成）

启动服务器：
```bash
python main.py web
```

主要接口：
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/samples` | 获取样本列表 |
| GET | `/api/samples/<id>` | 获取样本详情（含工单、脱敏规则） |
| PUT | `/api/samples/<id>` | 更新样本状态 |
| POST | `/api/samples/<id>/notes` | 补录脱敏规则备注（小孟） |
| POST | `/api/samples/<id>/tickets` | 关联线上反馈工单 |
| POST | `/api/compare` | 生成版本对比报告（JSON） |
| POST | `/api/compare/text` | 生成文字版对比报告 |
| GET | `/api/masked-samples` | 获取所有被平均值掩盖的样本 |

### 3. 小看板（适合日常使用）

启动 `python main.py web` 后打开 `http://localhost:5000`

功能：
- 🔍 **样本列表**：一眼看出哪些被平均值掩盖（黄色高亮）
- 📋 **样本详情**：点进去能看到关联工单、脱敏规则备注
- 📝 **补录备注**：小孟直接在页面上补录脱敏规则
- 🎫 **关联工单**：知识库编辑可以直接关联线上反馈
- 📊 **版本对比**：两个版本对比，明确谁来做、做什么、缺什么

---

## 核心设计原则

### 1. 不被漂亮画面迷惑 - 数据优先

- 被平均值掩盖的样本**黄色高亮**，列表里一眼就能看到
- 点进样本详情，**先显示告警**："该样本低置信度被高置信度平均值掩盖..."
- 3D/图表不是重点，能回到工单和备注才是关键

### 2. 报告不写系统日志 - 说人话

版本对比报告每条样本都会说明：
- ✅ **为什么被留下**：比如"低置信度条款被平均值掩盖，需要人工复核"
- ❓ **还缺什么材料**：比如"线上反馈工单、脱敏规则备注"
- 👉 **下一步该找谁**：知识库编辑 or 模型评测同事-小孟
- 🎯 **具体做什么**：比如"提交知识库编辑复核低置信度样本"

### 3. 三步流程闭环

```
线上反馈工单导入 → 模型评测小孟补录脱敏规则备注 → 模型版本对比更新
        ↓                          ↓                          ↓
   标记低置信度样本         补录后状态自动更新          报告里体现变化
   别急着归正常                                          留给知识库编辑复核
```

低置信度样本（特别是被平均值掩盖的）**不会自动归为正常**，始终保留待复核状态给知识库编辑确认。

### 4. 什么是"被平均值掩盖"？

检测逻辑（见 [sample.py](contract_review/models/sample.py#L38-L43)）：
```python
同时满足：
1. 存在低置信度条款（置信度 < 0.7）
2. 整体置信度 >= 0.75（看起来正常）
3. 高置信度条款（>= 0.9）数量 > 低置信度条款数量
```

这就是"平均指标把问题盖住了"的典型情况。

---

## 目录结构

```
contract_review/
├── models/          # 数据模型
│   ├── sample.py    # 样本、抽取条款
│   ├── ticket.py    # 工单、脱敏规则
│   └── version.py   # 版本对比
├── core/            # 核心业务逻辑
│   ├── store.py     # 数据存储（JSON文件）
│   ├── comparator.py # 版本对比 + 人类可读报告
│   └── importer.py  # 样本导入
├── cli/             # 命令行入口
├── api/             # Flask API
└── web/             # 小看板前端（原生HTML+JS）
data/                # 数据存储目录
main.py              # 统一入口
```

---

## 典型工作流示例

### 场景：新版本上线，知识库编辑来问为什么前后不一致

1. **小孟导入两个版本的样本**
   ```bash
   python main.py cli import-samples --file v1_results.json --model-version 1.0.0
   python main.py cli import-samples --file v2_results.json --model-version 1.1.0
   ```

2. **小孟导入线上反馈工单**
   ```bash
   python main.py cli import-tickets --file feedback_tickets.json
   ```

3. **小孟补录脱敏规则备注**
   ```bash
   python main.py cli add-note S100001 --note "此样本涉及客户名称脱敏，置信度低是因为脱敏后特征缺失"
   ```

4. **生成对比报告**
   ```bash
   python main.py cli compare --v1 1.0.0 --v2 1.1.0 --by 小孟
   ```

5. **知识库编辑查看报告**
   - 重点关注"被平均值掩盖"的样本
   - 每条样本都说明：为什么留下、缺什么、找谁
   - 有疑问可以点进去看关联工单和脱敏备注

---

## 数据格式说明

### 样本导入 JSON 格式

```json
[
  {
    "sample_id": "S001",
    "contract_name": "合同名称",
    "overall_confidence": 0.82,
    "review_status": "pending",
    "extracted_clauses": [
      {
        "clause_id": "C001",
        "clause_type": "payment",
        "content": "条款内容",
        "confidence": 0.95,
        "start_pos": 0,
        "end_pos": 20
      }
    ]
  }
]
```

也支持 CSV 格式，按 `sample_id` 分组。

---

## 常见问题

**Q: 数据存在哪里？**
A: 默认在 `data/` 目录下，JSON 格式，直接看得到。

**Q: 可以对接数据库吗？**
A: 当前用 JSON 文件是为了简单可复现。改 [store.py](contract_review/core/store.py) 就能换成数据库。

**Q: 置信度阈值可以改吗？**
A: 可以。低置信度阈值在 [sample.py](contract_review/models/sample.py#L35)，被掩盖判定逻辑在同文件 38-43 行。

**Q: 为什么低置信度样本不能自动通过？**
A: 故意设计的。留给知识库编辑人工复核，避免平均指标掩盖真实问题。
