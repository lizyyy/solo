# 门店会员并卡 API

## 项目概述

这是一个完整的线下门店会员并卡解决方案，专门处理顾客更换手机号后重复注册会员卡导致积分和储值分散的问题。

### 核心功能

1. **会员建档** - 支持创建会员、查询会员信息和交易历史
2. **重复候选识别** - 自动扫描同手机号的多个会员账户
3. **并卡申请** - 创建并卡申请，支持幂等性保证
4. **资产试算** - 合并前预览资产变更、冲突检测和警告
5. **确认合并** - 执行实际的资产转移和会员状态变更
6. **撤销窗口** - 合并确认前支持撤销操作
7. **报告导出** - 生成详细的并卡报告，支持下载

### 业务规则

- **手机号必须一致** - 只有相同手机号的会员才能合并
- **姓名冲突处理** - 同手机号不同姓名需要人工审核
- **储值余额异常拦截** - 源会员余额为负时禁止合并
- **积分即将过期警告** - 积分30天内过期会显示警告
- **幂等性保证** - 支持 `idempotency_key` 防止重复请求
- **人工修正留痕** - 所有人工操作记录前后差异和操作者
- **状态机流转** - initiated → pending_review → pending_confirm → completed

---

## 快速开始

### 环境要求

- Python 3.8+
- pip

### 1. 安装依赖

```bash
cd /Users/mac/pro/solo/workspaces/xy10543
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

服务启动后访问：
- API 文档: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- 健康检查: http://localhost:8000/health

### 3. 造数（创建演示数据）

```bash
python seed_data.py
```

这会创建以下测试数据：

| 会员号 | 姓名 | 手机号 | 储值 | 积分 | 说明 |
|--------|------|--------|------|------|------|
| M001 | 张三 | 13800000001 | 500 | 1000 | 目标卡（一年后积分过期） |
| M002 | 张三 | 13800000001 | 300 | 500 | 源卡（明天积分过期） |
| M003 | 李四 | 13800000002 | 800 | 2000 | 目标卡 |
| M004 | 李四五 | 13800000002 | 200 | 300 | 源卡（姓名冲突） |
| M005 | 王五 | 13800000003 | -100 | 100 | 余额异常（测试拦截） |
| M006 | 赵六 | 13800000004 | 1000 | 5000 | 独立会员 |

### 4. 运行完整演示

```bash
chmod +x demo.sh
./demo.sh
```

---

## API 接口列表

### 会员管理 (`/api/members`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/members | 创建会员 |
| GET | /api/members/{member_no} | 查询单个会员 |
| GET | /api/members/phone/{phone} | 按手机号查询会员 |
| GET | /api/members/{member_no}/transactions | 查询会员交易历史 |

### 重复识别 (`/api/duplicates`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/duplicates/scan | 扫描重复会员 |
| GET | /api/duplicates/pending | 查询待处理重复候选 |
| POST | /api/duplicates/{id}/resolve | 标记为已处理 |

### 并卡管理 (`/api/merges`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/merges/preview | 资产试算和冲突检测 |
| POST | /api/merges/initiate | 发起并卡申请 |
| POST | /api/merges/review | 人工审核冲突 |
| POST | /api/merges/confirm | 确认执行合并 |
| POST | /api/merges/cancel | 撤销并卡申请 |
| GET | /api/merges/{merge_no} | 查询并卡详情（含历史） |
| POST | /api/merges/query | 条件查询并卡记录 |

### 报告管理 (`/api/reports`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/reports/generate | 生成并卡报告 |
| GET | /api/reports/{report_no} | 查询报告信息 |
| GET | /api/reports/{report_no}/download | 下载报告文本 |

---

## 主要演示路径

### 路径一：安全合并（推荐流程）

```
1. 查询会员资产 → 2. 资产试算 → 3. 发起申请 → 4. 确认合并 → 5. 查看结果 → 6. 生成报告
```

预期结果：
- 源卡 (M002)：储值 300 → 0，积分 500 → 0，状态 merged
- 目标卡 (M001)：储值 500 → 800，积分 1000 → 1500
- 历史记录：2 条（发起、执行）
- 审核记录：0 条

### 路径二：信息冲突待审

```
1. 资产试算（发现姓名冲突） → 2. 发起申请（状态 pending_review） 
   → 3. 人工审核通过 → 4. 确认合并
