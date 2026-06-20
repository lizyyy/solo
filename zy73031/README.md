# 🐾 宠物训练课异常提醒系统

前台小温专用 · 病历手写单捋顺 · 回访结论可追溯

## 目录结构
```
.
├── backend/                 后端服务
│   ├── server.js            主入口 (Express API)
│   ├── config/database.js   SQLite配置
│   ├── services/anomaly-detector.js   异常检测算法
│   ├── scripts/
│   │   ├── init-db.js       建表脚本
│   │   ├── seed-data.js     示例数据导入+算法跑
│   │   └── rerun-algorithm.js  算法重跑CLI入口
│   ├── data/                SQLite数据文件(自动生成)
│   └── package.json
└── frontend/
    └── index.html           前端页面(直接浏览器打开)
```

## 🚀 启动方式

### 后端（必需）
```bash
cd backend
npm install
npm start
```
- 首次启动自动：建库 → 导入10条病历+8条训练课示例 → 跑算法 → 监听端口 3001
- 之后复用数据库，不再重建
- 端口配置：环境变量 `PORT`，默认 3001

### 前端
两种方式均可：
1. 直接双击 `frontend/index.html` 用浏览器打开
2. 或用任意静态服务器：`cd frontend && python3 -m http.server 8080`

前端内 `API_BASE` 变量默认 `http://localhost:3001/api`，如需修改请编辑 `index.html` 顶部 `<script>` 区。

### 访问入口
| 页面 | 位置 |
|---|---|
| 后端健康检查 | http://localhost:3001/api/health |
| 异常概览图表 | 前端首页 → 📊 异常概览图表 |
| 异常明细列表 | 前端 → 📋 异常明细列表 |
| 月底复核分类 | 前端 → ✅ 月底复核分类 |
| 系统文档 | 前端 → 📖 系统文档 |

## 🔄 算法重跑入口（三种方式任选）

| 方式 | 操作 |
|---|---|
| 命令行 | `cd backend && npm run rerun-algorithm` |
| 页面按钮 | 异常明细列表页 → 右上角「🔄 算法重跑」 |
| API调用 | `POST http://localhost:3001/api/algorithm/rerun`（无参数） |

重跑会清空旧异常和其复核记录，再按当前算法重新检测，避免版本升级后新旧告警混在一起。

## 📡 接口返回位置（全量）

所有接口 JSON 顶层均包含 `_context` 字段，结构：
```json
{
  "_context": {
    "algorithm_version": "v1.2",
    "caliber_version": "2026-06-v1.1",
    "caliber_description": "...",
    "api_version": "v1",
    "generated_at": "2026-06-20T..."
  }
}
```
→ 保证页面和导出文件口径一致。

| 方法 | 路径 | 场景 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| GET | `/api/anomaly/summary` | 📊 异常概览图表数据（类型/级别/日期/复核分布） |
| GET | `/api/anomaly/list` | 📋 异常列表分页。支持 `anomaly_type/level/review_status/start_date/end_date/page/page_size` |
| GET | `/api/anomaly/:id` | 🔍 异常详情 + 原始材料（病历/训练课）+ 复核历史。含 `judgment_change` 判断变更说明 |
| GET | `/api/anomaly/:id/material-link` | 🔗 关联材料链（异常→病历→训练课，用于追溯渲染） |
| POST | `/api/anomaly/:id/review` | ✅ 提交复核，body: `{review_status: confirmed/supplement_needed/rejected, reviewer, review_note, supplementary_material}` |
| GET | `/api/export/anomalies` | 📥 导出 Excel。含特殊标记列「⚠ 非普通记录」，高/中级别行染色 |
| POST | `/api/medical-record/:id/public-note` | 📝 社区公示前 - 补病历手写单备注。body: `{note_content, created_by}` |
| POST | `/api/algorithm/rerun` | 🔄 算法重跑 |
| GET | `/api/review/monthly-summary` | 📅 月底复核分类汇总。`?month=2026-06` 按月筛选 |
| GET | `/api/medical-record/:id` | 病历详情 + 关联训练课 + 关联异常 + 公示备注 |
| GET | `/api/training-course/:id` | 训练课详情 + 关联病历 + 关联异常 |

## 📐 判定口径（v1.2）

