# 性能事故复盘平台 (Performance Review Platform)

一个本地运行时性能事故复盘台，用于后端排查"接口忽快忽慢、CPU 飙高、内存涨、GC 抖、线程卡住"等问题。

## 功能特性

- **多类型文件上传**: 支持 incident.json、gc.log、thread-dump、慢请求、I/O 和网络延迟样例文件上传
- **自动解析**: 后端自动解析文件并落库
- **智能分析**: 自动串出 CPU 热点、堆增长、GC pause、锁等待链、I/O 阻塞、网络 RTT 的时间线和瓶颈排序
- **可视化展示**: 页面支持多种图表展示（时间线、趋势图、分布图）
- **证据管理**: 可点开证据片段、标记处置建议
- **报告导出**: 支持导出 Markdown/JSON 格式的复盘报告
- **样本数据**: 内置 seed 数据和坏格式提示

## 技术栈

### 后端
- Java 17
- Spring Boot 3.2
- Spring Data JPA
- SQLite 数据库
- Lombok
- Springdoc OpenAPI (Swagger)

### 前端
- React 18
- React Router 6
- Ant Design 5
- Recharts (图表库)
- Axios
- Day.js

## 项目结构

```
zy1216/
├── backend/                          # 后端项目
│   ├── pom.xml                       # Maven 配置
│   └── src/
│       ├── main/
│       │   ├── java/com/performancereview/
│       │   │   ├── config/           # 配置类
│       │   │   ├── controller/       # 控制器
│       │   │   ├── dto/              # 数据传输对象
│       │   │   ├── entity/           # 实体类
│       │   │   ├── enums/            # 枚举类
│       │   │   ├── parser/           # 文件解析器
│       │   │   ├── repository/       # 数据访问层
│       │   │   └── service/          # 服务层
│       │   └── resources/
│       │       └── application.properties  # 应用配置
│       └── test/                     # 测试代码
├── frontend/                         # 前端项目
│   ├── package.json
│   └── src/
│       ├── components/               # 组件
│       ├── pages/                    # 页面
│       └── services/                 # API 服务
└── samples/                          # 样本数据文件
    ├── incident.json                 # 事故描述示例
    ├── gc.log                        # GC 日志示例
    ├── thread-dump.txt               # 线程转储示例
    ├── slow-request.log              # 慢请求日志示例
    ├── io-block.log                  # I/O 阻塞日志示例
    ├── network-rtt.log               # 网络延迟日志示例
    └── bad-format/                   # 坏格式示例（用于测试）
```

## 快速开始

### 环境要求
- JDK 17+
- Node.js 18+
- Maven 3.8+

### 启动后端

```bash
cd backend

# 编译项目
mvn clean compile

# 运行项目
mvn spring-boot:run
```

后端服务将在 `http://localhost:8080` 启动

API 文档地址: `http://localhost:8080/swagger-ui.html`

### 启动前端

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm start
```

前端应用将在 `http://localhost:3000` 启动

## 支持的文件格式

| 文件类型 | 文件名模式 | 说明 |
|---------|-----------|------|
| incident.json | `*incident*.json` | 事故描述 JSON 文件 |
| GC 日志 | `*gc*.log` | JVM GC 日志（支持 G1、CMS 等） |
| 线程转储 | `*thread*dump*`, `*jstack*` | Java 线程转储文件 |
| 慢请求日志 | `*slow*request*`, `*access*.log` | HTTP 请求访问日志 |
| I/O 阻塞日志 | `*io*block*` | 磁盘/数据库/网络 I/O 阻塞日志 |
| 网络延迟日志 | `*network*rtt*` | 网络 RTT 监控日志 |

## API 接口

### 文件上传
- `POST /api/files/upload` - 单文件上传
- `POST /api/files/upload/batch` - 批量文件上传
- `GET /api/files/supported-types` - 获取支持的文件类型

### 事故管理
- `GET /api/incidents` - 获取事故列表（支持筛选、搜索）
- `GET /api/incidents/{id}` - 获取事故详情
- `POST /api/incidents` - 创建事故
- `PUT /api/incidents/{id}` - 更新事故
- `DELETE /api/incidents/{id}` - 删除事故
- `PUT /api/incidents/{id}/suggestion` - 更新处置建议
- `GET /api/incidents/{id}/analyze` - 重新分析事故

### 报告导出
- `GET /api/incidents/{id}/export/markdown` - 导出 Markdown 报告
- `GET /api/incidents/{id}/export/json` - 导出 JSON 报告

### 性能指标查询
- `GET /api/incidents/{id}/cpu-hotspots` - CPU 热点
- `GET /api/incidents/{id}/heap-growths` - 堆增长
- `GET /api/incidents/{id}/gc-pauses` - GC 暂停
- `GET /api/incidents/{id}/lock-waits` - 锁等待链
- `GET /api/incidents/{id}/io-blocks` - I/O 阻塞
- `GET /api/incidents/{id}/network-rtts` - 网络 RTT
- `GET /api/incidents/{id}/slow-requests` - 慢请求
- `GET /api/incidents/{id}/evidence-fragments` - 证据片段

