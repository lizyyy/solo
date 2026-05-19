# 门店品控管理系统

用于门店菜品留样、冰箱温度监控和废弃记录管理的本地系统，支持权限控制、审计跟踪和数据导出。

## 功能特性

- ✅ **菜品留样管理**: 记录留样菜品、时间、存放位置，支持48小时有效期校验
- ✅ **冰箱温度监控**: 记录冰箱温度，自动标记异常温度
- ✅ **废弃记录管理**: 记录废弃物品及原因
- ✅ **角色权限控制**: 管理员、店长、品控员、厨师四级权限
- ✅ **敏感字段脱敏**: 手机号等敏感信息自动脱敏
- ✅ **审计日志**: 所有操作完整记录，可追溯
- ✅ **数据导出**: 支持CSV格式导出
- ✅ **本地持久化**: SQLite数据库，重启数据不丢失

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务启动后访问: http://localhost:3000

### 3. 检查服务状态

```bash
curl http://localhost:3000/api/health
```

## 默认用户

系统启动后自动创建以下用户：

| 用户ID | 用户名   | 姓名     | 角色     | 权限范围               |
|--------|----------|----------|----------|------------------------|
| 1      | admin    | 系统管理员 | 管理员   | 所有操作               |
| 2      | manager01 | 张经理   | 店长     | 复核、查看、导出、审计 |
| 3      | qc01     | 品控员小李 | 品控员   | 创建、查看记录         |
| 4      | kitchen01 | 厨师小王 | 厨师     | 留样、温度记录         |

> 使用 API 时需要在 Header 中添加 `X-User-Id` 指定当前用户ID

## API 接口

### 菜品留样

#### 创建留样记录
```bash
curl -X POST http://localhost:3000/api/samples \
  -H "Content-Type: application/json" \
  -H "X-User-Id: 3" \
  -d '{
    "dishName": "红烧肉",
    "dishCode": "DISH001",
    "sampleTime": "2024-01-15T10:00:00",
    "sampleQuantity": "200g",
    "refrigeratorId": "A01",
    "storageLocation": "第一层左侧",
    "expiryTime": "2024-01-17T10:00:00"
  }'
```

#### 查询留样记录
```bash
curl -H "X-User-Id: 3" "http://localhost:3000/api/samples?status=pending&page=1&limit=10"
```

#### 复核留样记录
```bash
curl -X PUT http://localhost:3000/api/samples/1/review \
  -H "Content-Type: application/json" \
  -H "X-User-Id: 2" \
  -d '{
    "status": "approved",
    "reviewComment": "留样合规"
  }'
```

### 冰箱温度

#### 创建温度记录
```bash
curl -X POST http://localhost:3000/api/temperatures \
  -H "Content-Type: application/json" \
  -H "X-User-Id: 4" \
  -d '{
    "refrigeratorId": "A01",
    "refrigeratorName": "留样冰箱1号",
    "temperature": 4.5,
    "measureTime": "2024-01-15T08:00:00",
    "comment": "正常巡检"
  }'
```

#### 查询温度记录
```bash
curl -H "X-User-Id: 3" "http://localhost:3000/api/temperatures?status=normal&page=1&limit=10"
```

#### 温度统计汇总
```bash
curl -H "X-User-Id: 2" "http://localhost:3000/api/temperatures/summary"
```

### 废弃记录

#### 创建废弃记录
```bash
curl -X POST http://localhost:3000/api/wastes \
  -H "Content-Type: application/json" \
  -H "X-User-Id: 3" \
  -d '{
    "itemName": "过期蔬菜",
    "itemType": "原材料",
    "quantity": "5kg",
    "wasteReason": "超过保质期",
    "wasteTime": "2024-01-15T09:00:00"
  }'
```

#### 查询废弃记录
```bash
curl -H "X-User-Id: 3" "http://localhost:3000/api/wastes?status=pending&page=1&limit=10"
```

#### 复核废弃记录
```bash
curl -X PUT http://localhost:3000/api/wastes/1/review \
  -H "Content-Type: application/json" \
  -H "X-User-Id: 2" \
  -d '{
    "status": "approved"
  }'
```

### 数据导出

#### 导出留样记录
```bash
curl -H "X-User-Id: 2" "http://localhost:3000/api/export/samples?startDate=2024-01-01&endDate=2024-01-31" -o samples.csv
```

#### 导出温度记录
```bash
curl -H "X-User-Id: 2" "http://localhost:3000/api/export/temperatures" -o temperatures.csv
```

#### 导出废弃记录
```bash
curl -H "X-User-Id: 2" "http://localhost:3000/api/export/wastes" -o wastes.csv
```

