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

重跑会清空 `algorithm_version = v1.0` 的旧异常和其复核记录，再重新检测。

## 📡 接口返回位置（全量）

所有接口 JSON 顶层均包含 `_context` 字段，结构：
```json
{
  "_context": {
    "algorithm_version": "v1.0",
    "caliber_version": "2026-06-v1",
    "caliber_description": "...",
    "api_version": "v1",
    "generated_at": "2026-06-09T..."
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

## 📐 判定口径

1. **体重单位混写 / 缺失 / 量级不匹配**
   - 混写：同一条记录含 kg/g/lb 中 2+ 种单位表述
   - 缺失：只有数字无单位（无法判定量级）
   - 量级不匹配：g>100kg 或 kg<0.1且为成宠记录
2. **回访结论空值 / 歧义**
   - 空值：conclusion + 手写备注均为空 → 后续无人能接查
   - 歧义：含「待查/待定/？/?/需随访」等模糊措辞
3. **训练课关联断裂**
   - `training_courses.medical_record_id` 为 null 或指向不存在病历

## ✅ 月底复核口径

| 状态（英文值） | 中文 | 使用场景 |
|---|---|---|
| `confirmed` | 已确认 | 异常属实且已完成处理 |
| `supplement_needed` | 待补件 | 需要补充材料佐证（训练视频/补签名手写单等，必须写说明） |
| `rejected` | 退回 | 判定为误报 |
| (无记录) | 待复核 | 前台小温未处理 |

## 🧪 内置示例数据亮点（便于验证）

| 病历号 | 体重 | 触发的异常 |
|---|---|---|
| MR202605002 | 4500g 另 6kg | 体重单位混写 |
| MR202605003 | 30.5公斤 手写30500g | 体重单位混写 |
| MR202605004 | 3.2 | 体重单位缺失 |
| MR202605005 | 50000克 | 体重g量级不匹配(>100kg) |
| MR202605008 | 2500g 手写0.08kg | 体重单位量级不匹配 |
| MR202605010 | 4.3 kg 另注4300g | 体重单位混写 |

| 训练课号 | 触发的异常 |
|---|---|
| TC202605002 | 回访结论歧义（"待确认适应情况？"） |
| TC202605004 | 回访结论歧义（"待查心率恢复情况"） |
| TC202605005 | 回访结论空值（结论+手写均为空） |
| TC202605006 | 训练课关联断裂（未关联病历） |

## 🔗 追溯链路示例

```
异常概览图表（点击柱状图/趋势点）
  → 自动带条件筛选异常列表
    → 点击异常编号进入详情页
      → 顶部 banner 显示"改变了哪些判断"
      → 材料追溯链：异常提醒 ⇄ 病历手写单 ⇄ 训练课记录（都可点跳转）
      → 原始材料区：完整病历/训练课原文，体重单位异常字段高亮标黄
```
