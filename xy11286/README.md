# 宠物医院药房管理系统 CLI

基于Node.js + TypeScript + SQLite的轻量级宠物医院药房管理系统。

## 功能特性

### 核心业务流程
- **处方提交**: 医生提交处方，支持批量导入JSON
- **审核管理**: 药师审核处方，支持通过/驳回
- **拦截机制**: 异常处方可拦截，记录原因
- **库存管理**: 多批号库存管理，先进先出
- **发药流程**: 审核通过后自动扣减库存
- **追溯审计**: 完整的操作审计日志

### 数据导入
- **处方导入**: JSON格式批量导入处方
- **库存导入**: CSV格式批量导入库存
- **坏记录处理**: 导入失败记录保留原始位置、失败原因、修改建议

### 数据安全
- **敏感字段脱敏**: 手机号、主人姓名、主人ID在日志和导出时自动脱敏
- **配置化脱敏规则**: 支持自定义脱敏字段和规则

### 幂等性保证
- **重复导入检测**: 基于文件内容哈希检测重复导入
- **重复提交拦截**: 处方状态机确保操作幂等

## 安装

```bash
npm install
npm run build
npm link
```

## 快速开始

### 1. 创建药品

```bash
pharmacy medicine:create -c MED001 -n "阿莫西林片" --category 抗生素 --unit 片 --manufacturer 宠物药厂A
pharmacy medicine:create -c MED002 -n "外用药膏" --category 外用药 --unit 瓶 --manufacturer 宠物药厂B
pharmacy medicine:create -c MED003 -n "益生菌" --category 消化系统 --unit 盒 --manufacturer 宠物药厂C
```

### 2. 导入库存

```bash
pharmacy inventory:import -f examples/inventory.csv -o ADMIN001 --operator-name 系统管理员
```

### 3. 导入处方

```bash
pharmacy prescription:import -f examples/prescriptions.json -o ADMIN001 --operator-name 系统管理员
```

### 4. 处方流程

```bash
# 列出处方
pharmacy prescription:list

# 提交处方
pharmacy prescription:submit -i <处方ID> -o DOC001 --operator-name 张医生

# 审核通过
pharmacy prescription:approve -i <处方ID> -o PHA001 --operator-name 李药师

# 发药
pharmacy prescription:dispense -i <处方ID> -o PHA001 --operator-name 李药师
```

## 命令参考

### 药品管理
- `pharmacy medicine:create` - 创建药品
- `pharmacy medicine:list` - 列出所有药品
- `pharmacy medicine:search <keyword>` - 搜索药品

### 库存管理
- `pharmacy inventory:import` - 导入库存CSV
- `pharmacy inventory:list` - 列出库存

### 处方管理
- `pharmacy prescription:import` - 导入处方JSON
- `pharmacy prescription:submit` - 提交处方
- `pharmacy prescription:approve` - 审核通过处方
- `pharmacy prescription:reject` - 驳回处方
- `pharmacy prescription:block` - 拦截处方
- `pharmacy prescription:dispense` - 发药
- `pharmacy prescription:show` - 查看处方详情
- `pharmacy prescription:list` - 列出处方
- `pharmacy prescription:audit` - 查看处方审计轨迹

### 坏记录管理
- `pharmacy badrecords:list` - 列出未解决的坏记录
- `pharmacy badrecords:resolve` - 标记坏记录为已解决

### 审计与导入历史
- `pharmacy audit:recent` - 查看最近审计日志
- `pharmacy imports:list` - 列出导入会话

## 数据格式

### 库存CSV格式
```csv
药品编码,批号,数量,单位,单价,生产日期,有效期,库位,供应商
MED001,BATCH2024001,100,片,2.5,2024-01-15,2026-01-15,药柜A,宠物药厂A
```

### 处方JSON格式
```json
{
  "prescriptionNumber": "RX20240001",
  "doctorId": "DOC001",
  "doctorName": "张医生",
  "petId": "PET001",
  "petName": "豆豆",
  "petSpecies": "金毛",
  "petWeight": 25.5,
  "petWeightUnit": "kg",
  "ownerId": "OWN001",
  "ownerName": "王小明",
  "ownerPhone": "13800138000",
  "diagnosis": "皮肤感染",
  "items": [
    {
      "medicineCode": "MED001",
      "medicineName": "阿莫西林片",
      "requestedQuantity": 10,
      "unit": "片",
      "dosage": "每日2次，每次1片"
    }
  ],
  "notes": "一周后复诊"
}
```

## 处方状态机

```
draft (草稿) → submitted (已提交) → approved (已审核) → dispensed (已发药)
                            ↓            ↓
                          rejected    blocked
                          (驳回)     (拦截)
```

## 数据存储

SQLite数据库文件位于 `data/pharmacy.db`

## 敏感字段脱敏配置

系统默认脱敏配置存储在数据库 `sensitive_field_configs` 表中：

| 实体 | 字段 | 脱敏类型 | 日志脱敏 | 导出脱敏 |
|------|------|----------|----------|----------|
| prescription | ownerPhone | phone | ✓ | ✓ |
| prescription | ownerName | name | ✓ | ✗ |
| prescription | ownerId | idcard | ✓ | ✓ |

## 审计日志

所有关键操作均记录审计日志，包括：
- 操作类型
- 操作人
- 操作时间
- 旧值/新值
- 备注