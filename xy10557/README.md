# 托育园接送授权API系统

一个完整的托育机构孩子接送授权管理系统，围绕授权人核验、临时授权、黑名单和接送时间展开。

## 项目架构

```
nursery-pickup-authorization/
├── server.js                 # 主服务器入口
├── package.json              # 项目依赖
├── demo.sh                   # 交互式演示脚本
└── src/
    ├── data/
    │   ├── store.js          # 内存数据存储 + 历史记录管理
    │   └── sampleData.js     # 内置样例数据初始化
    ├── services/
    │   ├── pickupService.js  # 核心业务服务
    │   ├── businessRules.js  # 业务规则引擎
    │   └── idempotency.js    # 幂等性控制服务
    └── routes/
        ├── children.js       # 儿童档案API
        ├── authorizations.js # 授权管理API
        ├── blacklist.js      # 黑名单API
        ├── checkin.js        # 入园签到API
        ├── pickup.js         # 离园接送API
        ├── exceptions.js     # 异常处理API
        └── reports.js        # 报告导出API
```

## 核心功能

### 1. 授权管理
- **固定授权**：家长、亲属等长期接送人授权
- **临时授权**：临时让亲戚、朋友接孩子的授权（需确认）
- **授权有效期**：精确的时间范围控制

### 2. 业务规则拦截
| 规则类型 | 说明 | 异常类型 |
|---------|------|---------|
| 授权过期 | 授权时间已过 | AUTHORIZATION_EXPIRED |
| 重复离园 | 儿童已被接送 | DUPLICATE_PICKUP |
| 临时授权未确认 | 临时授权等待园长确认 | TEMP_AUTH_UNCONFIRMED |
| 黑名单拦截 | 接送人在黑名单中 | BLACKLISTED |
| 儿童未入园 | 今日未签到 | NOT_CHECKED_IN |
| 无有效授权 | 没有任何授权 | NO_AUTHORIZATION |

### 3. 幂等性保证
- 签到/接送操作支持 `X-Idempotency-Key` 请求头
- 重复执行相同请求返回相同结果
- 回调处理也做幂等校验

### 4. 完整追踪
- 每一步操作有状态变化记录
- 所有历史操作可追溯
- 人工修正必须记录：前后差异 + 操作者

### 5. 报告导出
- 每日接送报告（统计 + 明细）
- JSON格式导出
- 支持指定日期查询

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 启动服务
```bash
# 使用默认端口8765
PORT=8765 npm start

# 不初始化样例数据
INIT_SAMPLE_DATA=false npm start
```

服务启动后访问：
- 健康检查：`http://localhost:8765/api/health`
- API文档：`http://localhost:8765/`

### 3. 运行演示脚本
```bash
chmod +x demo.sh
./demo.sh
```

## 内置样例数据

系统启动时自动创建以下样例数据：

### 儿童档案（4人）
| 姓名 | 班级 | 状态 |
|------|------|------|
| 张小明 | 阳光班 | 今日已入园 |
| 李小红 | 阳光班 | 今日已入园 |
| 王小强 | 彩虹班 | 今日已入园+已接送 |
| 陈小美 | 彩虹班 | 今日未入园 |

### 固定授权（6人）
- 张伟（父亲）→ 张小明（有效）
- 王兰（奶奶）→ 张小明（有效）
- 李华（父亲）→ 李小红（有效）
- 张英（母亲）→ 李小红（**已过期**）
- 王芳（母亲）→ 王小强（有效）
- 陈刚（父亲）→ 陈小美（有效）

### 临时授权（2人）
- 张强（叔叔）→ 张小明（**已确认**）
- 李明（表哥）→ 李小红（**待确认**）

### 黑名单（1人）
- 刘磊：陌生人，曾试图强行接走儿童

### 今日接送状态
- 签到：张小明、李小红、王小强（3人）
- 已接送：王小强（1人）

## 演示路径

### 路径1：正常接送（成功）
```bash
# 张小明 + 父亲张伟
curl -X POST http://localhost:8765/api/pickup \
  -H "Content-Type: application/json" \
  -H "X-Operator: teacher_wang" \
  -H "X-Idempotency-Key: demo-pickup-001" \
  -d '{
    "childId": "<张小明的ID>",
    "authorizerId": "auth_parent_zhangwei",
    "authorizerName": "张伟",
    "pickupTime": "2026-05-12T17:00:00",
    "notes": "正常离园"
  }'
```

**预期结果**：接送成功，返回接送记录和授权链路

---

### 路径2：临时授权接送（成功）
```bash
# 张小明 + 叔叔张强（已确认的临时授权）
curl -X POST http://localhost:8765/api/pickup \
  -H "Content-Type: application/json" \
  -H "X-Operator: teacher_wang" \
  -d '{
    "childId": "<张小明的ID>",
    "authorizerId": "temp_auth_uncle_zhangqiang",
    "authorizerName": "张强",
    "pickupTime": "2026-05-12T17:30:00",
    "notes": "叔叔接送"
  }'
```

**预期结果**：接送成功，authorizationType=temporary

---

### 路径3：授权过期拦截（失败）
```bash
# 李小红 + 母亲张英（授权已过期）
curl -X POST http://localhost:8765/api/pickup \
  -H "Content-Type: application/json" \
  -H "X-Operator: teacher_wang" \
  -d '{
    "childId": "<李小红的ID>",
    "authorizerId": "auth_mother_zhangying",
    "authorizerName": "张英",
    "pickupTime": "2026-05-12T17:30:00",
    "notes": "接孩子"
  }'
```

**预期结果**：403 Forbidden，exceptionType=AUTHORIZATION_EXPIRED

---

