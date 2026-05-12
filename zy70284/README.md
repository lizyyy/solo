# 企业急救培训证书到期 CLI 工具

## 概述

这是一个用于管理企业急救员证书和复训记录的命令行工具。解决以下核心问题：
- 急救员证书和复训记录分散管理
- 过期后才发现资格失效
- 排班时无法快速检查急救员资格

## 功能步骤

### 1. 人员档案管理
- 存储员工基本信息（姓名、工号、部门、联系方式）
- 支持增删改查操作

### 2. 证书记录管理
- 记录证书类型、编号、发证日期、有效期
- 自动计算证书状态（有效、即将过期、已过期）
- 支持修改、补录历史记录

### 3. 复训计划管理
- 为每张证书创建复训计划
- 跟踪复训状态（待进行、已完成、已逾期）
- 关联讲师和备注信息

## 安装

```bash
pip install -e .
```

或者直接使用模块运行：

```bash
python3 -m first_aid_cert.cli [命令]
```

## 命令行子命令

### init - 初始化样例数据
```bash
python3 -m first_aid_cert.cli init
python3 -m first_aid_cert.cli init --force  # 强制覆盖
```

### import-data - 导入数据
```bash
python3 -m first_aid_cert.cli import-data personnel.json personnel
python3 -m first_aid_cert.cli import-data certificates.json certificates
python3 -m first_aid_cert.cli import-data retraining.json retraining
```

### list - 查看数据列表
```bash
python3 -m first_aid_cert.cli list personnel
python3 -m first_aid_cert.cli list certificates
python3 -m first_aid_cert.cli list retraining
```

### check - 执行到期检查
```bash
python3 -m first_aid_cert.cli check
python3 -m first_aid_cert.cli check -t certificates
python3 -m first_aid_cert.cli check -o check_result.json
```

检查会发现：
- 已过期的证书
- 30 天内即将过期的证书
- 已逾期的复训计划
- 30 天内即将开始的复训
- 需要安排复训的人员（证书即将过期但没有复训计划）

### update-certificate - 更新证书信息
```bash
python3 -m first_aid_cert.cli update-certificate <证书ID> -e 2027-05-12
python3 -m first_aid_cert.cli update-certificate <证书ID> -n FA2026001
```

### history - 查看历史记录
```bash
python3 -m first_aid_cert.cli history
python3 -m first_aid_cert.cli history -t certificate
python3 -m first_aid_cert.cli history -a update
python3 -m first_aid_cert.cli history --diff  # 显示前后变化差异
```

### export - 导出数据
```bash
python3 -m first_aid_cert.cli export all_data.json
```

## 数据存储

数据存储在当前目录的 `first_aid_data/` 文件夹下：

- `personnel.json` - 人员档案
- `certificates.json` - 证书记录
- `retraining.json` - 复训计划
- `history.json` - 操作历史

## 最短演示路径

运行演示脚本：

```bash
python3 demo_normal.py
```

或者手动执行：

```bash
# 1. 初始化样例数据
python3 -m first_aid_cert.cli init

# 2. 查看人员档案
python3 -m first_aid_cert.cli list personnel

# 3. 查看证书记录
python3 -m first_aid_cert.cli list certificates

# 4. 查看复训计划
python3 -m first_aid_cert.cli list retraining

# 5. 执行到期检查
python3 -m first_aid_cert.cli check

# 6. 修改证书（演示历史追踪）
python3 -m first_aid_cert.cli update-certificate <证书ID> -n FA999999

# 7. 查看历史（包含前后变化）
python3 -m first_aid_cert.cli history --diff

# 8. 导出数据
python3 -m first_aid_cert.cli export all_data.json
```

## 异常触发路径

运行异常演示脚本：

```bash
python3 demo_error.py
```

演示的异常场景：

1. **不使用 --force 覆盖已有数据** - 提示错误
2. **导入不存在的文件** - FileNotFoundError
3. **导入格式错误的 JSON** - JSONDecodeError
4. **导入不支持的数据类型** - 类型错误
5. **更新不存在的证书 ID** - 找不到记录
6. **查看不存在的实体类型** - 类型错误
7. **发现过期证书时的退出码** - check 命令返回码 2（用于 CI/CD 集成）

## 排班资格检查

在排班前执行：

```bash
python3 -m first_aid_cert.cli check
```

如果命令返回码为 2，说明存在已过期的证书或复训计划，需要处理后才能排班。

检查输出中的"需要安排复训的人员"表格，这些是排班时需要特别注意的人员。

## 历史追踪

所有增删改操作都会记录到 `history.json`，包括：
- 操作时间
- 实体类型
- 操作类型（create/update/delete/import）
- 操作描述
- **修改前的数据（before）**
- **修改后的数据（after）**

使用 `--diff` 参数可以查看详细的前后对比。

## 导入文件格式

### 人员档案 (personnel)
```json
[
  {
    "name": "张三",
    "employee_id": "E001",
    "department": "生产部",
    "phone": "13800138001",
    "email": "zhangsan@company.com"
  }
]
```

### 证书记录 (certificates)
```json
[
  {
    "personnel_id": "人员ID",
    "personnel_name": "张三",
    "certificate_type": "急救员初级证书",
    "certificate_number": "FA2024001",
    "issue_date": "2024-05-12",
    "expiry_date": "2026-05-12",
    "issuer": "急救培训中心"
  }
]
```

### 复训计划 (retraining)
```json
[
  {
    "certificate_id": "证书ID",
    "personnel_id": "人员ID",
    "personnel_name": "张三",
    "planned_date": "2026-04-01",
    "trainer": "王讲师",
    "notes": "复训时间已协调"
  }
]
```
