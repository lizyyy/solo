# 压缩包差异报告管理工具

面向运维的变更追踪工具，把变更单、人工确认和操作记录串起来，核心证据全部持久化存储。

---

## 核心设计原则

1. **证据不丢**：所有操作全部落地成JSON文件，不在内存里飘着
2. **宁严勿滥**：可疑记录一律标「待确认」，绝不混进正常结果
3. **口径一致**：导入、撤回、筛选、导出用同一套状态流转规则
4. **操作留痕**：谁改了什么、什么时候改的、为什么改，全留账本

---

## 快速开始

```bash
# 看帮助
./diff-report --help

# 看命令详情
./diff-report import --help
```

---

## 标准工作流

### 第一步：注册变更单

每次变更先建单，所有差异记录都要关联变更单：

```bash
./diff-report order \
  -o CHG20260531001 \
  -t "支付网关v2.3.1升级" \
  -a 张三 \
  -m "替换底层加密算法，涉及12个so文件" \
  -s v2.3.1
```

参数说明：
- `-o` 变更单号（必填）
- `-t` 变更标题（必填）
- `-a` 申请人（必填）
- `-m` 变更描述
- `-s` 来源标识，比如版本号

### 第二步：导入差异

从压缩包批量导入：

```bash
./diff-report import \
  -z /path/to/payment-v2.3.1.zip \
  -s v2.3.1 \
  -o CHG20260531001 \
  -p 李四
```

导入时自动检测异常，碰到以下情况自动标「待确认」：
- ✅ 路径含空格
- ✅ 同一来源重复导入同一文件
- ✅ MD5校验不匹配（人工录入时）

**看到 `! [待确认]` 标记的记录，必须人工处理！**

### 第三步：人工确认

处理待确认记录：

```bash
# 看所有待确认的
./diff-report list --status 待确认

# 确认没问题
./diff-report confirm \
  -i rec_xxx \
  -c 王五 \
  -r 正常 \
  -m "路径空格是Windows遗留，不影响"

# 确认有问题
./diff-report confirm \
  -i rec_yyy \
  -c 王五 \
  -r 异常 \
  -m "MD5对不上，疑似被篡改"
```

### 第四步：导出报告

按条件筛选后导出：

```bash
# 导出全部
./diff-report export -o report.csv

# 只导出待确认的
./diff-report export -o pending.csv --status 待确认

# 按变更单导出
./diff-report export -o chg001.csv --order-id CHG20260531001

# 按来源导出
./diff-report export -o v2.3.1.csv --source v2.3.1
```

---

## 其他常用操作

### 人工补录

```bash
./diff-report add \
  -f "/opt/app/config.properties" \
  -t 修改 \
  -s manual \
  -o CHG20260531001 \
  -p 李四 \
  -m "手动修改配置项，漏打了变更包"
```

### 撤回记录

```bash
./diff-report withdraw \
  -i rec_xxx \
  -p 李四 \
  -r "导错版本了，重新来"
```

### 标记回滚

```bash
./diff-report rollback \
  -i rec_xxx \
  -p 李四 \
  -r "升级失败，已回滚到旧版本"
```

### 更新备注

```bash
./diff-report remark \
  -i rec_xxx \
  -p 王五 \
  -m "已和开发确认，这个文件变更正常"
```

### 看详情和历史

```bash
./diff-report detail -i rec_xxx
```

能看到：
- 基本信息
- 关联的变更单
- 完整操作历史（导入、确认、撤回、回滚...）

### 看统计汇总

```bash
./diff-report summary
```

---

## 数据存储结构

所有数据存在 `./data` 目录，按类型分文件夹：

```
data/
├── records/    # 差异记录（每个记录一个JSON）
├── orders/     # 变更单
├── logs/       # 操作日志（每条操作一个JSON）
└── confirms/   # 人工确认记录
```

**重要：别删这些文件！这就是账本！**

---

## 异常场景说明

| 异常类型 | 触发条件 | 处理方式 |
|---------|---------|---------|
| 路径含空格 | 文件路径里有空格 | 标待确认，人工判断是否影响 |
| 重复执行 | 同一来源(source)导入同一文件 | 标待确认，防止重复打变更搞乱结果 |
| 文件不匹配 | 录入的MD5和实际文件MD5不一致 | 标待确认，防止报告和真实文件对不上 |

> 设计思路：**宁可多待确认，也不让可疑记录混进正常结果里**。

---

## 状态流转

```
待确认 ──人工确认──> 正常
              │
              └───> 异常
正常 ──撤回──> 已撤回
正常 ──回滚──> 已回滚
```

---

## 文件清单

| 文件 | 说明 |
|------|------|
| [diff-report](file:///Users/lzy/pro/solo/workspaces/zy71998/diff-report) | 命令行入口 |
| [diff_report/models.py](file:///Users/lzy/pro/solo/workspaces/zy71998/diff_report/models.py) | 数据模型 |
| [diff_report/storage.py](file:///Users/lzy/pro/solo/workspaces/zy71998/diff_report/storage.py) | 持久化存储 |
| [diff_report/manager.py](file:///Users/lzy/pro/solo/workspaces/zy71998/diff_report/manager.py) | 核心业务逻辑 |
| [diff_report/exporter.py](file:///Users/lzy/pro/solo/workspaces/zy71998/diff_report/exporter.py) | 导出功能 |
| [diff_report/cli.py](file:///Users/lzy/pro/solo/workspaces/zy71998/diff_report/cli.py) | 命令行接口 |
