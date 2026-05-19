# 会展物料管理系统

一个完整的会展物料（桁架、灯具、屏幕等）管理系统，用于解决多个展位同时借物料、现场改动后总账对不上的问题。

## 功能特性

### 核心业务功能
1. **物料管理** - 管理桁架、灯具、屏幕等物料的基础信息和库存
2. **调拨管理** - 物料借出、多展位同时调拨
3. **归还管理** - 物料归还、状态跟踪
4. **库存自动计算** - 实时更新可用、已调拨、已归还数量

### 数据导入功能
- 支持从CSV导入物料表
- 支持从YAML导入调拨单
- 支持从CSV导入归还记录
- **坏记录不吞掉** - 保留原始位置、失败原因和可修改建议

### 查询筛选功能
- 按**负责人**筛选
- 按**展位号**筛选
- 按**状态**筛选（待审批、已批准、已完成等）
- 按**异常类型**筛选
- 按**时间范围**筛选

### 报告导出功能
- 导出调拨记录到Excel/CSV
- 导出归还记录到Excel/CSV
- 导出汇总报告
- **查询结果与导出报告一致**

### 批量操作和错误处理
- 批量导入时部分成功部分失败
- 失败记录可重试
- **重试不破坏已成功记录**
- 完整的错误日志和处理建议

## 项目结构

```
exhibition-material-management/
├── requirements.txt              # 依赖包
├── README.md                    # 说明文档
├── exhibition_material/         # 主包
│   ├── __init__.py
│   ├── config.py               # 配置
│   ├── main.py                 # 主入口
│   ├── models/                 # 数据模型
│   │   ├── __init__.py
│   │   ├── base.py            # 基础模型
│   │   ├── material.py        # 物料模型
│   │   ├── allocation.py      # 调拨单模型
│   │   ├── return_record.py   # 归还记录模型
│   │   ├── import_error.py    # 导入错误记录模型
│   │   └── exceptions.py      # 枚举类型
│   ├── services/               # 业务逻辑层
│   │   ├── __init__.py
│   │   ├── material_service.py    # 物料服务
│   │   ├── allocation_service.py  # 调拨服务
│   │   ├── return_service.py      # 归还服务
│   │   ├── query_service.py       # 查询服务
│   │   └── batch_service.py       # 批量操作服务
│   ├── storage/                # 数据存储层
│   │   ├── __init__.py
│   │   ├── database.py         # 数据库连接
│   │   └── repository.py       # 数据仓库
│   ├── importers/             # 数据导入器
│   │   ├── __init__.py
│   │   ├── csv_importer.py     # CSV物料导入
│   │   ├── yaml_importer.py    # YAML调拨单导入
│   │   └── return_importer.py  # 归还记录导入
│   ├── exporters/             # 报告导出器
│   │   ├── __init__.py
│   │   └── report_exporter.py  # Excel/CSV报告导出
│   └── utils/                 # 工具类
│       ├── __init__.py
│       ├── validators.py      # 数据验证
│       └── helpers.py         # 辅助函数
├── sample_data/               # 示例数据
│   ├── sample_materials.csv      # 物料示例
│   ├── sample_allocations.yaml   # 调拨单示例
│   └── sample_returns.csv        # 归还记录示例
├── tests/                     # 测试
│   └── test_system.py            # 系统测试
└── exports/                   # 导出文件目录（自动创建）
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行演示

```bash
python -m exhibition_material.main
```

### 3. 运行完整测试

```bash
python tests/test_system.py
```

## 使用示例

### 基本使用

```python
from exhibition_material.main import ExhibitionMaterialManager
from exhibition_material.models import MaterialType

# 初始化管理器
manager = ExhibitionMaterialManager()

# 创建物料
material = manager.create_material(
    code="TRUSS-001",
    name="300x300铝合金桁架",
    material_type=MaterialType.TRUSS,
    unit="米",
    total_quantity=500,
    specification="300x300x4000mm",
    location="A区仓库",
    responsible_person="张三"
)

# 创建调拨单
allocation = manager.create_allocation(
    material_id=material.id,
    booth_number="A01",
    quantity=50,
    responsible_person="赵六",
    contact_phone="13800138000"
)

# 创建归还记录
record = manager.create_return_record(
    allocation_id=allocation.id,
    quantity=20,
    received_by="张三",
    returned_by="赵六",
    condition_remark="完好无损"
)

# 查询调拨记录（按负责人）
allocations = manager.query_allocations(responsible_person="赵六")

# 导出Excel报告
result = manager.export_allocations_excel("调拨记录.xlsx")

