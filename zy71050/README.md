# 港区冷藏箱插电 API

基于 Spring Boot + H2 的轻量级后端服务，解决码头冷藏箱插电记录管理问题。

## 功能特性

- **插座锁定**：防止重复占用，使用数据库悲观锁实现并发安全
- **断电状态机**：插座状态流转，重复操作仅留审计记录
- **温度报警**：自动检测温度异常并创建报警，支持复核流程
- **巡检留痕**：所有操作记录审计日志，可追溯
- **报告导出**：单条记录可追溯到汇总结果

## 技术栈

- Java 11
- Spring Boot 2.7.18
- Spring Data JPA
- H2 Database (内存)
- Lombok

## 快速开始

### 1. 启动服务

```bash
# 编译项目
mvn clean package -DskipTests

# 启动服务
java -jar target/reefer-plugin-api-1.0.0.jar

# 或使用 Maven 直接启动
mvn spring-boot:run
```

服务启动后访问：http://localhost:8080

### 2. H2 控制台

- 地址：http://localhost:8080/h2-console
- JDBC URL: `jdbc:h2:mem:reeferdb`
- 用户名: `sa`
- 密码: (空)

### 3. 初始化数据

服务启动时自动创建以下测试数据：

**巡检人 (3人)**
- INS001 - 张三
- INS002 - 李四
- INS003 - 王五

**插座 (36个)**
- A区/ B区/ C区，每区3排4列
- 编号格式：A-01-01, A-01-02, ...

**冷藏箱 (3个)**
- CBHU1234567 (目标温度 -18°C)
- MSKU7654321 (目标温度 -20°C)
- OOLU9876543 (目标温度 -15°C)

## API 接口

### 健康检查

```bash
curl http://localhost:8080/api/health
```

### 一、新建操作

#### 1. 插电

```bash
curl -X POST http://localhost:8080/api/plugin \
  -H "Content-Type: application/json" \
  -d '{
    "containerNumber": "CBHU1234567",
    "socketCode": "A-01-01",
    "inspectorBadge": "INS001",
    "targetTemperature": -18,
    "remarks": "正常插电"
  }'
```

#### 2. 温度采样

```bash
curl -X POST http://localhost:8080/api/temperature \
  -H "Content-Type: application/json" \
  -d '{
    "containerNumber": "CBHU1234567",
    "socketCode": "A-01-01",
    "inspectorBadge": "INS001",
    "temperature": -17.5,
    "setPoint": -18,
    "remarks": "巡检采样"
  }'
```

### 二、校验接口

#### 1. 校验插座状态

```bash
curl http://localhost:8080/api/validation/socket/A-01-01
```

#### 2. 校验冷藏箱状态

```bash
curl http://localhost:8080/api/validation/container/CBHU1234567
```

#### 3. 预校验插电

```bash
curl "http://localhost:8080/api/validation/plugin?containerNumber=CBHU1234567&socketCode=A-01-01"
```

### 三、处置接口

#### 1. 确认报警

```bash
curl -X POST http://localhost:8080/api/alarms/acknowledge \
  -H "Content-Type: application/json" \
  -d '{
    "alarmId": 1,
    "inspectorBadge": "INS001",
    "remarks": "已确认，正在处理"
  }'
```

#### 2. 处置报警

```bash
curl -X POST http://localhost:8080/api/alarms/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "alarmId": 1,
    "inspectorBadge": "INS001",
    "resolutionNotes": "调整温度设置后恢复正常",
    "remarks": "问题解决"
  }'
```

#### 3. 标记误报

```bash
curl -X POST http://localhost:8080/api/alarms/false \
  -H "Content-Type: application/json" \
  -d '{
    "alarmId": 1,
    "inspectorBadge": "INS001",
    "remarks": "传感器漂移导致"
  }'
```

#### 4. 断电

```bash
curl -X POST http://localhost:8080/api/unplug \
  -H "Content-Type: application/json" \
  -d '{
    "socketCode": "A-01-01",
    "inspectorBadge": "INS001",
    "reason": "集装箱装船",
    "remarks": "正常离港"
  }'
```

### 四、补证接口

```bash
curl -X POST "http://localhost:8080/api/supplement/1?inspectorBadge=INS001&remarks=补充说明材料"
```

### 五、复盘接口

```bash
curl "http://localhost:8080/api/review?start=2024-01-01T00:00:00&end=2024-12-31T23:59:59"
```

### 六、导出接口

```bash
# 导出单份报告
curl -O http://localhost:8080/api/export/RPT-XXXXXXXX

# 查看报告详情
curl http://localhost:8080/api/reports/RPT-XXXXXXXX
```

### 七、查询接口

```bash
# 查询所有插座
curl http://localhost:8080/api/sockets

# 查询可用插座
curl "http://localhost:8080/api/sockets?status=available"

# 查询待处理报警
curl http://localhost:8080/api/alarms/pending

# 查询审计日志
curl http://localhost:8080/api/audit/PowerSocket/1
```

## 失败路径示例

### 1. 重复插电（插座已被占用）

