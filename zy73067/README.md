# 风机叶片备件排程 CLI (Go + SQLite)

面向维保主管阿敏的命令行工具：读取**备件清单 / 停机窗口 / 到货计划 / 备注状态**四类 CSV，
判断每类备件是否能赶得上最早的停机窗口，输出稳定的汇总和异常明细，并把试跑结果、异常记录、
备注、当前状态、截图说明引用落库到 SQLite。重跑时已有的人工信息（状态/备注/截图）会被保留。

> 本仓库的 `src/` 目录保留着早期 React/Vite 预警看板原型，但**项目的主入口是 Go 二进制
> `./blade-schedule`**，日常排程脚本直接调用它即可。

---

## 1. 构建二进制

```bash
export PATH=$HOME/.local/go/bin:$PATH   # 如果 go 不在默认 PATH
go build -o blade-schedule ./cmd/blade-schedule
```

或直接：

```bash
npm run blade:build
```

构建后在项目根目录得到 `./blade-schedule`。

---

## 2. 子命令与固定参数

所有参数名**固定**，可以直接套到日常脚本里：

| 子命令 | 说明 | 固定参数 |
|---|---|---|
| `init` | 把两套样例数据（normal + anomaly）写到 workdir | `--workdir`（默认 `./data`） |
| `run` | 首次排程 | `--spare-parts`, `--downtime`, `--arrivals`, `--remarks`, `--db`（默认 `./blade.db`）, `--tag`, `--format`（text/json） |
| `rerun` | 异常样例重跑，逻辑同 `run`，打印标题区分，不冲掉已有备注 | 和 `run` 相同 |
| `show` | 查看历史运行、指定 run 汇总 + 异常明细 | `--db`, `--run-id`（默认最新）, `--format` |

---

## 3. 复制即用：一次完整验收

> 下面这组命令**按顺序**跑一遍，就能从 0 开始看到：备件是否赶得上、异常原因、原始清单原话、
> 状态/备注/截图引用全部展示，以及再次重跑不冲掉人工信息。

```bash
# （1）构建
export PATH=$HOME/.local/go/bin:$PATH
go build -o blade-schedule ./cmd/blade-schedule

# （2）清理旧数据 + 初始化样例
rm -f blade.db && rm -rf ./data
./blade-schedule init --workdir ./data

# （3）跑一次正常排程（4 种备件全部赶得上，0 异常）
./blade-schedule run \
    --spare-parts ./data/normal/spare_parts.csv \
    --downtime    ./data/normal/downtime.csv \
    --arrivals    ./data/normal/arrivals.csv \
    --remarks     ./data/normal/remarks.csv \
    --tag normal-run

# （4）用异常样例重跑（3 条异常：主梁晚 6 天 + 2 种写法 + 阈值调高 + 数量不足）
./blade-schedule rerun \
    --spare-parts ./data/anomaly/spare_parts.csv \
    --downtime    ./data/anomaly/downtime.csv \
    --arrivals    ./data/anomaly/arrivals.csv \
    --remarks     ./data/anomaly/remarks.csv \
    --tag anomaly-rerun

# （5）查看汇总 + 异常明细 + 状态/备注/截图引用
./blade-schedule show

# （6）再次重跑，确认人工备注/状态/截图引用没有被空值覆盖
./blade-schedule rerun \
    --spare-parts ./data/anomaly/spare_parts.csv \
    --downtime    ./data/anomaly/downtime.csv \
    --arrivals    ./data/anomaly/arrivals.csv \
    --remarks     ./data/anomaly/remarks.csv \
    --tag anomaly-rerun-2nd
./blade-schedule show --run-id 3
```

如果习惯用 `npm scripts`，也等价于：

```bash
npm run blade:build
rm -f blade.db
npm run blade:init
npm run blade:run-normal
npm run blade:rerun-anomaly
npm run blade:show
```

---

## 4. 样例数据覆盖的业务场景

`init` 生成的样例专门覆盖了前端原型保留的 3 条业务意图：

