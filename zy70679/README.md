# 酒旅发票项目拆分税额校正排查CLI

## 功能特性

- **发票识别**：支持酒店、机票等合开发票的识别与校验
- **比例拆分**：按出差人权重自动进行金额和税额拆分
- **税额校正**：自动处理尾差，确保拆分后总额与原发票一致
- **重复发票拦截**：自动检测并拦截重复发票
- **多格式报告导出**：支持人类可读(TXT)、机器可读(JSON)、表格(CSV)格式

## 安装

```bash
pip install -e .
```

## 使用方法

### 1. 生成样例输入文件

```bash
# 正常输入样例
invoice-splitter sample -t normal

# 脏数据样例
invoice-splitter sample -t dirty

# 边界冲突样例
invoice-splitter sample -t boundary

# 重复发票样例
invoice-splitter sample -t duplicate

# 空结果样例
invoice-splitter sample -t empty
```

### 2. 验证输入数据

```bash
invoice-splitter validate -i input.json
```

### 3. 执行发票拆分

```bash
invoice-splitter split -i input.json -o ./reports
```

## 输入文件格式

```json
{
  "description": "样例描述",
  "invoices": [
    {
      "invoice_no": "发票号",
      "invoice_date": "YYYY-MM-DD",
      "total_amount": 3180.00,
      "total_tax": 180.00,
      "invoice_type": "hotel",
      "vendor_name": "供应商名称",
      "tax_rate": 0.06
    }
  ],
  "travelers": [
    {
      "name": "张三",
      "employee_id": "E001",
      "project_code": "PRJ-A-2024",
      "weight": 1
    }
  ]
}
```

## 核心规则

1. **金额拆分**：按出差人权重比例进行分配
2. **税额拆分**：同金额拆分逻辑，最后一人承担尾差
3. **重复检测**：基于发票号进行唯一性校验
4. **数据校验**：日期格式、金额正负、权重合法性校验

## 报告输出

- `.txt` - 人类可读格式，便于财务审核
- `.json` - 机器可读格式，便于系统集成
- `.csv` - 表格格式，便于Excel处理
