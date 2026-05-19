# 家电售后仓管理系统

领件、旧件返还、厂商索赔三单匹配管理后端系统。

## 功能特性

- 领件记录管理
- 旧件返还记录管理
- 厂商索赔记录管理
- 三单自动匹配检查
- 异常记录追踪
- 多维度筛选查询
- Excel 报告导出
- 数据持久化（SQLite）
- 历史复核记录

## 快速开始

### 1. 安装依赖

```bash
cd warehouse_service
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问：
- API 文档：http://localhost:8000/docs
- 替代文档：http://localhost:8000/redoc

## 核心操作流程

### 一、数据导入

系统提供三种 CSV 数据导入接口，也支持单条录入。

#### 1. 导入领件数据

CSV 格式（参考 `data/sample_pickups.csv`）：
```csv
领件编号,工单号,工程师,零件编码,零件名称,数量,领件日期,备注
P001,W20240501001,张三,A-001,空调压缩机,1,2024-05-01,
```

**使用 curl 导入：**
```bash
curl -X POST "http://localhost:8000/import/pickups" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@data/sample_pickups.csv"
```

#### 2. 导入返还数据

CSV 格式（参考 `data/sample_returns.csv`）：
```csv
返还编号,领件编号,返还日期,返还数量,是否不良,不良描述,接收人
R001,P001,2024-05-06,1,True,压缩机不工作,仓管A
```

**使用 curl 导入：**
```bash
curl -X POST "http://localhost:8000/import/returns" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@data/sample_returns.csv"
```

#### 3. 导入索赔数据

CSV 格式（参考 `data/sample_claims.csv`）：
```csv
索赔编号,领件编号,厂商,索赔日期,索赔金额,状态,审批人,备注
C001,P001,美的空调,2024-05-10,350.00,approved,李经理,质量问题索赔
```

**使用 curl 导入：**
```bash
curl -X POST "http://localhost:8000/import/claims" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@data/sample_claims.csv"
```

### 二、匹配复核

#### 1. 查看单条领件匹配状态

```bash
curl "http://localhost:8000/match/P001"
```

#### 2. 执行批量复核

```bash
curl -X POST "http://localhost:8000/review/?reviewer=张经理"
```

#### 3. 查看历史复核记录

```bash
curl "http://localhost:8000/reviews/"
```

### 三、筛选查询

支持按以下条件筛选：

1. **按负责人筛选**
```bash
curl "http://localhost:8000/match/?engineer=张三"
```

2. **按时间范围筛选**
```bash
curl "http://localhost:8000/match/?start_date=2024-05-01&end_date=2024-05-31"
```

3. **按匹配状态筛选**
```bash
curl "http://localhost:8000/match/?status=unmatched"  # 只看不匹配的
curl "http://localhost:8000/match/?status=matched"    # 只看已匹配的
```

4. **按异常类型筛选**
```bash
curl "http://localhost:8000/match/?anomaly_type=缺失旧件返还"
```

5. **组合筛选**
```bash
curl "http://localhost:8000/match/?engineer=李四&status=unmatched"
```

### 四、导出报告

导出 Excel 报告，包含匹配结果和汇总统计：

```bash
curl -O "http://localhost:8000/export/report"
```

带筛选条件导出：
```bash
curl -O "http://localhost:8000/export/report?engineer=张三&status=unmatched"
```

导出的 Excel 包含两个工作表：
- **匹配结果**：所有领件的详细匹配情况
- **汇总**：匹配率统计

## 样例数据说明

`data/` 目录下提供了 3 组样例数据，包含正常和异常场景：

| 领件编号 | 状态说明 | 异常类型 |
|---------|---------|---------|
| P001 | 完全匹配 | - |
| P002 | 部分匹配 | 返还数量不足、索赔待审批 |
| P003 | 不匹配 | 缺失索赔记录 |
| P004 | 不匹配 | 缺失返还、缺失索赔 |
| P005 | 不匹配 | 缺失返还、缺失索赔 |

## 匹配规则

系统自动检查以下条件，全部满足才算完全匹配：

✅ 有旧件返还记录  
✅ 返还数量 >= 领件数量  
✅ 有厂商索赔记录  
✅ 索赔状态 = approved（已审批）

## API 接口一览

| 接口 | 方法 | 说明 |
|------|------|------|
| `/pickups/` | POST/GET | 领件管理 |
| `/returns/` | POST | 返还管理 |
| `/claims/` | POST/GET | 索赔管理 |
| `/anomalies/` | POST/GET | 异常管理 |
| `/import/pickups` | POST | 导入领件CSV |
| `/import/returns` | POST | 导入返还CSV |
| `/import/claims` | POST | 导入索赔CSV |
| `/match/{pickup_no}` | GET | 单条匹配检查 |
| `/match/` | GET | 批量匹配查询（支持筛选） |
| `/review/` | POST | 执行复核 |
| `/reviews/` | GET | 复核历史 |
| `/export/report` | GET | 导出报告 |
| `/stats` | GET | 统计汇总 |

## 数据持久化

数据存储在 `data/warehouse.db` SQLite 数据库中，重启服务后数据不会丢失。

## 目录结构

```
warehouse_service/
├── app/
│   ├── __init__.py
│   ├── main.py          # 主应用
│   ├── models.py        # 数据库模型
│   ├── schemas.py       # Pydantic 模式
│   ├── crud.py          # 业务逻辑
│   └── database.py      # 数据库配置
├── data/
│   ├── warehouse.db     # SQLite 数据库（自动创建）
│   ├── sample_pickups.csv
│   ├── sample_returns.csv
│   └── sample_claims.csv
├── exports/             # 导出报告目录（自动创建）
├── requirements.txt
└── README.md
```
