# 灌溉水权调剂 API

灌区管理站水权管理后端服务，解决农户间水量转让时的余额计算、超额转让、重复灌溉、撤销回滚等问题。

## 技术栈

- Go 1.21+
- Gin Web 框架
- GORM ORM
- SQLite 数据库

## 快速启动

### 1. 安装依赖

```bash
go mod download
```

### 2. 启动服务

```bash
go run cmd/api/main.go
```

服务将在 `http://localhost:8080` 启动。

### 3. 生成测试数据

新开一个终端窗口执行：

```bash
go run scripts/seed_data.go
```

脚本会自动创建测试数据并演示完整的业务流程。

## 核心业务规则

### 转让状态机
```
pending (待审批) → approved (已通过) → revoked (已撤销)
                    ↓
                  completed
```

### 额度校验
- 转让申请时校验转出方余额
- 审批通过时再次校验余额（防止期间被占用）
- 撤销时校验受让方余额是否足够回滚

### 灌溉防重复
- 同一地块同一天只能有一条灌溉记录
- 重复提交仅更新证据链，不重复扣减

### 证据链
- 所有关键操作都会留下证据链记录
- 补充材料只更新证据链，不改变业务结果
- 所有变更都有修改前后快照

## API 接口

### 农户管理

#### 创建农户
```bash
curl -X POST http://localhost:8080/api/v1/farmers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "张三",
    "id_card": "110101199001010001",
    "phone": "13800138001",
    "village": "东村村"
  }'
```

#### 查询农户余额
```bash
curl "http://localhost:8080/api/v1/farmers/1/balance?year=2024&week=20"
```

### 水权管理

#### 初始化水权额度
```bash
curl -X POST http://localhost:8080/api/v1/water-rights \
  -H "Content-Type: application/json" \
  -d '{
    "farmer_id": 1,
    "year": 2024,
    "week": 20,
    "total_quota": 500,
    "remarks": "每周配额"
  }'
```

### 转让管理

#### 创建转让申请
```bash
curl -X POST http://localhost:8080/api/v1/transfers \
  -H "Content-Type: application/json" \
  -d '{
    "from_farmer_id": 1,
    "to_farmer_id": 2,
    "amount": 100,
    "reason": "李四农田干旱急需用水",
    "week": 20,
    "year": 2024,
    "operator": "管理员小王"
  }'
```

#### 审批转让
```bash
curl -X POST http://localhost:8080/api/v1/transfers/1/approve \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "管理员小王",
    "opinion": "情况属实，同意转让"
  }'
```

#### 撤销转让（余额回滚）
```bash
curl -X POST http://localhost:8080/api/v1/transfers/1/revoke \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "管理员小王",
    "reason": "发现转让有误，申请撤销"
  }'
```

#### 查询转让列表
```bash
curl "http://localhost:8080/api/v1/transfers?status=approved&year=2024&week=20"
```

### 灌溉管理

#### 记录灌溉（自动扣减水权）
```bash
curl -X POST http://localhost:8080/api/v1/irrigation \
  -H "Content-Type: application/json" \
  -d '{
    "farmer_id": 1,
    "plot_id": 1,
    "water_amount": 50,
    "irrigation_date": "2024-05-20T10:00:00+08:00",
    "week": 20,
    "year": 2024,
    "operator": "管理员小王",
    "remarks": "水稻灌溉"
  }'
```

#### 补充灌溉证据（不改变水量）
```bash
curl -X POST http://localhost:8080/api/v1/irrigation/IR2024201234567890/evidence \
  -H "Content-Type: application/json" \
  -d '{
    "evidence": "现场照片已存档，编号PIC20240520001",
    "operator": "管理员小王"
  }'
```

### 报告与自检

#### 生成周度余额报告
```bash
curl -X POST "http://localhost:8080/api/v1/reports/generate?year=2024&week=20&operator=管理员小王" \
  -H "Content-Type: application/json" \
  -d '{}'
```

#### 系统自检（余额一致性校验）
```bash
curl "http://localhost:8080/api/v1/self-check?year=2024&week=20"
```

#### 查询变更历史
```bash
curl "http://localhost:8080/api/v1/change-history?resource_type=transfer&resource_id=1"
```

## 失败路径演示

### 1. 超额转让（必然失败）

张三余额只有 200 立方米，尝试转让 500 立方米：

```bash
curl -X POST http://localhost:8080/api/v1/transfers \
  -H "Content-Type: application/json" \
  -d '{
    "from_farmer_id": 1,
    "to_farmer_id": 3,
    "amount": 500,
    "reason": "测试超额转让",
    "week": 20,
    "year": 2024,
    "operator": "管理员小王"
  }'
```

预期响应：
```json
{
  "success": false,
  "message": "额度不足: 可用余额200.00立方米，申请转让500.00立方米",
  "transfer_no": ""
}
```

### 2. 同地块重复灌溉

同一地块同一天第二次提交灌溉记录：

```bash
# 第一次（成功）
curl -X POST http://localhost:8080/api/v1/irrigation \
  -H "Content-Type: application/json" \
  -d '{
    "farmer_id": 1,
    "plot_id": 1,
    "water_amount": 50,
    "irrigation_date": "2024-05-20T10:00:00+08:00",
    "week": 20,
    "year": 2024,
    "operator": "管理员小王",
    "remarks": "上午灌溉"
  }'

# 第二次（失败，重复灌溉）
curl -X POST http://localhost:8080/api/v1/irrigation \
  -H "Content-Type: application/json" \
  -d '{
    "farmer_id": 1,
    "plot_id": 1,
    "water_amount": 30,
    "irrigation_date": "2024-05-20T15:00:00+08:00",
    "week": 20,
    "year": 2024,
    "operator": "管理员小王",
    "remarks": "下午灌溉"
  }'
```

预期第二次响应：
```json
{
  "success": false,
  "message": "地块P001在2024-05-20已有灌溉记录，禁止重复灌溉",
  "is_duplicate": true
}
```

### 3. 撤销余额不足回滚

受让方把转入的水用完后，再撤销转让：

```bash
# 1. 张三转让100给李四
# 2. 审批通过
# 3. 李四把这100立方米用完
# 4. 尝试撤销转让（失败）

curl -X POST http://localhost:8080/api/v1/transfers/1/revoke \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "管理员小王",
    "reason": "尝试撤销"
  }'
```

预期响应：
```json
{
  "success": false,
  "message": "撤销失败: 受让方余额不足，当前余额0.00立方米，需回退100.00立方米"
}
```

## 轻量自检

系统提供自检接口，自动校验：
1. 每个农户的余额计算是否正确（初始配额 + 转入 - 转出 - 灌溉 = 当前余额）
2. 所有转让的进出总额是否平衡

运行自检：
```bash
curl "http://localhost:8080/api/v1/self-check?year=2024&week=20"
```

## 项目结构

```
.
├── cmd/api/              # 程序入口
├── internal/
│   ├── config/           # 配置
│   ├── models/           # 数据模型
│   ├── repository/       # 数据访问层
│   ├── service/          # 业务逻辑层
│   └── handler/          # API 接口层
├── scripts/              # 脚本工具
├── go.mod
└── README.md
```

## 核心数据模型

- **Farmer (农户)**: 基本信息
- **Plot (地块)**: 农户所属地块
- **WaterRight (水权)**: 周度水权额度与余额
- **TransferApplication (转让)**: 转让申请与状态流转
- **IrrigationRecord (灌溉)**: 灌溉用水记录
- **BalanceReport (余额报告)**: 周度余额报告
- **ChangeHistory (变更历史)**: 所有修改的前后快照
