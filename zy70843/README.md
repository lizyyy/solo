# 商场临时摊位证照处理API服务

用于处理商场临时摊位证照材料的提交、分类和管理的API服务。

## 功能特性

- 材料自动分类：正常、待补充、已拦截
- 重复提交识别：同一批材料重复提交时返回原有处理结果
- 字段校验与错误明细：错误明细可追溯到原始材料位置
- 证照版本、场地档期、押金状态管理
- 证照过期自动进入待补充状态
- Excel导出功能
- 统计数据查询

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动服务

```bash
python main.py
```

服务将在 http://localhost:8000 启动

### API文档

访问 http://localhost:8000/docs 查看交互式API文档

## API接口说明

### 1. 提交证照材料

**POST** `/api/certificates/submit`

提交摊位证照材料，系统会自动分类处理。

**请求示例：**
```json
{
    "batch_number": "BATCH001",
    "booth_number": "A01",
    "mall_name": "XX购物中心",
    "certificate_version": "V1.0",
    "schedule_start_date": "2024-02-01",
    "schedule_end_date": "2024-02-15",
    "entry_time": "2024-01-31T10:00:00",
    "business_license": "LIC123456",
    "fire_safety_material": "FIRE789012",
    "certificate_expiry_date": "2024-12-31",
    "deposit_status": "已缴纳",
    "processor": "张经理"
}
```

### 2. 查询证照列表

**GET** `/api/certificates`

支持按商场、状态、批次号筛选

### 3. 获取单条证照记录

**GET** `/api/certificates/{certificate_id}`

### 4. 获取统计数据

**GET** `/api/statistics`

返回各类状态的证照数量统计

### 5. 导取证照数据

**POST** `/api/certificates/export`

导出Excel文件，包含：
- 商场临时摊位证照
- 快闪摊位的营业执照
- 消防材料
- 进场时间
- 最后处理人
- 证照版本
- 场地档期
- 押金状态

### 6. 更新押金状态

**PUT** `/api/certificates/{certificate_id}/deposit`

## 材料分类规则

### 正常
- 所有必填字段完整
- 日期逻辑一致
- 证照在有效期内

### 待补充
- 缺少必填字段（营业执照、消防材料等）
- 证照已过期（必须排入待补材料）
- 日期逻辑有问题

### 已拦截
- 摊位编号重复
- 批次号重复提交

## 项目结构

```
├── main.py              # FastAPI主应用
├── models.py            # 数据模型
├── schemas.py           # Pydantic模式
├── database.py          # 数据库配置
├── services.py          # 业务逻辑服务
├── crud.py              # 数据库操作
├── requirements.txt     # 依赖列表
└── README.md           # 说明文档
```

## 数据模型说明

### BoothCertificate 字段说明

| 字段名 | 类型 | 说明 |
|--------|------|------|
| batch_number | String | 材料批次号 |
| booth_number | String | 摊位编号 |
| mall_name | String | 商场名称 |
| certificate_version | String | 证照版本 |
| schedule_start_date | Date | 场地档期开始日期 |
| schedule_end_date | Date | 场地档期结束日期 |
| entry_time | DateTime | 进场时间 |
| business_license | String | 营业执照编号/路径 |
| fire_safety_material | String | 消防材料编号/路径 |
| certificate_expiry_date | Date | 证照过期日期 |
| deposit_status | Enum | 押金状态：未缴纳/已缴纳/已退还 |
| status | Enum | 处理状态：正常/待补充/已拦截 |
| follow_up_action | Text | 后续动作说明 |
| reject_reason | Text | 原因说明 |
| error_details | Text | 错误明细和原始材料位置 |
| processor | String | 最后处理人 |
| is_duplicate | Boolean | 是否重复提交 |
| original_batch_id | Integer | 原始批次ID |