| 场景 | 在 anomaly 样例中的体现 |
|---|---|
| ① 同一备件前后叫法不一致 | `GW155-4.5MW-叶片A组` 同时写成 `风机叶片A组 GW155` 和 `GW155叶片A组`；`BLD-155-18-主梁` 同时写成 `BLD-155-18 主承力梁` 和 `叶片主梁 BLD-155` |
| ② 阈值调整需追溯原始清单说法 | `BLD-155-18 主承力梁` 行的"阈值调整说明"列写着 `角度阈值由12度临时调高至14度以配合整机测试`，会在异常明细和 SQLite 里原样保留 |
| ③ 异常结论变化要解释 | 每条异常带 `delta_from_prev`（如 `status pending→approved`），再次重跑输出时会标出 |

此外还包含一条**到货晚于停机窗口**的典型场景：主梁 ETA=2024-06-25，但停机窗口 2024-06-20 开始，晚 6 天。

---

## 5. 失败提示定位清单

CLI 在读取/解析任何阶段失败，都会以**非零状态码**退出，错误文案格式统一为
`文件绝对或相对路径:行号  具体原因 + 修复建议`，便于放进日常脚本里被监控系统捕获。

| 错误类型 | 示例输出 |
|---|---|
| 缺少备件清单 | `./xxx.csv:0 备件清单文件不存在，请使用 --spare-parts 指定正确路径，或运行 blade init 生成样例` |
| 日期格式错误 | `./arrivals.csv:3 到货日期格式错误 [not-a-date]，支持 YYYY-MM-DD / YYYY/MM/DD` |
| 停机窗口不存在 | `./empty.csv:0 停机窗口文件 [./empty.csv] 为空或无有效数据行（表头需包含 [风机编号]、[开始日期]、[结束日期]）` |
| 备件名称无法归并 | `./spare.csv:5 备件名称 [XYZ] 无法归并到统一编号，请在 normalizer 中补充对应模式，或核对原始写法` |
| 到货名称无法归并 | `./arrivals.csv:2 到货计划中的备件名称 [写错的叶根] 无法归并到统一编号，请在 normalizer 中补充对应映射，或核对原始清单写法` |
| 必填参数缺失 | `错误: 缺少 --downtime 停机窗口参数` |

---

## 6. SQLite 表结构与重跑保护

数据库路径默认 `./blade.db`，可以用 `--db ./other.db` 切换。

```
runs                -- 每次运行的元信息：tag / created_at / summary（total=X ontime=X ...）
schedule_records    -- 每次运行的完整快照（含 unified_name / eta / downtime / 原因 / 状态 / 备注 / 截图）
anomalies           -- 异常表（run_id + record_id 双外键，含 delta_from_prev）
notes               -- 稳定备注表 (UNIQUE(unified_name, spec_model))：再次重跑 UPSERT 不会覆盖非空旧值
screenshots         -- 截图引用索引（可选，目前通过 notes.screenshot_ref 直接引用路径）
```

**重跑不覆盖人工信息的关键**：`notes` 表使用 `UNIQUE(unified_name, spec_model)`，
每次 `UPSERT` 时只要旧 `status != '' && != 'pending'` 就保留旧 status；旧 remark / screenshot_ref /
threshold_note 非空就全部保留；新 CSV 里的人工字段只有当库里**还是空**时才会被写入。

用下面的 SQL 可以直接验证（sqlite3 `modernc.org/sqlite` 文件完全兼容）：

```bash
# 确认备注/状态/截图引用已落库
sqlite3 blade.db <<'SQL'
.headers on
.mode column
SELECT unified_name, status, remark, screenshot_ref, threshold_note FROM notes;
SELECT count(*) AS anomaly_count FROM anomalies;
-- 再次重跑后，status 不会被空值覆盖
SELECT unified_name, status FROM notes WHERE status != 'pending' OR status IS NOT NULL;
SQL
```

---

## 7. 目录说明

```
zy73067/
├── blade-schedule              # 编译产物，主入口
├── cmd/blade-schedule/main.go  # CLI 薄入口
└── internal/
    ├── cli/                    # 子命令分发 + 内嵌样例 + 格式化输出
    ├── db/                     # SQLite schema + Store（UPSERT 备注保护）
    ├── normalizer/             # 备件名称归一化：多写法 → 统一编号
    ├── scheduler/              # CSV 解析（ParseError: 行级定位）+ 延误计算
    └── model/                  # 结构体定义
```