1. **体重单位异常（四分类）** — 同时扫描结构化 `weight` 字段和 `handwritten_note` 病历手写单备注，二者联合判定：
   - **体重单位混写**：体重字段内部（如 4.3 kg 另注 4300g），或字段+备注（如 4500g vs 6kg处方粮）同时出现 2+ 种单位（kg/g/lb/斤/公斤/克/磅），即使数值等价换算也会标为非普通记录
   - **体重字段内多单位混写**：weight 字段本身一条记录内多单位（kg↔g、斤↔kg、lb↔kg 等）
   - **体重量级冲突**：归一化后最大/最小比 > 10x（如 2500g vs 0.08kg = 31倍），或 g>100kg / kg<0.1且为成宠记录
   - **体重单位缺失**：只有纯数字无单位，无法判定量级
   - 备注上下文关键词：体重/登记处/另注/单位/误写/量级/手写/**处方粮**/喂食/剂量/用药/狗粮/猫粮/康复/复查/营养/肥胖/偏瘦/增重/减重/超重/称重 等 — 命中以上任意关键词的备注体重值会纳入联合判定
2. **回访结论空值 / 歧义**
   - 空值：conclusion + 手写备注均为空 → 后续无人能接查
   - 歧义：含「待查/待定/？/?/需随访/待确认」等模糊措辞
3. **训练课关联断裂**
   - `training_courses.medical_record_id` 为 null 或指向不存在病历

> **v1.1 → v1.2 升级要点**：
> - 新增备注上下文识别「处方粮/喂食/剂量/用药」等，`6kg处方粮` 这类与体重强相关的备注也会纳入联合扫描
> - 新增「等价换算也标混写」规则（4.3kg↔4300g / 30.5公斤↔30500g），因前台归一化时仍可能出错
> - 所有体重类异常的 `description` 均加 `[非普通记录-体重XXX]` 醒目前缀，详情页/导出均会突出
> - `original_value` 字段新增 `触发材料：来源[字符偏移]原始值=>归一化值` 部分，前端和导出能直接定位到触发判断的原始文本
> - 算法版本：v1.1 → v1.2；口径版本：2026-06-v1 → 2026-06-v1.1

## ✅ 月底复核口径

| 状态（英文值） | 中文 | 使用场景 |
|---|---|---|
| `confirmed` | 已确认 | 异常属实且已完成处理 |
| `supplement_needed` | 待补件 | 需要补充材料佐证（训练视频/补签名手写单等，必须写说明） |
| `rejected` | 退回 | 判定为误报 |
| (无记录) | 待复核 | 前台小温未处理 |

## 🧪 内置示例数据亮点（便于验收验证）

### 🎯 四个必须命中的体重混写 / 量级冲突样例

| 病历号 | 宠物名 | 体重字段 | 手写备注 | 触发异常类型 | 归一化后差异 | 异常原因标签（非普通记录前缀） |
|---|---|---|---|---|---|---|
| **MR202605002** | 小白 | `4500g` | `6kg处方粮一周后复查` | `weight_unit_mixed` danger | 4.5kg vs 6kg，差 1.33× | `[非普通记录-体重单位混写（字段+备注联合发现）]` |
| **MR202605003** | 旺财 | `30.5 公斤` | `体重登记处手写：30500g` | `weight_unit_mixed` danger | 30.5kg vs 30.5kg，**等价换算但单位不同** | `[非普通记录-体重单位混写（字段+备注联合发现）]` |
| **MR202605008** | 可乐 | `2500g` | `0.08kg 疑似单位误写` | `weight_unit_mismatch` danger | 2.5kg vs 0.08kg，差 31.25× | `[非普通记录-体重量级冲突]` |
| **MR202605010** | 蛋挞 | `4.3 kg 另注4300g` | *(备注与体重无关)* | `weight_unit_mixed` danger | 4.3kg vs 4.3kg，**字段内部等价混写** | `[非普通记录-体重单位混写]` |

> **验收必看 4 条命中：** v1.2 算法重跑后，上述 4 条病历必须全部出现在「异常列表」中，并在详情页显示 `[非普通记录-体重XXX]` 前缀 + `触发材料` 定位 + Banner 非普通记录提示。

### 其它内置样例

| 病历/训练课号 | 触发的异常 | 备注 |
|---|---|---|
| MR202605004 咪咪 | 体重单位缺失（`3.2` 无单位） | warning 级别 |
| MR202605007 布丁 | 字段 10斤 + 备注 5kg（等价换算） | weight_unit_mixed danger |
| MR202605009 薯条 | 字段 8.2kg vs 备注 10.2kg 同单位差 1.24× | weight_unit_mismatch warning |
| TC202605002 | 回访结论歧义「待确认适应情况？」 | warning |
| TC202605004 | 回访结论歧义「待查心率恢复情况」 | warning |
| TC202605005 | 回访结论空值（结论+手写均为空） | danger |
| TC202605006 | 训练课关联断裂（未关联病历） | danger |

