# 🐾 宠物减重排程对账工作台

> 训练师阿岑专用：病历手写单自动核 + 用药提醒不漏 + 筛选/备注/CSV三者绑一起不再各走各的

---

## 🚀 阿岑快速上手（就看这一段）

```bash
# 第 1 步：进入项目，激活虚拟环境
cd /Users/maca/pro/solo/workspaces/zy73022
source .venv/bin/activate

# 第 2 步：导入样例数据包（6只宠物 + 6份减重排程 + 8张手写病历单）
python import_samples.py

# 第 3 步：跑主流程，首轮对账并导出全部 CSV
python run_pipeline.py --export

# 第 4 步：打开浏览器看工作台（刷新筛选/备注都在，不会各走各的）
python app.py
# 然后浏览器访问 http://127.0.0.1:5001/  （默认端口 5001，可 PORT=5002 改）
```

📄 **跑完第 3 步先看这份 CSV 明细**：
- 打开 `exports/` 文件夹下最新的那个文件，名字类似 **`宠物减重排程对账_RCNxxxxxxxxxxxx_xxxxxxxx_xxxxxx.csv`**
- 重点看「复核原因」列：会明确告诉你 **「肥波叫法对不上」**、**「阿旺体重单位混写(14.5kg/29斤)」** 这类异常
- 「处理状态」列会区分 **首轮处理 / 重跑(后补) / 新增**，重跑不会覆盖旧的

---

## 📦 样例数据包里特意埋的「测试用异常」

| 手写单名称 | 异常类型 | 设计目的 |
|---|---|---|
| **肥波** | 叫法对不上（别名库里没有，宠物档案也没这名） | 验证异常分支能不能走通：→ 复核状态=需复核，复核原因写清楚「名称无法匹配」 |
| **阿旺** | 体重单位混写：`14.5kg/29斤`（英制+市斤同时写） | 验证单位混写识别：→ 自动换算取首段数值 14.5kg，状态标「混写(已转换)」，需复核 |
| **小布** | 体重无单位：`5300` | 无单位默认为 kg，复核原因会提示 |
| **橘胖** | 别名匹配：橘胖 → 大橘 | 正常分支，可走通别名匹配路径 |

---

## 🧪 跑全链路测试（含异常分支）

```bash
python test_pipeline.py
```

跑完会看到 5 组测试全部通过：
1. 宠物名匹配（别名/模糊/未匹配三种分支）
2. 体重单位混写识别（kg、千克、g、斤、磅、混写、无单位）
3. 主对账流程（8 条病历 → 8 条对账记录）
4. 重跑流程：旧处理、后补备注、最新导出三区分
5. CSV 导出 + 筛选条件持久化 + 按筛选追回同一批记录

---

## 🛠 命令行工具速查

### 1. 主流程：`run_pipeline.py`

| 命令 | 场景 |
|---|---|
| `python run_pipeline.py` | 首轮对账，生成新批次号 |
| `python run_pipeline.py --export` | 首轮 + 自动导出全部 CSV |
| `python run_pipeline.py --export-filtered '{"review_status":"需复核"}'` | 按筛选条件导出（例：只导出需复核）并把筛选条件存库 |
| `python run_pipeline.py --round 2 --batch RCNxxxxxx` | 同一批次号重跑第 2 轮，**继承上一轮的人工备注** |
| `python run_pipeline.py --add-note 5 "已确认肥波是大橘旧名"` | 给第 5 号对账记录加人工备注 |
| `python run_pipeline.py --show-latest` | 看最新 3 个批次概况 |

### 2. 数据管理

| 命令 | 作用 |
|---|---|
| `python import_samples.py` | 导入样例数据包（`samples/` 目录下的 3 份 CSV） |
| 替换 `samples/病历手写单_YYYYMMDD.csv` | 把现场收到的新手写单按同名格式覆盖，再重新 import + run_pipeline |

### 3. Web 工作台功能

- 🔍 **筛选条件**：复核状态 / 名称匹配方式 / 单位状态 / 处理状态 / 轮次 / 宠物名关键字 / 有无备注 —— **刷新页面自动恢复，不会重置**
- ✍️ **人工备注**：每条记录可加备注，历史版本全留（可点「📜历史」查看），**重跑自动继承最新备注**
- 📥 **导出 CSV**：
  - 「按当前筛选」导出：CSV 会和当时的筛选条件绑定，历史导出栏能看到筛选条件
  - 复核人想追回同一批：点侧边栏「最近导出」里的下载链接即可
- 🔄 **首轮 / 重跑按钮**：重跑沿用同一批次号，同一批材料多轮处理一目了然

---

## 📂 项目结构

```
zy73022/
├── README.md                    ← 你在看的这份
├── requirements.txt             ← 依赖清单
├── config.py                    ← 别名库、单位换算表、导出列定义
├── models.py                    ← SQLAlchemy 数据模型（7 张表）
├── reconcile_engine.py          ← 核心对账引擎（名称匹配/单位解析/重跑/导出/筛选持久化）
├── import_samples.py            ← 样例数据导入脚本
├── run_pipeline.py              ← CLI 主流程入口
├── test_pipeline.py             ← 全链路测试（含异常分支验证）
├── app.py                       ← Flask Web 工作台
├── static/style.css             ← 页面样式
├── templates/index.html         ← 工作台页面
├── samples/                     ← 现场会收到的材料包
│   ├── 宠物基础信息.csv
│   ├── 减重排程表.csv
│   └── 病历手写单_20260608.csv       ← 含「肥波」叫法对不上 +「阿旺」单位混写
├── data/                        ← SQLite 数据库（自动生成）
│   └── pet_weight.db
└── exports/                     ← 导出的 CSV 明细（自动生成）
    └── 宠物减重排程对账_RCNxxxxxx_YYYYMMDD_HHMMSS.csv
```

---

## 🔍 常见问题

**Q: 刷新页面筛选条件怎么不见了？**
A: 筛选条件是存在 SQLite 的 `filter_states` 表里的，只要没删 `data/pet_weight.db`，刷新一定恢复。Web 和 CLI 共用同一张表。

**Q: 重跑会覆盖之前的备注吗？**
A: 不会。重跑第 2 轮会生成新的 `Reconciliation` 记录，自动把第 1 轮的备注拷过来，同时在 `manual_notes` 表里保留完整历史。

**Q: 怎么看哪条 CSV 对应哪次筛选？**
A: 两种方式：
1. Web 工作台侧边栏「最近导出」会直接显示当时的筛选条件
2. `export_batches` 表里的 `filter_criteria` 字段存了筛选 JSON

**Q: 现场收的手写单格式不一样？**
A: 改 `samples/病历手写单_YYYYMMDD.csv` 的列名，或直接改 `import_samples.py` 的 `import_medical_records` 函数里的列映射即可。
