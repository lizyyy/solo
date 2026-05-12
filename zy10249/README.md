# 医疗器械消毒批次管理 API

## 项目简介
本系统用于管理医疗器械包的完整消毒生命周期，包括建档、使用回收、清洗、消毒、灭菌、发放和追溯查询。

## 核心业务规则
1. **状态流转控制**：器械包必须按顺序经历状态流转
2. **防违规操作**：
   - 未清洗不能直接灭菌
   - 灭菌失败不能发放
   - 同一器械包不能重复入批
   - 过期批次不能继续使用
3. **幂等性保障**：重复导入或提交不会重复计算

## 状态流转图
```
已建档 → 使用中 → 已回收 → 清洗中 → 已清洗 → 消毒中 → 已消毒 → 灭菌中 → [已灭菌/灭菌失败] → 已发放
                                                          ↓
                                                      已过期
```

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 启动服务
```bash
npm start
```
服务将在 http://localhost:3000 启动

### 3. 运行完整流程测试
```bash
npm test
```

## API 接口

### 1. 器械包建档
```bash
POST /api/packages
Content-Type: application/json

{
  "packageId": "PKG001",
  "name": "手术器械包A",
  "items": ["手术刀", "镊子", "剪刀"],
  "operator": "张护士"
}
```

### 2. 使用发放
```bash
POST /api/packages/:packageId/use
Content-Type: application/json

{
  "operator": "李护士",
  "patientId": "PAT001",
  "surgeryId": "SUR001"
}
```

### 3. 回收登记
```bash
POST /api/packages/:packageId/recycle
Content-Type: application/json

{
  "operator": "王护士",
  "condition": "正常",
  "notes": "使用后回收"
}
```

### 4. 清洗登记
```bash
POST /api/packages/:packageId/clean
Content-Type: application/json

{
  "operator": "赵护士",
  "method": "全自动清洗机",
  "temperature": 85,
  "duration": 20
}
```

### 5. 消毒登记
```bash
POST /api/packages/:packageId/disinfect
Content-Type: application/json

{
  "operator": "钱护士",
  "method": "湿热消毒",
  "temperature": 90,
  "duration": 15
}
```

### 6. 灭菌登记
```bash
POST /api/packages/:packageId/sterilize
Content-Type: application/json

{
  "operator": "孙护士",
  "batchNo": "BATCH20240101001",
  "method": "高压蒸汽灭菌",
  "temperature": 134,
  "duration": 10,
  "pressure": 210,
  "result": "pass"
}
```

### 7. 发放登记
```bash
POST /api/packages/:packageId/distribute
Content-Type: application/json

{
  "operator": "周护士",
  "department": "手术室",
  "receiver": "郑护士长"
}
```

### 8. 查询器械包状态
```bash
GET /api/packages/:packageId
```

### 9. 查询器械包历史
```bash
GET /api/packages/:packageId/history
```

### 10. 查询所有器械包
```bash
GET /api/packages
```

### 11. 查询灭菌批次
```bash
GET /api/batches/:batchNo
```

## 业务规则验证

### ❌ 违规操作拦截示例

1. **未清洗直接灭菌**
   ```
   状态: 已回收 → 直接灭菌 → 拦截: "器械包必须先清洗才能灭菌"
   ```

2. **灭菌失败仍发放**
   ```
   灭菌结果: fail → 发放 → 拦截: "灭菌失败的器械包不能发放"
   ```

3. **重复入批**
   ```
   已在批次 BATCH001 中 → 再次加入 BATCH002 → 拦截: "器械包已在灭菌批次中"
   ```

4. **过期批次使用**
   ```
   灭菌有效期已过 → 发放 → 拦截: "该批次已过期，请重新灭菌"
   ```

5. **重复提交**
   ```
   同一请求ID重复提交 → 返回已有结果，不重复处理
   ```

## 数据持久化
数据默认存储在内存中，重启服务会清空。如需持久化可扩展为数据库存储。
