# 短视频封面违规样本管理系统

## 一、核心目标

解决短视频封面违规样本标注流程中的以下问题：

1. **标注员留言结论不能直接照抄** - 标注负责人回看时必须结合模型输出
2. **知识库编辑可追溯证据** - 保留原始行号、人工改动、处理状态
3. **重复导入不翻倍** - 同一批标注员留言重复导入不重复创建样本
4. **低置信度样本不被平均指标盖住** - 置信度<0.6留给知识库编辑复核
5. **历史可查** - 标注负责人改备注时能看出改前改后差别
6. **边界规则写在代码里** - 不靠口头约定

---

## 二、核心三步流程

### 第一步：标注员留言第一次导入

```python
from sample_manager import SampleManager

manager = SampleManager()

sample, is_new = manager.import_annotator_message(
    source_file="群聊记录_20260601.txt",
    line_number=42,
    raw_content="封面文字'今晚必看'太夸张，诱导点击，建议判定违规",
    annotator_name="标注员小王",
    video_id="VID_001",
    cover_image_url="https://example.com/cover1.jpg",
    conclusion="违规",
)
```

**保留的证据：**
- `source_file`: 原始来源文件
- `line_number`: 原始行号（关键！知识库编辑追问时能定位）
- `raw_content`: 标注员留言原文
- `annotator_name`: 标注员
- `import_timestamp`: 导入时间
- `conclusion`: 标注员给出的结论（仅作参考，不能直接用）

---

### 第二步：标注负责人周姐补看模型输出片段

```python
# 2.1 周姐回看，不能直接照抄标注员结论
manager.manager_review(
    sample_id=sample.sample_id,
    manager_name="周姐",
    manager_notes="回看后发现原标注结论太笼统，需要结合模型输出再判断",
    edited_annotation="封面文字'今晚必看'属于夸张诱导，但需结合视频内容确认是否真正违规",
)

# 2.2 补加模型输出（模拟后来才补到群里）
manager.add_model_output(
    sample_id=sample.sample_id,
    version="v1.0",
    violation_score=0.72,
    confidence=0.85,
    raw_fragment="模型检测到'诱导点击'关键词，置信度0.85，违规概率0.72",
    operator="周姐",
)
```

---

### 第三步：模型版本对比更新

```python
# 更新模型版本，对比新旧输出
manager.update_model_version(
    sample_id=sample.sample_id,
    old_version="v1.0",
    new_version="v2.0",
    new_violation_score=0.88,
    new_confidence=0.92,
    new_raw_fragment="模型v2.0优化后，检测到'诱导点击+虚假宣传'，置信度提升到0.92",
    operator="算法团队",
)

# 知识库编辑最终复核
manager.kb_editor_review(
    sample_id=sample.sample_id,
    editor_name="知识库编辑小郑",
    final_status=SampleStatus.CONFIRMED_VIOLATION,
    kb_notes="结合模型v2.0输出和人工判断，确认违规",
)
```

---

## 三、边界规则（已写入代码，不依赖口头约定）

### 【BR001】低置信度样本不自动判定

**规则：** 模型置信度低于0.6的样本，不能被平均指标覆盖，需留给知识库编辑复核

**条件：** `model_output.confidence < 0.6`

**处理动作：**
- 自动标记 `is_low_confidence = True`
- 状态设为 `LOW_CONFIDENCE`
- **禁止**直接判定为 `CONFIRMED_NORMAL`（代码层面拦截）
- 必须由知识库编辑人工复核后才能最终判定

