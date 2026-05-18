# 产后康复中心康复项目排程 API

## 项目简介

专为产后康复中心设计的康复项目排程管理系统，核心功能包括批量导入、状态管理、禁忌项检查和人工审核机制，确保每一条排程数据都有完整的状态记录和证据留存。

## 技术栈

- Node.js + Express - Web框架
- Multer - 文件上传处理
- csv-parser - CSV文件解析
- Jest + Supertest - 单元测试和接口测试

## 安装部署

```bash
# 安装依赖
npm install

# 启动开发服务
npm run dev

# 启动生产服务
npm start

# 运行测试
npm test
```

服务默认运行在 `http://localhost:3000`

## API 接口

### 1. 导入排程数据

**POST** `/api/schedule/import`

支持两种导入方式：
- 上传CSV文件（form-data，字段名：file）
- JSON格式批量导入（request body 中提供 data 数组）

**请求示例（JSON批量导入）：**
```json
{
  "data": [
    {
      "patientId": "P2024001",
      "patientName": "王芳",
      "patientAge": 28,
      "postpartumDays": 15,
      "deliveryMethod": "顺产",
      "programCode": "P001",
      "programName": "盆底肌修复",
      "scheduledDate": "2024-01-20",
      "scheduledTime": "09:00",
      "therapistId": "T001",
      "therapistName": "李医师",
      "roomNumber": "301",
      "contraindications": "",
      "contraindicationsResolved": true,
      "reminderEnabled": true,
      "reminderTime": "2024-01-20T08:30:00"
    }
  ]
}
```

**响应示例：**
```json
{
  "success": true,
  "batchId": "uuid",
  "summary": {
    "total": 9,
    "success": 6,
    "error": 2,
    "warning": 2
  },
  "results": [
    {
      "rowNumber": 2,
      "originalData": {...},
      "success": true,
      "schedule": {...},
      "errors": [],
      "needsManualReview": false
    },
    {
      "rowNumber": 4,
      "originalData": {...},
      "success": true,
      "schedule": {...},
      "errors": [
        {
          "field": "contraindications",
          "message": "存在未解除禁忌项却安排热敷项目",
          "suggestion": "请人工确认禁忌项状态并添加备注后继续",
          "severity": "warning"
        }
      ],
      "needsManualReview": true
    }
  ]
}
```

### 2. 人工审核接口

**POST** `/api/schedule/review`

对标记为需人工审核的排程进行审核并添加备注后导入。

**请求示例：**
```json
{
  "scheduleData": {
    "patientId": "P2024003",
    "patientName": "刘敏",
    "programCode": "H001",
    "programName": "热敷护理",
    "scheduledDate": "2024-01-20",
    "scheduledTime": "11:00",
    "contraindications": "皮肤破损、急性感染",
    "contraindicationsResolved": false
  },
  "manualNotes": "经医生确认，患者皮肤破损已愈合，急性感染已痊愈，可以进行热敷护理"
}
```

### 3. 查询批次详情

**GET** `/api/schedule/batch/:batchId`

查询指定导入批次的所有排程记录。

### 4. 导出排程数据

**GET** `/api/schedule/export?batchId=:batchId`

导出所有排程数据或指定批次的数据。

### 5. 查询单条排程

**GET** `/api/schedule/:id`

### 6. 更新排程状态

**PATCH** `/api/schedule/:id/status`

```json
{
  "status": "已确认"
}
```

### 7. 查询所有排程

**GET** `/api/schedule/`

### 8. 健康检查

**GET** `/health`

## 数据字段说明

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| patientId | 字符串 | 是 | 患者ID |
| patientName | 字符串 | 是 | 患者姓名 |
| patientAge | 数字 | 否 | 患者年龄 |
| postpartumDays | 数字 | 否 | 产后天数 |
| deliveryMethod | 字符串 | 否 | 分娩方式（顺产/剖腹产） |
| programCode | 字符串 | 是 | 项目编码 |
| programName | 字符串 | 是 | 项目名称（盆底肌修复、热敷护理等） |
| scheduledDate | 字符串 | 是 | 排程日期（YYYY-MM-DD） |
| scheduledTime | 字符串 | 是 | 排程时间（HH:MM） |
| therapistId | 字符串 | 否 | 治疗师ID |
| therapistName | 字符串 | 否 | 治疗师姓名 |
| roomNumber | 字符串 | 否 | 房间号 |
| contraindications | 字符串/数组 | 否 | 禁忌项（多个用逗号分隔） |
| contraindicationsResolved | 布尔值 | 否 | 禁忌项是否已解除 |
| reminderEnabled | 布尔值 | 否 | 是否开启提醒 |
| reminderTime | 字符串 | 否 | 提醒时间 |

