# 质检申诉同步系统 - 本地运行说明

## 一、项目简介
解决坐席对质检扣分申诉后，复核分数与最终分数不同步的问题。支持扣分项撤销、二次复核、成绩回写等核心规则。

## 二、快速启动

### 1. 安装依赖
```bash
cd /Users/lzy/pro/solo/workspaces/zy70965
pip install -r requirements.txt
```

### 2. 启动服务
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 访问接口文档
打开浏览器访问: http://localhost:8000/docs

## 三、API 使用说明

### 1. 批量上传质检材料
**接口**: `POST /api/upload`
**参数**:
- `quality_csv`: 质检结果CSV文件
- `audio_json`: 录音摘要JSON文件
- `appeal_csv`: 申诉单CSV文件

**使用示例（curl）**:
```bash
cd /Users/lzy/pro/solo/workspaces/zy70965
curl -X POST "http://localhost:8000/api/upload" \
  -H "Content-Type: multipart/form-data" \
  -F "quality_csv=@sample_data/quality_records.csv" \
  -F "audio_json=@sample_data/audio_summaries.json" \
  -F "appeal_csv=@sample_data/appeals.csv"
```

**返回示例**:
```json
{
  "batch_id": "a1b2c3d4e5f67890",
  "message": "批次处理完成",
  "summary": {
    "total": 8,
    "normal": 5,
    "pending": 3,
    "failed": 0
  },
  "duplicates_skipped": 0
}
```

### 2. 获取批次处理结果
**接口**: `GET /api/batch/{batch_id}`

**示例**:
```bash
curl "http://localhost:8000/api/batch/a1b2c3d4e5f67890"
```

### 3. 获取所有批次列表
**接口**: `GET /api/batches`

### 4. 执行复核操作
**接口**: `POST /api/review`

**请求体**:
```json
{
  "record_id": 1,
  "action": "accept_revoke",
  "operator": "质检主管",
  "note": "经核实申诉成立"
}
```

**支持的操作类型**:
- `accept_revoke`: 同意撤销扣分项
- `reject_revoke`: 驳回撤销申请
- `second_review_done`: 二次复核完成
- `finalize`: 最终确认

### 5. 查看系统规则说明
**接口**: `GET /api/system/info`

## 四、核心规则说明

### 规则1：扣分项撤销（DEDUCTION_REVOKE）
**触发条件**: 申诉理由充分且有录音摘要佐证
**边界说明**:
- 若申诉仅部分有理，则只撤销对应部分，而非全部撤销
- 必须有录音摘要作为佐证材料
**示例**: 原扣分项"未使用标准开场白(-5分)"，申诉后录音证明确实使用了开场白 → 撤销扣分项，回加5分

### 规则2：二次复核（SECOND_REVIEW）
**触发条件**:
- 初次复核与申诉意见完全相反
- 单次扣分≥5分
- 涉及敏感或重大违规判定
**边界说明**: 二次复核为最终结论，不再接受申诉

### 规则3：成绩回写（SCORE_WRITE_BACK）
**触发条件**: 申诉处理完成后
**边界说明**:
- 申诉成功 → 按申诉通过后的成绩回写
- 申诉驳回 → 成绩保持不变
- 部分撤销 → 按比例调整成绩

### 规则4：分数不一致检测（INCONSISTENCY_DETECT）
**触发条件**: 申诉后期望分数与复核分数差异≥2分
**处理方式**: 标记为"待确认"，需人工介入

## 五、幂等性说明

- 系统通过文件内容哈希（SHA256）生成唯一批次ID
- **同一批材料（相同的3个文件）再次上传会被自动识别并跳过**
- 重复上传时会返回已有批次ID和处理结果，不会重复处理

**测试幂等性**: 连续执行两次相同的上传命令，第二次会提示"该批次材料已存在"

## 六、分类结果说明

系统将所有记录分为三类：

| 分类 | 说明 | 常见场景 |
|------|------|----------|
| **正常项（normal）** | 申诉处理清晰，无需额外操作 | 申诉通过/驳回、无申诉 |
| **待确认项（pending）** | 存在分歧或需二次复核 | 分数差异≥2分、大额扣分争议 |
| **失败项（failed）** | 数据异常或规则无法覆盖 | 字段缺失、格式错误 |

## 七、测试数据说明

`sample_data/` 目录包含示例数据：
- `quality_records.csv`: 8条质检记录（包含各种扣分场景）
- `audio_summaries.json`: 对应通话的AI摘要
- `appeals.csv`: 7条申诉记录（覆盖通过、驳回、待确认等场景）

## 八、完整复跑步骤

```bash
# 1. 进入项目目录
cd /Users/lzy/pro/solo/workspaces/zy70965

# 2. 安装依赖（首次运行）
pip install -r requirements.txt

# 3. 启动服务
uvicorn app.main:app --reload --port 8000

# 4. 新开终端，上传测试数据
cd /Users/lzy/pro/solo/workspaces/zy70965
curl -X POST "http://localhost:8000/api/upload" \
  -H "Content-Type: multipart/form-data" \
  -F "quality_csv=@sample_data/quality_records.csv" \
  -F "audio_json=@sample_data/audio_summaries.json" \
  -F "appeal_csv=@sample_data/appeals.csv"

# 5. 查看所有批次
curl "http://localhost:8000/api/batches"

# 6. 查看某个批次的详细分类结果（替换为实际返回的batch_id）
curl "http://localhost:8000/api/batch/替换为实际batch_id"

# 7. 查看系统规则
curl "http://localhost:8000/api/system/info"

# 8. 测试幂等性 - 再次上传相同文件（会提示已存在）
curl -X POST "http://localhost:8000/api/upload" \
  -H "Content-Type: multipart/form-data" \
  -F "quality_csv=@sample_data/quality_records.csv" \
  -F "audio_json=@sample_data/audio_summaries.json" \
  -F "appeal_csv=@sample_data/appeals.csv"
```

## 九、数据持久化

- 使用 SQLite 数据库，数据保存在 `quality_appeal.db` 文件中
- 重启服务数据不会丢失
- 如需重置数据：删除 `quality_appeal.db` 文件，重启服务即可

## 十、常见问题

**Q: 上传后提示"质检CSV解析失败"怎么办？**
A: 检查CSV文件编码（建议UTF-8）和列名是否正确，支持"坐席工号"、"agent_id"等多种列名别名。

**Q: 如何处理边界案例？**
A: 所有边界案例（如部分撤销、分数差异）都会被标记为"待确认项"，并给出可读的处理建议，需人工复核。

**Q: 如何扩展新规则？**
A: 在 `app/services/classifier.py` 的 `_apply_rules` 函数中添加新的规则逻辑即可。
