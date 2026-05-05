# 砂型开浇守门员

本地"砂型开浇守门员"系统，用于铸造车间砂型质量检查和浇注前复核。

## 功能特性

- **CSV数据导入**：支持导入砂型工单、烘干炉温度日志、水分抽检表、浇注排程和质检备注
- **规则判断引擎**：自动检测以下问题：
  - **未烘透**：烘干温度低于180℃或时间少于120分钟
  - **复潮**：水分含量超过5%
  - **炉次串号**：同一砂型在不同炉次浇注
  - **开浇时间冲突**：同一砂型浇注排程时间重叠
  - **需复检砂型**：质检备注标记需要复检的砂型
- **复核功能**：班长可改判/补备注，数据持久化到SQLite
- **导出功能**：支持导出Markdown交班单和JSON明细
- **本地Web界面**：简洁的Web页面供班长操作

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python app.py
```

服务将在 `http://localhost:5000` 启动。

### 3. 验证流程

#### 方式一：使用示例数据快速验证

1. 打开浏览器访问 `http://localhost:5000`
2. 点击 **"导入示例数据"** 按钮
3. 系统将自动导入示例数据并运行规则检测
4. 查看检测结果，应该能看到以下违规：
   - **未烘透**：MOLD-2024-001、MOLD-2024-002、MOLD-2024-005
   - **复潮**：MOLD-2024-002、MOLD-2024-004
   - **炉次串号**：MOLD-2024-001、MOLD-2024-002
   - **开浇时间冲突**：MOLD-2024-001
   - **需复检砂型**：MOLD-2024-003

5. 点击 **"复核"** 按钮进行改判
6. 点击 **"导出交班单(MD)"** 或 **"导出明细(JSON)"** 导出数据

#### 方式二：使用自己的CSV文件

1. 准备CSV文件，文件名需包含以下关键词之一：
   - `砂型工单` - 砂型工单数据
   - `烘干炉温度` - 烘干炉温度日志
   - `水分抽检` - 水分抽检表
   - `浇注排程` - 浇注排程数据
   - `质检备注` - 质检备注数据

2. 调用API导入CSV：

```bash
# 导入砂型工单
curl -X POST -F "file=@砂型工单.csv" http://localhost:5000/api/import/csv

# 导入烘干炉温度日志
curl -X POST -F "file=@烘干炉温度日志.csv" http://localhost:5000/api/import/csv

# 导入水分抽检表
curl -X POST -F "file=@水分抽检表.csv" http://localhost:5000/api/import/csv

# 导入浇注排程
curl -X POST -F "file=@浇注排程.csv" http://localhost:5000/api/import/csv

# 导入质检备注
curl -X POST -F "file=@质检备注.csv" http://localhost:5000/api/import/csv
```

3. 运行规则检测：

```bash
curl -X POST http://localhost:5000/api/rules/run
```

4. 打开浏览器访问 `http://localhost:5000` 查看结果

## CSV文件格式说明

### 1. 砂型工单

```csv
mold_no,part_name,mold_qty,material,pouring_temp,create_time
MOLD-2024-001,气缸盖,10,HT250,1380,2024-05-05 08:00
```

| 字段 | 说明 |
|------|------|
| mold_no | 砂型编号（唯一） |
| part_name | 零件名称 |
| mold_qty | 砂型数量 |
| material | 材质 |
| pouring_temp | 浇注温度(℃) |
| create_time | 创建时间 |

### 2. 烘干炉温度日志

```csv
oven_no,batch_no,log_time,temperature,target_temp,duration_min,mold_nos
OVEN-01,BATCH-2024-001,2024-05-05 07:00,175,180,110,MOLD-2024-001,MOLD-2024-002
```

| 字段 | 说明 |
|------|------|
| oven_no | 烘干炉编号 |
| batch_no | 批次号 |
| log_time | 记录时间 |
| temperature | 实际温度(℃) |
| target_temp | 目标温度(℃) |
| duration_min | 烘干时长(分钟) |
| mold_nos | 涉及砂型编号(逗号分隔) |

### 3. 水分抽检表

```csv
mold_no,inspect_time,moisture_content,inspector,location,remark
MOLD-2024-001,2024-05-05 09:30,3.5,张三,上模,正常
```

| 字段 | 说明 |
|------|------|
| mold_no | 砂型编号 |
| inspect_time | 抽检时间 |
| moisture_content | 水分含量(%) |
| inspector | 抽检人 |
| location | 抽检位置 |
| remark | 备注 |

### 4. 浇注排程

```csv
schedule_no,mold_no,furnace_no,planned_start_time,planned_end_time,actual_start_time,actual_end_time,status
SCH-2024-001,MOLD-2024-001,FURN-01,2024-05-05 14:00,2024-05-05 14:30,,,pending
```

