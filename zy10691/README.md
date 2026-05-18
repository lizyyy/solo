# 代码扫描平台漏洞误报关闭复核 API

## 项目概述

本项目提供了一套完整的代码扫描漏洞误报管理API，围绕仓库、漏洞规则、扫描结果、复核意见四个核心模型构建，支持漏洞的提交复核、关闭（标记误报）、重新打开和列表筛选功能。

### 核心特性

- ✅ **完整的复核流程**：提交复核 → 复核中 → 关闭（误报）/ 重新打开
- ✅ **智能边界处理**：误报关闭后，新提交触发同一漏洞时不会直接沿用旧结论
- ✅ **完整留痕机制**：规则版本、文件路径、人工备注等全部信息留痕
- ✅ **灵活筛选**：支持按仓库、规则、状态、文件路径等多维度筛选
- ✅ **审计追踪**：所有复核操作都有完整的历史记录

---

## 数据模型

### 1. repositories（仓库）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| name | TEXT | 仓库名称 |
| url | TEXT | 仓库地址 |
| created_at | DATETIME | 创建时间 |

### 2. vulnerability_rules（漏洞规则）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| rule_id | TEXT | 规则唯一标识 |
| name | TEXT | 规则名称 |
| description | TEXT | 规则描述 |
| severity | TEXT | 严重级别（CRITICAL/HIGH/MEDIUM/LOW） |
| version | TEXT | 规则版本 |
| created_at | DATETIME | 创建时间 |

### 3. scan_results（扫描结果）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| repository_id | INTEGER | 关联仓库ID |
| rule_id | TEXT | 关联规则ID |
| file_path | TEXT | 文件路径 |
| line_number | INTEGER | 行号 |
| commit_hash | TEXT | 提交哈希 |
| status | TEXT | 状态（OPEN/REVIEWING/FALSE_POSITIVE/FIXED） |
| scan_time | DATETIME | 扫描时间 |
| created_at | DATETIME | 创建时间 |

### 4. review_records（复核记录）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| scan_result_id | INTEGER | 关联扫描结果ID |
| reviewer | TEXT | 复核人 |
| review_type | TEXT | 复核类型（SUBMIT/CLOSE/REOPEN） |
| comment | TEXT | 复核意见 |
| previous_status | TEXT | 变更前状态 |
| new_status | TEXT | 变更后状态 |
| rule_version_at_review | TEXT | 复核时的规则版本 |
| file_path_at_review | TEXT | 复核时的文件路径 |
| created_at | DATETIME | 创建时间 |

---

## API 接口文档

### 基础信息
- **Base URL**: `http://localhost:3000/api`
- **Content-Type**: `application/json`

---

### 1. 扫描结果接口

#### 提交新的扫描结果
```
POST /scan-results
```

**输入参数**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| repository_id | Integer | 是 | 仓库ID |
| rule_id | String | 是 | 漏洞规则ID |
| file_path | String | 是 | 文件路径 |
| line_number | Integer | 否 | 行号 |
| commit_hash | String | 是 | 提交哈希 |

**处理逻辑**：
1. 检查是否存在相同条件（相同仓库、规则、文件路径、commit_hash）且已标记为误报的记录
2. 如果存在完全相同的条件，返回原有记录状态，不创建新记录
3. 如果条件不同（文件路径变更或commit_hash变更），创建新的OPEN状态记录

**输出示例**：
```json
{
  "id": 8,
  "status": "OPEN"
}
```

或（相同条件重复提交）：
```json
{
  "message": "同一漏洞在相同条件下已被标记为误报，保持原有状态",
  "scan_result_id": 3,
  "status": "FALSE_POSITIVE"
}
```

---

#### 获取扫描结果列表
```
GET /scan-results
```

**查询参数**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| repository_id | Integer | 否 | 按仓库筛选 |
| rule_id | String | 否 | 按规则筛选 |
| status | String | 否 | 按状态筛选 |
| file_path | String | 否 | 按文件路径模糊搜索 |
| page | Integer | 否 | 页码，默认1 |
| limit | Integer | 否 | 每页数量，默认20 |

**输出示例**：
```json
{
  "data": [
    {
      "id": 1,
      "repository_id": 1,
      "rule_id": "SQLI-001",
      "file_path": "src/db/connection.js",
      "line_number": 42,
      "commit_hash": "abc123def456",
      "status": "FALSE_POSITIVE",
      "repository_name": "frontend-webapp",
      "rule_name": "SQL注入漏洞",
      "severity": "CRITICAL",
      "rule_version": "1.0"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 7
  }
}
```

---

### 2. 复核操作接口

#### 提交复核操作
```
POST /scan-results/:id/review
```

**输入参数**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| reviewer | String | 是 | 复核人标识 |
| review_type | String | 是 | 复核类型：SUBMIT（提交复核）、CLOSE（关闭误报）、REOPEN（重新打开） |
| comment | String | 否 | 复核意见 |

**处理逻辑**：
1. 验证扫描结果是否存在
2. 根据review_type确定新状态：
   - SUBMIT: OPEN → REVIEWING
   - CLOSE: REVIEWING → FALSE_POSITIVE
   - REOPEN: FALSE_POSITIVE → OPEN
