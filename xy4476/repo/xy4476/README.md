# 播客广告排期API服务

一个本地运行的播客广告排期管理系统，专为小播客团队设计，用于管理赞助商、节目期数和口播档期。

## 功能特性

- ✅ **REST API接口**: 完整的CRUD操作支持
- ✅ **SQLite持久化**: 轻量级本地数据库
- ✅ **智能冲突检查**:
  - 同品类排他检查
  - 相邻期频次过高检查
  - 已售库存超卖检查
  - 补播承诺冲突检查
- ✅ **广告合同导入**: 支持JSON格式合同导入
- ✅ **风险报告生成**: 可下载的Markdown格式排期风险报告
- ✅ **示例数据**: 内置完整的示例数据用于测试
- ✅ **接口用例**: 提供完整的API调用示例

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化示例数据（可选）

```bash
node init-sample-data.js
```

这将创建以下示例数据：
- **5个赞助商**: 元气森林、农夫山泉、小米科技、华为、美团外卖
- **5期节目**: 已发布2期，计划中3期
- **3份合同**: 包含不同的广告配置
- **4个广告位**: 部分已播出，部分待履行

### 3. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动

### 4. 验证服务

访问 `http://localhost:3000/api/health` 检查服务状态

## API接口

### 基础路径
`http://localhost:3000/api`

### 赞助商管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /sponsors | 获取所有赞助商 |
| GET | /sponsors/:id | 获取单个赞助商 |
| POST | /sponsors | 创建新赞助商 |
| PUT | /sponsors/:id | 更新赞助商 |
| DELETE | /sponsors/:id | 删除赞助商 |

**创建赞助商示例**:
```json
{
  "name": "蔚来汽车",
  "category": "汽车",
  "website": "https://nio.com",
  "contact_person": "陈经理",
  "phone": "13900139001",
  "email": "chen@nio.com"
}
```

### 节目期数管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /episodes | 获取所有节目期数 |
| GET | /episodes/:id | 获取单个节目期数 |
| POST | /episodes | 创建新节目期数 |
| PUT | /episodes/:id | 更新节目期数 |
| DELETE | /episodes/:id | 删除节目期数 |

**创建节目期数示例**:
```json
{
  "episode_number": 6,
  "title": "电动汽车的未来",
  "description": "探讨电动汽车行业的发展趋势",
  "publish_date": "2026-02-05",
  "recording_date": "2026-02-01",
  "status": "planned",
  "inventory": 3
}
```

### 广告档期管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /ad-slots | 获取所有广告档期 |
| GET | /ad-slots/:id | 获取单个广告档期 |
| POST | /ad-slots | 创建新广告档期（带冲突检查） |
| PUT | /ad-slots/:id | 更新广告档期 |
| DELETE | /ad-slots/:id | 删除广告档期 |

**创建广告档期示例**:
```json
{
  "sponsor_id": 1,
  "episode_id": 3,
  "slot_type": "pre-roll",
  "position": 1,
  "contract_id": "CT-2026-001",
  "is_broadcast": 0,
  "is_fulfilled": 0
}
```

### 合同管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /contracts | 获取所有合同 |
| GET | /contracts/:id | 获取单个合同 |
| POST | /contracts | 创建新合同 |
| POST | /contracts/import | 导入JSON格式合同 |
| PUT | /contracts/:id | 更新合同 |
| DELETE | /contracts/:id | 删除合同 |

**导入合同JSON格式**:
```json
{
  "contract_number": "CT-2026-NEW-001",
  "sponsor": "字节跳动",
  "category": "互联网",
  "total_slots": 6,
  "used_slots": 0,
  "start_date": "2026-02-01",
  "end_date": "2026-04-30",
  "exclusivity_category": "互联网",
  "max_frequency": 2,
  "makegood_allowed": 1,
  "episodes": [3, 4, 5]
}
```

### 报告生成

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /reports/risk | 下载Markdown格式风险报告 |
| GET | /reports/risk/json | 获取JSON格式的风险报告 |

**风险报告包含**:
- 📊 排期概览
- 🔴 品类排他冲突
- 🟡 频次过高问题
- 🔴 库存超卖问题
- 🟠 未履行广告位
- 📋 合同状态一览

### 工具接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /check-conflicts | 检查潜在冲突 |
| GET | /health | 健康检查 |

**冲突检查参数**:
- `sponsor_id`: 赞助商ID
- `category`: 品类
- `episode_ids`: 节目期数ID（逗号分隔）
- `max_frequency`: 最大频次（可选，默认2）

示例:
```
GET /api/check-conflicts?sponsor_id=1&category=饮料&episode_ids=2,3
```

## 冲突检查逻辑

### 1. 同品类排他检查
- 检查同一期节目中是否存在同品类的其他赞助商
- 防止品牌竞争，提升广告效果