```bash
# 第一次插电
curl -X POST http://localhost:8080/api/plugin \
  -H "Content-Type: application/json" \
  -d '{"containerNumber":"CBHU1234567","socketCode":"A-01-01","inspectorBadge":"INS001","targetTemperature":-18}'

# 第二次插电（同一个插座）- 会失败
curl -X POST http://localhost:8080/api/plugin \
  -H "Content-Type: application/json" \
  -d '{"containerNumber":"MSKU7654321","socketCode":"A-01-01","inspectorBadge":"INS002","targetTemperature":-20}'
```

**预期结果**：返回 `success: false`，提示"插座已被占用"

### 2. 重复断电

```bash
# 先断电一次
curl -X POST http://localhost:8080/api/unplug \
  -H "Content-Type: application/json" \
  -d '{"socketCode":"A-01-01","inspectorBadge":"INS001"}'

# 再次断电 - 会失败，但审计日志会记录重复操作
curl -X POST http://localhost:8080/api/unplug \
  -H "Content-Type: application/json" \
  -d '{"socketCode":"A-01-01","inspectorBadge":"INS001"}'
```

**预期结果**：返回 `success: false`，提示"插座当前状态为AVAILABLE，无需断电"

### 3. 重复确认报警

```bash
# 先确认一次
curl -X POST http://localhost:8080/api/alarms/acknowledge \
  -H "Content-Type: application/json" \
  -d '{"alarmId":1,"inspectorBadge":"INS001"}'

# 再次确认 - 会失败
curl -X POST http://localhost:8080/api/alarms/acknowledge \
  -H "Content-Type: application/json" \
  -d '{"alarmId":1,"inspectorBadge":"INS001"}'
```

**预期结果**：返回 `success: false`，提示"报警当前状态为ACKNOWLEDGED，无需重复确认"

## 轻量自检脚本

```bash
#!/bin/bash
set -e

echo "=== 港区冷藏箱插电 API 自检 ==="

# 1. 健康检查
echo -n "1. 健康检查... "
curl -s http://localhost:8080/api/health | grep -q "OK" && echo "PASS" || echo "FAIL"

# 2. 查询插座
echo -n "2. 查询插座列表... "
RESULT=$(curl -s http://localhost:8080/api/sockets)
echo "$RESULT" | grep -q "success" && echo "PASS" || echo "FAIL"

# 3. 执行插电
echo -n "3. 执行插电... "
RESULT=$(curl -s -X POST http://localhost:8080/api/plugin \
  -H "Content-Type: application/json" \
  -d '{"containerNumber":"CBHU1234567","socketCode":"A-01-01","inspectorBadge":"INS001","targetTemperature":-18}')
echo "$RESULT" | grep -q "PLUGGED_IN" && echo "PASS" || echo "FAIL"

# 4. 温度采样（触发报警）
echo -n "4. 温度采样（触发报警）... "
RESULT=$(curl -s -X POST http://localhost:8080/api/temperature \
  -H "Content-Type: application/json" \
  -d '{"containerNumber":"CBHU1234567","socketCode":"A-01-01","inspectorBadge":"INS001","temperature":-10,"setPoint":-18}')
echo "$RESULT" | grep -q "success" && echo "PASS" || echo "FAIL"

# 5. 查询待处理报警
echo -n "5. 查询待处理报警... "
RESULT=$(curl -s http://localhost:8080/api/alarms/pending)
echo "$RESULT" | grep -q "TEMPERATURE_HIGH" && echo "PASS" || echo "FAIL"

# 6. 校验插座状态
echo -n "6. 校验插座状态... "
RESULT=$(curl -s http://localhost:8080/api/validation/socket/A-01-01)
echo "$RESULT" | grep -q "OCCUPIED" && echo "PASS" || echo "FAIL"

# 7. 复盘统计
echo -n "7. 复盘统计... "
RESULT=$(curl -s "http://localhost:8080/api/review?start=2024-01-01T00:00:00&end=2024-12-31T23:59:59")
echo "$RESULT" | grep -q "statistics" && echo "PASS" || echo "FAIL"

echo "=== 自检完成 ==="
```

保存为 `self-check.sh` 并执行：
```bash
chmod +x self-check.sh
./self-check.sh
```

## 核心设计

### 状态流转

**插座状态**：
```
AVAILABLE (可用) → OCCUPIED (占用中) → AVAILABLE (可用)
                        ↓
                   MAINTENANCE (维护中)
```

**报警状态**：
```
PENDING (待处理) → ACKNOWLEDGED (已确认) → RESOLVED (已解决)
                        ↓                    ↓
                   FALSE_ALARM (误报) ←─────┘
```

### 并发控制

- 使用 `@Lock(LockModeType.PESSIMISTIC_WRITE)` 实现插座锁定
- 事务保证插电/断电操作的原子性
- 重复操作检测，仅记录审计日志不产生新数据

### 可追溯性

- 所有变更操作记录 `audit_logs` 表
- 包含操作前后状态快照
- 可通过 `GET /api/audit/{entityType}/{entityId}` 查询历史

## 项目结构

```
src/main/java/com/port/reefer/
├── ReeferPluginApplication.java    # 启动类
├── config/
│   └── DataInitializer.java        # 数据初始化
├── controller/
│   └── PluginController.java       # API 控制器
├── dto/                            # 数据传输对象
├── entity/                         # 实体类
│   └── enums/                      # 枚举类
├── exception/                      # 异常处理
├── repository/                     # 数据访问层
└── service/                        # 业务逻辑层
```
