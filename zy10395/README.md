# 边缘节点配置签收 API

基于 Spring Boot 的边缘节点配置签收、生效校验、失败补发系统。

## ✅ 修复内容

### 1. 编译问题修复
- ✅ 所有枚举类添加 `of(Integer code)` 静态方法
- ✅ `AckResultEnum`, `CheckResultEnum`, `FailureTypeEnum`, `RetryStatusEnum`, `RetryTypeEnum`
- ✅ 降低 Java 版本从 11 到 1.8，兼容 Java 8 环境

### 2. 运行环境增强
- ✅ 添加 `mvnw` Maven wrapper 脚本
- ✅ 添加 `start.sh` 一键启动脚本（自动下载 Maven + 编译 + 运行）
- ✅ 添加 `test-api.sh` API 自动化测试脚本
- ✅ 添加 `.mvn/wrapper/maven-wrapper.properties` 配置
- ✅ pom.xml 添加 Maven wrapper 插件

## 🚀 快速开始

### 方式一：一键启动（推荐）
```bash
./start.sh
```
- 自动检测 Java 环境
- 自动下载 Maven（无需手动安装）
- 自动编译并启动
- 服务地址: http://localhost:8080

### 方式二：使用 Maven
```bash
./mvnw clean spring-boot:run
```

## 🧪 API 测试

项目启动后，在另一个终端运行：
```bash
./test-api.sh
```

测试脚本覆盖以下场景：
1. ✅ 创建配置下发（含幂等性验证）
2. ✅ 节点签收配置
3. ✅ 生效校验
4. ✅ 查询下发详情
5. ✅ 版本对账
6. ✅ 查询下发列表

## 📚 API 文档

详细接口文档请查看: [API.md](./API.md)

### 核心接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/delivery/create | 创建配置下发 |
| POST | /api/v1/delivery/ack | 签收配置 |
| POST | /api/v1/delivery/effective-check | 生效校验 |
| GET | /api/v1/delivery/list | 查询下发列表 |
| GET | /api/v1/delivery/{deliveryNo} | 查询下发详情 |
| GET | /api/v1/delivery/{deliveryNo}/receipts | 查询签收历史 |
| GET | /api/v1/delivery/{deliveryNo}/failures | 查询失败历史 |
| GET | /api/v1/delivery/reconciliation/{versionNo} | 版本对账 |

### 导出接口
- GET `/api/v1/export/delivery` - 导出下发记录
- GET `/api/v1/export/receipt/{deliveryNo}` - 导出签收记录
- GET `/api/v1/export/failure/{deliveryNo}` - 导出失败记录
- GET `/api/v1/export/check/{deliveryNo}` - 导出校验记录

## 🗄️ 数据库控制台

H2 Console: http://localhost:8080/h2-console
- JDBC URL: `jdbc:h2:mem:edge_config`
- Username: `sa`
- Password: (空)

## 📁 项目结构

```
.
├── src/main/java/com/edge/config/ack/
│   ├── controller/          # Controller 层
│   ├── service/             # Service 层
│   ├── mapper/              # Mapper 层
│   ├── entity/              # 数据实体
│   ├── dto/                 # 请求/响应 DTO
│   ├── enums/               # 枚举类
│   ├── common/              # 通用类（Result, ErrorCode）
│   ├── config/              # 配置类
│   └── EdgeConfigAckApplication.java
├── src/main/resources/
│   ├── application.yml      # 应用配置
│   └── schema.sql           # 数据库初始化脚本
├── start.sh                 # 一键启动脚本
├── test-api.sh              # API 测试脚本
├── mvnw                     # Maven wrapper
├── pom.xml                  # Maven 配置
├── API.md                   # API 文档
└── README.md                # 本文件
```

## 💡 核心特性

1. **幂等性保障** - 通过 `idempotentKey` 和数据库唯一约束
2. **状态流转控制** - 严格的状态机校验
3. **完整审计日志** - 签收、校验、失败记录全留存
4. **版本对账** - 按配置版本核对所有节点状态
5. **Excel 导出** - 四种数据导出格式
6. **预置测试数据** - 5 个测试节点，1 个测试配置版本

## 🔧 技术栈

- Java 8+
- Spring Boot 2.7.18
- MyBatis Plus 3.5.3.1
- H2 Database (内存)
- Apache POI 5.2.3

---

**注意**: 首次启动需要下载 Maven 和依赖，可能需要 2-5 分钟，请耐心等待。启动成功后会显示 `Started EdgeConfigAckApplication` 日志。
