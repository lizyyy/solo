# MCN 样品寄送回收管理系统

## 功能特性

- 支持上传寄送单CSV文件批量导入
- 支持上传达人档案JSON
- 支持上传回收照片
- 自动规则引擎检测：
  - 超期未还检测
  - 损坏扣款检测
  - 同样品重复寄送检测
  - 达人档案缺失检测
  - 归还无照片检测
- 自动分类结果：正常项、待确认项、失败项
- 失败记录保留原始字段和建议处理方式
- 同一批次文件重复提交拦截
- 单条明细追踪到最终报告

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

服务器将运行在 `http://localhost:3000`

### 3. 测试API

#### 导入达人档案

```bash
curl -X POST http://localhost:3000/api/upload/influencers \
  -F "jsonFile=@examples/influencers.json"
```

#### 导入寄送单

```bash
curl -X POST http://localhost:3000/api/upload/shipments \
  -F "csvFile=@examples/shipments.csv"
```

#### 查询处理结果

```bash
# 获取所有批次结果
curl http://localhost:3000/api/results

# 获取指定批次结果
curl http://localhost:3000/api/results/{batchId}
```

#### 查询单条明细报告

```bash
curl http://localhost:3000/api/report/{shipmentId}
```

#### 其他API

```bash
# 获取批次列表
curl http://localhost:3000/api/batches

# 获取所有寄送记录
curl http://localhost:3000/api/shipments

# 获取所有达人
curl http://localhost:3000/api/influencers

# 上传照片
curl -X POST http://localhost:3000/api/upload/photos \
  -F "photos=@photo1.jpg" \
  -F "photos=@photo2.jpg"
```

## 文件说明

- `examples/influencers.json` - 达人档案示例
- `examples/shipments.csv` - 寄送单示例

## 业务规则

### 超期未还
- 超过预计归还日期未归还标记为待确认
- 超期超过30天标记为失败
- 超期超过14天可扣除押金

### 损坏扣款
- 状态为damaged的记录标记为失败
- 按样品价值扣除达人押金
- 缺少损坏照片凭证的标记为待确认

### 重复寄送
- 同一样品ID在未归还状态下再次寄送标记为失败

### 达人档案缺失
- 寄送记录中的达人ID在档案中不存在的标记为待确认

### 归还无照片
- 已归还但缺少回收照片的标记为待确认

## 数据存储

所有数据存储在 `data/` 目录下：
- `data/shipments/` - 寄送记录
- `data/influencers/` - 达人档案
- `data/results/` - 处理结果
- `data/batches/` - 批次记录
- `data/photos/` - 回收照片

## 生产部署

```bash
npm run build
npm start
```