**代码实现位置：** [sample_manager.py](file:///Users/lzy/pro/solo/workspaces/zy72514/sample_manager.py#L235-L238)

---

### 【BR002】标注员留言结论不可直接照抄

**规则：** 标注负责人回看时，必须对比模型输出后才能确认结论，不能直接复制标注员留言

**条件：** 标注负责人操作时，系统强制进入 `MANAGER_REVIEWED` 状态，需添加模型输出后才能继续流转

**处理动作：**
- 标注负责人只能修改标注内容和添加备注
- 必须调用 `add_model_output()` 添加模型输出后，状态才能推进
- 原始标注员结论仅保存在 `original_annotation.conclusion` 中，不参与最终判定

**代码实现位置：** [sample_manager.py](file:///Users/lzy/pro/solo/workspaces/zy72514/sample_manager.py#L169-L209)

---

### 【BR003】重复导入去重规则

**规则：** 同一 `source_file + line_number + raw_content` 的标注员留言不重复创建样本

**条件：** 导入时计算 `annotation_hash = sha256(source_file:line_number:raw_content)`，如哈希已存在则判定为重复

**处理动作：**
- 不创建新样本
- 仅更新现有样本的 `updated_at` 时间戳
- 在历史记录中添加一条"重复导入检测"记录

**代码实现位置：** [sample_manager.py](file:///Users/lzy/pro/solo/workspaces/zy72514/sample_manager.py#L118-L131)

---

### 【BR004】错口径样本返工规则

**规则：** 标注口径错误的样本，需回滚到 `ANNOTATOR_IMPORTED` 状态重新标注

**条件：** 发现标注口径错误时，手动触发回滚

**处理动作：**
- 调用 `rollback_to_status()` 回滚到指定状态
- **所有历史记录保留**，不删除，供追溯
- 可在历史记录中看到回滚原因

**代码实现位置：** [sample_manager.py](file:///Users/lzy/pro/solo/workspaces/zy72514/sample_manager.py#L330-L352)

---

## 四、数据结构说明

### ViolationSample（违规样本）

| 字段 | 类型 | 说明 |
|------|------|------|
| `sample_id` | str | 样本唯一ID |
| `video_id` | str | 视频ID |
| `cover_image_url` | str | 封面图片URL |
| `current_status` | SampleStatus | 当前处理状态 |
| `original_annotation` | OriginalAnnotation | 原始标注（永不修改！） |
| `current_annotation` | str | 当前标注内容（可修改） |
| `model_outputs` | List[ModelOutput] | 模型输出列表（多版本） |
| `history` | List[HistoryRecord] | 完整历史记录 |
| `manager_notes` | str | 标注负责人备注 |
| `kb_editor_notes` | str | 知识库编辑备注 |
| `is_low_confidence` | bool | 是否低置信度样本 |

### OriginalAnnotation（原始标注，永不修改）

| 字段 | 类型 | 说明 |
|------|------|------|
| `line_number` | int | **原始行号**（知识库编辑找证据用） |
| `raw_content` | str | **原始留言内容** |
| `annotator_name` | str | 标注员姓名 |
| `source_file` | str | **来源文件**（群聊记录文件名） |
| `import_timestamp` | datetime | 导入时间 |
| `conclusion` | str | 标注员给出的结论（仅参考） |

### HistoryRecord（历史记录）

每条历史记录包含：
- `before_snapshot`: 变更前的样本快照
- `after_snapshot`: 变更后的样本快照
- `manual_edits`: 具体的人工改动列表（字段、旧值、新值、原因）
- `operator`: 操作人
- `timestamp`: 操作时间
- `comment`: 操作说明

---

## 五、知识库编辑如何追溯证据

当知识库编辑有疑问时，可按以下路径回溯：

```python
sample = manager.get_sample_by_id("SAMPLE-XXX")

# 1. 看原始标注员留言（含行号）
print(f"来源: {sample.original_annotation.source_file} 第{sample.original_annotation.line_number}行")
print(f"标注员: {sample.original_annotation.annotator_name}")
print(f"原始内容: {sample.original_annotation.raw_content}")

# 2. 看所有人工改动
for record in sample.history:
    for edit in record.manual_edits:
        print(f"{edit.editor} 修改了 {edit.field_changed}:")
        print(f"  旧值: {edit.old_value}")
        print(f"  新值: {edit.new_value}")
        print(f"  原因: {edit.reason}")

# 3. 看完整操作历史
for i, record in enumerate(sample.history, 1):
    print(f"{i}. [{record.timestamp}] {record.operator}: {record.comment}")

# 4. 看当前状态
print(f"当前状态: {sample.current_status.value}")
```

---

## 六、运行演示

```bash
python3 demo.py
```

演示内容包括：
1. 标注员留言首次导入
2. 重复导入去重测试
3. 标注负责人周姐回看修正
4. 补加模型输出片段
5. 低置信度样本处理（置信度<0.6）
6. 低置信度样本直接判正常的拦截测试
7. 模型版本对比更新
8. 知识库编辑最终复核
9. 标注负责人改备注的历史对比
10. 错口径样本回滚返工
11. 完整证据链展示

---

## 七、当前流程范围

本系统**先处理现场最常见的问题**，不铺太大：

✅ 已实现：
- 错口径返工（回滚机制）
- 补录返工（历史记录保留）
- 标注员留言结论不能直接照抄（流程强制）
- 低置信度样本留给知识库编辑复核
- 重复导入去重
- 三步标准流程（导入→补看模型→版本对比）

❌ 暂不实现（后续按需扩展）：
- 批量导入导出
- Web界面
- 数据库持久化（当前为内存版，可快速扩展）
- 权限管理
- 通知提醒

---

## 八、文件说明

| 文件 | 说明 |
|------|------|
| [schemas.py](file:///Users/lzy/pro/solo/workspaces/zy72514/schemas.py) | 数据结构定义（样本、状态、历史记录等） |
| [sample_manager.py](file:///Users/lzy/pro/solo/workspaces/zy72514/sample_manager.py) | 核心管理逻辑（导入、去重、状态流转、边界规则） |
| [demo.py](file:///Users/lzy/pro/solo/workspaces/zy72514/demo.py) | 完整流程演示脚本 |
| [README.md](file:///Users/lzy/pro/solo/workspaces/zy72514/README.md) | 本文档 |
