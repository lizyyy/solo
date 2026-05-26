# 汽修保养套餐核销 API

面向汽修连锁门店店长的小型核销处理服务：把店长上交的保养套餐原始材料
（JSON 或 CSV）接入系统后，自动拆分为 **正常 / 待补充 / 已拦截** 三类，
每一类都带有明确的**原因说明**和**后续动作**；支持从原始输入一路追踪到最终报告。

## 特性

- **批次管理**：创建批次、登记原始材料、上传 CSV、触发拆分。
- **三类拆分**：
  - `normal`  —— 关键字段齐全且格式合法，自动进入结算。
  - `pending` —— 存在可空字段留空或必填字段缺失，指派门店补充。
  - `blocked` —— 发现 VIN 长度错误、套餐前缀非法、手机号格式错误等严重问题，冻结并进入风控。
- **处理轨迹**：每一条明细的分类结果、原因、后续动作以及历史记录都可查询。
- **报告导出**：按批次导出 CSV / JSON，可直接给店长或总部财务使用。
- **关键字段贯通**：`package_code / plate / vin / service_date / store_id`
  可从原始输入追溯到最终报告中的每一行。

## 安装与启动

```bash
pip install -r requirements.txt
python app.py          # 默认 http://127.0.0.1:8000
# 或者
uvicorn app:app --reload --port 8000
```

服务启动后：

- OpenAPI 文档：<http://127.0.0.1:8000/docs>
- 健康检查：`curl http://127.0.0.1:8000/health`

## 端到端示例（curl）

以下命令演示：从创建批次 → 上传 CSV → 触发拆分 → 查询明细轨迹 → 下载报告。

```bash
BASE=http://127.0.0.1:8000

# 1. 创建一个新批次（店长 S001 的当班核销批次）
curl -s -X POST $BASE/batches \
  -H 'Content-Type: application/json' \
  -d '{"store_id":"S001","operator":"店长-李伟","remark":"5月第四周套餐核销"}'
# 返回：
# {"batch_no":"B20260526103045123","store_id":"S001","status":"open",...}

# 把返回的 batch_no 记录下来，以下命令用占位符 $BATCH 代替
BATCH=B20260526103045123

# 2. 上传店长提供的 CSV 原始材料（仓库内提供 sample.csv）
curl -s -X POST $BASE/batches/$BATCH/upload \
  -F 'file=@sample.csv;type=text/csv'

# 3. 也可以用 JSON 登记单条/多条原始材料
curl -s -X POST $BASE/batches/$BATCH/register \
  -H 'Content-Type: application/json' \
  -d '{
    "records":[
      {"package_code":"B10123","plate":"沪H55555","vin":"LSGPC54U8KD654321",
       "service_date":"2026-05-25","store_id":"S001","mileage":42100,
       "phone":"13800000000","customer_name":"黄先生","technician":"高师傅"}
    ]
  }'

# 4. 触发拆分流程 —— 系统将每一条原始记录分入 normal / pending / blocked
curl -s -X POST $BASE/batches/$BATCH/split
# 返回示例：
# {"batch_no":"...","status":"split","counts":{"normal":3,"pending":2,"blocked":2},"total":7}

# 5. 查看批次概览
curl -s $BASE/batches/$BATCH

# 6. 按类别查看本批次内所有明细
curl -s "$BASE/batches/$BATCH/items?category=blocked"
curl -s "$BASE/batches/$BATCH/items?category=pending"
curl -s "$BASE/batches/$BATCH/items?category=normal"

# 7. 查看某条明细的完整处理轨迹（把 1 换成真实的 item_id）
curl -s $BASE/items/1/history

# 8. 下载批次报告（CSV）
curl -s "$BASE/batches/$BATCH/report?fmt=csv" -o $BATCH.csv

# 9. 下载批次报告（JSON）
curl -s "$BASE/batches/$BATCH/report?fmt=json" -o $BATCH.json
```

## 一键跑通脚本（demo.sh）

仓库内已提供 [demo.sh](file:///Users/lzy/pro/solo/workspaces/zy70931/demo.sh)，
可在服务启动后直接执行：

```bash
bash demo.sh
```

脚本会完整走完：创建批次 → 上传 `sample.csv` → 触发拆分 → 查询轨迹 → 下载 CSV/JSON 报告。

## 拆分规则一览

| 类别      | 触发条件                                                      | 后续动作                                                 |
|-----------|---------------------------------------------------------------|----------------------------------------------------------|
| normal    | 所有必填字段齐全、VIN 长度 17、套餐前缀在备案范围、日期合法    | 自动推送结算系统，权益次日到账，客户短信通知             |
| pending   | 可空字段留空，或必填字段缺失                                  | 提醒门店店长补齐，超期未补则转拦截                       |
| blocked   | VIN 长度异常 / 套餐前缀非法 / 手机号格式错误 / 日期非法        | 冻结本单，进入风控复核，24h 内需门店补正                 |

## 关键字段贯通

所有原始记录中的核心字段都会在报告中原样保留，支持反向追溯：

| 字段            | 来源            | 报告列          | 分类是否影响 |
|-----------------|-----------------|-----------------|--------------|
| `package_code`  | 原始输入        | `package_code`  | ✅           |
| `plate`         | 原始输入        | `plate`         | ✅           |
| `vin`           | 原始输入        | `vin`           | ✅           |
| `service_date`  | 原始输入        | `service_date`  | ✅           |
| `store_id`      | 原始输入        | `store_id`      | ✅           |
| `mileage` 等    | 原始输入        | 同名列          | —            |
| `reason`        | 拆分引擎生成    | `reason`        | —            |
| `follow_up`     | 拆分引擎生成    | `follow_up`     | —            |

## 目录结构

```
.
├── app.py           # FastAPI 主服务
├── requirements.txt # 依赖
├── sample.csv       # 演示数据（含 3 条正常 / 2 条待补充 / 2 条拦截）
└── demo.sh          # 一键跑通脚本
```