### 审计日志

```bash
curl -H "X-User-Id: 2" "http://localhost:3000/api/audit?limit=50"
```

### 用户管理

```bash
curl "http://localhost:3000/api/users"
```

## 操作流程示例

### 正常流程 - 菜品留样

1. **厨师创建留样记录** (User ID: 4)
   ```bash
   curl -X POST http://localhost:3000/api/samples \
     -H "Content-Type: application/json" \
     -H "X-User-Id: 4" \
     -d '{
       "dishName": "清蒸鲈鱼",
       "sampleTime": "2024-01-15T11:30:00",
       "sampleQuantity": "150g",
       "refrigeratorId": "A01",
       "storageLocation": "第二层右侧",
       "expiryTime": "2024-01-17T11:30:00"
     }'
   ```

2. **店长复核** (User ID: 2)
   ```bash
   curl -X PUT http://localhost:3000/api/samples/1/review \
     -H "Content-Type: application/json" \
     -H "X-User-Id: 2" \
     -d '{"status": "approved", "reviewComment": "符合规范"}'
   ```

3. **导出当月记录**
   ```bash
   curl -H "X-User-Id: 2" "http://localhost:3000/api/export/samples?startDate=2024-01-01&endDate=2024-01-31" -o jan_samples.csv
   ```

### 异常流程 - 温度异常

1. **记录异常温度**
   ```bash
   curl -X POST http://localhost:3000/api/temperatures \
     -H "Content-Type: application/json" \
     -H "X-User-Id: 4" \
     -d '{
       "refrigeratorId": "A01",
       "refrigeratorName": "留样冰箱1号",
       "temperature": 12.5,
       "measureTime": "2024-01-15T14:00:00",
       "comment": "发现温度偏高，已通知维修"
     }'
   ```
   > 系统自动将状态标记为 `abnormal` (温度范围: -10℃ ~ 10℃)

2. **查看审计日志追溯操作**
   ```bash
   curl -H "X-User-Id: 2" "http://localhost:3000/api/audit?tableName=temperature_records"
   ```

### 异常流程 - 权限不足

```bash
# 厨师尝试复核记录（无权限）
curl -X PUT http://localhost:3000/api/samples/1/review \
  -H "Content-Type: application/json" \
  -H "X-User-Id: 4" \
  -d '{"status": "approved"}'
```

返回:
```json
{
  "success": false,
  "message": "权限不足",
  "required": "sample:review"
}
```

## 数据校验规则

### 菜品留样
- 留样时间和过期时间必须为有效日期
- 留样有效期不能超过48小时
- 过期时间不能早于留样时间

### 温度记录
- 温度必须为有效数字
- 温度范围: -10℃ ~ 10℃
- 超出范围自动标记为异常

### 废弃记录
- 必填字段不能为空
- 复核后不能再次操作

## 敏感字段处理

系统对敏感字段进行自动脱敏处理：

- **手机号**: `138****8001`
- 非管理员和店长角色查看用户信息时自动脱敏
- 审计日志中的敏感数据也会进行脱敏处理

## 项目结构

```
.
├── src/
│   ├── app.js                 # 应用入口
│   ├── database/
│   │   ├── init.js           # 数据库初始化
│   │   └── seed.js           # 种子数据
│   ├── middleware/
│   │   └── auth.js           # 权限和脱敏中间件
│   ├── routes/
│   │   ├── samples.js        # 留样记录路由
│   │   ├── temperatures.js   # 温度记录路由
│   │   ├── wastes.js         # 废弃记录路由
│   │   ├── users.js          # 用户管理路由
│   │   ├── audit.js          # 审计日志路由
│   │   └── export.js         # 数据导出路由
│   └── utils/
│       └── audit.js          # 审计日志工具
├── data/                      # SQLite数据库文件目录
├── package.json
└── README.md
```

## 数据库表结构

- `roles`: 角色表，存储角色权限配置
- `users`: 用户表，存储用户基本信息和角色关联
- `sample_records`: 菜品留样记录表
- `temperature_records`: 冰箱温度记录表
- `waste_records`: 废弃记录表
- `audit_logs`: 审计日志表，记录所有操作

## 开发模式

使用 nodemon 进行开发，代码变更自动重启：

```bash
npm run dev
```

## 注意事项

1. 所有 API 请求需要在 Header 中携带 `X-User-Id` 进行身份识别
2. 数据库文件默认保存在 `data/storeqc.db`
3. 首次启动自动初始化角色和用户数据
4. CSV导出文件包含BOM头，支持Excel直接打开
5. 审计日志不可删除，保证操作可追溯
