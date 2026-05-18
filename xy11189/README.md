# 户外广告安装队广告施工证照 CLI 数据清洗工具

专门用于户外广告安装队广告施工证照数据的清洗工具，自动分离正常记录和异常记录，方便人工复核。

## 功能特性

- ✅ 正常记录与异常记录分离输出
- ✅ 保险过期、临时工、可复跑标记时继续处理并记录原因
- ✅ 默认规则配置，缺配置时也能运行
- ✅ 详细的处理日志记录
- ✅ 支持批量处理CSV文件

## 快速开始

### 安装依赖

```bash
npm install
```

### 运行清洗

使用默认样例数据：

```bash
npm test
```

或指定自定义目录：

```bash
npm run clean -- --input /path/to/input --output /path/to/output
```

## 目录结构

```
.
├── bin/                    # CLI入口
├── config/
│   └── rules.json         # 清洗规则配置
├── samples/
│   ├── input/             # 输入样例
│   │   ├── 01_normal_data.csv    # 正常数据
│   │   └── 02_dirty_data.csv     # 脏数据
│   ├── output/            # 输出目录（自动生成）
│   └── retry_reference/   # 重跑对照参考
└── src/                   # 核心代码
```

## 清洗规则

### 必填字段校验
- teamName（安装队名称）
- licenseNumber（证照编号）
- licenseType（证照类型）
- issueDate（发证日期）
- expiryDate（有效期至）
- insuranceExpiry（保险到期日）
- workerType（用工类型）

### 允许的证照类型
- 户外广告安装资质
- 高空作业证
- 电工证
- 焊工证

### 允许的用工类型
- 正式工
- 合同工

### 特殊处理规则（可配置）
以下情况会记录警告但继续处理：
- INSURANCE_EXPIRED：保险过期
- TEMP_WORKER：临时工
- RETRY_RECORD：可复跑标记

## 输出文件

### normal_records.csv
通过所有校验的正常记录，包含警告信息列。

### abnormal_records.csv
异常记录，包含以下字段：
- errorType：错误类型（VALIDATION_ERROR / WARNING_BLOCKED）
- errorMessages：具体错误信息
- processTime：处理时间

### process.log
详细处理日志，包含时间、级别、来源文件、记录标识和消息。

## 自定义配置

修改 [config/rules.json](file:///Users/mac/pro/solo/workspaces/xy11189/config/rules.json) 自定义清洗规则：

```json
{
  "insuranceExpiryDays": 30,
  "allowedWorkerTypes": ["正式工", "合同工"],
  "skipOnErrors": ["INSURANCE_EXPIRED", "TEMP_WORKER"]
}
```
