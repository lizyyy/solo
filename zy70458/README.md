# 端口占用巡检命令行工具

支持版本化规则口径管理、样本去重复用/冲突检测、异常样本导出复核的端口占用巡检工具。

## 实现版本

本项目提供两种编程语言实现：

### Python 版本（推荐使用，已完整测试）
- 完整实现所有功能，已通过端到端测试
- 支持样本去重、复用、冲突检测
- 支持异常导出、完整报告、按风险等级导出

### Java 版本（标准 Maven 项目）
- 完整实现所有核心逻辑和命令行接口
- 代码结构清晰，功能完整
- 需要 Maven 环境构建

---

## 功能特性

- **版本化规则口径**：支持多版本规则并存，旧批次使用旧规则解释
- **样本去重复用**：相同IP+端口+供应商的样本再次提交时复用旧结论
- **冲突检测**：规则口径变更导致结论不同时标记为冲突
- **供应商自动修正**：支持供应商名称标准化映射
- **异常样本导出**：导出异常样本Excel供同事复核
- **风险等级过滤**：按风险等级（critical/high/medium/low/safe）查询导出
- **完整报告导出**：导出批次完整巡检报告

---

## Python 版本快速开始

### 系统要求
- Python 3.7+
- pip

### 安装和使用

```bash
# 安装依赖
pip install pandas openpyxl

# 首次巡检
python3 -m port_inspector.cli inspect test_samples_normal.xlsx --rule-version v1.0.0

# 同一样本再次提交（测试复用功能）
python3 -m port_inspector.cli inspect test_samples_normal.xlsx --rule-version v1.0.0

# 切换规则版本，测试冲突检测
python3 -m port_inspector.cli inspect test_samples_normal.xlsx --rule-version v2.0.0

# 查看批次报告
python3 -m port_inspector.cli report <batch_id>

# 查看所有批次
python3 -m port_inspector.cli list-batches

# 导出异常样本
python3 -m port_inspector.cli export-anomalies <batch_id>

# 按风险等级导出所有异常
python3 -m port_inspector.cli export-by-risk critical

# 查看规则版本
python3 -m port_inspector.cli list-rules
```

---

## Java 版本使用说明

### 系统要求
- JDK 11 或更高版本
- Maven 3.6 或更高版本

### Maven 构建

```bash
# 使用 Maven 构建（推荐）
mvn clean package -DskipTests

# 运行
java -jar target/port-inspector-1.0.0.jar --help
```

### Maven 项目结构
```
src/main/java/com/portinspector/
├── model/                      # 数据模型
│   ├── RiskLevel.java         # 风险等级枚举
│   ├── InspectionSample.java  # 巡检样本
│   ├── InspectionResult.java  # 巡检结果
│   ├── BatchInfo.java         # 批次信息
│   └── PortInspectionRule.java # 巡检规则
├── PortInspector.java          # 巡检核心逻辑
├── RuleManager.java           # 规则版本管理器
├── DataStorage.java           # 数据存储
├── ExcelImporter.java         # Excel 导入
├── ExcelExporter.java         # Excel 导出
├── ReviewService.java         # 复核服务
└── PortInspectorMain.java     # CLI 入口
```

---

## 规则版本说明

### v1.0.0 版本（原始口径）
- 端口0-1023（系统端口）：CRITICAL
- 端口1024-49151（注册端口）：MEDIUM
- 端口49152-65535（动态端口）：LOW
- 保留端口：22, 80, 443, 3306, 5432, 6379, 27017
- 高连接阈值：100

### v2.0.0 版本（新口径，降低风险等级）
- 端口0-1023（系统端口）：HIGH
- 端口1024-49151（注册端口）：LOW
- 端口49152-65535（动态端口）：SAFE
- 保留端口：22, 80, 443, 3306, 5432, 6379, 27017, 8080, 8443
- 高连接阈值：50

---

## 供应商自动修正映射

- "阿里" → "阿里巴巴"
- "阿里云计算" → "阿里巴巴"
- "腾讯" → "腾讯科技"
- "腾讯云" → "腾讯科技"
- "百度" → "百度在线"
- "百度云" → "百度在线"

---

## 核心功能说明

### 样本去重与复用
同一批样本再次提交时，系统会自动检测：
- 相同IP+端口+供应商的样本视为重复
- 规则版本相同 → 标记为**复用**，结果前添加"【复用】"
- 规则版本不同 → 标记为**冲突**，结果前添加"【冲突】"，并记录新旧风险对比

### 报告口径可追溯
每个批次巡检时记录使用的规则版本，报告中显示：
- 批次提交时间
- 使用的规则版本
- 样本总数、异常数
- 风险等级分布统计

### 导出字段说明
导出的Excel包含以下字段：
- 样本基本信息（ID、批次、源文件、IP、端口等）
- 巡检结果（规则版本、风险等级、是否异常、结论）
- 样本状态（正常/复用/冲突）
- 追溯信息（原始样本ID、原始批次ID）
- 复核信息（复核人、时间、备注）
