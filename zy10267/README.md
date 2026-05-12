# 社区积分兑换 API 系统

社区志愿积分管理系统，解决家庭成员积分分散、兑换库存不足、积分回滚、重复积分等问题。

## 功能特性

### 核心业务
- **居民管理**: 创建和查询居民信息，每人独立积分账户
- **家庭管理**: 创建家庭，关联家庭成员，合并家庭积分
- **服务记录**: 记录志愿服务，支持批量导入，防重复积分
- **积分管理**: 积分入账、兑换、撤销回滚
- **库存管理**: 兑换物品管理，库存实时校验

### 异常处理
- ✅ 服务撤销后积分自动回滚
- ✅ 兑换时库存不足校验
- ✅ 家庭合并积分标记待人工复核
- ✅ 同一服务记录防止重复积分
- ✅ 兑换记录软删除（标记撤销）
- ✅ 重复导入服务记录去重

### 查询与导出
- 账户余额实时查询
- 余额变更历史追溯
- 交易流水完整记录
- 待复核交易导出Excel

## 快速开始

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 启动服务
```bash
python main.py
```

服务启动后访问:
- API 文档: http://localhost:8000/docs
- Redoc: http://localhost:8000/redoc

### 3. 运行演示脚本
```bash
python demo_data.py
```

演示脚本将模拟以下场景：
1. 创建4个家庭成员，各有独立积分账户
2. 创建家庭账户
3. 各成员参与志愿服务获得积分（积分分散状态）
4. 合并家庭成员积分到家庭账户（需人工复核）
5. 使用家庭统一积分兑换大米、食用油
6. 演示兑换撤销和积分回滚
7. 查询余额变更历史和交易流水
8. 复核家庭合并交易

## API 接口说明

### 居民管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/residents/` | 创建居民 |
| GET | `/residents/{id}` | 获取居民详情 |
| GET | `/residents/` | 获取居民列表 |

### 家庭管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/families/` | 创建家庭 |
| POST | `/families/add-resident` | 添加家庭成员 |
| POST | `/families/merge-accounts` | 合并家庭积分账户 |

### 服务记录
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/service-records/` | 创建服务记录 |
| POST | `/service-records/batch-import` | 批量导入服务记录 |

### 积分管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/points/earn` | 积分入账 |
| POST | `/points/exchange` | 积分兑换物品 |
| POST | `/points/revoke-service` | 撤销服务记录并回滚积分 |
| POST | `/points/revoke-exchange` | 撤销兑换并回滚积分 |

### 库存管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/inventory/` | 创建兑换物品 |
| GET | `/inventory/` | 获取物品列表 |

### 账户查询
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/accounts/{id}/balance` | 查询账户余额 |
| GET | `/accounts/{id}/balance-history` | 查询余额变更历史 |

### 交易流水
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/transactions/` | 查询交易流水 |
| GET | `/transactions/pending-review` | 获取待复核交易 |
| POST | `/transactions/review` | 复核交易 |
| GET | `/export/pending-review` | 导出待复核Excel |

## 数据模型

### 核心实体关系
```
Family (1) ──── (N) Resident
   │                │
   │                │
   1                1
   │                │
   └── PointAccount ─┘
           │
           │ (1)
           │
           N
   PointTransaction
```

### 交易类型
- `earn`: 积分入账
- `exchange`: 积分兑换
- `rollback`: 积分回滚
- `merge_in`: 合并转入
- `merge_out`: 合并转出
- `adjust`: 积分调整

## 业务场景示例

### 场景1: 发米油前积分合并
```python
# 问题: 一家四口积分分散在4个账户
# 解决: 合并到家庭账户统一兑换
POST /families/merge-accounts
{
  "target_family_id": 1,
  "source_account_ids": [2, 3, 4, 5],
  "operator_id": "admin"
}
```

### 场景2: 撤销错误兑换
```python
POST /points/revoke-exchange
{
  "order_id": 10,
  "reason": "发错物品规格",
  "operator_id": "admin"
}
```

### 场景3: 防止服务重复积分
系统自动检查:
- 同一服务记录只能入账一次
- 同一批次导入的重复服务记录自动去重

## 技术栈
- FastAPI: API 框架
- SQLAlchemy: ORM
- SQLite: 数据库
- Pandas + OpenPyXL: Excel导出

## 项目结构
```
.
├── main.py          # API 接口层
├── services.py      # 业务逻辑层
├── database.py      # 数据模型层
├── demo_data.py     # 演示脚本
├── requirements.txt # 依赖清单
└── README.md        # 说明文档
```