### 路径4：重复离园拦截（失败）
```bash
# 王小强 + 母亲王芳（已被接送）
curl -X POST http://localhost:8765/api/pickup \
  -H "Content-Type: application/json" \
  -H "X-Operator: teacher_wang" \
  -d '{
    "childId": "<王小强的ID>",
    "authorizerId": "auth_parent_wangfang",
    "authorizerName": "王芳",
    "pickupTime": "2026-05-12T18:00:00",
    "notes": "接孩子"
  }'
```

**预期结果**：403 Forbidden，exceptionType=DUPLICATE_PICKUP

---

### 路径5：黑名单拦截（失败）
```bash
# 任意儿童 + 刘磊（黑名单）
curl -X POST http://localhost:8765/api/pickup \
  -H "Content-Type: application/json" \
  -H "X-Operator: teacher_wang" \
  -d '{
    "childId": "<李小红的ID>",
    "authorizerId": "blacklist_liulei",
    "authorizerName": "刘磊",
    "pickupTime": "2026-05-12T17:45:00",
    "notes": "接孩子"
  }'
```

**预期结果**：403 Forbidden，exceptionType=BLACKLISTED

---

### 路径6：临时授权未确认拦截（失败）
```bash
# 李小红 + 李明（临时授权待确认）
curl -X POST http://localhost:8765/api/pickup \
  -H "Content-Type: application/json" \
  -H "X-Operator: teacher_wang" \
  -d '{
    "childId": "<李小红的ID>",
    "authorizerId": "temp_auth_cousin_liming",
    "authorizerName": "李明",
    "pickupTime": "2026-05-12T17:30:00",
    "notes": "表哥接"
  }'
```

**预期结果**：403 Forbidden，exceptionType=TEMP_AUTH_UNCONFIRMED

## API接口列表

### 儿童档案
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/children | 创建儿童档案 |
| GET | /api/children | 获取所有儿童列表 |
| GET | /api/children/:id | 获取儿童详情 |
| GET | /api/children/:id/status | 获取儿童当日状态（含授权链路、历史记录） |

### 授权管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/authorizations/fixed | 创建固定授权 |
| GET | /api/authorizations/fixed | 获取固定授权列表 |
| POST | /api/authorizations/temporary | 创建临时授权 |
| POST | /api/authorizations/temporary/:id/confirm | 确认临时授权 |
| POST | /api/authorizations/temporary/:id/reject | 拒绝临时授权 |
| GET | /api/authorizations/temporary | 获取临时授权列表 |

### 黑名单
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/blacklist | 添加黑名单 |
| DELETE | /api/blacklist/:id | 移除黑名单（需记录原因） |
| GET | /api/blacklist | 获取黑名单列表 |

### 签到/接送
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/checkin | 入园签到（支持幂等） |
| GET | /api/checkin | 获取签到记录 |
| POST | /api/pickup | 离园接送（支持幂等） |
| GET | /api/pickup | 获取接送记录 |

### 异常处理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/exceptions | 获取异常记录（可筛选状态/类型） |
| POST | /api/exceptions/:id/resolve | 处理异常（需记录前后差异+操作者） |

### 报告
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/reports/daily | 获取每日接送报告 |
| GET | /api/reports/export/daily | 导出每日接送报告（下载） |

## 请求头说明

| 请求头 | 说明 | 示例 |
|--------|------|------|
| Content-Type | 请求体格式 | application/json |
| X-Operator | 操作者标识 | teacher_wang, principal |
| X-Idempotency-Key | 幂等键（签到/接送） | pickup-20260512-001 |

## 儿童状态流转

```
not_arrived (未入园)
    ↓ 签到
in_school (在园)
    ↓ 接送
picked_up (已接送)
```

## 异常处理流程

1. **异常产生**：接送被拦截时自动创建异常记录
2. **查看异常**：`GET /api/exceptions?status=open`
3. **处理异常**：
   ```bash
   curl -X POST http://localhost:8765/api/exceptions/:id/resolve \
     -H "Content-Type: application/json" \
     -H "X-Operator: principal" \
     -d '{
       "resolution": "人工特批放行",
       "beforeState": {"status": "in_school"},
       "afterState": {"status": "picked_up"}
     }'
   ```
4. **留痕**：处理后自动记录：
   - 处理人（resolvedBy）
   - 处理时间（resolvedAt）
   - 处理方案（resolution）
   - 前后状态对比（beforeState/afterState）

## 如何判断业务闭环

### 查看儿童当日状态
```bash
curl http://localhost:8765/api/children/:id/status
```

返回包含：
- `currentStatus.status`: not_arrived/in_school/picked_up
- `fixedAuthorizations`: 固定授权列表（含isValid字段）
- `temporaryAuthorizations`: 临时授权列表（含isValid/isConfirmed）
- `checkIns`: 签到历史
- `pickups`: 接送历史
- `history`: 完整操作历史

### 查看接送报告
```bash
curl http://localhost:8765/api/reports/daily
```

返回统计：
- `stats.totalChildren`: 总儿童数
- `stats.checkedIn`: 今日签到数
- `stats.pickedUp`: 已接送数
- `stats.inSchool`: 在园数
- `stats.notArrived`: 未入园数
- `stats.exceptionCount`: 异常数
- `stats.openExceptions`: 待处理异常数

### 查看异常记录
```bash
curl http://localhost:8765/api/exceptions?status=open
```

无待处理异常 = 当日业务闭环

## 技术栈

- Node.js
- Express.js
- 内存数据存储（演示用，可替换为数据库）
- UUID 生成唯一标识

## 注意事项

1. 本系统使用内存存储，重启后数据会重置
2. 生产环境建议替换为持久化数据库（MongoDB/PostgreSQL）
3. 样例数据中使用固定的authorizerId以便于演示
