# Embedding 版本兼容检查系统

> 林姐和推荐负责人交接用，不是评测说明书

---

## 这玩意儿是干嘛的？

之前"线上特征缺失却给了默认分"这种记录，要么被当成小备注跳过了，结果推荐负责人一查就查到。
现在把这套东西就是管这个的：

1. **谁也跳不过去** —— 这种记录会专门标出来，等推荐负责人复核
2. **三个地方看的都一样** —— 导出明细、页面展示、接口返回，读同一份结果
3. **能回到证据** —— 每一条都留着YAML原始行号、谁改了、改了啥、什么时候改的

---

## 三步走完一个批次

### 第一步：参数 YAML 第一次导入

```python
from embedding_compat.workflow import ThreeStepWorkflow

wf = ThreeStepWorkflow()
wf.step1_import_yaml("data/embedding_params_v2_v3.yaml", created_by="小明")
```

导进来系统会自动检查有没有"线上特征缺失却给了默认分"的情况，有就标出来待推荐负责人看。

### 第二步：数据科学家林姐补看评测切片

```python
wf.step2_linji_review(
    reviewer="linjie",
    record_notes={
        "user_click_emb": "分布没问题，虽然线上暂时用旧版embedding",
        "item_tag_emb": "这个特征线上没有，但给了默认分0.5，等负责人看",
    },
)
```

林姐看完，该写备注写备注，该标记的标记。
但是！只要是"线上特征缺失给默认分"的，林姐看完也还是待推荐负责人复核，不会自己就过了。

### 第三步：可解释摘要更新

```python
# 先让推荐负责人把待复核的处理了，然后再更摘要：

# 推荐负责人复核通过某条
wf.lead_review_approve(record_id="xxx", reviewer="张负责人", note="这个默认分没问题，历史原因")

# 然后更新摘要
wf.step3_update_summary(
    updater="linjie",
    record_summaries={
        "user_click_emb": "v3相比v2，用户行为embedding升级，覆盖度提升5%",
    }
)
```

待复核的记录，推荐负责人没批之前，第三步更新摘要会自动跳过，不会更。

---

## 怎么看数据？

### 统一都走同一个出口，保证一致

```python
exporter = wf.get_exporter()

# 页面用
page_data = exporter.get_page_data()

# API用
api_resp = exporter.get_api_response()

# 导出CSV
csv_content = exporter.export_details_csv()

# 导出JSON
json_content = exporter.export_details_json()

# 看某条的审计日志（推荐负责人追问的时候用）
audit_trail = exporter.get_audit_trail(record_id="xxx")

# 看某条的YAML原始行证据
yaml_evidence = exporter.get_yaml_evidence(record_id="xxx")
```

---

## 碰到"线上特征缺失给默认分"具体怎么处理？

详细规则看 [BOUNDARY_RULES.md](./BOUNDARY_RULES.md)

简单说：
- 系统自动检测 → 待推荐负责人复核 → 推荐负责人批了才算完
谁也不许跳过，谁也不许自己算正常

---

## 项目结构

```
embedding_compat/
├── models/           # 数据模型
│   ├── status.py          # 状态、异常类型枚举
│   ├── yaml_line.py       # YAML原始行记录
│   ├── audit_log.py      # 审计日志
│   ├── feature_record.py   # 单条特征对比记录（核心）
│   └── compat_session.py # 整个会话
├── io/               # 输入输出
│   ├── yaml_importer.py   # YAML导入（保留行号）
│   └── unified_exporter.py # 统一数据出口
└── workflow/         # 工作流
    └── three_step_workflow.py # 三步工作流控制器
```

---

## 依赖

```
pip install pyyaml
```
