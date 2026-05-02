# 病理科切片管理系统

本地桌面工具，用于管理医院病理科切片台账、借阅记录和科室规则。

## 功能特性

- **数据导入**: CSV 导入切片台账，JSON 导入借阅申请和科室规则
- **状态管理**: 切片状态机 (在库/已借出/已归还/逾期/丢失)
- **规则引擎**: 不同科室不同借期，逾期自动检测
- **批量操作**: 支持批量确认归还、备注持久化
- **报告导出**: Markdown 和 CSV 格式的交接报告

## 项目结构

```
pathology_slide_manager/
├── models.py           # 数据模型 (Slide, BorrowRecord, DepartmentRule)
├── database.py         # SQLite 存储层
├── importer.py         # CSV/JSON 导入和校验
├── state_machine.py    # 状态机和规则引擎
├── reporter.py         # 报告生成器
├── gui.py              # Tkinter GUI
├── demo.py             # 演示流程脚本
├── samples/            # 示例数据
│   ├── slides.csv
│   ├── borrows.json
│   └── department_rules.json
└── test_pathology.py   # 单元测试
```

## 快速开始

### 1. 安装依赖

```bash
pip install tkcalendar  # 可选，用于日期选择
```

Python 3.8+ 自带 tkinter，无需额外安装。

### 2. 运行演示

```bash
cd pathology_slide_manager
python demo.py
```

演示流程将:
1. 导入示例切片台账 (10 条)
2. 导入科室规则 (5 个科室)
3. 处理借阅申请 (8 条)
4. 执行归还操作
5. 测试边界情况 (重复借阅、归还早于借出)
6. 生成交接报告

### 3. 运行测试

```bash
cd pathology_slide_manager
python test_pathology.py
```

### 4. 启动 GUI

```bash
cd pathology_slide_manager
python gui.py
```

## 数据格式

### 切片台账 CSV

```csv
slide_id,patient_id,specimen_type,collection_date,department,storage_location,notes
SL001,P001,HE染色,2024-01-15,病理科,A-01-001,常规切片
```

### 借阅申请 JSON

```json
{
  "borrows": [
    {
      "record_id": "B001",
      "slide_id": "SL001",
      "borrower_name": "张医生",
      "borrower_dept": "肿瘤科",
      "borrow_date": "2024-02-01",
      "expected_return_date": "2024-02-08",
      "notes": "常规借阅"
    }
  ]
}
```

### 科室规则 JSON

```json
{
  "rules": [
    {
      "department": "肿瘤科",
      "max_borrow_days": 14,
      "max_concurrent_borrows": 3,
      "allow_extend": true,
      "requires_approval": true,
      "notes": "需填写申请表"
    }
  ]
}
```

## 边界处理

| 场景 | 处理方式 |
|------|----------|
| 同一切片重复借阅 | 拦截，返回错误信息 |
| 归还日期早于借出日期 | 拦截，返回错误信息 |
| 不同科室借期不同 | 根据科室规则自动计算应还日期 |
| 逾期未还 | 自动更新状态为"逾期" |

## 使用流程

1. **导入数据**: 依次导入切片台账 CSV、借阅申请 JSON、科室规则 JSON
2. **借阅操作**: 选中切片，填写借阅信息，确认借阅
3. **归还操作**: 选中借阅记录，点击归还或批量归还
4. **导出报告**: 选择报告类型，导出交接清单

## 技术栈

- Python 3.8+
- Tkinter (GUI)
- SQLite (数据持久化)
- CSV/JSON (数据交换)