3. 记录复核时的规则版本和文件路径
4. 创建复核历史记录
5. 更新扫描结果状态

**输出示例**：
```json
{
  "scan_result_id": "1",
  "previous_status": "REVIEWING",
  "new_status": "FALSE_POSITIVE",
  "reviewer": "li.si",
  "review_type": "CLOSE",
  "comment": "经核实，此处使用参数化查询，确认为误报"
}
```

---

#### 获取复核历史记录
```
GET /scan-results/:id/reviews
```

**输出示例**：
```json
[
  {
    "id": 2,
    "scan_result_id": 3,
    "reviewer": "li.si",
    "review_type": "CLOSE",
    "comment": "经核实，此处密码为环境变量占位符，确认为误报",
    "previous_status": "REVIEWING",
    "new_status": "FALSE_POSITIVE",
    "rule_version_at_review": "2.0",
    "file_path_at_review": "config/database.js",
    "created_at": "2024-01-15T10:30:00.000Z"
  }
]
```

---

### 3. 辅助接口

#### 获取仓库列表
```
GET /repositories
```

#### 获取漏洞规则列表
```
GET /vulnerability-rules
```

---

## 边界情况处理

### 核心原则
> **误报关闭后新提交触发同一漏洞，不能直接沿用旧结论**

### 判定逻辑

| 场景 | 处理方式 | 说明 |
|------|----------|------|
| ✅ 完全相同条件（相同仓库+规则+文件路径+commit） | 沿用旧结论 | 真正的重复扫描 |
| ❌ 文件路径变更 | 创建新记录 | 代码重构可能导致真漏洞 |
| ❌ commit_hash变更 | 创建新记录 | 代码变更需要重新评估 |
| ❌ 规则版本升级 | 创建新记录 | 检测逻辑增强可能发现新问题 |

### 留痕机制

每次复核操作都会记录：
1. **规则版本留痕**：`rule_version_at_review` - 记录复核时使用的规则版本
2. **文件路径留痕**：`file_path_at_review` - 记录复核时的文件位置
3. **人工备注留痕**：`comment` - 完整记录复核人的判断依据
4. **状态变更留痕**：`previous_status` → `new_status`

---

## 快速开始

### 安装依赖
```bash
npm install
```

### 初始化种子数据
```bash
npm run seed
```

种子数据包含：
- 📦 **正常记录**：标准的扫描结果和复核流程
- ⚠️ **异常记录**：文件路径变动、规则升级等边界场景
- 🔄 **重复运行记录**：同一规则在不同条件下的多次触发

### 启动服务
```bash
npm start
```

开发模式（自动重启）：
```bash
npm run dev
```

服务启动后访问：`http://localhost:3000/health`

---

## 测试命令

### 运行完整测试套件
```bash
npm test
```

测试覆盖场景：
1. ✅ 健康检查接口
2. ✅ 仓库列表获取
3. ✅ 漏洞规则列表获取
4. ✅ 扫描结果列表获取
5. ✅ 提交复核（正常流程）
6. ✅ 关闭漏洞（标记误报）
7. ✅ 获取复核历史（验证留痕机制）
8. ✅ 重新打开漏洞
9. ✅ 筛选功能测试
10. ✅ 边界情况 - 相同条件重复提交

---

## 验收测试指南

### 1. 正常流程验收
```bash
# 步骤1: 提交复核
curl -X POST http://localhost:3000/api/scan-results/1/review \
  -H "Content-Type: application/json" \
  -d '{"reviewer":"tester","review_type":"SUBMIT","comment":"请复核"}'

# 步骤2: 关闭漏洞（标记误报）
curl -X POST http://localhost:3000/api/scan-results/1/review \
  -H "Content-Type: application/json" \
  -d '{"reviewer":"admin","review_type":"CLOSE","comment":"确认为误报"}'

# 步骤3: 查看复核历史
curl http://localhost:3000/api/scan-results/1/reviews
```

### 2. 异常流程验收
```bash
# 文件路径变动 - 应创建新记录
curl -X POST http://localhost:3000/api/scan-results \
  -H "Content-Type: application/json" \
  -d '{"repository_id":2,"rule_id":"AUTH-003","file_path":"new/path/db.js","line_number":15,"commit_hash":"xyz789abc123"}'

# 验证规则版本留痕
curl http://localhost:3000/api/scan-results/7/reviews
```

### 3. 重复运行验收
```bash
# 完全相同条件重复提交 - 应保持原有误报状态
curl -X POST http://localhost:3000/api/scan-results \
  -H "Content-Type: application/json" \
  -d '{"repository_id":2,"rule_id":"AUTH-003","file_path":"config/database.js","line_number":15,"commit_hash":"xyz789abc123"}'
```

---

## cURL 示例

详细的cURL示例请参考：[curl-examples.md](./curl-examples.md)

---

## 项目结构

```
.
├── src/
│   ├── app.js          # 应用入口
│   ├── database.js     # 数据库初始化
│   ├── routes.js       # API路由
│   └── seed.js         # 种子数据
├── tests/
│   └── run.js          # 测试脚本
├── curl-examples.md    # cURL示例
├── package.json        # 项目配置
└── README.md          # 项目文档
```
