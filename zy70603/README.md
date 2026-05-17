# 图书馆预约队列逾期释放副本流转排查CLI

## 项目概述
本工具是学校图书馆预约队列管理系统的命令行工具，用于处理热门书籍的多人预约排队、逾期未取自动释放、教师优先借阅等核心业务规则。

## 核心功能
1. **排队锁定机制** - 预约成功后锁定书籍24小时，读者需在此期间取书
2. **身份优先级** - 教师优先级最高(100) > 职员(50) > 学生(10)
3. **逾期释放** - 锁定超时自动释放书籍，并记录读者逾期次数
4. **重复预约幂等** - 同一读者对同一本书的重复预约不会重复排队
5. **流转报告** - 生成人类可读和机器可读(JSON/CSV)两种格式的报告

## 文件结构
```
.
├── models.py              # 核心数据模型定义
├── reservation_engine.py  # 业务规则引擎
├── library_cli.py        # CLI命令行入口
├── samples/              # 样例测试数据
│   ├── normal/          # 正常输入场景
│   ├── dirty/           # 脏数据场景（用于校验）
│   ├── boundary/        # 边界冲突场景（10人竞争1本书）
│   └── empty/           # 空结果场景
└── README.md
```

## 数据格式说明

### readers.txt (读者数据)
```
reader_id, name, reader_type, department, overdue_count
R-001,张教授,teacher,计算机学院,0
```

### copies.txt (书籍副本数据)
```
copy_id, isbn, title, status, location
COPY-001,978-7-111-54493-7,深入理解计算机系统,available,A区-3架
```

### reservations.txt (预约数据)
```
reader_id, copy_id, note
R-001,COPY-001,张教授预约
```

### windows.txt (取书窗口数据)
```
window_id, start_time, end_time, location, max_capacity
WIN-001,2024-01-15T09:00:00,2024-01-15T12:00:00,一楼服务台,10
```

## 使用方法

### 1. 查看帮助
```bash
python3 library_cli.py --help
```

### 2. 查看指定书籍的预约队列
```bash
# 正常场景 - 查看COPY-001的队列
python3 library_cli.py --readers samples/normal/readers.txt \
                       --copies samples/normal/copies.txt \
                       --reservations samples/normal/reservations.txt \
                       --queue COPY-001

# 边界冲突场景 - 10人竞争同一本书的优先级排序
python3 library_cli.py --readers samples/boundary/readers.txt \
                       --copies samples/boundary/copies.txt \
                       --reservations samples/boundary/reservations.txt \
                       --queue COPY-HOT
```

### 3. 生成流转报告
```bash
# 同时生成人类可读和机器可读报告
python3 library_cli.py --readers samples/normal/readers.txt \
                       --copies samples/normal/copies.txt \
                       --reservations samples/normal/reservations.txt \
                       --report \
                       --json-out report.json \
                       --csv-out report.csv
```

### 4. 数据校验模式
```bash
python3 library_cli.py --readers samples/dirty/readers.txt \
                       --copies samples/dirty/copies.txt \
                       --validate
```

### 5. 处理逾期预约
```bash
python3 library_cli.py --process-expired --report
```

### 6. 空数据场景测试
```bash
python3 library_cli.py --readers samples/empty/readers.txt \
                       --copies samples/empty/copies.txt \
                       --reservations samples/empty/reservations.txt \
                       --report --json-out empty.json
```

## 验收检查清单

### ✅ 场景1: 正常输入
- [x] 队列正确按优先级排序
- [x] 教师排在学生前面
- [x] 预约总数统计正确
- [x] 人类可读报告格式清晰
- [x] 机器可读JSON数据完整

### ✅ 场景2: 边界冲突 (10人竞争同一本书)
- [x] 3位教师排在前3位
- [x] 7位学生按预约时间排序
- [x] 队列为10人，数据完整无遗漏

### ✅ 场景3: 脏数据校验
- [x] 空姓名被检测
- [x] 负逾期次数被检测
- [x] 空ISBN被检测
- [x] 空书名被检测
- [x] 错误提示清晰明确

### ✅ 场景4: 空结果
- [x] 系统能正常处理空数据
- [x] 报告显示各项为0
- [x] 无报错、无崩溃

### ✅ 核心机制验证
- [x] 教师优先级排序生效
- [x] 重复预约幂等性（同读者同书籍不重复排队）
- [x] 机器可读与人类可读数据一致性

## 运行验收测试
```bash
# 一键运行所有验收场景（如果创建了验收脚本）
chmod +x acceptance_test.sh
./acceptance_test.sh
```
