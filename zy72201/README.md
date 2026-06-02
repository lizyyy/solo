# 债券回售提醒核对系统

服务真实复核 · 保留人工判断 · 完整审计追踪

## 系统特点

### 🎯 核心设计理念
- **不洗干净数据**：尾差调整条的备注比正式表还重要，完整保留所有原始材料说明
- **不是冷冰冰的系统日志**：补录记录说明为什么被留下、还缺什么材料、下一步该找谁
- **保留人工判断空间**：机构简称前后不一致不急着归正常，留给财务复核人复核
- **服务真实复核**：谁改了什么、为什么改、改完影响哪些结果，全部说清楚

### ✨ 核心功能
1. **三入口接入**：命令行、API、HTML小看板
2. **机构简称检测**：自动标出机构简称前后不一致，停在待处理状态
3. **尾差调整条**：补录后补录记录自动联动更新
4. **节假日顺延**：自动识别节假日/周末，顺延回售日期
5. **完整审计追踪**：所有操作均有日志，可追溯可复盘
6. **演示数据**：内置小而真的演示数据，方便新人培训

## 快速开始

### 1. 初始化演示数据

```bash
python cli.py init-demo
```

这将创建一套完整的演示数据，包含：
- 节假日顺延（2026-06-19端午节顺延）
- 机构简称不一致检测与复核
- 尾差调整条补录
- 一次人工修正（票面利率修正）
- 一次人工重跑
- 完整的财务复核人→林姐流转流程

### 2. 命令行使用

#### 查看记录列表
```bash
python cli.py list
python cli.py list --status "待财务复核"
```

#### 查看记录详情
```bash
python cli.py show <记录ID>
```

#### 导入新记录
```bash
python cli.py import \
  --bond-code 127123 \
  --bond-name "21国开01" \
  --institution-full-name "中国工商银行股份有限公司" \
  --institution-alias "工商银行" \
  --redemption-date 2026-07-01 \
  --exercise-amount 10000000 \
  --coupon-rate 3.25 \
  --operator "财务复核人小王"
```

#### 添加尾差调整条
```bash
python cli.py add-tail <记录ID> \
  --amount-diff 0.58 \
  --reason "四舍五入尾差调整" \
  --remark "尾差0.58元，因四舍五入导致，已与对手方确认，详见20260615尾差调整说明.docx" \
  --operator "基金会计林姐"
```

#### 复核机构简称（使用标准简称）
```bash
python cli.py resolve-alias <记录ID> \
  --use-standard \
  --reason "经核对工商登记信息，确认使用标准简称" \
  --operator "财务复核人小王"
```

#### 复核机构简称（保留原简称）
```bash
python cli.py resolve-alias <记录ID> \
  --no-use-standard \
  --confirmed-alias "BOC" \
  --reason "合同约定使用BOC作为简称" \
  --operator "财务复核人小王"
```

#### 转交林姐处理
```bash
python cli.py send-to-linjie <记录ID> \
  --message "机构简称已复核，尾差调整条已补录，请林姐最终确认" \
  --operator "财务复核人小王"
```

#### 林姐确认完成
```bash
python cli.py linjie-confirm <记录ID> \
  --confirmation "尾差调整合理，机构简称确认无误，数据核对完成，可以记账" \
  --operator "基金会计林姐"
```

#### 生成完整核对报告
```bash
python cli.py report --output report.txt
```

#### 查看待处理列表
```bash
python cli.py pending-review   # 待财务复核
python cli.py pending-linjie   # 待林姐处理
```

### 3. Web小看板使用

```bash
python app.py
```

然后在浏览器访问 http://localhost:8000

Web界面功能：
- 📊 实时统计面板（总记录数、待财务复核、待林姐处理、有尾差调整、已完成）
- 📋 记录列表，支持按状态筛选
- 🔍 记录详情（基本信息、尾差调整条、补录记录、审计追踪、原始数据）
- ➕ 导入新记录
- 💰 添加尾差调整条
- 🔍 复核机构简称（可选择使用标准简称或保留原简称）
- 📤 转交林姐处理
- ✅ 林姐确认完成
- 🔄 重跑记录
- 📄 生成并下载核对报告