### 2. 相邻期频次过高检查
- 检查同一赞助商在同一期节目中的广告位数量
- 避免过度投放引起听众反感

### 3. 已售库存超卖检查
- 检查节目期数的广告位库存是否已售罄
- 防止超卖，维护客户关系

### 4. 补播承诺冲突检查
- 检查是否存在未履行的补播承诺
- 确保补播安排合理

## 数据库结构

### sponsors 表
| 字段 | 类型 | 描述 |
|------|------|------|
| id | INTEGER | 主键 |
| name | TEXT | 赞助商名称 |
| category | TEXT | 品类 |
| website | TEXT | 官网 |
| contact_person | TEXT | 联系人 |
| phone | TEXT | 电话 |
| email | TEXT | 邮箱 |

### episodes 表
| 字段 | 类型 | 描述 |
|------|------|------|
| id | INTEGER | 主键 |
| episode_number | INTEGER | 期数 |
| title | TEXT | 标题 |
| description | TEXT | 描述 |
| publish_date | DATE | 发布日期 |
| recording_date | DATE | 录制日期 |
| status | TEXT | 状态 |
| inventory | INTEGER | 广告位库存 |

### ad_slots 表
| 字段 | 类型 | 描述 |
|------|------|------|
| id | INTEGER | 主键 |
| sponsor_id | INTEGER | 赞助商ID |
| episode_id | INTEGER | 节目期数ID |
| slot_type | TEXT | 广告类型 |
| position | INTEGER | 位置 |
| contract_id | TEXT | 合同编号 |
| is_broadcast | INTEGER | 是否已播出 |
| is_fulfilled | INTEGER | 是否已履行 |

### contracts 表
| 字段 | 类型 | 描述 |
|------|------|------|
| id | INTEGER | 主键 |
| contract_number | TEXT | 合同编号 |
| sponsor_id | INTEGER | 赞助商ID |
| category | TEXT | 品类 |
| total_slots | INTEGER | 总广告位 |
| used_slots | INTEGER | 已使用 |
| start_date | DATE | 开始日期 |
| end_date | DATE | 结束日期 |
| exclusivity_category | TEXT | 排他品类 |
| max_frequency | INTEGER | 最大频次 |
| makegood_allowed | INTEGER | 是否允许补播 |

## 使用示例

### 运行接口用例

```bash
# 确保服务已启动
npm start

# 另开终端运行测试用例
bash examples/api-calls.sh
```

### 典型工作流程

1. **添加赞助商**
   ```bash
   curl -X POST http://localhost:3000/api/sponsors \
     -H "Content-Type: application/json" \
     -d '{"name":"新赞助商","category":"品类名"}'
   ```

2. **创建节目期数**
   ```bash
   curl -X POST http://localhost:3000/api/episodes \
     -H "Content-Type: application/json" \
     -d '{"episode_number":7,"title":"新一期节目","inventory":3}'
   ```

3. **导入广告合同**
   ```bash
   curl -X POST http://localhost:3000/api/contracts/import \
     -H "Content-Type: application/json" \
     -d @examples/contract-sample.json
   ```

4. **检查冲突**
   ```bash
   curl "http://localhost:3000/api/check-conflicts?sponsor_id=1&category=饮料&episode_ids=2"
   ```

5. **创建广告档期**
   ```bash
   curl -X POST http://localhost:3000/api/ad-slots \
     -H "Content-Type: application/json" \
     -d '{"sponsor_id":1,"episode_id":3,"slot_type":"pre-roll"}'
   ```

6. **生成风险报告**
   ```bash
   # 下载Markdown报告
   curl -o report.md http://localhost:3000/api/reports/risk
   
   # 查看JSON格式
   curl http://localhost:3000/api/reports/risk/json
   ```

## 开发模式

使用 nodemon 进行开发，自动重启服务：

```bash
npm run dev
```

## 项目结构

```
.
├── server.js              # 主服务文件
├── database.js            # 数据库配置
├── init-sample-data.js    # 示例数据初始化
├── package.json           # 项目配置
├── routes/
│   ├── sponsors.js        # 赞助商路由
│   ├── episodes.js        # 节目期数路由
│   ├── ad_slots.js        # 广告档期路由
│   └── contracts.js       # 合同路由
├── services/
│   ├── conflictChecker.js # 冲突检查服务
│   └── reportGenerator.js # 报告生成服务
└── examples/
    ├── api-calls.sh       # API接口用例
    └── contract-sample.json # 合同导入示例
```

## 注意事项

1. **数据持久化**: 数据存储在本地 `podcast.db` SQLite 文件中
2. **冲突检查**: 创建广告档期和导入合同时会自动进行冲突检查
3. **示例数据**: 运行 `init-sample-data.js` 会清空现有数据并重新初始化
4. **风险报告**: 建议定期生成风险报告，及时发现和解决问题

## 许可证

MIT License
