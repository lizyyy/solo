# 口腔连锁采购库存管理API

用于口腔连锁机构的库存管理，支持种植体、麻药、一次性包材等材料的批号追踪、召回管理、效期预警和替代耗材溯源。

## 功能特性

- **库存CSV导入**：批量导入库存数据，自动校验
- **召回公告解析**：支持Markdown格式召回公告，自动匹配受影响批次
- **门店消耗记录**：追踪各门店耗材使用情况
- **多规则校验**：
  - 召回批号检查
  - 近效期预警（90天）
  - 跨门店调拨校验
  - 重复提交去重
- **结果分类**：正常项、待确认项、失败项
- **替代耗材追溯**：可追溯替代耗材的历史来源

## 快速开始

### 环境要求

- Python 3.8+

### 安装依赖

```bash
cd dental_inventory_api
pip install -r requirements.txt
```

### 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问：
- API文档：http://localhost:8000/docs
- 备用文档：http://localhost:8000/redoc

### 复跑测试流程

1. **启动服务**
```bash
uvicorn app.main:app --reload
```

2. **导入召回公告（可选）**
```bash
curl -X POST "http://localhost:8000/api/recall/upload" \
  -F "file=@data/sample_recall.md"
```

3. **上传库存CSV**
```bash
curl -X POST "http://localhost:8000/api/inventory/upload" \
  -F "file=@data/sample_inventory.csv"
```

4. **查看处理记录**
```bash
curl "http://localhost:8000/api/inventory/records?store_id=ST001"
```

5. **追溯替代耗材来源**
```bash
curl "http://localhost:8000/api/inventory/trace/IMP-2024-R01"
```

6. **上传门店消耗记录**
```bash
curl -X POST "http://localhost:8000/api/consumption/upload" \
  -F "file=@data/sample_consumption.csv"
```

## API端点说明

### 库存管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/inventory/upload | 上传库存CSV文件 |
| POST | /api/inventory/process | 直接处理库存数据 |
| GET | /api/inventory/trace/{batch_number} | 追溯替代耗材来源 |
| GET | /api/inventory/records | 查询处理记录 |

### 召回管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/recall/upload | 上传召回公告Markdown |
| POST | /api/recall/ | 创建召回公告 |
| GET | /api/recall/ | 查询召回公告列表 |
| PUT | /api/recall/{id}/deactivate | 停用召回公告 |

### 门店消耗

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/consumption/upload | 上传消耗记录CSV |
| POST | /api/consumption/ | 创建消耗记录 |
| GET | /api/consumption/ | 查询消耗记录 |

## 响应格式示例

```json
{
  "normal_items": [...],
  "pending_items": [
    {
      "status": "pending",
      "batch_number": "IMP-2024-001",
      "material_name": "ITI种植体",
      "store_id": "ST001",
      "original_data": {...},
      "suggestion": "立即停止使用，联系供应商处理召回事宜",
      "failure_reason": "召回预警：该批次在召回范围内..."
    }
  ],
  "failed_items": [...],
  "total_count": 6,
  "normal_count": 3,
  "pending_count": 2,
  "failed_count": 1
}
```

## 数据文件格式

### 库存CSV字段

- 批号(batch_number)：必填，唯一标识
- 材料名称(material_name)：必填
- 材料类型、规格、数量、单位、供应商
- 门店ID、门店名称
- 有效期、生产日期
- is_replacement：是否为替代耗材
- replaced_batch：被替代的批号
- original_source：原始来源说明

### 召回公告Markdown格式

使用二级标题（##）分隔各部分：
- 发布日期
- 发布机构
- 召回产品
- 涉及批次
- 召回原因
- 召回级别

## 项目结构

```
dental_inventory_api/
├── app/
│   ├── __init__.py
│   ├── main.py              # 主入口
│   ├── models/              # 数据模型
│   │   ├── inventory.py
│   │   ├── recall.py
│   │   └── schemas.py
│   ├── services/            # 业务逻辑
│   │   ├── parser.py        # 文件解析器
│   │   └── rules_engine.py  # 规则引擎
│   ├── api/                 # API端点
│   │   ├── inventory.py
│   │   ├── recall.py
│   │   └── consumption.py
│   └── utils/
│       └── database.py      # 数据库配置
├── data/                     # 示例数据
│   ├── sample_inventory.csv
│   ├── sample_recall.md
│   └── sample_consumption.csv
├── requirements.txt
└── README.md
```
