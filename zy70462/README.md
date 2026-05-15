# 日志脱敏验证命令行工具

基于 Node.js 的日志脱敏验证命令行工具，支持材料验证、历史查询、候选清单管理、人工确认等功能。

## 功能特性

- ✅ **材料验证**: 自动检测敏感数据（手机号、身份证、邮箱、银行卡号、姓名）
- ✅ **下载链接失效检测**: 识别过期/失效的下载链接作为失败路径
- ✅ **统一查询入口**: 成功路径和异常/失败路径在同一查询结果中展示
- ✅ **候选清单机制**: 清理/回滚操作前生成候选清单，避免误伤真实数据
- ✅ **持久化存储**: SQLite本地存储，重启后历史记录依然可查
- ✅ **内容去重**: 同一批内容再次提交时复用旧结论或提示冲突
- ✅ **历史过滤**: 支持按批次、操作者、风险类型过滤查询
- ✅ **人工确认**: 财务结转表等重要材料需要人工确认
- ✅ **摘要搜索**: 支持按文件摘要关键词过滤查询结果

## 安装

```bash
npm install
```

## 使用方法

### 1. 提交验证批次

```bash
node src/cli.js submit

# 或使用材料文件
node src/cli.js submit -f tests/sample-materials.json

# 或带参数
node src/cli.js submit -n "灰度夜间巡检-20240115" -o "admin" -r "high"
```

### 2. 查询批次详情

```bash
node src/cli.js query <batchId>
```

### 3. 查询历史记录

```bash
# 全部历史
node src/cli.js history

# 按操作者过滤
node src/cli.js history -o admin

# 按风险类型过滤
node src/cli.js history -r high

# 按状态过滤
node src/cli.js history -s completed
```

### 4. 生成候选清单

```bash
# 清理候选清单（包含失败的验证结果）
node src/cli.js candidate <batchId> cleanup

# 回滚候选清单（包含成功的验证结果）
node src/cli.js candidate <batchId> rollback
```

### 5. 执行候选清单

```bash
node src/cli.js execute <candidateListId>
```

### 6. 搜索查询

```bash
# 按文件摘要关键词搜索
node src/cli.js search --summary "财务"

# 查看待人工确认项目
node src/cli.js search --pending
```

### 7. 人工确认

```bash
node src/cli.js confirm <resultId>
```

### 8. 查看帮助

```bash
node src/cli.js --help
```

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 运行测试脚本
npm test

# 3. 提交第一个验证批次（使用示例数据）
node src/cli.js submit -f tests/sample-materials.json

# 4. 查看历史记录
node src/cli.js history

# 5. 查看批次详情（使用上一步返回的batchId）
node src/cli.js query <batchId>

# 6. 按文件摘要搜索财务相关材料
node src/cli.js search --summary "财务"

# 7. 查看待人工确认项目
node src/cli.js search --pending
```

## 项目结构

```
.
├── src/
│   ├── cli.js              # 命令行入口
│   ├── database/
│   │   ├── init.js         # 数据库初始化
│   │   └── db.js           # 数据访问层
│   └── utils/
│       ├── hash.js         # 哈希和摘要工具
│       ├── validator.js    # 脱敏验证逻辑
│       └── service.js      # 核心业务服务
├── tests/
│   ├── test.js             # 测试脚本
│   └── sample-materials.json  # 示例材料数据
├── data/                   # SQLite数据库文件目录
├── package.json
└── README.md
```

## 敏感数据检测模式

- **手机号**: 1[3-9]\d{9}
- **身份证**: 18/15位身份证号格式
- **邮箱**: 标准邮箱格式
- **银行卡号**: 16-19位数字
- **姓名**: 中文姓名格式（含"姓名:"等前缀）

## 注意事项

1. 财务结转表等重要材料需要人工确认
2. 下载链接包含 "expired"、"过期" 等关键词会被判定为失效
3. 候选清单执行前建议人工审核，避免误操作
4. 数据存储在本地 SQLite 数据库文件中，注意备份
