# 园区食堂餐补跨店核销API系统

## 项目简介

本系统实现了园区食堂餐补跨店核销的完整流程，支持单条人工录入和批量补录两条入口，自动验证异常情况并提示所需补充材料。

## 核心功能

1. **双入口处理**
   - 单条人工录入：`POST /api/transactions/single`
   - 批量补录：`POST /api/transactions/batch`（支持Excel上传）

2. **智能验证**
   - 离职员工异地消费检测
   - 跨园区消费验证
   - 餐补额度超限检查
   - 自动告知调用方下一步需补充的材料

3. **全程审计**
   - 每一步操作都记录审计日志
   - 可追溯每笔交易的变更历史

4. **数据导出**
   - 导出Excel保留关键业务列
   - 便于与原始台账逐项核对

## 目录结构

```
xy11018/
├── main.py                  # 主程序（包含所有API和模型）
├── requirements.txt         # 依赖包
├── batch_import_template.py # 批量导入模板生成脚本
└── README.md               # 说明文档
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

服务启动后访问：http://localhost:8000/docs 查看API文档

### 3. 初始化样例数据

访问：http://localhost:8000/api/init-sample-data

将创建4个员工和4个门店的样例数据，其中包含：
- 正常在职员工
- 已离职员工（王五，工号E003）
- 不同园区的门店

### 4. 生成批量导入模板

```bash
python batch_import_template.py
```

将生成 `批量导入模板.xlsx` 用于测试批量导入功能。

## API接口说明

### 单条人工录入

**POST** `/api/transactions/single`

请求体：
```json
{
  "employee_no": "E003",
  "store_no": "S001",
  "transaction_date": "2024-01-15T12:30:00",
  "transaction_amount": 25.5,
  "subsidy_amount": 20.0,
  "personal_pay_amount": 5.5,
  "meal_type": "午餐",
  "consumption_details": "一荤两素",
  "operator": "张管理员",
  "remarks": "测试"
}
```

**响应示例（发现异常）：**
```json
{
  "success": true,
  "transaction_no": "ST20240115A1B2C3D4",
  "verification_result": {
    "passed": false,
    "issues": [
      "员工王五已离职，离职日期：2024-12-31",
      "跨园区消费：员工所属园区临港产业园，消费园区张江高科技园区"
    ],
    "required_materials": [
      {"code": "RESIGNATION_PROOF", "name": "离职证明", "description": "..."},
      {"code": "USAGE_EXPLANATION", "name": "异地消费情况说明", "description": "..."},
      {"code": "CROSS_PARK_APPROVAL", "name": "跨园区就餐审批单", "description": "..."},
      {"code": "CONSUMPTION_PROOF", "name": "消费凭证", "description": "..."}
    ],
    "next_steps": [
      "联系员工所属部门和HR确认离职状态",
      "核实该笔消费是否为离职后产生的异常消费",
      "确认员工是否有跨园区办公或出差事由",
      "检查跨园区餐补使用的审批流程是否完整"
    ]
  }
}
```

### 批量补录

**POST** `/api/transactions/batch`

- 上传Excel文件
- 必填列：员工工号、门店编号、交易时间、交易总金额、餐补核销金额
- 可选列：个人支付金额、餐别、消费明细、备注

### 查询交易记录

**GET** `/api/transactions`

支持分页和多条件筛选（员工工号、门店编号、验证状态、日期范围）

### 导出Excel

**GET** `/api/transactions/export`

导出的Excel包含20+关键业务列，便于与原始台账核对。

### 查看审计日志

**GET** `/api/transactions/{transaction_no}/audit-logs`

查看单笔交易的所有操作历史。

## 核心数据模型

### 员工信息（Employee）
- 员工工号、姓名、部门
- 所属园区代码/名称
- 在职状态、离职日期
- 月度餐补配额

### 门店信息（Store）
- 门店编号、名称
- 所属园区代码/名称
- 地址、联系人信息

### 餐补核销记录（SubsidyTransaction）
- 交易编号、员工信息、门店信息
- 交易时间、金额明细
- 是否跨店/跨园区标志
- 核销状态、验证状态
- 需补充材料清单
- 处理人、处理时间

### 审计日志（AuditLog）
- 关联交易编号
- 操作类型（CREATE/VERIFY/BATCH_IMPORT等）
- 变更字段、旧值/新值
- 操作人、操作角色、备注
- 操作时间

## 后续扩展

本项目目录结构简洁，便于扩展：

1. **添加前端页面**
   - 在项目中创建 `frontend/` 目录
   - 使用Vue/React构建管理界面

2. **添加定时任务**
   - 创建 `scheduler/` 目录
   - 使用APScheduler实现每日自动对账、异常提醒

3. **对接HR系统**
   - 扩展员工信息同步接口
   - 自动获取离职员工数据

4. **添加审批流程**
   - 实现多级审批机制
   - 支持线上材料上传
