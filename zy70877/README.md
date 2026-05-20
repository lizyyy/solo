# 研究生院招生数据处理API

## 项目概述

本项目是为了解决研究生院招生过程中导师名额、学生志愿和调剂记录的数据混乱问题，提供统一的数据导入、校验和管理接口。

## 核心功能

### 1. 数据导入与分类
- **导师信息导入（CSV格式）
- 学生志愿导入（JSON格式）
- 调剂记录导入（JSON格式）
- 批量处理，支持同一批次防重复导入

### 2. 业务规则引擎
- **名额占用校验：导师名额已满时拒绝录取
- **跨专业限制：学生专业与导师专业不匹配时标记
- **重复录取校验：防止同一学生被同一导师重复录取校验

### 3. 处理结果分类
- **正常项**：符合所有规则，成功导入
- **待确认项**：需人工审核的记录（如跨专业调剂）
- **失败项**：不符合规则，保留原始数据和处理建议

## 快速开始

### 环境要求
- Node.js >= 14.x
- npm 或 yarn

### 安装依赖

```bash
# 1. 安装依赖
npm install

# 2. 运行测试演示（无需启动服务器）
npm test

# 3. 启动开发服务器
npm run dev

# 4. 生产构建
npm run build

# 5. 启动生产服务器
npm start
```

### 测试验证

运行 `npm test` 将执行完整的测试流程，展示：
- 样例数据解析
- 业务规则校验
- 处理结果分类
- 防重复导入验证

## API 接口

### 基础信息

- **服务地址**: http://localhost:3000
- **API前缀**: `/api`

### 接口列表

| 方法 | 路径 | 说明
|------|------|------
| GET | `/` | API首页，显示接口列表
| GET | `/api/health` | 健康检查
| POST | `/api/import/batch` | 批量导入数据
| GET | `/api/mentors` | 获取导师列表
| GET | `/api/applications` | 获取申请列表
| GET | `/api/transfers` | 获取调剂列表
| POST | `/api/applications/:id/confirm` | 确认录取
| GET | `/api/statistics` | 获取统计数据
| GET | `/api/export/mentors` | 导出导师CSV
| POST | `/api/reset` | 重置所有数据

### 批量导入示例

```bash
curl -X POST http://localhost:3000/api/import/batch \
  -F "batchId=BATCH_2024_001" \
  -F "mentors=@samples/mentors.csv" \
  -F "applications=@samples/applications.json" \
  -F "transfers=@samples/transfers.json"
```

## 文件格式说明

### 导师CSV格式

```csv
id,name,department,major,direction,quota,usedQuota
M001,张明教授,计算机学院,计算机科学与技术,人工智能与机器学习,5,2
```

字段说明：
- `id`: 导师唯一标识
- `name`: 导师姓名
- `department`: 所属院系
- `major`: 专业
- `direction`: 研究方向
- `quota`: 招生总名额
- `usedQuota`: 已使用名额

### 学生志愿JSON格式

```json
[
  {
    "studentId": "S2024001",
    "studentName": "张三",
    "studentMajor": "计算机科学与技术",
    "mentorId": "M001",
    "mentorName": "张明教授",
    "priority": 1,
    "isTransfer": false
  }
]
```

### 调剂记录JSON格式

```json
[
  {
    "studentId": "S2024006",
    "studentName": "孙八",
    "fromMajor": "计算机科学与技术",
    "toMajor": "软件工程",
    "reason": "对分布式系统方向更感兴趣"
  }
]
```

## 业务规则详解

### 1. 名额占用规则
- 导师已用名额 >= 总名额时，拒绝新申请
- 导入成功后自动更新导师已用名额
- 名额即将用尽时给出警告提示

### 2. 跨专业限制规则
- 学生专业与导师专业不一致时：
  - 普通申请：标记为失败，给出建议处理方式
  - 调剂申请：标记为待确认，需人工审核

### 3. 重复录取规则
- 同一学生被同一导师重复申请时标记为失败
- 支持查看学生所有申请记录

## 项目结构

```
.
├── src/
│   ├── index.ts          # 服务器入口
│   ├── routes/
│   │   └── index.ts    # API路由
│   ├── services/
│   │   ├── ValidationService.ts    # 规则引擎
│   │   ├── ProcessingService.ts    # 处理服务
│   │   └── FileParserService.ts    # 文件解析
│   ├── store/
│   │   └── DataStore.ts    # 数据存储
│   ├── types/
│   │   └── index.ts    # 类型定义
│   └── test.ts           # 测试演示
├── samples/
│   ├── mentors.csv       # 导师样例数据
│   ├── applications.json  # 志愿样例数据
│   └── transfers.json   # 调剂样例数据
├── package.json
└── tsconfig.json
```

## 样例数据说明

samples目录包含测试数据：
- **mentors.csv**: 5位导师，包含研究方向，其中王芳教授名额已满（3/3）
- **applications.json**: 5条学生志愿，包含正常录取、跨专业调剂、名额已满等场景
- **transfers.json**: 2条调剂记录，包含1条错误记录（同专业调剂）

## 复跑说明

每次运行测试或重启服务器都会重置数据，确保结果可复现：

```bash
# 完整复跑流程
npm install && npm test

# 启动服务器后重置数据
curl -X POST http://localhost:3000/api/reset
```

## 注意事项

1. **批次防重：同一batchId不能重复导入
2. **数据持久化：当前版本使用内存存储，重启服务器数据会丢失
3. **人工确认：待确认记录需要调用确认接口完成最终录取
4. **名额更新：录取确认时自动更新导师已用名额

## 技术栈

- Node.js + TypeScript
- Express Web框架
- multer 文件上传
- csv-parser CSV解析

