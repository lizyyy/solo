# 学术摘要引用复核系统

> 像编辑部校稿一样做复核：摘要、引用页、人工备注并排看，缺引用时不让模型分数把问题盖掉。

## 这是什么

标注负责人只想看一份能解释的「学术摘要引用复核」结果。
AI 产品经理阿宁面对线上反馈工单里的同一用户反馈被重复计入，现在不用再口头兜底了。

**核心原则**：碰到同一用户反馈被重复计入时，别急着归正常，留给标注负责人复核。

## 三种入口

| 入口 | 适用场景 | 启动方式 |
|------|----------|----------|
| 🖥️ 命令行 (CLI) | 批量处理、脚本集成 | `python main.py` |
| 🌐 API 接口 | 系统对接、自动化流程 | `uvicorn citation_review.api:app --reload` |
| 📊 小看板 (Streamlit) | 人工复核、日常使用 | `streamlit run dashboard.py` |

## 快速开始（新人 5 分钟跑通）

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 第一步：导入线上反馈工单

```bash
# 使用样例数据导入
python main.py import-tickets samples/sample_tickets.json
```

你会看到 7 条工单被导入，其中：
- 用户 U_1001 有 3 条重复反馈（都是说脱敏问题）
- 用户 U_3003 有 2 条重复反馈（都是说加载慢）
- 用户 U_2002 和 U_4004 各 1 条正常反馈

### 3. 第二步：执行复核（检测重复）

```bash
python main.py run-review
```

系统会检测出 2 组重复工单，共 5 条疑似重复，状态都是 `duplicate_detected` —— **注意：没有自动归为正常，都留给标注负责人复核。**

### 4. 第三步：AI 产品经理阿宁补录脱敏规则备注

假设阿宁看了 TK_001，补录备注：

```bash
python main.py add-note TK_001 "用户手机号属于 PII 敏感信息，应按脱敏规则 v2 处理，输出时替换为 ***" --context "该用户反馈的是 v2.3.1 版本的问题，已在 hotfix 中修复"
```

补录后，证据回放会自动更新：
- 状态变为 `need_more_info`
- 「缺什么材料」列表会更新
- 「下一步找谁」指向标注负责人

### 5. 查看单条证据回放

```bash
python main.py show-evidence TK_001
```

你会看到完整的证据链，像编辑部校稿一样并排展示：
- 工单原文（左）
- 证据回放（中：为什么留下、缺什么材料、下一步找谁）
- 脱敏规则备注（右，阿宁补录的）

### 6. 生成复核报告

```bash
python main.py report -o report.txt
```

报告会以学术摘要风格输出，包含：
- 摘要
- 核心发现
- 重复工单分组详情
- 证据回放索引

## 小看板使用

```bash
streamlit run dashboard.py
```

打开浏览器后：
1. **复核总览** Tab：看整体数据，点「重新执行复核」
2. **工单校稿室** Tab：三栏并排展示，像编辑部校稿一样
   - 左：工单原文 + 关联重复工单跳转
   - 中：证据回放（为什么留下、缺什么、下一步找谁）
   - 右：阿宁补录脱敏备注，保存后证据回放自动更新
3. **报告导出** Tab：生成并下载报告

## API 接口

启动服务：
```bash
uvicorn citation_review.api:app --reload
```

访问 http://localhost:8000/docs 查看 Swagger 文档。

主要接口：
- `POST /tickets/import` - 导入工单
- `POST /review/run` - 执行复核
- `GET /review/records` - 查看复核记录
- `POST /notes` - 阿宁补录备注（会自动更新证据回放）
- `GET /report` - 生成报告

## 核心设计原则

### 1. 编辑部校稿原则
- 摘要、引用页、人工备注三栏并排看
- 疑似重复不得自动放行，必须人工确认
- 证据回放必须说明：为什么留下、缺什么材料、下一步找谁

### 2. 不自动归为正常
同一用户反馈被重复计入检测到后，状态设为 `duplicate_detected`，**永远不会自动变成 `normal`**，必须由标注负责人人工确认。

### 3. 证据回放可追溯
- 补录脱敏备注后，证据回放立即更新
- 每一步变更都有记录
- 报告中可以点击工单 ID 追溯完整证据链

### 4. 不被模型分数掩盖问题
即使文本相似度不高，只要是同一用户短期内的相似反馈，都会被标记待复核。

## 项目结构

```
.
├── citation_review/
│   ├── __init__.py
│   ├── models.py          # 数据模型定义
│   ├── storage.py         # JSON 存储层
│   ├── engine.py          # 核心复核引擎
│   ├── importer.py        # 数据导入工具
│   ├── cli.py             # 命令行入口
│   └── api.py             # FastAPI 服务
├── samples/
│   └── sample_tickets.json  # 样例数据
├── dashboard.py           # Streamlit 小看板
├── main.py                # CLI 主入口
├── requirements.txt
└── README.md
```

## 数据存储说明

所有数据存在 `./data/` 目录下的 JSON 文件中：
- `tickets.json` - 工单原始数据
- `notes.json` - 阿宁补录的脱敏备注
- `reviews.json` - 复核记录和证据回放
- `groups.json` - 重复工单分组
- `reports.json` - 历史报告

不需要数据库，开箱即用。

## 完整工作流演示（三步法）

### 第一步：导入工单
```bash
python main.py reset --yes
python main.py import-tickets samples/sample_tickets.json
```

### 第二步：第一次复核（没有备注时）
```bash
python main.py run-review
python main.py show-evidence TK_001
```

此时证据回放会说：
- 为什么留下：与同用户 2 条其他工单相似度达 XX%
- 缺什么材料：缺少阿宁的脱敏备注、缺少标注负责人复核结论
- 下一步找谁：标注负责人

### 第三步：阿宁补录备注后，证据回放更新
```bash
python main.py add-note TK_001 "手机号按 PII 规则 B 脱敏"
python main.py show-evidence TK_001
```

此时证据回放更新为：
- 状态变为 `need_more_info`
- 缺什么材料：已去掉「缺少阿宁的脱敏备注」这一项
- 下一步动作：阿宁已补录规则，请标注负责人继续复核

## 常见问题

**Q: 为什么不自动把重复工单合并掉？**
A: 按编辑部校稿原则，疑似问题必须人工确认。自动合并可能掩盖真实的不同反馈。

**Q: 模型分数在哪里？**
A: 系统不依赖大模型打分，只做规则+相似度检测。缺引用时不让模型分数把问题盖掉。

**Q: 可以自定义相似度阈值吗？**
A: 可以，修改 `citation_review/engine.py` 中的 `similarity_threshold`，默认 0.75。
