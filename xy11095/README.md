# 皮具护理店返修管理 API

一个轻量级的皮具护理返修管理系统，支持单条录入和批量补录，专门处理客户取走后反馈旧划痕等复杂场景。

## 项目特点

- **独立留痕**：旧伤照片、客户取走时间、返修判定、门店责任分别独立记录，不按一般维修单处理
- **双入口**：支持单条人工处理和批量补录两条入口
- **智能校验**：自动识别记录完整性，告诉调用方下一步该补什么材料
- **台账友好**：导出结果保留关键业务列，便于和原始台账逐项核对
- **目录简单**：便于后续添加前端页面或定时任务

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python app.py
```

服务将在 `http://localhost:5000` 启动

### 3. 运行测试

```bash
python test_api.py
```

## API 接口

### 单条人工录入
```
POST /api/repair
```

### 批量补录
```
POST /api/repair/batch
```

### 获取单条记录
```
GET /api/repair/<id>
```

### 更新记录
```
PUT /api/repair/<id>
```

### 列表查询（分页）
```
GET /api/repair?page=1&per_page=20
```

### 校验并获取需补充材料
```
POST /api/repair/validate/<id>
```

### 导出Excel
```
GET /api/repair/export?start_date=2024-01-01&end_date=2024-12-31
```

### 获取统计数据
```
GET /api/repair/stats
```

## 核心业务字段

| 分类 | 字段 | 说明 |
|------|------|------|
| 客户信息 | customer_name | 客户姓名 |
| | customer_phone | 客户电话 |
| 皮具信息 | product_type | 皮具类型（如：牛皮公文包） |
| | product_brand | 品牌 |
| | product_material | 材质 |
| 原始损伤 | original_damage_description | 原始损伤描述 |
| | original_damage_photos | 旧伤照片（独立留痕） |
| 返修判定 | repair_decision | 返修判定：同意返修/拒绝返修/协商处理 |
| | store_responsibility | 门店责任：全责/部分责任/无责 |
| 取走反馈 | customer_takeaway_date | 客户取走时间（独立留痕） |
| | feedback_after_takeaway | 客户取走后反馈内容 |
| | feedback_photos | 反馈问题照片 |

## 核心业务逻辑

### 客户取走后反馈旧划痕处理
- 自动检测反馈时间与取走时间的间隔
- 超过7天异议期会特别标注
- 提示核对旧伤照片确认是否为原有问题
- 建议留存沟通记录

### 返修记录一致性校验
- 检查必填材料是否齐全
- 校验状态与字段的一致性（如"已取走"必须有取走时间）
- 智能生成下一步处理建议

## 目录结构

```
├── app.py              # 主程序入口
├── models.py           # 数据模型定义
├── services.py         # 业务逻辑层
├── requirements.txt    # Python依赖
├── test_api.py         # API测试脚本
└── repair_records.db   # SQLite数据库（自动生成）
```

## 后续扩展建议

- 添加前端页面：在 static/templates 目录下添加前端代码
- 添加定时任务：使用 APScheduler 添加数据同步、提醒等定时任务
- 接入企业微信/钉钉通知：添加反馈提醒、待处理提醒
- 添加图片上传接口：完善照片管理功能