## 状态流转规则

```
待确认 → 已确认 → 进行中 → 已完成
              ↓
            已取消
```

- **禁止越级**：不能直接从"待确认"跳到"已完成"
- **禁止回退**：不能从"已完成"回到"进行中"
- **取消例外**：任何状态都可以直接改为"已取消"

## 验收流程（从创建到导出）

### 第1步：准备测试数据

使用项目根目录下的 `sample_data.csv` 文件，包含9条测试记录：
- 5条正常数据
- 2条禁忌项未解除却安排热敷（需人工审核）
- 1条缺少patientId（错误）
- 1条重复记录（错误）

### 第2步：批量导入

```bash
curl -X POST http://localhost:3000/api/schedule/import \
  -F "file=@sample_data.csv"
```

**验证要点：**
- 统计摘要：total=9, success=6, error=2, warning=2
- 错误记录（第8、9行）包含 originalData、message、suggestion
- 警告记录（第4、10行）标记 needsManualReview=true
- 获取 batchId 备用

### 第3步：人工审核需复审的记录

```bash
curl -X POST http://localhost:3000/api/schedule/review \
  -H "Content-Type: application/json" \
  -d '{
    "scheduleData": {
      "patientId": "P2024003",
      "patientName": "刘敏",
      "programCode": "H001",
      "programName": "热敷护理",
      "scheduledDate": "2024-01-20",
      "scheduledTime": "11:00",
      "contraindications": "皮肤破损、急性感染",
      "contraindicationsResolved": false
    },
    "manualNotes": "经医生确认，患者情况稳定，禁忌项已评估，热敷是安全的"
  }'
```

**验证要点：**
- 返回成功状态
- 返回的 schedule 包含 manualNotes 字段
- needsManualReview 变为 false

### 第4步：更新排程状态

```bash
# 先获取排程ID
curl http://localhost:3000/api/schedule/

# 更新状态
curl -X PATCH http://localhost:3000/api/schedule/:id/status \
  -H "Content-Type: application/json" \
  -d '{"status": "已确认"}'
```

**验证要点：**
- 正常状态更新成功
- 尝试越级更新（待确认→已完成）应失败
- 尝试回退更新应失败
- 任何状态都可以取消

### 第5步：查询批次详情

```bash
curl http://localhost:3000/api/schedule/batch/:batchId
```

**验证要点：**
- 返回批次统计信息
- 返回该批次所有排程记录

### 第6步：导出数据

```bash
# 导出所有数据
curl http://localhost:3000/api/schedule/export

# 导出指定批次数据
curl "http://localhost:3000/api/schedule/export?batchId=:batchId"
```

**验证要点：**
- 导出的数据包含所有字段
- 数据完整且格式正确

### 第7步：运行自动化测试

```bash
npm test
```

**预期测试结果：**
- 所有测试用例通过（≥15个测试用例）
- 覆盖缺字段、重复提交、状态越级、禁忌项检查、人工审核等场景

## 坏行处理机制

导入过程中发现的问题行将包含以下信息：
- **rowNumber**：原始行号（便于定位）
- **originalData**：原始数据完整留存
- **errors[].field**：出错字段名
- **errors[].message**：错误原因描述
- **errors[].suggestion**：后续处理建议
- **errors[].severity**：严重程度（error/warning）

## 项目结构

```
.
├── src/
│   ├── app.js              # 应用入口
│   ├── routes/
│   │   └── scheduleRoutes.js  # 排程路由
│   ├── models/
│   │   └── Schedule.js     # 排程模型
│   └── store/
│       └── dataStore.js    # 数据存储
├── test/
│   └── schedule.test.js    # 测试用例
├── sample_data.csv         # 样例数据
├── package.json
└── README.md
```
