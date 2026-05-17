# 餐饮小程序后端预制菜批量下架系统

## 项目简介
这是一个餐饮小程序后端预制菜批量下架管理系统，支持完整的下架流程管理、库存冲突检测、操作历史记录和数据导出。

## 技术栈
- Node.js + Express
- MongoDB + Mongoose
- ExcelJS (Excel导出)

## 核心功能

### 1. 预制菜管理
- 预制菜列表查询（支持分页、状态筛选、分类筛选、关键词搜索）
- 预制菜详情查询
- 状态管理：可售(available) / 下架中(off_shelves_processing) / 已下架(off_shelved) / 可恢复(recoverable)

### 2. 批量下架功能
- 支持多SKU批量下架
- 库存冲突检测：门店有库存时提示冲突
- 强制下架选项
- 下架原因记录
- 操作来源和操作者信息记录
- 证据附件支持

### 3. 历史记录管理
- 按批次ID查询
- 按SKU查询
- 按操作者查询
- 冲突记录筛选
- Excel导出

### 4. 批量导入
- 支持Excel批量导入下架
- 坏行记录和错误详情

## API 接口

### 预制菜接口
```
GET    /api/prepared-meals              # 获取预制菜列表
GET    /api/prepared-meals/:id          # 获取预制菜详情
POST   /api/prepared-meals/batch-off-shelves  # 批量下架
POST   /api/prepared-meals/confirm-off-shelved  # 确认下架完成
POST   /api/prepared-meals/recover     # 恢复上架
```

### 历史记录接口
```
GET    /api/off-shelves-history         # 获取历史记录列表
GET    /api/off-shelves-history/batch/:batchId  # 按批次查询
GET    /api/off-shelves-history/sku/:sku  # 按SKU查询
GET    /api/off-shelves-history/export  # 导出Excel
POST   /api/off-shelves-history/import  # 批量导入下架
```

### 门店接口
```
GET    /api/stores                      # 获取门店列表
GET    /api/stores/:id                  # 获取门店详情
```

### 库存接口
```
GET    /api/inventories                 # 获取库存列表
GET    /api/inventories/:id             # 获取库存详情
```

## 数据模型

### PreparedMeal (预制菜)
- sku: 商品编码
- name: 商品名称
- category: 分类
- price: 售价
- originalPrice: 原价
- cost: 成本
- weight: 重量
- shelfLife: 保质期
- storageCondition: 存储条件
- ingredients: 配料
- allergens: 过敏原
- nutritionInfo: 营养信息
- status: 状态
- supplier: 供应商信息

### Store (门店)
- storeCode: 门店编码
- name: 门店名称
- address: 地址
- manager: 店长信息
- businessHours: 营业时间
- area: 面积
- seatingCapacity: 座位数
- status: 门店状态
- region: 区域

### Inventory (库存)
- preparedMealId: 预制菜ID
- storeId: 门店ID
- sku: SKU
- storeCode: 门店编码
- quantity: 总库存
- availableQuantity: 可用库存
- reservedQuantity: 预留库存
- safetyStock: 安全库存
- batchNo: 批次号
- productionDate: 生产日期
- expiryDate: 过期日期

### OffShelvesHistory (下架历史)
- batchId: 批次ID
- preparedMealId: 预制菜ID
- storeId: 门店ID
- sku: SKU
- previousStatus: 原状态
- newStatus: 新状态
- reason: 下架原因
- reasonDetail: 原因详情
- operationSource: 操作来源(headquarters/store/api/batch_import/system)
- operator: 操作者信息
- hasInventoryConflict: 是否有库存冲突
- inventoryConflictDetail: 冲突详情
- forceOffShelves: 是否强制下架
- evidence: 证据附件
- importRowNumber: 导入行号
- importError: 导入错误
- remarks: 备注

## 下架原因枚举
- quality_issue: 质量问题
- supplier_issue: 供应商问题
- seasonal: 季节性调整
- inventory_clearance: 清库存
- strategy_adjustment: 策略调整
- customer_complaint: 客户投诉
- regulatory_requirement: 合规要求
- expired: 过期
- other: 其他

## 安装和运行

### 安装依赖
```bash
npm install
```

### 启动MongoDB
确保MongoDB服务已启动并运行在默认端口27017

### 填充种子数据
```bash
npm run seed
```

### 启动服务
```bash
npm start
```

开发模式：
```bash
npm run dev
```

### 运行测试
```bash
node src/scripts/test.js
```

## 验收场景

### 1. 完整流转场景
- 预制菜从"可售" → "下架中" → "已下架" → "可售"
- 每一步操作都有历史记录
- 记录操作来源、操作者、时间

### 2. 冲突记录场景
- 选择有库存的预制菜进行下架
- 系统检测到库存冲突并记录
- 冲突详情包含门店信息和库存数量

### 3. 导入坏行场景
- 批量导入时出现错误数据
- 错误数据被记录到历史表中
- 包含行号和具体错误信息

### 4. 数据互相对齐
- 列表页数据和详情页一致
- 历史记录可追溯到具体操作
- 导出Excel数据与系统数据一致
