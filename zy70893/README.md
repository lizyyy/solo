# 工厂返修数据处理 API

## 项目概述

解决工厂质量工程师返修数据导入混乱问题：统一处理返修CSV、工单JSON、物料批次，自动分类正常/待确认/失败记录，支持重复批次拦截、多缺陷检测、返修闭环校验等规则。

## 核心功能

### 1. 数据分类处理
- **正常项**：所有校验通过的记录
- **待确认项**：工位异常等需人工确认的记录（保留原始数据+修正建议）
- **失败项**：重复批次、严重错误等无法处理的记录

### 2. 校验规则

#### 同批多缺陷检测
- 同一物料批次出现3种以上不同缺陷时触发警告
- 建议排查批次质量问题

#### 返修闭环校验
- 已关闭工单的返修记录无法重复录入
- 确保返修流程完整性

#### 责任工位校验
- 工位编号必须以S/ST/W开头或数字
- 不在预设列表中的工位标记为待确认

#### 批次防重
- 已处理批次再次提交直接拦截
- 避免数据重复录入

## 项目结构

```
.
├── main.py              # FastAPI主应用
├── models.py            # 数据模型定义
├── processor.py         # 数据处理和校验逻辑
├── requirements.txt     # 依赖包列表
├── sample_repairs.csv       # 返修CSV样例
├── sample_work_orders.json  # 工单JSON样例
├── sample_material_batches.json  # 物料批次样例
└── test_api.py          # API测试脚本
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

服务将在 `http://localhost:8000` 启动

### 3. 访问文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 4. 运行测试

```bash
# 新开终端窗口
pip install requests
python test_api.py
```

## API 端点

### `POST /upload/repair-csv`
上传返修CSV文件进行处理

**请求**: `multipart/form-data`
- `file`: CSV文件

**CSV字段要求**:
- `work_order_id`: 工单编号
- `station_id`: 工位编号（如S01, ST01, W01）
- `material_batch`: 物料批次号
- `defect_type`: 缺陷类型
- `repair_date`: 返修日期
- `operator`: 操作员
- `is_closed`: 是否已闭环
- `close_date`: 闭环日期（可选）

**响应示例**:
```json
{
  "total_count": 6,
  "normal_count": 4,
  "pending_count": 1,
  "failed_count": 1,
  "normal_items": [...],
  "pending_items": [
    {
      "status": "pending",
      "raw_data": {"station_id": "QA999", ...},
      "suggestion": "工位QA999不在责任工位列表中，请人工确认",
      "error_code": "STATION_PENDING"
    }
  ],
  "failed_items": [
    {
      "status": "failed",
      "raw_data": {"material_batch": "BATCH202404001", ...},
      "suggestion": "物料批次BATCH202404001已处理，无法重复提交",
      "error_code": "BATCH_DUPLICATE"
    }
  ],
  "summary": {...}
}
```

### `POST /upload/work-order`
上传工单JSON文件

### `POST /upload/material-batch`
上传物料批次JSON文件

### `POST /process`
直接提交JSON数据处理

### `GET /stats`
获取当前处理统计

### `POST /reset`
重置处理器状态

## 样例数据说明

### sample_repairs.csv 包含：
1. **正常记录** (S01, S02, S04, S05) - 标准工位编号
2. **待确认记录** (QA999) - 非常规工位，需人工修正
3. **失败记录** (BATCH202404001重复提交) - 批次防重
4. **闭环工单测试** (WO20240501002已关闭)

### 典型测试场景：
- 第3行 `station_id: QA999` → 待确认项，建议人工修正工位
- 第4行 `material_batch: BATCH202404001` → 与第1行重复 → 失败项
- 第6行 工单WO20240501002已闭环 → 失败项

## 业务规则扩展

如需新增校验规则，编辑 `processor.py` 中的 `DataProcessor` 类：

1. 添加新的校验方法
2. 在 `process_repair_record` 中调用该方法
3. 根据校验结果设置状态（NORMAL/PENDING/FAILED）

## 注意事项

- 批次防重基于内存存储，服务重启后重置
- 建议生产环境接入数据库持久化数据
- 工位列表可在 `check_responsibility_station` 方法中配置
