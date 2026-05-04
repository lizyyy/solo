# 社区公交电子墨水屏发布校验服务

本服务为社区公交电子墨水屏发布前提供数据校验功能，帮助调度员在发布前发现潜在问题。

## 功能特性

- **数据导入**：支持导入站点设备CSV、线路时刻表CSV、临时绕行JSON和模板包
- **发布批次管理**：创建、查看、删除发布批次
- **智能校验**：
  - 设备离线检测
  - 模板字段完整性检查
  - 临时绕行覆盖范围校验
  - 同一屏幕重复排程检测
- **人工复核**：支持添加复核备注
- **导出功能**：
  - Markdown格式交接单
  - JSON格式审计包
- **批量操作**：支持批量导入数据

## 快速开始

### 环境要求

- Python 3.8+
- pip

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动服务

```bash
python app.py
```

服务将在 `http://localhost:5000` 启动。

## API 接口

### 健康检查

```
GET /api/health
```

### 发布批次管理

**列出所有发布批次**
```
GET /api/releases
```

**创建发布批次**
```
POST /api/releases
Content-Type: application/json

{
  "release_name": "2026年5月4日早高峰发布",
  "created_by": "张调度员"
}
```

**获取单个发布批次详情**
```
GET /api/releases/{release_id}
```

**删除发布批次**
```
DELETE /api/releases/{release_id}
```

### 数据导入

**导入站点设备CSV**
```
POST /api/releases/{release_id}/import/devices
Content-Type: multipart/form-data

file: devices.csv
```

**导入线路时刻表CSV**
```
POST /api/releases/{release_id}/import/schedules
Content-Type: multipart/form-data

file: schedules.csv
```

**导入临时绕行JSON**
```
POST /api/releases/{release_id}/import/detours
Content-Type: multipart/form-data

file: detours.json
```

**导入模板包JSON**
```
POST /api/releases/{release_id}/import/templates
Content-Type: multipart/form-data

file: templates.json
```

**批量导入**
```
POST /api/releases/{release_id}/batch-import
Content-Type: multipart/form-data

devices_file: devices.csv
schedules_file: schedules.csv
detours_file: detours.json
templates_file: templates.json
```

### 校验功能

**执行校验**
```
POST /api/releases/{release_id}/validate
```

**获取校验问题**
```
GET /api/releases/{release_id}/issues
```

### 复核与审批

**添加复核备注**
```
POST /api/releases/{release_id}/review
Content-Type: application/json

{
  "reviewer": "李复核员",
  "comment": "已确认设备EP003确实离线，需要联系运维人员",
  "issue_id": "issue-uuid"
}
```

**审批通过**
```
POST /api/releases/{release_id}/approve
Content-Type: application/json

{
  "approved_by": "王主管"
}
```

### 发布清单管理

**重新生成发布清单**
```
POST /api/releases/{release_id}/regenerate-items
```

**获取发布清单**
```
GET /api/releases/{release_id}/items
```

### 导出功能

**导出Markdown交接单**
```
GET /api/releases/{release_id}/export/markdown
```

**导出JSON审计包**
```
GET /api/releases/{release_id}/export/audit
```

## 数据格式说明

### 站点设备CSV (devices.csv)

| 字段 | 说明 | 示例 |
|------|------|------|
| device_id | 设备唯一标识 | EP001 |
| station_name | 站点名称 | 阳光花园东门 |
| station_id | 站点ID | S001 |
| is_online | 在线状态 | true/false |
| template_id | 使用模板ID | template_standard |
| location | 位置描述 | 东城区阳光路88号 |
| last_seen | 最后在线时间 | 2026-05-04T08:30:00 |

### 线路时刻表CSV (schedules.csv)

| 字段 | 说明 | 示例 |
|------|------|------|
| route_name | 线路名称 | 1路公交 |
| route_id | 线路ID | R001 |
| station_name | 站点名称 | 阳光花园东门 |
| station_id | 站点ID | S001 |
| departure_time | 发车时间 | 06:30 |
| direction | 方向 | 往火车站 |
| device_id | 设备ID (可选) | EP001 |

### 临时绕行JSON (detours.json)

```json
{
  "detours": [
    {
      "detour_id": "DT001",
      "route_id": "R001",
      "route_name": "1路公交",
      "effective_from": "2026-05-01T00:00:00",
      "effective_to": "2026-05-10T23:59:59",
      "affected_stations": ["阳光花园东门", "人民广场南"],
      "detour_stations": ["临时站A", "临时站B"],
      "reason": "阳光路道路施工，临时绕行"
    }
  ]
}
```

### 模板包JSON (templates.json)

