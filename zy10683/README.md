# 电子合同服务附件缺失补传 API

## 项目简介

这是一个电子合同附件缺失补传管理系统 API，用于管理合同附件的补传、校验和归档流程。

## 核心功能

- ✅ **附件列表查询** - 支持按日期、状态、负责人、业务对象筛选
- ✅ **附件详情查看** - 包含合同信息、补传记录、历史记录
- ✅ **附件上传补传** - 版本不匹配自动检测并记录
- ✅ **附件校验** - 自动校验版本和内容
- ✅ **手动归档** - 已上传附件可手动归档
- ✅ **数据导出** - CSV 格式导出，导出口径与列表一致
- ✅ **状态统计** - 各状态数量统计
- ✅ **历史记录** - 完整操作轨迹追踪

## 状态说明

| 状态值 | 显示文本 | 说明 |
|--------|----------|------|
| pending_upload | 待补传 | 等待上传附件 |
| uploaded | 已上传 | 附件已上传待校验 |
| validation_failed | 校验失败 | 校验未通过 |
| archived | 已归档 | 校验通过已归档 |

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式运行

```bash
npm run dev
```

服务将在 http://localhost:3000 启动

### 构建生产版本

```bash
npm run build
npm start
```

## API 接口文档

### 1. 获取附件列表

```
GET /api/attachments/list
```

**查询参数:**
- `startDate` - 开始日期 (YYYY-MM-DD)
- `endDate` - 结束日期 (YYYY-MM-DD)
- `status` - 状态过滤: pending_upload|uploaded|validation_failed|archived
- `responsiblePerson` - 负责人过滤
- `businessObject` - 业务对象过滤

**示例:**
```bash
curl "http://localhost:3000/api/attachments/list?status=pending_upload"
```

### 2. 获取附件详情

```
GET /api/attachments/detail/:id
```

### 3. 获取历史记录

```
GET /api/attachments/history/:attachmentItemId
```

### 4. 上传附件

```
POST /api/attachments/upload
Content-Type: application/json

{
  "attachmentItemId": "xxx",
  "uploadedBy": "张三",
  "fileName": "报价单.pdf",
  "fileSize": 1024000,
  "fileVersion": "V1.0"
}
```

### 5. 校验附件

```
POST /api/attachments/validate
Content-Type: application/json

{
  "attachmentItemId": "xxx",
  "operator": "管理员"
}
```

### 6. 手动归档

```
POST /api/attachments/archive
Content-Type: application/json

{
  "attachmentItemId": "xxx",
  "operator": "管理员"
}
```

### 7. 导出数据

```
GET /api/attachments/export
```

支持与列表相同的筛选参数

### 8. 获取状态统计

```
GET /api/attachments/stats
```

### 9. 健康检查

```
GET /health
```

## 验收测试场景

### 场景 1: 完整流转测试

1. 查询列表找到一条"待补传"记录
2. 调用上传接口上传正确版本附件
3. 查看详情确认状态变为"已上传"
4. 调用校验接口进行校验
5. 确认状态变为"已归档"
6. 查看历史记录确认完整轨迹
7. 导出数据验证数据一致性

### 场景 2: 版本不匹配冲突测试

1. 查询列表找到一条"待补传"记录
2. 上传错误版本的附件 (如期望 V2.0，上传 V1.0)
3. 查看详情确认:
   - 状态显示"已上传"
   - versionMismatch 标记为 true
   - 校验消息显示版本不匹配
4. 查看历史记录确认版本不匹配已记录
5. 导出 CSV 验证"版本是否不匹配"列为"是"

### 场景 3: 导入坏行测试（校验失败）

1. 上传附件后处于"已上传"状态
2. 调用校验触发失败场景
3. 确认状态变为"校验失败"
4. 在列表、详情、历史中都能看到失败原因
5. 导出数据也能正确体现

## 配置说明

环境变量 (.env):

```
PORT=3000                    # 服务端口
NODE_ENV=development         # 环境
STORAGE_TYPE=local           # 存储类型 (本地内存)
EXPORT_PATH=./exports        # 导出文件路径
```

## 技术栈

- Node.js + TypeScript
- Express (Web 框架)
- Joi (参数校验)
- csv-writer (CSV 导出)
- dayjs (日期处理)
- uuid (唯一 ID 生成)
