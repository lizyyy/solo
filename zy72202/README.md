# ETF 篮子成分异常复盘

投研助理小周做 ETF 篮子成分异常复盘时的实用工具。支持清算批次号导入、拼音审批人自动检测、节假日顺延说明补录、余额变化表联动更新，三步走端到端闭环。

## 快速开始

```bash
# 1. 安装依赖
pip install flask

# 2. 导入样例数据（三步走第一步）
python3 -m etf_review.cli import sample_data.json

# 3. 查看批次列表
python3 -m etf_review.cli list

# 4. 查看批次详情（拼音审批人会被标红）
python3 -m etf_review.cli detail CL-20260601-001

# 5. 生成复盘报告
python3 -m etf_review.cli report CL-20260601-001
```

## 三步走端到端演示

```bash
python3 -m etf_review.cli demo
```

这会自动跑完以下三步：

1. **导入清算批次号** → 自动检测拼音审批人，标记待复核
2. **投研助理小周补看节假日顺延说明** → 余额变化表联动更新
3. **查看余额变化表** → 每行标明为何留下、缺什么、找谁

> 拼音审批人的成分**不会**因补录顺延说明而归正常，需客户经理复核后确认。

## CLI 命令

| 命令 | 说明 |
|------|------|
| `import <file>` | 导入 JSON 格式清算批次数据 |
| `list` | 列出所有批次 |
| `detail <batch_id>` | 查看批次详情 |
| `report <batch_id> [-o file]` | 生成复盘报告（可选输出到文件） |
| `note <component_id> <note>` | 补录节假日顺延说明 |
| `confirm <component_id> <name>` | 确认审批人中文全名 |
| `demo` | 三步走端到端演示 |

### 补录顺延说明示例

```bash
# 给成分ID=2补录节假日顺延说明
python3 -m etf_review.cli note 2 "端午节顺延至6月2日清算"
```

### 确认审批人示例

```bash
# 确认成分ID=2的审批人中文全名
python3 -m etf_review.cli confirm 2 "张伟"
```

## API 接口

启动服务：

```bash
python3 -c "from etf_review.app import app; app.run(port=5002)"
```

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/stats` | GET | 全局统计 |
| `/api/batches` | GET | 批次列表 |
| `/api/batch/<batch_id>` | GET | 批次详情（含成分+余额变化） |
| `/api/import` | POST | 导入数据 `{"filepath": "sample_data.json"}` |
| `/api/component/<id>/note` | POST | 补录顺延说明 `{"note": "..."}` |
| `/api/component/<id>/confirm` | POST | 确认审批人 `{"name": "张伟"}` |
| `/api/report/<batch_id>` | GET | 获取复盘报告 |

## Web Dashboard

启动服务后访问 `http://localhost:5002/`：

- **总览页**：统计卡片 + 异常分布图 + 偏差量图 + 批次列表
- **批次详情页**：成分状态分布图（可点击下钻）+ 权重偏差图（可点击下钻）+ 篮子成分表 + 余额变化表
- **复盘报告页**：纯文本报告，可复制

### 下钻复核

点到一条审批人只留拼音的记录时：
1. 点击红色拼音标签 → 弹出模态框，可回到清算批次号或补录顺延说明
2. 在图表中点击对应成分 → 弹出详情，含清算批次号、顺延说明、操作入口
3. 余额变化表中的代码链接 → 可跳转到审批人确认或顺延说明补录

## 数据格式

导入文件为 JSON 格式，结构如下：

```json
{
  "batches": [
    {
      "batch_id": "CL-20260601-001",
      "batch_date": "2026-06-01",
      "etf_code": "510050",
      "etf_name": "华夏上证50ETF",
      "components": [
        {
          "component_code": "600036",
          "component_name": "招商银行",
          "expected_weight": 0.0830,
          "actual_weight": 0.0795,
          "approver_name": "zhangwei",
          "holiday_extension_note": ""
        }
      ]
    }
  ]
}
```

拼音审批人（如 `zhangwei`）会被自动检测并标记。

## 余额变化表说明

每行包含三列关键信息：

| 列 | 含义 |
|----|------|
| 为何留下 | 这条为什么被留在异常清单里 |
| 缺什么 | 还缺什么材料（审批人中文全名 / 节假日顺延说明） |
| 下一步 | 该找客户经理确认审批人，还是找投研助理小周补充材料 |

## 项目结构

```
├── etf_review/
│   ├── __init__.py
│   ├── __main__.py         # python3 -m etf_review 入口
│   ├── app.py              # Flask Web 服务 + API
│   ├── cli.py              # 命令行入口
│   ├── models.py           # 数据模型（SQLite）
│   ├── pinyin_detector.py  # 拼音审批人检测
│   └── services.py         # 业务逻辑 + 报告生成
├── templates/              # Jinja2 HTML 模板
│   ├── dashboard.html      # 总览
│   ├── batch_detail.html   # 批次详情（含图表下钻）
│   ├── report.html         # 复盘报告
│   └── error.html          # 错误页
├── static/
│   ├── css/style.css
│   └── js/
│       ├── dashboard.js    # 总览页交互
│       └── batch_detail.js # 详情页交互（下钻+补录+确认）
├── sample_data.json        # 样例数据
└── requirements.txt
```