| 字段 | 说明 |
|------|------|
| schedule_no | 排程编号（唯一） |
| mold_no | 砂型编号 |
| furnace_no | 炉号 |
| planned_start_time | 计划开始时间 |
| planned_end_time | 计划结束时间 |
| actual_start_time | 实际开始时间 |
| actual_end_time | 实际结束时间 |
| status | 状态 |

### 5. 质检备注

```csv
mold_no,note_time,note_type,content,reporter
MOLD-2024-003,2024-05-05 10:30,需复检,砂型表面有轻微裂纹,建议复检后开浇,质检员B
```

| 字段 | 说明 |
|------|------|
| mold_no | 砂型编号 |
| note_time | 备注时间 |
| note_type | 备注类型 |
| content | 备注内容 |
| reporter | 报告人 |

## API接口说明

### 1. 导入CSV文件

```
POST /api/import/csv
Content-Type: multipart/form-data
```

参数：
- `file`: CSV文件
- `type` (可选): 文件类型

### 2. 导入目录所有CSV

```
POST /api/import/all
Content-Type: application/x-www-form-urlencoded
```

参数：
- `directory`: 目录路径（默认uploads目录）

### 3. 运行规则检测

```
POST /api/rules/run
```

### 4. 查询检测结果

```
GET /api/results?severity=high&rule_type=undried&mold_no=MOLD-2024-001
```

参数：
- `severity`: 严重程度 (high/medium/low)
- `rule_type`: 规则类型
- `mold_no`: 砂型编号

### 5. 提交复核

```
POST /api/review
Content-Type: application/json
```

请求体：
```json
{
    "result_id": 1,
    "mold_no": "MOLD-2024-001",
    "new_verdict": "approved",
    "review_note": "经检查，砂型实际已烘干",
    "reviewer": "张班长"
}
```

改判结果选项：
- `approved`: 确认合格（放行）
- `waived`: 豁免（有条件放行）
- `rejected`: 维持违规（禁止开浇）

### 6. 导出Markdown交班单

```
GET /api/export/markdown
```

### 7. 导出JSON明细

```
GET /api/export/json
```

### 8. 获取统计数据

```
GET /api/stats
```

### 9. 导入示例数据

```
POST /api/import/sample
```

## 规则配置

规则参数可在 `rules_engine.py` 中修改：

```python
self.config = {
    'min_oven_temp': 180.0,      # 最低烘干温度(℃)
    'min_oven_duration': 120,      # 最短烘干时长(分钟)
    'max_moisture': 5.0,           # 最大水分含量(%)
    'time_conflict_gap': 5         # 时间冲突最小间隔(分钟)
}
```

## 项目结构

```
├── app.py                  # Flask应用入口
├── database.py             # SQLite数据库模型
├── csv_importer.py         # CSV导入模块
├── rules_engine.py         # 规则判断引擎
├── requirements.txt        # Python依赖
├── templates/
│   └── index.html          # Web界面
├── samples/                # 示例数据
│   ├── 砂型工单_20240505.csv
│   ├── 烘干炉温度日志_20240505.csv
│   ├── 水分抽检表_20240505.csv
│   ├── 浇注排程_20240505.csv
│   └── 质检备注_20240505.csv
├── data/                   # SQLite数据库目录
│   └── mold_guardian.db    # 数据库文件
└── uploads/                # 上传文件目录
```

## 示例数据说明

示例数据设计了以下测试场景：

| 砂型编号 | 问题类型 | 说明 |
|---------|---------|------|
| MOLD-2024-001 | 未烘透、炉次串号、开浇时间冲突 | 烘干温度175℃<180℃，时间110分钟<120分钟；两个排程时间重叠(14:00-14:30和14:15-14:45)；炉号从FURN-01变FURN-02 |
| MOLD-2024-002 | 未烘透、复潮、炉次串号 | 同炉次烘干未达标；水分6.2%>5%；炉号从FURN-01变FURN-03 |
| MOLD-2024-003 | 需复检 | 质检备注标记"需复检" |
| MOLD-2024-004 | 复潮 | 水分7.8%>5% |
| MOLD-2024-005 | 未烘透 | 烘干温度165℃<180℃，时间100分钟<120分钟 |

## 注意事项

1. 所有CSV文件必须使用UTF-8编码
2. 时间格式建议使用 `YYYY-MM-DD HH:MM`
3. 砂型编号必须在砂型工单表中存在才能进行关联查询
4. 数据存储在本地SQLite数据库中，刷新页面不会丢失

## 技术栈

- **后端**: Python + Flask
- **数据库**: SQLite
- **数据处理**: pandas
- **前端**: 原生HTML/CSS/JavaScript
