# 安全隐患闭环管理系统

一个专为安全员设计的隐患台账管理系统，解决巡检照片分散、整改责任不清、复查结果难以追溯的问题。

## 核心功能

### ✅ 业务规则引擎
- **缺照片拦截**：巡检、整改、复查三个环节都必须上传照片才能通过
- **逾期自动升级**：高等级隐患（high/critical）逾期未整改自动标记为已升级
- **重复隐患检测**：同位置30天内的隐患自动提示并支持合并处理
- **整改期限校验**：根据风险等级限制整改期限（重大3天、高7天、普通30天）

### ✅ 数据筛选
- 按整改责任人筛选
- 按状态筛选（待分配、整改中、待复查、已闭环、已升级）
- 按风险等级筛选
- 按时间范围筛选
- 按位置模糊搜索

### ✅ 报告导出
- 导出Excel格式的隐患台账
- 包含详细的统计摘要页面
- 闭环率、各状态数量等关键指标

### ✅ 可追溯性
- 每条规则执行都有日志记录
- 状态变更历史完整保留
- 所有拦截和放行操作都有原因说明

## 快速开始

### 1. 安装依赖
```bash
cd safety-hazard-system
npm install
```

### 2. 启动服务
```bash
npm start
```

服务启动后访问：
- 服务地址：http://localhost:3000
- 接口文档：http://localhost:3000/api/docs
- 健康检查：http://localhost:3000/api/health

## 使用流程

### 标准闭环流程
```
1. 创建隐患 (POST /api/hazards)
   ↓
2. 分配整改 (PUT /api/hazards/:id/assign)
   ↓
3. 提交整改 (PUT /api/hazards/:id/rectify)
   ↓
4. 提交复查 (PUT /api/hazards/:id/recheck)
   ↓
   [通过] → 闭环 (closed)
   [不通过] → 重新整改 (rectifying)
```

## API 接口

### 隐患管理

| 方法 | 接口 | 说明 |
|------|------|------|
| GET | /api/hazards | 获取隐患列表（支持筛选分页） |
| GET | /api/hazards/stats | 获取统计数据 |
| GET | /api/hazards/:id | 获取单条隐患详情（含规则日志和状态历史） |
| POST | /api/hazards | 创建新隐患（支持上传巡检照片） |
| PUT | /api/hazards/:id/assign | 分配整改任务 |
| PUT | /api/hazards/:id/rectify | 提交整改 |
| PUT | /api/hazards/:id/recheck | 提交复查 |
| PUT | /api/hazards/:id/merge | 合并重复隐患 |
| DELETE | /api/hazards/:id | 删除隐患 |

### 导出和日志

| 方法 | 接口 | 说明 |
|------|------|------|
| GET | /api/export/hazards | 导出隐患台账为Excel |
| GET | /api/export/rule-logs | 获取规则执行日志 |

## 筛选参数说明

所有筛选参数均为可选，可组合使用：

| 参数 | 类型 | 说明 |
|------|------|------|
| rectifier | string | 整改责任人 |
| status | string | 状态: pending/rectifying/rechecking/closed/escalated |
| hazard_level | string | 风险等级: low/medium/high/critical |
| start_time | string | 巡检开始时间 (ISO格式) |
| end_time | string | 巡检结束时间 (ISO格式) |
| location | string | 位置（模糊搜索） |
| page | number | 页码，默认1 |
| page_size | number | 每页数量，默认20 |

## 使用示例

### 示例1：创建隐患（正常情况）
```bash
curl -X POST http://localhost:3000/api/hazards \
  -H "Content-Type: application/json" \
  -d '{
    "location": "B栋2楼车间",
    "description": "灭火器压力不足",
    "hazard_level": "high",
    "inspector": "王安全",
    "inspector_time": "2024-01-15T10:30:00Z"
  }'
```

### 示例2：分配整改任务
```bash
curl -X PUT http://localhost:3000/api/hazards/1/assign \
  -H "Content-Type: application/json" \
  -d '{
    "rectifier": "张主管",
    "rectify_deadline": "2024-01-22T17:00:00Z",
    "operator": "管理员"
  }'
```

