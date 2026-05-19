# 家电售后仓管理系统

解决售后仓手工对表问题，实现领用、装机、返还、索赔、核销全流程管理。

## 核心特性

✅ **全流程覆盖** - 领用 → 装机 → 返还 → 索赔 → 核销  
✅ **幂等性保证** - 重复提交结果稳定，不多扣多算  
✅ **审计追踪** - 角色、操作人、时间完整记录  
✅ **批量操作** - 部分失败不影响成功记录，支持重试  
✅ **多维度查询** - 按负责人、时间、状态、异常类型筛选  
✅ **报告导出** - 查询结果一致导出

## 项目结构

```
├── models.py          # 数据模型和数据库操作
├── service.py         # 核心业务逻辑
├── api.py             # Flask REST API
├── cli.py             # 命令行工具
├── test_warehouse.py  # 单元测试
├── sample_data.json   # 示例数据
└── requirements.txt   # 依赖包
```

## 快速开始

### 1. 安装依赖

```bash
pip3 install -r requirements.txt
```

### 2. 运行测试

```bash
python3 test_warehouse.py
```

### 3. 启动 API 服务

```bash
python3 api.py
```

服务地址: http://localhost:5000

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 健康检查 |
| POST | /api/receive | 领用零件 |
| POST | /api/install | 装机登记 |
| POST | /api/return | 返还旧件 |
| POST | /api/claim | 厂商索赔 |
| POST | /api/write-off | 核销 |
| POST | /api/batch | 批量操作 |
| GET | /api/operations | 查询操作记录 |
| GET | /api/export | 导出报告 |
| GET | /api/part/{code}/trace | 零件追溯 |

### API 调用示例

**领用零件:**
```bash
curl -X POST http://localhost:5000/api/receive \
  -H "Content-Type: application/json" \
  -d '{
    "operation_id": "REC2024001",
    "operator_id": "ENG001",
    "operator_name": "张工",
    "role": "engineer",
    "parts": [
      {"part_code": "COM001", "part_name": "压缩机", "quantity": 2}
    ]
  }'
```

## 命令行使用

### 查看帮助

```bash
python3 cli.py --help
```

### 领用零件

```bash
python3 cli.py receive \
  --operation-id REC001 \
  --parts '[{"part_code": "P001", "part_name": "压缩机", "quantity": 5}]'
```

### 完整流程示例

```bash
# 1. 领用
python3 cli.py receive --operation-id REC_FLOW \
  --parts '[{"part_code": "FLOW01", "part_name": "测试零件", "quantity": 3}]'

# 2. 装机
python3 cli.py install --operation-id INS_FLOW \
  --receive-id REC_FLOW \
  --parts '[{"part_code": "FLOW01", "quantity": 1}]'

# 3. 返还
python3 cli.py return --operation-id RET_FLOW \
  --install-id INS_FLOW \
  --parts '[{"part_code": "FLOW01", "quantity": 1}]'

# 4. 索赔
python3 cli.py claim --operation-id CLA_FLOW \
  --return-id RET_FLOW \
  --parts '[{"part_code": "FLOW01", "quantity": 1}]'

# 5. 核销
python3 cli.py writeoff --operation-id WOF_FLOW \
  --claim-id CLA_FLOW \
  --parts '[{"part_code": "FLOW01", "quantity": 1}]'
```

### 查询和导出

```bash
# 查询操作记录
python3 cli.py query --operator-id cli_user --status success

# 导出报告
python3 cli.py export --operation-type receive

# 零件追溯
python3 cli.py trace --part-code P001
```

### 批量操作

```bash
python3 cli.py batch \
  --operations '[{"operation_type": "receive", "operation_id": "B001", "parts": [{"part_code": "B_P01", "part_name": "批量件1", "quantity": 10}]}]'
```

## 数据库表结构

- **parts** - 零件库存表
- **operation_records** - 操作记录表（含审计信息）
- **stock_flows** - 库存流水表
- **part_operations** - 零件操作关联表

## 业务规则

1. **关联关系必须有效**: 装机关联领用、返还关联装机、索赔关联返还、核销关联索赔
2. **幂等性**: 同一 operation_id 重复提交不会产生副作用
3. **审计信息**: 所有操作都记录操作人ID、姓名、角色、时间
4. **状态追踪**: 每个零件都有完整的状态流转记录

## 测试覆盖

- ✅ 领用成功
- ✅ 领用幂等性
- ✅ 完整流程（领用→装机→返还→索赔→核销）
- ✅ 无效关联ID处理
- ✅ 批量操作全部成功
- ✅ 批量操作部分失败
- ✅ 查询操作记录
- ✅ 导出报告
- ✅ 零件追溯
- ✅ 失败重试
