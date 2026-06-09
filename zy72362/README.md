# 管道水锤压力试算系统

整合设备铭牌参数与维修群截图，支持参数溯源、人工改系数据标记、复核工作流与一致性报告。**所有入口（命令行 / API / Web 看板）读取同一份数据，页面看到的状态、保存结果和导出报告严格一致，绝不打架。**

---

## 快速开始

### 1. 安装依赖

```bash
pip install -e .
```

> macOS 自带 python3：可用 `python3 -m pip install -e .`

### 2. 一键运行完整样例（新人 30 秒从样例跑到报告）

```bash
# 路线 A：一致性端到端验证（39 项检查 100% 通过）
python3 verify_consistency.py

# 路线 B：三步工作流（导入铭牌 → 计算 → 回放）
python3 test_workflow.py

# 路线 C：命令行逐步操作（见第 3 节）
```

输出目录：`./wh_data_e2e/` 或 `./wh_data/`，包含计算记录、变更历史、导出报告 JSON，**全部带 calc_id，可反查同一条记录**。

---

## 3. 完整命令行操作路线（CLI）

所有命令共享同一数据源 `--data-dir ./wh_data`，状态/历史/回放同步刷新。

### 第一步：导入设备铭牌参数并试算

```bash
# 导入铭牌
whcalc import-nameplate --file samples/nameplate_001.json

# 水锤压力试算（含人工改系数但未填原因 → 自动标为需设备工程师复核）
whcalc calculate --file samples/calc_input_001.json --calc-id demo-001

# 查看参数回放页（此时 friction_factor / valve_closing_time 都标黄：改系数但无原因）
whcalc replay --calc-id demo-001
```

### 第二步：训练教练老唐 补录维修群截图

```bash
# 导入维修群截图（老唐现场说法：关阀时间实测 2.5s，管道有结垢）
whcalc import-screenshot --file samples/screenshot_001.json

# 关联截图 → 参数溯源自动更新，回放页立即同步
whcalc link-screenshot --calc-id demo-001 --screenshot-id SCREEN-2024-001

# 再看回放：valve_closing_time / friction_factor 来源已变为「维修群截图」
whcalc replay --calc-id demo-001
```

### 第三步：设备工程师 补充改系数原因 + 复核归档

```bash
# 补充原因 1
whcalc add-reason --calc-id demo-001 \
  --param friction_factor \
  --reason "老唐提供的管道结垢照片显示实际粗糙度大于设计值" \
  --reviewer "设备工程师张工"

# 补充原因 2
whcalc add-reason --calc-id demo-001 \
  --param valve_closing_time \
  --reason "维修群截图显示实测关阀时间为2.5秒，铭牌标称5秒偏保守" \
  --reviewer "设备工程师张工"

# 训练教练老唐 确认
whcalc trainer-review --calc-id demo-001 \
  --reviewer "训练教练老唐" \
  --comments "现场已核关阀时间确实为2.5秒，结垢照片属实"

# 设备工程师 正式复核通过
whcalc engineer-review --calc-id demo-001 \
  --approve --reviewer "设备工程师李工" \
  --comments "所有参数均有证据支撑，压力升高 3.22 MPa 在允许范围内，予以通过"

# 查看改前改后历史（每一步：谁、何时、改了什么、为什么）
whcalc history --calc-id demo-001

# 归档
whcalc finalize --calc-id demo-001

# 导出报告 → 带 calc_id、完整历史、可反查
whcalc export-report --calc-id demo-001 --output ./exports

# 最终回放 → 状态：已归档 ✓
whcalc replay --calc-id demo-001
```

---

## 4. Web 小看板（3D/图表 + 溯源跳转 + 状态横幅）

### 启动方式

```bash
# 启动服务
uvicorn water_hammer_calc.web.server:app --host 127.0.0.1 --port 8000 --reload

# 新开浏览器
open http://127.0.0.1:8000
```

### 小看板路由（所有数据同源）