```json
{
  "metadata": {
    "package_name": "公交电子墨水屏标准模板包",
    "version": "1.0.0"
  },
  "templates": [
    {
      "template_id": "template_standard",
      "template_name": "标准时刻表模板",
      "required_fields": ["route_name", "station_name", "departure_time", "direction"],
      "description": "标准时刻表显示模板"
    }
  ]
}
```

## 校验规则说明

### 1. 设备离线检测
- **检测逻辑**：检查 `is_online` 字段为 `false` 的设备
- **严重程度**：警告 (WARNING)
- **处理建议**：联系运维人员确认设备状态

### 2. 模板字段完整性检查
- **检测逻辑**：比对时刻表数据与模板定义的必填字段
- **严重程度**：错误 (ERROR)
- **处理建议**：补充缺失字段或更换模板

### 3. 临时绕行覆盖检查
- **检测逻辑**：检查受影响的线路站点是否都在绕行定义中
- **严重程度**：错误 (ERROR)
- **处理建议**：更新绕行配置，确保所有受影响站点都被覆盖

### 4. 重复排程检测
- **检测逻辑**：检查同一设备、同一线路、同一时间是否有重复排程
- **严重程度**：错误 (ERROR)
- **处理建议**：清理重复的时刻表条目

## 完整工作流程示例

### 使用 curl 命令

```bash
# 1. 创建发布批次
curl -X POST http://localhost:5000/api/releases \
  -H "Content-Type: application/json" \
  -d '{"release_name":"测试发布批次","created_by":"测试用户"}'

# 2. 批量导入数据
curl -X POST http://localhost:5000/api/releases/{release_id}/batch-import \
  -F "devices_file=@examples/devices.csv" \
  -F "schedules_file=@examples/schedules.csv" \
  -F "detours_file=@examples/detours.json" \
  -F "templates_file=@examples/templates.json"

# 3. 执行校验
curl -X POST http://localhost:5000/api/releases/{release_id}/validate

# 4. 添加复核备注
curl -X POST http://localhost:5000/api/releases/{release_id}/review \
  -H "Content-Type: application/json" \
  -d '{"reviewer":"复核员","comment":"已核实问题"}'

# 5. 审批通过（需要没有错误）
curl -X POST http://localhost:5000/api/releases/{release_id}/approve \
  -H "Content-Type: application/json" \
  -d '{"approved_by":"主管"}'

# 6. 导出交接单
curl -O http://localhost:5000/api/releases/{release_id}/export/markdown

# 7. 导出审计包
curl -O http://localhost:5000/api/releases/{release_id}/export/audit
```

### 使用 Python requests

```python
import requests

BASE_URL = "http://localhost:5000"

# 1. 创建发布批次
response = requests.post(f"{BASE_URL}/api/releases", json={
    "release_name": "2026年5月4日发布",
    "created_by": "张调度员"
})
release_id = response.json()["release_id"]

# 2. 批量导入
files = {
    "devices_file": open("examples/devices.csv", "rb"),
    "schedules_file": open("examples/schedules.csv", "rb"),
    "detours_file": open("examples/detours.json", "rb"),
    "templates_file": open("examples/templates.json", "rb")
}
response = requests.post(
    f"{BASE_URL}/api/releases/{release_id}/batch-import",
    files=files
)

# 3. 校验
response = requests.post(f"{BASE_URL}/api/releases/{release_id}/validate")
result = response.json()
print(f"校验结果: {result['summary']}")

# 4. 导出交接单
response = requests.get(f"{BASE_URL}/api/releases/{release_id}/export/markdown")
with open("handover.md", "wb") as f:
    f.write(response.content)
```

## 项目结构

```
xy4424/
├── app.py              # Flask 应用入口
├── config.py           # 配置文件
├── models.py           # 数据模型定义
├── storage.py          # 数据存储管理
├── parsers.py          # CSV/JSON 解析器
├── validators.py       # 校验逻辑实现
├── exporters.py        # 导出功能实现
├── requirements.txt    # 依赖包列表
├── examples/           # 示例数据
│   ├── devices.csv
│   ├── schedules.csv
│   ├── detours.json
│   └── templates.json
└── data/               # 运行时数据目录
    ├── releases/       # 发布批次存储
    ├── audits/         # 审计包存储
    ├── uploads/        # 上传文件缓存
    └── templates/      # 模板缓存
```

## 注意事项

1. 所有数据存储在本地 `data/` 目录下，不会同步到云端
2. 审批前必须解决所有 ERROR 级别的问题
3. 示例数据中包含故意设置的问题，用于测试校验功能
4. 服务默认运行在调试模式，生产环境请关闭 debug 模式

## 许可证

本项目仅供内部使用。