### 4. API接口

所有API返回JSON格式数据，支持跨域访问。

#### 获取统计信息
```http
GET /api/stats
```

#### 获取记录列表
```http
GET /api/reminders
GET /api/reminders?status=待财务复核
```

#### 获取记录详情
```http
GET /api/reminders/{id}
```

#### 导入新记录
```http
POST /api/reminders
Content-Type: application/json

{
  "bond_code": "127123",
  "bond_name": "21国开01",
  "institution_full_name": "中国工商银行股份有限公司",
  "institution_alias": "工商银行",
  "redemption_date": "2026-07-01",
  "exercise_amount": 10000000,
  "coupon_rate": 3.25,
  "operator": "财务复核人小王"
}
```

#### 添加尾差调整条
```http
POST /api/reminders/{id}/tail
Content-Type: application/json

{
  "amount_diff": 0.58,
  "reason": "四舍五入尾差调整",
  "remark": "尾差0.58元，因四舍五入导致，已与对手方确认",
  "operator": "基金会计林姐"
}
```

#### 复核机构简称
```http
POST /api/reminders/{id}/resolve-alias
Content-Type: application/json

{
  "use_standard": true,
  "reason": "经核对工商登记信息，确认使用标准简称",
  "operator": "财务复核人小王"
}
```

#### 转交林姐处理
```http
POST /api/reminders/{id}/send-to-linjie
Content-Type: application/json

{
  "message": "机构简称已复核，尾差调整条已补录，请林姐最终确认",
  "operator": "财务复核人小王"
}
```

#### 林姐确认完成
```http
POST /api/reminders/{id}/linjie-confirm
Content-Type: application/json

{
  "confirmation": "尾差调整合理，机构简称确认无误，数据核对完成，可以记账",
  "operator": "基金会计林姐"
}
```

#### 重跑记录
```http
POST /api/reminders/{id}/rerun
Content-Type: application/json

{
  "reason": "尾差调整后重新计算应计利息",
  "operator": "基金会计林姐"
}
```

#### 生成报告
```http
POST /api/report
```

#### 初始化演示数据
```http
POST /api/init-demo
```

## 核心数据结构

### 债券回售提醒 (BondRedemptionReminder)
- 基本信息：债券代码、债券名称、机构全称、机构简称、回售日期、行权金额、票面利率
- 异常标记：机构简称不一致、节假日顺延、尾差调整
- 关联数据：尾差调整条列表、补录记录、审计日志
- 状态：待处理 → 待财务复核 → 已复核 → 待林姐确认 → 已完成

### 补录记录 (SupplementaryRecord)
- **为什么留下**：说明这条记录为什么被单独列出来处理
- **还缺什么材料**：列出还需要补充或核对的材料
- **下一步**：找财务复核人 / 找基金会计林姐 / 暂存待确认 / 已完成
- **处理日志**：完整记录每一步处理过程

### 尾差调整条 (TailAdjustmentEntry)
- 差额、调整原因、备注（完整保留原始材料说明）
- 操作人、时间
- 自动关联补录记录

### 审计日志 (AuditLog)
- 操作人、动作、字段变更、原值→新值
- 变更原因、影响结果
- 完整可追溯

## 典型业务流程

### 完整三阶段流程
1. **节假日顺延说明第一次导入**
   - 系统自动检测回售日是否遇节假日/周末
   - 自动顺延并生成顺延说明
   - 同时检测机构简称是否一致
   - 如有不一致，标记为"待财务复核"，不自动修正

2. **基金会计林姐补看尾差调整条**
   - 林姐查看原始数据中的尾差备注
   - 补录尾差调整条，完整填写差额、原因、备注
   - 备注中保留所有原始材料说明（如文档名称、确认情况等）

3. **补录记录更新**
   - 补录尾差调整条后，补录记录自动更新
   - "为什么留下"增加尾差调整说明
   - "还缺什么材料"增加复核尾差调整依据
   - "下一步"自动变为"找基金会计林姐"

