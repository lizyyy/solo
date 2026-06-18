# 珊瑚白化时序回放

面向水质分析师阿乔的珊瑚白化异常溯源系统。重点解决：异常点一点即回船上记录本（含历史版本、备注、扫描截图），保留离群原始值不硬删，遥感云遮挡留下影响范围和来源行，汇总面板可看出船测/遥感谁拉动了结果。

---

## 🚀 先跑哪包样例？

默认自带一包现场会收到的材料：**`2024_Q2_Xisha`**（西沙北礁 2024 年 Q2）。这包里有：

| 文件 | 现场角色对应 |
|---|---|
| `data/ship_logbook.json` | 船上记录本（6 条，含多次修订版本 + 补录备注 + 扫描截图引用） |
| `data/remote_sensing.json` | 哨兵 2 号遥感数据（6 景，含云掩膜行号、受影响像素数、来源波段） |
| `data/calc_formula.json` | 计算口径（v1.2，含阈值、加权、离群/云区规则） |
| `data/timeseries_summary.json` | 时序汇总（含 2 处异常标记、异常原因、结果拉动贡献占比） |

两个典型异常已经预置好，方便阿乔直接验证回溯链路：

1. **2024-04-22** — 船上记录本被阿乔、李主任来回改了 3 版，最终 35%，标记 `疑似离群 / 多次修订`
2. **2024-05-18** — 实习生原始记录 99%，被阿乔修正为 42%，标记 `离群已修正 / 原始离群值保留`（旧值不删，留在历史版本里）

---

## 🏃 启动步骤（阿乔看这个就够）

```bash
# 1. 安装依赖（只需一次）
npm install

# 2. 启动服务
npm start
```

启动成功后终端会打印接口地址。然后：

| 想看什么 | 打开哪里 |
|---|---|
| 时序回放图表 + 点异常回溯明细 | 浏览器访问 **http://localhost:3000** |
| 健康检查接口（服务通没通） | 浏览器/cURL 打开 **http://localhost:3000/api/health** |
| 时序汇总 JSON | **http://localhost:3000/api/timeseries** |
| 异常明细溯源（以 2024-04-22 为例） | **http://localhost:3000/api/anomaly/2024-04-22** |
| 单条船上记录本（含所有历史版本） | **http://localhost:3000/api/log/LOG-20240422-007** |
| 单景遥感（含云掩膜行号） | **http://localhost:3000/api/remote/S2A_20240422T031027** |
| 计算口径与版本变更 | **http://localhost:3000/api/formula** |

---

## 🧯 失败了怎么重来？

| 症状 | 重来方法 |
|---|---|
| 浏览器图表空白、提示「加载时序数据失败」 | 确认 `npm start` 已跑；端口 3000 是否被占用，占用就改端口：`PORT=3001 npm start`，然后访问 http://localhost:3001 |
| 点异常红点明细出不来 / 返回 404 | 先确认日期格式：URL 必须是 `YYYY-MM-DD`，例如 `/api/anomaly/2024-05-18`，不要写 `2024/5/18` |
| JSON 数据改了但页面没变化 | 点页面右上角「重新加载」按钮；或刷新浏览器（Ctrl+R / Cmd+R） |
| 数据改坏了想回到样例初始值 | `data/` 下 4 个 JSON 文件是唯一数据源，重新替换成备份即可；接口层不缓存，重启就会读新文件 |
| 安装依赖失败（`npm install` 报错） | 删掉 `node_modules` 和 `package-lock.json`，换国内镜像重试：`npm install --registry=https://registry.npmmirror.com` |
| 想换一包新样例 | 把新数据按 `data/` 下 4 个文件同名替换即可；API 层会自动读取，无需改代码 |

---

## 🧭 接口返回从哪里看？

两份接口返回最关键：

### 1. 汇总接口：`GET /api/timeseries`
返回整条时间线，每条包含 `anomaly` 布尔值 + `anomaly_flags` + `driver`（谁拉动了结果）。排班同事点开图表前先扫这个接口就能快速定位异常日期。

### 2. 异常明细接口：`GET /api/anomaly/YYYY-MM-DD`
一个接口同时把 4 件事吐回来，阿乔不用再翻多个地方：
- `summary`：最终白化率、水温、活珊瑚覆盖 + 结果拉动来源 `driver`（船测/遥感各占多少贡献 %，一眼看出谁拉动了结果）
- `ship_log`：船上记录本条目，含 **所有历史版本**（`versions` 数组）、每条版本的记录人、时间戳、备注、扫描截图引用，`flags` 里会保留 `outlier_corrected` / `raw_outlier_kept` 等标记，原始离群值不删
- `remote_scene`：遥感场景，含 `cloud_coverage_pct`、受影响像素数、`cloud_mask_rows`（云掩膜来源行号数组）、`source_band_lines`、`quality_note`
- `calc_formula`：当前生效的计算口径（版本号、公式、加权方式、离群处理规则、历史保留规则）

---

## 📂 项目结构

```
.
├── package.json
├── server.js              # Express API 服务
├── data/
│   ├── ship_logbook.json       # 船上记录本（含历史版本、备注、截图引用、离群标记）
│   ├── remote_sensing.json     # 遥感数据（含云掩膜行号、受影响像素）
│   ├── calc_formula.json       # 计算口径与变更历史
│   └── timeseries_summary.json # 时序汇总 + 异常点 + 拉动贡献
└── public/
    ├── index.html
    ├── style.css
    └── app.js              # Chart.js 图表 + 异常点点击回溯
```