| 路由 | 用途 | 关键一致性保障 |
|------|------|----------------|
| `/` | 首页：6 色状态卡片 + 导入表单 | 各状态计数来自数据存储 |
| `/calculations/{id}` | 3D / 图表展示 | 若 `NEEDS_REVIEW` 弹出**警告横幅**带「跳回铭牌参数 / 维修群截图 / 参数回放页」链接，绝不只剩漂亮画面 |
| `/calculations/{id}/replay` | 参数回放页 | 说明每条为什么被留下、还缺什么材料、下一步找谁；改系数填原因表单；补录截图；导出报告 |
| `/calculations/{id}/history`（API） | 变更历史 JSON | 与 `whcalc history` 内容一致 |
| `/calculations/{id}/export`（API） | 导出报告 JSON | 与磁盘保存文件和 `whcalc export-report` 完全一致，可反查 |

---

## 5. API 接口（自动化集成）

Base URL: `http://127.0.0.1:8000/api`

```bash
# 健康检查
curl http://127.0.0.1:8000/api/health

# 提交计算
curl -s -X POST http://127.0.0.1:8000/api/calculate \
  -H "Content-Type: application/json" \
  -d @samples/calc_input_001.json | python3 -m json.tool

# 参数回放页数据（含状态、历史、下一步找谁）
curl -s http://127.0.0.1:8000/api/calculations/{calc_id}/replay | python3 -m json.tool

# 变更历史
curl -s http://127.0.0.1:8000/api/calculations/{calc_id}/history | python3 -m json.tool

# 补录维修群截图 → 自动触发 re-run，回放页同步刷新
curl -X POST http://127.0.0.1:8000/api/calculations/{calc_id}/link-screenshot/SCREEN-2024-001

# 补充改系数原因
curl -X PATCH http://127.0.0.1:8000/api/calculations/{calc_id}/overrides/friction_factor \
  -H "Content-Type: application/json" \
  -d '{"reason":"老唐提供的管道结垢照片","reviewer":"设备工程师张工"}'

# 工程师复核通过
curl -X PATCH http://127.0.0.1:8000/api/calculations/{calc_id}/status/engineer-review \
  -H "Content-Type: application/json" \
  -d '{"approve":true,"reviewer":"设备工程师李工","comments":"证据完整，予以通过"}'

# 强制刷新计算 → 保留所有状态/审核人/历史
curl -X POST http://127.0.0.1:8000/api/calculations/{calc_id}/refresh

# 导出报告（带 calc_id 可反查）
curl -s http://127.0.0.1:8000/api/calculations/{calc_id}/export | python3 -m json.tool
```

---

## 6. 统一状态机（所有入口颜色 & 含义一致）

| 状态 | 值 | CLI 色 | Web 色 | 说明 |
|------|----|--------|--------|------|
| `DRAFT` | 待复核 | 蓝 | `bg-primary` | 刚导入，无人工改系数问题 |
| `NEEDS_REVIEW` | 需设备工程师复核 | 黄 | `bg-warning` | 有人工改系数但未填原因 或 压力升高 > 10 MPa |
| `REVIEWED_BY_TRAINER` | 训练教练老唐已确认 | 青 | `bg-info` | 训练教练确认了现场证据 |
| `APPROVED` | 设备工程师已通过 | 绿 | `bg-success` | 设备工程师复核通过 |
| `REJECTED` | 设备工程师已驳回 | 红 | `bg-danger` | 设备工程师驳回，需重新走流程 |
| `FINALIZED` | 已归档 | 灰 | `bg-secondary` | 报告已出，正式归档 |

状态机按顺序升级：`DRAFT → NEEDS_REVIEW → REVIEWED_BY_TRAINER → APPROVED → FINALIZED`，驳回可跨级跳 `REJECTED`。

---

## 7. 改前改后历史（7 个维度，谁也赖不掉）

每一次操作都会写入 `change_history`，在命令行 / Web / API / 导出报告中**完全一致**：

