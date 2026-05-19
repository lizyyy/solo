# 会展设备租赁管理系统

一个基于 FastAPI 的会展设备租赁管理系统，用于管理多个展位同时借用桁架、灯具、屏幕等设备，确保现场改动后总账准确。

## 功能特性

### 核心业务规则
- **重复扫码检测**：防止同一设备被重复借出
- **跨展位借用校验**：设备不能同时被多个展位借用
- **损坏扣减**：根据损坏等级（轻微/中等/严重/全部）自动计算扣减费用
- **回滚机制**：支持错误操作的回滚

### 数据安全
- **敏感字段脱敏**：手机号、邮箱等敏感字段在日志和API响应中自动脱敏
- **审计日志**：每条操作都记录原因（放行/拦截）
- **操作追溯**：所有操作可溯源

### 批量操作
- **部分成功部分失败**：批量操作中单个失败不影响其他成功项
- **重试安全**：失败重试不会破坏已成功的记录

## 技术栈

- **后端框架**: FastAPI
- **数据库**: SQLite (可轻松切换为 PostgreSQL/MySQL)
- **ORM**: SQLAlchemy
- **数据验证**: Pydantic

## 项目结构

```
exhibition_rental_system/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI 主应用
│   ├── models.py        # 数据库模型
│   ├── schemas.py       # Pydantic 模式
│   ├── crud.py          # CRUD 操作
│   ├── rules.py         # 业务规则引擎
│   ├── audit.py         # 审计日志和脱敏
│   └── database.py      # 数据库连接
├── scripts/
│   └── test_flow.py     # 主流程测试脚本
├── requirements.txt     # 依赖
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
cd exhibition_rental_system
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn app.main:app --reload
```

服务将在 `http://localhost:8000` 启动。

### 3. 运行测试脚本

打开新的终端窗口：

```bash
python scripts/test_flow.py
```

该脚本将测试以下完整流程：
- 创建展位（A01、A02）
- 创建设备（桁架、灯具、屏幕）
- 验证重复扫码拦截
- 验证跨展位借用拦截
- 正常借用流程
- 损坏扣减归还
- 正常归还
- 回滚操作
- 查看审计日志
- 查看脱敏后的展位列表

### 4. API 文档

启动服务后，访问：
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## 主要 API 接口

### 展位管理
- `POST /booths/` - 创建展位
- `GET /booths/` - 获取展位列表（脱敏）

### 设备管理
- `POST /equipment/` - 创建设备
- `GET /equipment/` - 获取设备列表

### 租赁管理
- `POST /rentals/` - 创建借用单（含规则校验）
- `GET /rentals/` - 获取借用单列表
- `POST /rentals/{id}/rollback/` - 回滚借用单

### 归还管理
- `POST /returns/` - 创建归还单（含损坏扣减）
- `GET /returns/` - 获取归还单列表

### 批量操作
- `POST /batch/rentals/` - 批量创建借用单

### 审计日志
- `GET /audit-logs/` - 获取审计日志

## 业务规则详情

### 借用规则 (RentalRuleEngine)
1. **重复扫码检测**：同一设备不能在同一张借用单中出现多次
2. **设备可用性检测**：设备状态必须为 available
3. **跨展位借用检测**：设备不能被其他展位正在借用
4. **设备状态检测**：设备不能已损坏

### 归还规则 (ReturnRuleEngine)
1. **设备归属检测**：设备必须在该借用单中借出
2. **借用单状态检测**：借用单必须为 active 状态
3. **数量验证**：归还数量不能大于借出数量

### 损坏扣减标准 (DamageFeeCalculator)
- **minor (轻微)**: 押金 × 10%
- **moderate (中等)**: 押金 × 30%
- **severe (严重)**: 押金 × 70%
- **total (全部)**: 押金 × 100%

## 脱敏处理

系统自动对以下敏感字段进行脱敏处理（日志和API响应）：
- `phone`: 138****8001
- `contact_phone`: 138****8001
- `email`: te****@example.com
- `password`: ***
- `hashed_password`: ***

## 审计日志示例

每条操作都会记录：
- 用户ID
- 操作类型（create_rental, create_return, rollback 等）
- 资源类型和ID
- 状态（allowed / blocked）
- 原因（规则详情）
- 请求和响应数据（脱敏）
- IP 地址
- 时间戳
