# 护理站排班校验 API

## 项目概述
解决护理站导入混乱问题：护士排班、老人护理项目和临时取消统一校验，自动分类正常项、待确认项、失败项。

## 核心功能
1. **数据导入**：支持服务单CSV、护士日历JSON、老人档案CSV
2. **规则引擎**：
   - 技能匹配校验（技能名称+等级）
   - 跨区路程预警
   - 时间冲突检查
   - 取消补位检查
3. **批次去重**：同一批材料再次提交不重复生效
4. **结果分类**：正常项、待确认项、失败项（保留原始字段+处理建议）

## 快速开始

### 1. 环境要求
- Go 1.18+
- 网络连接（下载依赖）

### 2. 安装与运行
```bash
cd /Users/lzy/pro/solo/workspaces/zy70917

# 安装依赖
go mod tidy

# 编译
go build -o nursing-scheduler .

# 启动服务
./nursing-scheduler
```
服务启动在 `http://localhost:8080`

### 3. 一键复跑命令
**每次运行只需执行以下命令：**
```bash
cd /Users/lzy/pro/solo/workspaces/zy70917 && go build -o nursing-scheduler . && ./nursing-scheduler
```

---

## API 接口

### 上传并校验数据
```bash
curl -X POST http://localhost:8080/api/upload \
  -H "Content-Type: application/json" \
  -d '{
    "ServiceOrders": "服务单CSV内容",
    "NurseCalendar": "护士日历JSON内容",
    "ElderProfiles": "老人档案CSV内容"
  }'
```

### 查询批次结果
```bash
curl http://localhost:8080/api/result/{batch_id}
```

### 列出所有批次
```bash
curl http://localhost:8080/api/batches
```

---

## 测试数据说明

### 项目结构
```
.
├── main.go                  # 主程序（单文件完整实现）
├── go.mod                   # Go模块依赖
├── go.sum                   # 依赖校验和
├── nursing-scheduler        # 编译后的可执行文件
├── testdata/                # 测试数据目录
│   ├── service_orders.csv   # 服务单（5条测试数据）
│   ├── nurse_calendar.json  # 护士日历（3名护士）
│   └── elder_profiles.csv   # 老人档案（5位老人）
└── README.md                # 本文档
```

### 测试数据场景

**服务单 testdata/service_orders.csv**
| 单号 | 场景 | 预期结果 |
|------|------|----------|
| SO001 | 张护士+基础护理+朝阳区 | 待确认（技能匹配但跨区） |
| SO002 | 张护士+压疮护理+东城区 | 正常（技能+区域匹配） |
| SO003 | 李护士+康复治疗+西城区 | 正常（技能+区域匹配） |
| SO004 | 王护士+输液护理+海淀区 | 待确认（护士当日不可用） |
| SO005 | 李护士+临终关怀+朝阳区 | 待确认（取消无补位+跨区） |

**护士日历 testdata/nurse_calendar.json**
- N001 张护士：东城区，技能=基础护理(basic)/压疮护理(advanced)/日常照料
- N002 李护士：西城区，技能=基础护理/康复治疗(advanced)/临终关怀(basic)
- N003 王护士：海淀区，技能=基础护理/输液护理(intermediate)

**老人档案 testdata/elder_profiles.csv**
- E001-E005：五位不同区域和健康等级的老人

---

## 规则说明

| 规则代码 | 规则名称 | 分类 | 说明 |
|---------|---------|------|------|
| SKILL_MISMATCH | 技能不匹配 | 失败 | 护士完全不具备所需技能 |
| SKILL_LEVEL_INSUFFICIENT | 技能等级不足 | 待确认 | 护士技能等级低于要求 |
| CROSS_DISTRICT | 跨区域服务 | 待确认 | 护士跨区服务需预留路程时间 |
| TIME_CONFLICT | 时间冲突 | 待确认 | 服务时间与已有排班重叠 |
| NURSE_UNAVAILABLE | 护士当日不可用 | 失败 | 护士当天不上班 |
| CANCELLATION_NO_BACKUP | 取消无补位 | 待确认 | 取消后无同技能同区域备用护士 |

---

## 验证核心规则

### 启动服务后运行测试
```bash
cd /Users/lzy/pro/solo/workspaces/zy70917 && python3 << 'PYTEST'
import json
import requests

# 读取测试数据
with open('testdata/service_orders.csv') as f:
    so = f.read()
with open('testdata/nurse_calendar.json') as f:
    nc = f.read()
with open('testdata/elder_profiles.csv') as f:
    ep = f.read()

# 上传数据
r = requests.post('http://localhost:8080/api/upload', json={
    'ServiceOrders': so,
    'NurseCalendar': nc,
    'ElderProfiles': ep
})
result = r.json()

print(f"批次ID: {result['batch_id']}")
print(f"是否重复: {result['is_duplicate']}")
print()

res = result['result']
s = res['Summary']
print(f"=== 处理结果 ===")
print(f"总数: {s['TotalCount']}")
print(f"正常: {s['NormalCount']}")
print(f"待确认: {s['PendingCount']}")
print(f"失败: {s['FailedCount']}")
print()

print("=== 正常项 ===")
for item in res['Normal']:
    print(f"  {item['OriginalID']}: {item['Data'].get('服务类型')}")
print()

print("=== 待确认项（含规则说明）===")
for item in res['Pending']:
    print(f"  {item['OriginalID']}:")
    for w in item['Data']['warnings']:
        print(f"    [{w['RuleCode']}] {w['RuleName']}: {w['Detail']}")
    print(f"    -> 建议: {', '.join(item['Data']['suggestions'])}")
print()

print("=== 失败项（含原始数据+处理建议）===")
for item in res['Failed']:
    print(f"  {item['OriginalID']}:")
    for f in item['FailureReasons']:
        print(f"    [{f['RuleCode']}] {f['RuleName']}: {f['Detail']}")
    print(f"    -> 建议: {', '.join(item['Suggestions'])}")
PYTEST
```

---

## 注意事项
1. **批次去重**：基于文件内容MD5校验和，相同内容重复提交直接返回历史结果
2. **失败项保留**：失败项保留完整原始数据，便于人工核对
3. **可读说明**：所有规则都有中文人性化说明，非技术人员也能理解
4. **可扩展**：规则引擎采用模块化设计，新增规则只需添加检查函数

---

## 常见问题

**Q: 如何添加新的校验规则？**
A: 在 RuleEngine 结构体中添加新的 checkXxx 方法，在 ValidateServiceOrder 中调用即可。

**Q: 如何修改路程时间？**
A: 修改 NewRuleEngine() 中的 districtDistance 映射。

**Q: 数据保存在哪里？**
A: 当前版本为内存存储，重启服务数据清空。如需持久化，请扩展 BatchStorage。
