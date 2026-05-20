# 酒店布草对账系统 API

一个解决酒店布草送洗、破损、回收数量与洗涤厂账单对账问题的API服务。

## 功能特性

1. **CSV/JSON文件上传**：支持送洗单CSV、回收单JSON、房型配置JSON的上传解析
2. **三方对账**：自动比对送洗数量与回收数量
3. **结果分类**：
   - 正常项：数量一致，无破损
   - 待确认项：差异在正常范围内或需人工确认
   - 失败项：需赔付的项目
4. **三大核心规则**：
   - 短少赔付：送洗数量与回收数量不符时自动计算赔付金额
   - 破损归因：根据破损类型判定责任方（酒店/洗涤厂/待确认）
   - 重复计费：检测送洗单中重复出现的物品
5. **历史溯源**：赔付记录可追溯到原始送洗和回收记录
6. **防重复提交**：同一批次再次提交不会重复生效

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── models.py          # 数据模型定义
│   ├── database.py        # 内存数据库
│   ├── parser.py          # 文件解析器
│   ├── reconciliation.py  # 对账引擎
│   └── main.py            # FastAPI主程序
├── sample_data/           # 示例数据文件
│   ├── wash_sample.csv
│   ├── recycle_sample.json
│   └── room_config_sample.json
├── requirements.txt
└── README.md
```

## 本地运行说明

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 访问接口文档

启动后访问：http://localhost:8000/docs

可以使用 Swagger UI 直接测试所有接口。

### 4. 测试对账接口

在 Swagger UI 中找到 `POST /api/reconcile` 接口，上传以下三个文件：
- `sample_data/wash_sample.csv` - 送洗单CSV
- `sample_data/recycle_sample.json` - 回收单JSON
- `sample_data/room_config_sample.json` - 房型配置JSON（可选）

### 5. 查询赔付溯源

根据返回结果中的 `compensation_id`，调用：
```
GET /api/compensation/{compensation_id}
```

即可查看该赔付记录对应的原始送洗和回收数据。

## API 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/reconcile | 提交批次进行对账 |
| GET | /api/batch/{batch_id} | 查询批次对账结果 |
| GET | /api/compensation/{compensation_id} | 查询赔付记录溯源 |
| GET | /api/compensations/batch/{batch_id} | 查询批次所有赔付记录 |
| GET | /api/batches/check/{batch_id} | 检查批次是否已处理 |
| POST | /api/config/room | 添加房型配置 |
| GET | /api/config/rooms | 获取所有房型配置 |

## 赔付规则说明

### 物品单价（可配置）
- bedsheet（床单）：35元
- pillowcase（枕套）：15元
- towel（毛巾）：20元
- bathrobe（浴袍）：80元
- quilt_cover（被套）：50元

### 破损责任判定
- tear（撕裂）：酒店责任（正常损耗）
- stain（污渍）：洗涤厂责任（需赔付）
- hole（破洞）：洗涤厂责任（需赔付）
- wear（磨损）：酒店责任（正常损耗）
- unknown（未知）：待人工确认

### 短少赔付规则
- 差异 ≤ 1件：正常损耗，不赔付
- 差异 > 2件：判定为短少，洗涤厂需赔付
- 回收数量 > 送洗数量：待确认，需人工核实

## 示例数据说明

示例数据 `sample_data/` 包含：
1. **送洗单**：5种物品，共580件
2. **回收单**：模拟各种情况：
   - 床单：短少5件，2件污渍（洗涤厂赔付）
   - 枕套：正常
   - 毛巾：短少2件，1件撕裂（酒店责任）
   - 浴袍：短少5件（需赔付）
   - 被套：3件破损原因未知
