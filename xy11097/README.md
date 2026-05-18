# 小学校服订购点校服尺码换货API

一个完整的小学校服尺码换货管理系统，包含完整的业务流程、异常处理和种子数据。

## ✨ 功能特性

- **完整换货流程**: 提交申请 → 待审核 → 正常/补录/驳回 → 已完成
- **库存保护**: 自动检测目标尺码库存
- **防重复申请**: 同一学生有未完成换货时自动拦截
- **换货次数限制**: 同一订单最多允许换货2次
- **清晰的错误提示**: 每个错误都附带解决方案
- **丰富的种子数据**: 包含各种状态的示例换货单

## 🚀 快速开始

### 环境要求

- Node.js 14+

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动。

### 运行测试

```bash
# 先启动服务
npm start

# 新开终端运行测试
npm test
```

## 📋 API 接口

### 1. 获取换货列表

```http
GET /api/exchanges
```

**查询参数:**
- `studentNo`: 学生学号（可选）
- `status`: 换货状态（可选）
- `page`: 页码（可选，默认1）
- `pageSize`: 每页数量（可选，默认20）

**示例:**
```bash
# 获取所有换货单
curl http://localhost:3000/api/exchanges

# 按状态筛选
curl "http://localhost:3000/api/exchanges?status=已完成"

# 按学生筛选
curl "http://localhost:3000/api/exchanges?studentNo=20240101"
```

### 2. 获取换货详情

```http
GET /api/exchanges/:exchangeNo
```

**示例:**
```bash
curl http://localhost:3000/api/exchanges/EXC2024052001
```

### 3. 创建换货申请

```http
POST /api/exchanges
Content-Type: application/json
```

**请求体:**
```json
{
  "orderNo": "ORD202405002",
  "studentNo": "20240101",
  "toSizeCode": "140",
  "reason": "尺码偏小",
  "reasonDetail": "孩子穿着后说裤腰太紧，蹲下不方便",
  "contactPhone": "13800138001"
}
```

**字段说明:**
- `orderNo`: 原始订单号（必填）
- `studentNo`: 学生学号（必填）
- `toSizeCode`: 目标尺码编码（必填）
- `reason`: 换货原因（必填）
- `reasonDetail`: 详细原因（可选）
- `contactPhone`: 联系电话（必填）

**成功响应:**
```json
{
  "success": true,
  "data": {
    "id": 6,
    "exchangeNo": "EXC20240528XXXX",
    "status": "待审核",
    "student": {
      "studentNo": "20240101",
      "name": "张小明",
      "grade": "三年级",
      "className": "1班"
    },
    "originalOrder": {
      "orderNo": "ORD202405002",
      "productName": "夏季短裤",
      "originalSize": "130"
    },
    "targetSize": {
      "sizeCode": "140",
      "sizeName": "140码"
    },
    "reason": "尺码偏小",
    "reasonDetail": "孩子穿着后说裤腰太紧，蹲下不方便",
    "contactPhone": "13800138001",
    "createdAt": "2024-05-28T10:00:00.000Z"
  }
}
```

### 4. 更新换货状态

```http
PUT /api/exchanges/:exchangeNo/status
Content-Type: application/json
```

**请求体:**
```json
{
  "status": "正常",
  "rejectReason": "材料不全",
  "supplementaryNotes": "请补充具体的不适部位描述"
}
```

**状态转换规则:**

| 当前状态 | 可转换状态 |
|---------|-----------|
| 待审核 | 正常、驳回、补录 |
| 正常 | 已完成、驳回 |
| 补录 | 正常、驳回 |
| 驳回 | 正常 |
| 已完成 | - |

## ❌ 错误处理

所有错误响应格式统一，包含错误代码、消息和解决方案：

```json
{
  "success": false,
  "error": {
    "code": "PENDING_EXCHANGE_EXISTS",
    "message": "该学生已有换货申请正在处理中",
    "solution": "请等待前一个换货申请处理完成后再提交新申请，或联系管理员",
    "details": {
      "pendingCount": 1,
      "pendingExchanges": [
        {
          "exchangeNo": "EXC2024090801",
          "status": "待审核",
          "createdAt": "2024-09-08 11:00:00"
        }
      ]
    }
  }
}
```

### 错误代码说明

