# 托育接送授权 API

一个完整的托育中心接送授权管理系统，支持儿童档案管理、授权人管理、临时授权、入园离园登记、迟接计费和异常上报。

## 功能特性

### 核心业务
- ✅ **儿童档案管理**: 创建、查询儿童基本信息
- ✅ **固定授权人**: 永久授权的家长或监护人
- ✅ **临时授权**: 有效期限制的临时接送人
- ✅ **入园登记**: 验证授权后记录入园
- ✅ **离园登记**: 验证授权后记录离园，自动计算迟接费用
- ✅ **迟接计费**: 超过17:00按每分钟2元计算
- ✅ **异常上报**: 未授权接送、授权过期等异常记录

### 安全机制
- ✅ **授权验证**: 每次接送都验证授权有效性
- ✅ **授权过期检测**: 临时授权自动过期
- ✅ **重复签到检测**: 防止同一天重复入园
- ✅ **重复计费防护**: 同一接送记录不重复计费
- ✅ **幂等性支持**: 使用 idempotency_key 防止重复提交

## API 接口

### 儿童管理
- `POST /children` - 创建儿童档案
- `GET /children` - 查询所有儿童
- `GET /children/{child_id}` - 查询单个儿童

### 授权人管理
- `POST /authorized-persons` - 创建授权人
- `GET /authorized-persons` - 查询所有授权人

### 授权管理
- `POST /authorizations` - 创建授权（永久/临时）
- `GET /authorizations` - 查询授权列表
- `GET /authorizations/{auth_id}` - 查询单个授权

### 接送登记
- `POST /check-in` - 入园登记
- `POST /check-out` - 离园登记
- `GET /pickup-records` - 查询接送记录

### 费用管理
- `GET /late-fees` - 查询迟接费用

### 异常管理
- `POST /exceptions` - 上报异常
- `GET /exceptions` - 查询异常记录
- `PATCH /exceptions/{exception_id}/resolve` - 处理异常

### 汇总查询
- `GET /dashboard` - 仪表盘汇总
- `GET /child-status/{child_id}` - 儿童状态详情

## 快速开始

### 安装依赖
```bash
pip install fastapi uvicorn pydantic python-multipart
```

### 运行服务
```bash
python main.py
```

服务将在 http://localhost:8000 启动

### 访问 API 文档
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 运行测试场景
```bash
python test_scenarios.py
```

测试脚本包含以下场景：
1. **正常接送流程**: 固定授权人正常接送
2. **临时授权接送**: 临时授权人接送，包含迟接计费
3. **未授权接送被拒绝**: 陌生人尝试接送被拒绝并记录异常
4. **幂等性测试**: 验证重复提交不会创建重复记录

## 数据模型

### 儿童 (Child)
- child_id: 儿童ID
- name: 姓名
- birth_date: 出生日期
- guardian_name: 监护人姓名
- guardian_phone: 监护人电话

### 授权人 (AuthorizedPerson)
- person_id: 人员ID
- name: 姓名
- id_card: 身份证号
- phone: 电话
- relation: 与儿童关系

### 授权 (Authorization)
- auth_id: 授权ID
- child_id: 儿童ID
- person_id: 授权人ID
- auth_type: permanent/temporary
- start_date/end_date: 有效期（临时授权）
- is_active: 是否有效

### 接送记录 (PickupRecord)
- record_id: 记录ID
- child_id: 儿童ID
- person_id: 接送人ID
- check_in_time: 入园时间
- check_out_time: 离园时间
- status: checked_in/checked_out

### 迟接费用 (LatePickupFee)
- fee_id: 费用ID
- record_id: 关联接送记录
- late_minutes: 迟接分钟数
- fee_amount: 费用金额
- fee_rate: 费率（元/分钟）

### 异常记录 (ExceptionRecord)
- exception_id: 异常ID
- exception_type: 异常类型
- description: 异常描述
- resolved: 是否已处理
- resolution_note: 处理说明

## 异常类型
- unauthorized_pickup: 未授权接送
- expired_authorization: 授权已过期
- duplicate_checkout: 重复签退
- duplicate_fee: 重复计费
- closed_without_note: 无说明关闭
- other: 其他异常