### 机构简称不一致处理
1. 导入时检测到简称与标准不一致
2. 系统标记为"待财务复核"，**不自动修正**
3. 财务复核人人工判断：
   - 方案A：使用标准简称（如"工行"→"工商银行"）
   - 方案B：保留原简称（如合同约定使用"BOC"）
4. 复核后状态变为"已复核"，可继续流转

## 演示数据说明

演示数据包含3条记录，覆盖所有典型场景：

### 记录1（完整流程演示）
- 债券：127123 21国开01
- 机构：中国工商银行（录入简称"工行"，标准简称"工商银行"）
- 原回售日：2026-06-19（端午节，自动顺延至2026-06-20）
- 处理流程：
  1. 导入检测到节假日顺延 + 机构简称不一致
  2. 财务复核人确认使用标准简称"工商银行"
  3. 林姐补录尾差调整条（0.58元四舍五入）
  4. 人工重跑一次
  5. 转交林姐确认
  6. 林姐确认完成

### 记录2（人工修正演示）
- 债券：127456 21国开05
- 机构：中国建设银行（简称正确）
- 回售日：2026-07-15（无顺延）
- 处理：票面利率3.45%→3.55%人工修正

### 记录3（机构简称保留原称演示）
- 债券：127789 20农发03
- 机构：中国银行（录入简称"BOC"，标准简称"中国银行"）
- 回售日：2026-08-20（无顺延）
- 处理：财务复核人确认保留使用"BOC"（合同约定）

## 目录结构

```
zy72201/
├── models.py              # 数据模型定义
├── storage.py             # 数据持久化
├── core.py                # 核心业务逻辑
├── demo_data.py           # 演示数据
├── cli.py                 # 命令行入口
├── app.py                 # Web服务和API入口
├── templates/
│   └── dashboard.html     # Web小看板界面
├── data/                  # 数据存储目录（自动创建）
│   ├── reminders.json     # 债券回售提醒数据
│   ├── institution_aliases.json  # 机构简称配置
│   └── holidays.json      # 节假日配置
└── README.md              # 本文件
```

## 配置说明

### 机构简称配置
编辑 `data/institution_aliases.json`：
```json
[
  {
    "full_name": "中国工商银行股份有限公司",
    "aliases": ["工行", "工商银行", "ICBC"],
    "standard_alias": "工商银行"
  }
]
```

### 节假日配置
编辑 `data/holidays.json`：
```json
{
  "holiday_dates": ["2026-01-01", "2026-06-19"],
  "weekend_days": [5, 6]
}
```

## 设计亮点

1. **尾差调整条备注完整保留**：不会把重要的尾差说明洗成一行干净数据
2. **补录记录联动更新**：每一步操作都会自动更新"为什么留下"、"缺什么材料"、"下一步"
3. **人工判断空间**：机构简称不一致不自动吞掉，留给财务复核人人工判断
4. **完整审计追踪**：谁改了什么、为什么改、改完影响哪些结果，全部有记录
5. **多入口支持**：命令行适合批量处理，Web适合日常操作，API适合系统集成
6. **小而真的演示数据**：包含完整业务流程，方便林姐给新人讲流程

## 技术栈

- Python 3.7+（无需额外依赖，标准库即可运行）
- 数据存储：JSON文件（无需数据库）
- Web服务：Python标准库 http.server
- 前端：原生HTML/CSS/JavaScript（无需构建）

## 常见问题

**Q: 数据存在哪里？会丢失吗？**
A: 数据存在 `data/` 目录下的JSON文件中，只要不删除这个目录就不会丢失。

**Q: 可以对接其他系统吗？**
A: 可以，提供了完整的REST API接口，支持系统集成。

**Q: 如何新增机构简称配置？**
A: 编辑 `data/institution_aliases.json` 文件，添加新的机构配置即可。

**Q: 如何新增节假日？**
A: 编辑 `data/holidays.json` 文件，添加节假日日期即可。
