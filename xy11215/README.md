# 地下泵房巡检数据处理系统

## 项目概述

这是一个为小区工程主管设计的后端工具，用于处理地下泵房的巡检数据。解决了微信群中巡检信息分散、遗漏的问题，通过数据导入、错误记录、本地持久化等功能，确保停水风险被及时发现。

## 核心功能

### 1. 数据导入
- **CSV巡检表导入：支持人工巡检记录CSV文件
- **JSON传感器告警导入：支持传感器数据JSON文件

### 2. 数据验证与错误处理
- **完整的数据验证规则
- **坏记录不丢弃，而是完整保留：
  - 原始位置（行号
  - 失败原因（详细错误信息
  - 可修改建议（指导用户如何修正

### 3. 敏感字段脱敏
- **后端层脱敏，不仅在展示层遮一下
- **姓名、电话等敏感字段在API返回、导出文件、日志中全部脱敏
- 确保数据安全合规

### 4. 本地持久化
- 使用SQLite本地数据库
- 重启服务或第二次运行后仍能查到所有历史数据
- 完整的处理历史记录

### 5. API接口
- 上传CSV/JSON文件上传
- 巡检记录查询
- 错误记录查询（含原因和建议）
- 数据导出（CSV格式）
- 处理历史查询
- 统计信息

## 项目结构

```
├── main.py              # FastAPI主应用，API接口定义
├── models.py            # 数据库模型
├── database.py          # 数据库配置
├── data_processor.py    # 数据处理与验证逻辑
├── mask_utils.py     # 敏感字段脱敏工具
├── requirements.txt     # 依赖包
├── test_inspection.csv  # CSV测试数据
├── test_sensor.json    # JSON测试数据
├── test_flow.sh        # 主流程测试脚本
├── uploads/            # 上传文件目录
├── exports/            # 导出文件目录
└── pump_room_inspection.db  # SQLite数据库
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务将在 http://127.0.0.1:8000 启动

访问 http://127.0.0.1:8000/docs 查看API文档

### 3. 运行主流程测试

```bash
./test_flow.sh
```

## 主要数据验证规则

- 必填字段：泵房ID、巡检时间、巡检员姓名
- 数值范围：水压0-10 MPa，水位-5~10 m，温度-20~80 °C
- 枚举值验证：水泵状态、振动等级
- 格式验证：时间格式、数值格式

## 错误记录可解释性示例

每条错误记录包含：
- **source_file**：来源文件名
- **row_number**：行号（准确定位
- **error_type**：错误类型
- **error_message**：详细错误原因
- **suggestion**：具体修改建议
- **raw_data**：原始数据（脱敏后

## 敏感字段处理

敏感字段在以下位置全部脱敏：
- API返回结果
- 导出的CSV文件
- 系统日志

脱敏规则：
- 姓名：张*、李*、王*、周*
- 手机号：138****001
- 邮箱：u***@example.com

## 技术栈

- **Web框架**：FastAPI
- **数据库**：SQLite + SQLAlchemy
- **数据处理**：Python标准库

## 使用说明

### 上传文件

```bash
# 上传CSV
curl -X POST -F "file=@your_file.csv" http://127.0.0.1:8000/api/upload/csv

# 上传JSON
curl -X POST -F "file=@your_file.json" http://127.0.0.1:8000/api/upload/json
```

### 查询错误记录

```bash
# 查询所有未解决的错误
curl "http://127.0.0.1:8000/api/errors?resolved=false"
```

### 导出数据

```bash
# 导出巡检记录
curl -o records.csv "http://127.0.0.1:8000/api/export/records"

# 导出错误记录
curl -o errors.csv "http://127.0.0.1:8000/api/export/errors"
```

## 工程主管如何解释某条记录被拦下？

1. 调用 `/api/errors` 接口查看所有错误记录
2. 查看每条记录的 `error_message` 了解被拦下的原因
3. 查看 `suggestion` 字段获取修改建议
4. 根据 `row_number` 和 `source_file` 定位原始文件位置
5. 修改后重新上传即可

## 数据安全

- 所有敏感字段在后端层脱敏
- 数据库中存储原始数据，但API返回和导出全部脱敏
- 日志中的敏感信息自动脱敏
- 本地部署，数据不离开本地网络
