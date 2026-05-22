# 机场地服申诉处理后端服务

一套专门为机场地服设计的行李申诉处理系统，支持数据导入、自动审核、状态追踪和导出。

## 功能特性

### 核心功能
- **新增批次** - 批量导入申诉记录
- **标记处理** - 支持通过/拒绝/退回等操作
- **退回修改** - 记录退回原因和补材料要求
- **导出明细** - CSV导出，数量与查询一致
- **历史查询** - 重启后数据不丢失

### 自动规则判断
- **超时申报** - 航班日期超过7天自动标记
- **责任航段** - 根据航线自动识别责任航段
- **赔付上限** - 超过5000元需人工核定
- **赔付等级** - A/B/C/D四级自动分级

### 查询维度
- 行李牌号模糊查询
- 按责任航段筛选
- 按赔付等级筛选
- 按状态筛选

## 快速开始

### 安装依赖
```bash
npm install
```

### 运行样例演示
```bash
npm test
```

### 启动API服务
```bash
npm start
```

## API接口

### 批次管理
```
POST   /api/batches              # 创建批次
GET    /api/batches              # 批次列表
GET    /api/batches/:id          # 批次详情
POST   /api/batches/import/csv   # 导入申诉CSV
POST   /api/batches/import/flight # 导入航班JSON
POST   /api/batches/import/photo  # 导入照片索引
```

### 申诉处理
```
GET    /api/claims                # 查询申诉列表
GET    /api/claims/export         # 导出CSV
GET    /api/claims/:id            # 申诉详情
POST   /api/claims/:id/process    # 处理申诉
GET    /api/claims/:id/logs       # 处理日志
POST   /api/claims/batch-process  # 批量处理
```

### 查询参数示例
```
# 按行李牌号查询
GET /api/claims?baggage_tag_no=CA1234567890

# 按责任航段查询
GET /api/claims?responsible_segment=PEK

# 按赔付等级查询
GET /api/claims?compensation_level=B

# 组合查询
GET /api/claims?responsible_segment=PEK&compensation_level=B
```

### 处理操作类型
- `approve` - 同意放行
- `reject` - 拒绝赔付
- `return` - 退回修改
- `review` - 标记待审核

## 数据结构

### 申诉状态
- `pending` - 待处理
- `pending_review` - 待人工审核
- `approved` - 已通过
- `rejected` - 已拒绝
- `returned` - 已退回

### 赔付等级
- A级: 0-500元
- B级: 500-2000元
- C级: 2000-5000元
- D级: 5000元以上(需人工)

## 样例数据说明

`data/sample_claims.csv` 包含5条样例记录：
1. CA1234567890 - 正常记录，自动通过
2. MU9876543210 - 正常记录
3. CZ1122334455 - 正常记录
4. **HU5566778899 - 6000元超限，需人工修正**
5. FM2233445566 - 资料不全，需人工审核

## 处理轨迹说明

每条申诉记录都保存：
- 操作类型
- 处理原因
- 处理人
- 处理时间
- 状态变更前后

可用于向其他部门说明：
- 为什么这条记录被放行
- 为什么被退回
- 需要补充什么材料