| 字段 | 含义 |
|------|------|
| `change_id` | 变更唯一 ID（短 UUID） |
| `change_type` | 类型：导入铭牌 / 补录截图 / 补充原因 / 状态变更 / 人工修改参数 / 工程师复核 / 教练确认 |
| `timestamp` | 时间戳 |
| `operator` | 操作人（训练教练老唐 / 设备工程师张工 ...） |
| `parameter_name` | 被改参数（可能为空） |
| `old_value → new_value` | 改前值 / 改后值 |
| `reason` | 原因 / 备注 |
| `status_before → status_after` | 状态流转前后 |
| `related_screenshot_id` | 关联截图 ID |
| `related_nameplate_id` | 关联铭牌 ID |

---

## 8. 参数回放页 7 个必问字段

回放页对**每一条参数**都明确回答：

| 字段 | 回答的问题 | 举例 |
|------|------------|------|
| 数值 + 单位 | 这条是什么 | 500 m |
| 证据来源 | 这条为什么被留下 | 设备铭牌参数 / 维修群截图 |
| 是否人工修改 | 有没有被改过 | 是 / 否 |
| 修改原因 + 复核人 | 为什么这么改 | 老唐提供的管道结垢照片 |
| 缺少材料 | 还缺什么证据 | 现场实际管长复测报告 |
| 下一步行动 | 下一步该找谁 | 找设备工程师确认管长 |

---

## 9. 目录结构

```
water_hammer_calc/
├── models.py          # Pydantic 数据模型 + CalcStatus 状态机 + ChangeRecord
├── engine.py          # Joukowsky 水锤计算 + 报告导出 + 下一步聚合
├── store.py           # JSON 数据存储 + 所有操作触发 re-run 保证一致性
├── cli.py             # CLI：whcalc 命令组（import/calculate/replay/history/export...）
├── api/main.py        # FastAPI：/api/* 所有接口
└── web/
    ├── server.py      # Web 服务路由 + 统一状态颜色映射
    ├── static/style.css
    └── templates/
        ├── base.html
        ├── dashboard.html      # 首页 6 色状态卡 + 导入
        ├── calc_detail.html    # 3D/图表 + 警告横幅 + 复核按钮
        └── calc_replay.html    # 参数回放 + 缺材料 + 下一步 + 历史 + 导出
samples/
├── nameplate_001.json         # 设备铭牌参数样例
├── screenshot_001.json        # 训练教练老唐维修群截图样例
└── calc_input_001.json        # 计算输入样例（含人工改系数未填原因）
verify_consistency.py          # 39 项一致性端到端验证脚本
test_workflow.py               # 三步工作流演示脚本
wh_data*/                      # 运行后生成，所有数据 / 历史 / 报告
```

---

## 10. 复跑方式

```bash
# 从零开始，清空数据
rm -rf wh_data wh_data_e2e exports

# 跑一遍完整验证
python3 verify_consistency.py

# 或跑一遍三步工作流
python3 test_workflow.py

# 或手动命令行走 8 个命令（见第 3 节）
```

---

## 11. 一致性核心保障（为什么绝不打架）

1. **所有写入必须经过 DataStore**：`save_calculation` 会自动设置 `result.calc_id` 与状态；
2. **所有变更触发 re-run**：`link_screenshot`、`add_override_reason`、`refresh` 都会调用 `engine.run_calculation`，回放页永远是**最新结果**；
3. **状态/审核人/历史 独立保存**：re-run 时 `status`、`change_history`、`reviewed_by_*`、`*_name` 全部保留，绝不被计算覆盖；
4. **三个入口读取同一份 JSON 文件**：CLI 读 `wh_data/calculations/{id}.json`、API 读同一个、Web 渲染前也读同一个 → 天然一致；
5. **报告从 result 直接构建**：`build_report_export(calc_id, input, result)` 输出内容与 result 逐字段比对验证，无偏差；
6. **calc_id 贯穿全链路**：报告 JSON 内自带 `calc_id`，从磁盘文件读回 → 匹配 `load_calculation` → 回到同一条记录，反查零歧义。