v1.2 检测总异常数 = **11 条**（6 种类型分布：weight_unit_mixed danger×4、weight_unit_mismatch danger×1+warning×1、weight_unit_missing warning×1、conclusion_ambiguous warning×3、link_orphan_course danger×1）。

## 🔍 可验证步骤（验收用）

按顺序执行可验证四处口径一致（图表 → 明细 → 原始材料 → 导出 → 接口）：

### Step 1：启动 + 算法重跑
```bash
cd backend && npm start       # 后端 3001 端口
# 新开一个终端，启动前端（可选）
cd frontend && python3 -m http.server 8080
# 打开 http://localhost:8080
# 若需重跑算法：页面右上角「🔄 算法重跑」，或命令行 npm run rerun-algorithm，或 POST /api/algorithm/rerun
```
确认：
- 页面右上角 `算法vv1.2 · 口径2026-06-v1.1`，与 `_context.algorithm_version/caliber_version` 一致
- `/api/health` 返回 `algorithm_version:"v1.2"`

### Step 2：图表 → 明细
- 打开「📊 异常概览图表」Tab
- 点击第一张柱状图中「体重单位混写 danger」柱子（计数应等于 4）
- 会自动跳转到「📋 异常明细列表」Tab，并按 anomaly_type 筛选
- 筛选结果 4 条中应包含 MR202605002/03/08/10（通过病历号在描述或 original_value 中搜索）

### Step 3：明细 → 原始材料（抽查小白 MR202605002）
- 点击列表中 MR202605002 对应行的「追溯 →」
- **Banner**：顶部红底 banner 显示 `⚠ 判断变更说明：同一病历在结构化字段和手写备注中给出不统一的体重口径… — 本记录为异常提醒关联材料，不是普通训练/病历记录`
- **原始值**：`<code>` 块中包含三段：
  1. `体重字段：4500g`
  2. `手写备注：6kg处方粮一周后复查`
  3. `触发材料：体重字段[0-5]4500g=>4.5000kg(g)；手写备注[0-3]6kg=>6.0000kg(kg)` ← 可直接定位字符偏移
- **异常描述**：以 `[非普通记录-体重单位混写（字段+备注联合发现）]` 开头
- **材料追溯链**：`异常提醒单 AA… ➜ 病历单 MR202605002`，点病历单可查看手写单

### Step 4：月底复核三态
- 跳转「✅ 月底复核分类」Tab
- 四张卡片：待复核 / 已确认 / 待补件 / 退回
- 抽查任一条 → 点「处理」→ 选「已确认」→ 提交 → 卡片计数变化 +1
- 再选「待补件」（必须填写 supplementary_material 说明）、「退回」各一条测试
- 三态均正常提交后，调用 `/api/review/monthly-summary` 应看到四组 count 合计 = 11

### Step 5：导出验证（体重单位混写明示）
- 在异常明细列表页点「📥 导出 Excel」，或直接请求 `GET /api/export/anomalies`
- 打开生成的 xlsx：
  - 最后一列为「⚠ 非普通标记」列，值为 `⚠ 非普通记录 - 异常提醒导出数据`
  - MR202605002/03/08/10 对应行的「异常描述」列会带 `[非普通记录-体重…]` 前缀
  - `weight_unit_mixed` / `weight_unit_mismatch` 级别的行按 danger 染浅红、warning 染浅橙
  - 文件末尾附加一行口径说明：算法 v1.2 + 口径版本 2026-06-v1.1

### Step 6：四处口径一致核对
| 位置 | 验证方式 | 期望值 |
|---|---|---|
| 页面右上角 | 首页查看 | v1.2 / 2026-06-v1.1 |
| 详情页「算法/口径」行 | 任意异常详情 | v1.2 / 2026-06-v1.1 |
| 导出 Excel 口径说明行 | 文件末行 | v1.2 / 2026-06-v1.1 |
| 任一接口 JSON `_context` | `curl /api/anomaly/summary` | algorithm_version:"v1.2"，caliber_version:"2026-06-v1.1" |

## 🔗 追溯链路示例

```
异常概览图表（点击柱状图/趋势点）
  → 自动带条件筛选异常列表
    → 点击异常编号进入详情页
      → 顶部 banner 显示"改变了哪些判断"
      → 材料追溯链：异常提醒 ⇄ 病历手写单 ⇄ 训练课记录（都可点跳转）
      → 原始材料区：完整病历/训练课原文，体重单位异常字段高亮标黄
```