manager.close()
```

### 数据导入

```python
# 从CSV导入物料
result = manager.import_materials_from_csv("sample_data/sample_materials.csv")
print(f"成功: {result['success_count']}, 失败: {result['failure_count']}")

# 从YAML导入调拨单
result = manager.import_allocations_from_yaml("sample_data/sample_allocations.yaml")
print(f"成功: {result['success_count']}, 失败: {result['failure_count']}")

# 查看导入错误
errors = manager.batch_service.get_import_errors()
for error in errors:
    print(f"行 {error['source_line']}: {error['error_message']}")
    print(f"建议: {error['suggestion']}")
```

### 查询和筛选

```python
# 按负责人查询
by_person = manager.query_allocations(responsible_person="赵六")

# 按展位查询
by_booth = manager.query_allocations(booth_number="A01")

# 按状态查询
from exhibition_material.models import RecordStatus
by_status = manager.query_allocations(status=RecordStatus.APPROVED)

# 查询异常记录
anomalies = manager.get_all_anomalies()

# 获取展位汇总
booth_summary = manager.get_booth_summary("A01")

# 获取人员汇总
person_summary = manager.get_person_summary("赵六")
```

## 数据模型

### Material（物料）
- `code`: 物料编码（唯一）
- `name`: 物料名称
- `type`: 物料类型（桁架/灯具/屏幕/其他）
- `specification`: 规格说明
- `unit`: 单位
- `total_quantity`: 总数量
- `available_quantity`: 可用数量
- `allocated_quantity`: 已调拨数量
- `returned_quantity`: 已归还数量
- `location`: 存放位置
- `responsible_person`: 负责人
- `is_active`: 是否启用

### Allocation（调拨单）
- `allocation_no`: 调拨单号（唯一）
- `material_id`: 物料ID
- `booth_number`: 展位号
- `quantity`: 数量
- `allocated_at`: 调拨时间
- `expected_return_at`: 预计归还时间
- `responsible_person`: 负责人
- `contact_phone`: 联系电话
- `status`: 状态（待审批/已批准/部分/已完成/已取消）
- `has_anomaly`: 是否有异常
- `anomaly_type`: 异常类型
- `anomaly_remark`: 异常备注
- `approved_by`: 审批人
- `approved_at`: 审批时间
- `remarks`: 备注
- `source_file`: 来源文件
- `source_line`: 来源行号

### ReturnRecord（归还记录）
- `return_no`: 归还单号（唯一）
- `allocation_id`: 调拨单ID
- `material_id`: 物料ID
- `quantity`: 归还数量
- `returned_at`: 归还时间
- `received_by`: 接收人
- `returned_by`: 归还人
- `booth_number`: 展位号
- `condition_remark`: 状况备注
- `status`: 状态
- `has_anomaly`: 是否有异常
- `anomaly_type`: 异常类型
- `source_file`: 来源文件
- `source_line`: 来源行号

### ImportError（导入错误记录）
- `import_batch_id`: 导入批次ID
- `source_file`: 来源文件
- `source_line`: 来源行号
- `raw_data`: 原始数据
- `error_type`: 错误类型
- `error_message`: 错误消息
- `suggestion`: 修改建议
- `is_resolved`: 是否已解决
- `resolved_by`: 解决人
- `resolved_at`: 解决时间

## 核心设计要点

### 1. 分层架构
- **模型层**: 数据结构定义
- **存储层**: 数据库操作和事务管理
- **业务层**: 核心业务逻辑实现
- **导入/导出层**: 数据导入导出处理

### 2. 库存自动计算
- 调拨时：可用数量↓，已调拨数量↑
- 归还时：可用数量↑，已调拨数量↓，已归还数量↑
- 部分归还时自动更新状态

### 3. 错误处理机制
- 批量操作时单条失败不影响其他记录
- 完整记录失败原因和原始数据
- 提供可操作的修改建议
- 失败记录可独立重试

### 4. 数据一致性
- 所有操作使用数据库事务
- 异常情况自动回滚
- 完整的操作日志和审计追踪

## 扩展建议

1. **REST API接口**: 添加FastAPI/Flask接口，支持Web前端调用
2. **Web管理界面**: 使用Vue/React开发管理后台
3. **消息通知**: 集成邮件/短信通知，提醒物料逾期归还
4. **二维码管理**: 物料和调拨单生成二维码，扫码操作
5. **统计报表**: 添加更多统计分析和可视化图表
6. **多仓库管理**: 支持多仓库/分会展独立管理
7. **权限管理**: 添加用户角色和权限控制

## License

MIT
