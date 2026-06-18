# 港湾淤积时序回放

生态调查员阿宁交接用 - 港湾淤积时序回放后端服务

---

## 一、怎么启动（按顺序操作）

### 第 1 步：安装 Python 依赖

确保本机 Python ≥ 3.9。在项目根目录执行：

```bash
cd /Users/maca/pro/solo/workspaces/zy73147
pip install -r requirements.txt
```

### 第 2 步：启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

启动成功后终端会显示：

```
Uvicorn running on http://0.0.0.0:8000
```

### 第 3 步：验证服务是否起来

浏览器打开或 `curl`：

```
http://localhost:8000/api/health
```

返回 `{"status":"ok",...}` 即表示正常。

---

## 二、失败后怎么重跑

### 情况 A：服务启动失败（依赖缺失 / 端口被占）

- 依赖缺失：重新执行 `pip install -r requirements.txt`
- 端口 8000 被占：换端口启动
  ```bash
  uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
  ```

### 情况 B：某条淤积记录计算失败（公式 / 单位 / 阈值）

算不出的记录**不会消失**，会保留在数据库中并标记失败阶段。重跑单条记录：

```bash
curl -X POST "http://localhost:8000/api/records/{记录ID}/retry"
```

或直接打开浏览器的交互式文档（见下一节），找到 `POST /api/records/{record_id}/retry` 点「Try it out」。

重跑前请先确认：
- 公式阶段失败：检查 `raw_siltation_value` 是否有值且为数字
- 单位阶段失败：检查 `raw_unit` 是否在支持列表（cm / m / mm / 厘米 / 米 / 毫米）
- 阈值阶段失败：检查换算后淤积量是否为负值

### 情况 C：服务崩了需要重启

直接 `Ctrl+C` 停掉当前 `uvicorn`，再重新执行启动命令即可。SQLite 数据库文件 `harbor_siltation.db` 在项目根目录，不会丢失。

---

## 三、接口返回从哪里看

### 方式 1：浏览器交互式文档（推荐接班人使用）

启动服务后，浏览器打开：

```
http://localhost:8000/docs
```

这是 FastAPI 自动生成的 Swagger UI，可以：
- 查看所有接口列表和参数说明
- 点「Try it out」直接填参并执行请求
- 实时看到返回 JSON

### 方式 2：运营主管视图（给主管看的汇总接口）

列表：
```
GET /api/manager/records
```

单条详情：
```
GET /api/manager/records/{记录ID}
```

运营主管接口返回里**一眼能看出**：
- `is_supplemented` / `supplement_count`：哪些补过材料
- `supplement_tags`：补录类型标签（灰度发布补录 / 运行后补录 / 云遮挡挂起）
- `judgment_changed`：哪些改判过
- `before_judgment` / `after_judgment` / `rejudge_reasons`：改判前后对比和原因
- `status_desc`：中文状态说明
- `fail_stage` / `fail_reason`：算不出的卡在哪一步
- `cloud_suspended` / `cloud_explanation`：云遮挡挂起及影响说明

### 方式 3：调查员完整记录详情

```
GET /api/records/{记录ID}
```

这里包含：
- 经纬度原始写法 / 标准化后值 / 检测到的格式
- 失败阶段中文解释 `fail_stage_desc`
- `gray_release_note`：灰度发布临时备注，说明这次补录改变了哪些判断
- `post_run_note`：跑完后补录备注，说明导出变了哪里
- `supplements`：所有补录材料历史
- `rejudge_logs`：所有改判日志
- `export_diffs`：导出字段差异记录（old → new）

---

## 四、关键业务逻辑速查（交接备忘）

| 场景 | 处理逻辑 |
|------|---------|
| 经纬度写法不统一 | 自动检测「十进制」或「度分秒(DMS)」格式，统一转为十进制；检测失败保留原始值并标记 `coord_normalized=false` |
| 记录算不出 | 不删除，`status` 标记为 `failed_formula` / `failed_unit` / `failed_threshold`，`fail_stage` 和 `fail_reason` 写清卡在哪一步 |
| 名字被改过的补充材料 | `original_name` 存原名，`name_changed=true` 标记 |
| 灰度发布临时补遥感截图 | 调 `POST /api/gray-release-note`，系统在 `gray_release_note` 字段写明更新了哪些字段、判定是否改变 |
| 遥感截图云遮挡 | 云遮挡比例 ≥ 15% 自动将记录置为 `suspended_cloud`（挂起），放入待补材料，同时生成补录备注说明会牵动淤积等级、时序趋势、正式导出三类结论 |
| 跑完后补录 | 调 `POST /api/post-run-supplement`，系统写 `post_run_note` 并在 `export_diffs` 中记录每个字段的 old / new 变化 |
| 运营主管看接口 | 走 `/api/manager/*`，补录和改判都有明确标记和说明 |