```

预期结果：
- 状态流转：pending_review → pending_confirm → completed
- 审核记录：1 条（记录前后差异、决策者、解释）

### 路径三：撤销窗口

```
1. 发起申请 → 2. 撤销申请 → 3. 验证资产未变动
```

预期结果：
- 最终状态：cancelled
- 会员资产保持不变

---

## 失败路径演示

### 失败一：储值异常拦截

场景：M005 余额为 -100

```bash
curl -X POST http://localhost:8000/api/merges/preview \
  -H "Content-Type: application/json" \
  -d '{"source_member_no":"M005","target_member_no":"M006"}'
```

预期响应：
```json
{
  "success": true,
  "code": "PREVIEW_READY",
  "data": {
    "is_mergeable": false,
    "reason_if_not_mergeable": "源会员储值余额为负: -100.0",
    "conflicts": [
      {
        "field": "balance",
        "level": "error",
        "description": "源会员储值余额异常"
      }
    ]
  }
}
```

### 失败二：手机号不一致

```bash
curl -X POST http://localhost:8000/api/merges/preview \
  -H "Content-Type: application/json" \
  -d '{"source_member_no":"M001","target_member_no":"M006"}'
```

预期结果：is_mergeable = false

### 失败三：状态流转错误

对已完成的并卡再次执行确认：
```bash
curl -X POST http://localhost:8000/api/merges/confirm \
  -H "Content-Type: application/json" \
  -d '{"merge_no":"已完成的并卡号","operator":"测试"}'
```

预期：直接返回已完成记录（幂等处理）

---

## 数据模型说明

### 核心表结构

| 表名 | 说明 |
|------|------|
| members | 会员主表（卡号、姓名、手机号、储值、积分） |
| transactions | 交易流水（储值、积分变动记录） |
| duplicate_candidates | 重复候选（扫描结果） |
| merge_records | 并卡主记录（状态机、资产快照） |
| merge_histories | 并卡操作历史（每一步流转留痕） |
| manual_reviews | 人工审核记录（前后差异、操作者、解释） |
| merge_reports | 并卡报告 |

### 状态机说明

```
initiated (创建申请)
    ↓
pending_review (冲突待审) ←─ 需要人工审核
    ↓ accept
pending_confirm (待确认)
    ↓ confirm
completed (已完成)

任何非终止状态都可 → cancelled (已撤销)
```

---

## 业务闭环验证

查看并卡详情时，返回数据包含：

1. **合并前后资产对比**
   - source_member.balance_before → balance_after
   - target_member.balance_before → balance_after

2. **被合并卡历史**
   - source_transactions: 源卡所有交易记录
   - 包含 initial_deposit, merge_out 等类型

3. **客服解释记录**
   - histories: 每一步操作的时间、操作者、描述
   - reviews: 人工审核的决策、解释、前后值

4. **报告输出**
   - 下载报告后可直接阅读完整合并过程
   - 包含资产明细、操作历史、审核记录

---

## 技术栈

- **框架**: FastAPI + Uvicorn
- **ORM**: SQLAlchemy 2.0
- **数据库**: SQLite（可替换为 PostgreSQL/MySQL）
- **数据验证**: Pydantic
- **文档**: OpenAPI (Swagger UI / ReDoc)

---

## 注意事项

1. **幂等性**: 发起并卡时建议传入 `idempotency_key`，防止重复创建
2. **事务安全**: 所有写操作在数据库事务中执行
3. **状态校验**: 每个操作都会校验当前状态是否允许执行
4. **审计日志**: merge_histories 表记录所有状态变更
5. **人工留痕**: manual_reviews 表记录所有人工决策

---

## 目录结构

```
.
├── app/
│   ├── __init__.py
│   ├── database.py       # 数据库配置
│   ├── models.py         # 数据模型
│   ├── schemas.py        # Pydantic 模式
│   ├── services.py       # 业务逻辑
│   └── routers/
│       ├── __init__.py
│       ├── members.py    # 会员路由
│       ├── duplicates.py # 重复识别路由
│       ├── merges.py     # 并卡路由
│       └── reports.py    # 报告路由
├── main.py               # 应用入口
├── requirements.txt      # 依赖
├── seed_data.py          # 造数脚本
├── demo.sh               # curl 演示脚本
└── README.md             # 本文档
```
