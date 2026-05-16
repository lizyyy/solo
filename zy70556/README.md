# Redis 键空间分析工具

一个用于分析Redis键空间使用情况的Python工具包，支持扫描、分析和报告Redis内存使用情况。

## 功能特性

- 扫描Redis中的所有键并收集详细信息
- 按键前缀进行分组统计
- 分析内存使用分布
- 分析TTL过期时间分布
- 按键类型进行统计分析
- 支持Owner映射，将键前缀分配给对应服务
- 生成多种格式的分析报告（JSON、CSV、HTML）
- 支持离线分析，从已保存的扫描文件中重新生成报告

## 安装

### 方式一：使用 pip 安装

```bash
pip install -e .
```

### 方式二：使用 requirements.txt 安装依赖

```bash
pip install -r requirements.txt
```

安装完成后，即可使用 `redis-key-analyzer` 命令行工具。

## 使用方法

### 1. 扫描Redis键空间并生成报告

```bash
# 基本使用（连接本地Redis）
redis-key-analyzer scan

# 指定Redis连接参数
redis-key-analyzer scan --host 192.168.1.100 --port 6379 --db 0 --password your_password

# 只扫描特定模式的键
redis-key-analyzer scan --pattern "user:*"

# 指定输出文件名
redis-key-analyzer scan --output my_redis_analysis

# 使用Owner映射文件
redis-key-analyzer scan --owner-mapping owner_mapping.json

# 限制扫描的最大键数（适用于大型Redis）
redis-key-analyzer scan --max-keys 10000
```

### 2. 从已保存的扫描文件进行分析

如果已经有扫描生成的JSON文件，可以离线重新分析：

```bash
redis-key-analyzer analyze redis_analysis.json

# 使用自定义Owner映射重新分析
redis-key-analyzer analyze redis_analysis.json --owner-mapping new_mapping.json --output new_analysis
```

### 3. 初始化Owner映射配置文件

```bash
redis-key-analyzer init-mapping

# 指定输出文件名
redis-key-analyzer init-mapping --output my_owner_mapping.json
```