| 错误代码 | 说明 | 解决方案 |
|---------|------|---------|
| `STUDENT_NOT_FOUND` | 学生信息不存在 | 请检查学号是否正确 |
| `ORIGINAL_ORDER_NOT_FOUND` | 原始订单不存在 | 请检查原始订单号是否正确 |
| `ORDER_NOT_RECEIVED` | 该订单校服尚未领取 | 请先领取校服后再申请换货 |
| `SIZE_NOT_FOUND` | 目标尺码不存在 | 请选择正确的目标尺码 |
| `SAME_SIZE_EXCHANGE` | 目标尺码与原尺码相同 | 请选择与原尺码不同的目标尺码 |
| `INVENTORY_INSUFFICIENT` | 目标尺码库存不足 | 请选择其他尺码或等待补货后再申请 |
| `PENDING_EXCHANGE_EXISTS` | 该学生已有换货申请正在处理中 | 请等待前一个换货申请处理完成后再提交新申请 |
| `TOO_MANY_EXCHANGES` | 该订单已达到最大换货次数限制 | 同一订单最多允许换货2次，请联系管理员特殊处理 |
| `REASON_REQUIRED` | 换货原因不能为空 | 请填写详细的换货原因 |
| `CONTACT_REQUIRED` | 联系电话不能为空 | 请留下有效的联系电话 |
| `INVALID_STATUS_TRANSITION` | 不允许的状态转换 | 请检查当前换货单状态是否允许进行此操作 |
| `EXCHANGE_NOT_FOUND` | 换货单不存在 | 请检查换货单号是否正确 |

## 📊 种子数据

系统启动时会自动植入以下示例数据：

### 学生数据
| 学号 | 姓名 | 年级 | 班级 | 性别 |
|------|------|------|------|------|
| 20240101 | 张小明 | 三年级 | 1班 | 男 |
| 20240102 | 李小红 | 三年级 | 1班 | 女 |
| 20240203 | 王小刚 | 三年级 | 2班 | 男 |
| 20240204 | 赵小芳 | 三年级 | 2班 | 女 |

### 校服产品
| 产品编码 | 名称 | 季节 | 类型 |
|---------|------|------|------|
| U-CS-S-001 | 夏季短袖上衣 | 夏季 | 上衣 |
| U-CS-P-001 | 夏季短裤 | 夏季 | 下装 |
| U-AW-J-001 | 秋季运动外套 | 秋季 | 外套 |
| U-AW-P-001 | 秋季长裤 | 秋季 | 下装 |

### 换货单示例（含各种状态）

| 换货单号 | 学生 | 商品 | 状态 | 说明 |
|---------|------|------|------|------|
| EXC2024051001 | 张小明 | 夏季短袖上衣 | 已完成 | 已完成的换货 |
| EXC2024052001 | 李小红 | 夏季短袖上衣 | 正常 | 审核通过待处理 |
| EXC2024052501 | 王小刚 | 夏季短袖上衣 | 驳回 | 因信息不全被驳回 |
| EXC2024052801 | 赵小芳 | 夏季短袖上衣 | 补录 | 需要补充材料 |
| EXC2024090801 | 张小明 | 秋季运动外套 | 待审核 | 刚提交的申请 |

## 🛡️ 业务规则

### 1. 库存保护
- 创建换货单时检查目标尺码库存
- 状态改为"已完成"时扣减库存
- 库存不足时明确提示解决方案

### 2. 防重复申请
- 同一学生有"待审核"、"正常"、"补录"状态的换货单时
- 禁止提交新的换货申请
- 返回现有待处理换货单的详细信息

### 3. 换货次数限制
- 同一原始订单最多允许换货2次
- 超过限制需联系管理员特殊处理

### 4. 状态一致性
- 严格的状态转换校验
- 只有"正常"状态的换货单才能标记为"已完成"
- 保证库存扣减与状态变更的原子性

## 📁 项目结构

```
.
├── package.json
├── README.md
└── src/
    ├── database.js      # 数据库初始化和表结构
    ├── seed.js          # 种子数据植入
    ├── exchangeService.js # 核心业务逻辑
    ├── server.js        # Express API 服务
    └── test.js          # 自动化测试
```

## 🔧 技术栈

- **Node.js**: 运行环境
- **Express**: Web 框架
- **Better-SQLite3**: 嵌入式数据库（无需额外安装）

## 💡 常见问题

### Q: 如何重置数据库？
A: 删除项目根目录下的 `uniform_exchange.db` 文件，重启服务即可重新初始化。

### Q: 如何添加新的尺码？
A: 可以直接修改 `src/seed.js` 中的尺码数据，或通过数据库工具直接操作。

### Q: 如何修改换货次数限制？
A: 修改 `src/exchangeService.js` 中的 `TOO_MANY_EXCHANGES` 相关逻辑。

### Q: 服务启动失败怎么办？
A: 检查 3000 端口是否被占用，或设置 `PORT` 环境变量使用其他端口。

## 📞 技术支持

如遇到问题，请查看错误响应中的 `solution` 字段，通常会提供具体的解决方案。