## 数据模型

### 核心实体
- **Incident**: 事故主实体
- **UploadedFile**: 上传文件记录
- **CpuHotSpot**: CPU 热点数据
- **HeapGrowth**: 堆内存增长
- **GcPause**: GC 暂停事件
- **LockWaitChain**: 锁等待链
- **IoBlock**: I/O 阻塞事件
- **NetworkRtt**: 网络 RTT 数据
- **SlowRequest**: 慢请求记录
- **EvidenceFragment**: 证据片段

### 枚举类型
- **PerformanceMetricType**: 性能指标类型（CPU_HOTSPOT, HEAP_GROWTH, GC_PAUSE, LOCK_WAIT, IO_BLOCK, NETWORK_RTT, SLOW_REQUEST）
- **BottleneckSeverity**: 严重程度（CRITICAL, HIGH, MEDIUM, LOW, INFO）
- **FileUploadStatus**: 文件状态（UPLOADED, PARSING, PARSED, FAILED）

## 使用示例

### 1. 上传样本文件

1. 启动后端和前端服务
2. 访问 `http://localhost:3000/upload`
3. 选择 "创建新事故"，输入标题
4. 拖拽或选择 `samples/` 目录下的文件：
   - `incident.json`
   - `gc.log`
   - `thread-dump.txt`
   - `slow-request.log`
   - `io-block.log`
   - `network-rtt.log`
5. 点击 "开始上传并解析"

### 2. 查看分析结果

1. 上传完成后自动跳转到事故详情页
2. 查看：
   - **时间线分析**: 各类事件的时间分布
   - **瓶颈分布**: 各类问题的数量占比
   - **详细标签页**: 各类性能数据的详细信息和图表

### 3. 导出报告

1. 在事故详情页点击右上角的 "导出 Markdown" 或 "导出 JSON"
2. 下载的报告包含：
   - 事故基本信息
   - 各类性能指标数据
   - 关键证据片段
   - 处置建议

### 4. 测试坏格式文件

使用 `samples/bad-format/` 目录下的文件测试错误处理：
- `invalid-json.json`: 格式错误的 JSON
- `invalid-gc.log`: 无法解析的 GC 日志
- `invalid-thread-dump.txt`: 无法解析的线程转储

## 开发指南

### 添加新的文件解析器

1. 实现 `FileParser` 接口：
```java
@Component
public class MyCustomParser implements FileParser {
    @Override
    public String getSupportedFileType() {
        return "MY_CUSTOM_TYPE";
    }
    
    @Override
    public boolean canParse(String fileName) {
        return fileName.toLowerCase().matches(".*custom.*\\.log");
    }
    
    @Override
    public FileUploadResult parse(Path filePath, Incident incident) {
        // 实现解析逻辑
    }
}
```

2. 解析器会自动被 `FileParserManager` 发现和注册

### 前端开发

```bash
cd frontend

# 开发模式
npm start

# 构建生产版本
npm run build
```

## 运行测试

### 后端测试

```bash
cd backend
mvn test
```

### 测试覆盖
- `IncidentJsonParserTest`: JSON 解析器测试
- `GcLogParserTest`: GC 日志解析器测试
- `ThreadDumpParserTest`: 线程转储解析器测试

## 配置说明

### 后端配置 (application.properties)

```properties
# 数据库
spring.datasource.url=jdbc:sqlite:./data/performance-review.db
spring.jpa.hibernate.ddl-auto=update

# 文件上传
spring.servlet.multipart.max-file-size=100MB
spring.servlet.multipart.max-request-size=100MB

# CORS
cors.allowed-origins=http://localhost:3000

# 服务端口
server.port=8080
```

### 前端配置

前端通过 `package.json` 中的 `proxy` 配置代理到后端：
```json
{
  "proxy": "http://localhost:8080"
}
```

## 常见问题

### Q: 数据库文件在哪里？
A: SQLite 数据库文件位于 `backend/data/performance-review.db`，启动时会自动创建。

### Q: 支持哪些 GC 日志格式？
A: 支持 G1、CMS、Parallel、Serial 等主流 GC 收集器的日志格式，包括带时间戳和不带时间戳的格式。

### Q: 文件大小限制是多少？
A: 默认单文件最大 100MB，可在 `application.properties` 中修改。

### Q: 如何添加新的性能指标类型？
A: 
1. 在 `PerformanceMetricType` 枚举中添加新类型
2. 创建对应的实体类（继承 `BaseEntity`）
3. 创建对应的 Repository 接口
4. 在 `DataAnalysisService` 中添加分析逻辑
5. 在前端页面添加对应的数据展示

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