### 示例3：按条件筛选并导出
```bash
# 筛选张三负责的待整改隐患
curl "http://localhost:3000/api/hazards?rectifier=张三&status=rectifying"

# 导出所有已闭环的隐患报告
curl "http://localhost:3000/api/export/hazards?status=closed" -o 已闭环隐患.xlsx
```

### 示例4：查看规则执行日志
```bash
# 查看所有被拦截的操作
curl "http://localhost:3000/api/export/rule-logs?action=block"

# 查看特定隐患的所有规则记录
curl "http://localhost:3000/api/export/rule-logs?hazard_id=1"
```

## 异常场景示例

### 场景1：不上传照片提交整改（会被规则拦截）
```bash
# 尝试不提交整改照片
curl -X PUT http://localhost:3000/api/hazards/2/rectify \
  -H "Content-Type: application/json" \
  -d '{
    "rectify_description": "已更换灭火器",
    "operator": "张主管"
  }'

# 返回结果：
{
  "success": false,
  "message": "整改必须上传照片才能通过",
  "rule_logs": [...]
}
```

### 场景2：设置整改期限过长（会被规则拦截）
```bash
# 高等级隐患设置整改期限超过7天
curl -X PUT http://localhost:3000/api/hazards/1/assign \
  -H "Content-Type: application/json" \
  -d '{
    "rectifier": "李负责",
    "rectify_deadline": "2024-02-15T17:00:00Z",
    "operator": "管理员"
  }'

# 返回结果：
{
  "success": false,
  "message": "高等级隐患整改期限不能超过7天"
}
```

### 场景3：同位置重复提交隐患（自动检测提示）
```bash
# 再次在A栋3楼楼梯口创建隐患
curl -X POST http://localhost:3000/api/hazards \
  -H "Content-Type: application/json" \
  -d '{
    "location": "A栋3楼楼梯口",
    "description": "又发现堆放杂物",
    "hazard_level": "medium",
    "inspector": "新员工",
    "inspector_time": "2024-01-16T09:00:00Z"
  }'

# 返回结果包含警告：
{
  "success": true,
  "message": "隐患创建成功",
  "data": {
    "warnings": {
      "duplicate": "该位置(A栋3楼楼梯口)30天内已有2条隐患记录，建议合并处理",
      "photo": null
    }
  }
}
```

## 状态说明

| 状态码 | 中文说明 |
|--------|----------|
| pending | 待分配 |
| rectifying | 整改中 |
| rechecking | 待复查 |
| closed | 已闭环 |
| escalated | 已升级 |

## 风险等级说明

| 等级 | 中文 | 最长整改期限 |
|------|------|-------------|
| low | 低 | 30天 |
| medium | 中 | 30天 |
| high | 高 | 7天 |
| critical | 重大 | 3天 |

## 目录结构

```
safety-hazard-system/
├── app.js                    # 主入口文件
├── package.json              # 项目配置
├── README.md                 # 说明文档
├── data/                     # SQLite数据库文件
├── uploads/                  # 上传的照片文件
├── exports/                  # 导出的Excel报告
└── src/
    ├── models/
    │   └── database.js       # 数据库模型和初始化
    ├── routes/
    │   ├── hazards.js        # 隐患管理接口
    │   └── export.js         # 导出和日志接口
    └── utils/
        ├── ruleEngine.js     # 业务规则引擎
        └── exporter.js       # Excel导出工具
```

## 技术栈

- **后端框架**: Express.js
- **数据库**: SQLite (better-sqlite3)
- **文件上传**: Multer
- **Excel导出**: ExcelJS
- **跨域支持**: CORS

## 样例数据

系统启动时会自动加载5条样例数据：
1. ✅ 已闭环：A栋3楼楼梯口消防通道
2. 🔄 整改中：B栋生产车间配电箱
3. ⏳ 待分配：C栋仓库门口地面积水
4. ⏳ 待分配：A栋3楼楼梯口（重复位置示例）
5. ⚠️ 已升级：D栋宿舍区过期灭火器（逾期升级示例）

## 注意事项

1. 所有时间字段请使用 ISO 8601 格式（如：2024-01-15T10:30:00Z）
2. 照片上传使用 multipart/form-data 格式
3. 高等级隐患逾期会自动升级，查询列表时触发检查
4. 规则日志不可删除，用于审计追溯
