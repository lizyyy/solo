# 城市树池破损巡检系统

从"临时拼接"中解耦出来的标准化巡检流程管理系统。

---

## 快速开始

### 环境要求
- Python 3.7+
- 无第三方依赖（仅使用标准库）

### 核心文件

| 文件 | 说明 |
|------|------|
| [models.py](file:///Users/lzy/pro/solo/workspaces/zy72463/models.py) | 数据模型定义 |
| [storage.py](file:///Users/lzy/pro/solo/workspaces/zy72463/storage.py) | JSON文件存储 |
| [service.py](file:///Users/lzy/pro/solo/workspaces/zy72463/service.py) | 核心业务逻辑 |
| [cli.py](file:///Users/lzy/pro/solo/workspaces/zy72463/cli.py) | 命令行接口 |
| [BOUNDARY_RULES.md](file:///Users/lzy/pro/solo/workspaces/zy72463/BOUNDARY_RULES.md) | 边界规则文档 |

---

## 三步标准工作流

### 第1步：导入居民投诉编号
```bash
python cli.py import-complaints --ids C001,C002 --intersection "中山路与人民路交叉口" --description "树池破损，行人绊倒风险" --by "system"
```
或从 JSON 文件批量导入：
```bash
python cli.py import-complaints --file complaints.json
```

### 第2步：街道规划员小姜补看路口照片
```bash
python cli.py add-photo --complaint C001 --file "photos/C001路口_20260607.jpg" --remark "树池边缘破损约30cm" --by "xiaojiang"
```

### 第3步：更新整改建议
```bash
python cli.py update-suggestion --complaint C001 --suggestion "建议更换树池边缘石，重新铺设步道砖" --by "xiaojiang"
```

---

## 关键场景操作

### 场景1：坡道补录后评分没变化

```bash
# 先设置初始评分
python cli.py update-score --complaint C001 --score 7.5 --by "xiaojiang"

# 补录坡道，但评分不变（自动标记需复核）
python cli.py add-ramp --complaint C001 --location "路口西南角坡道" --description "坡道表面磨损" --score 7.5 --by "xiaojiang"
```

**系统自动处理：**
- 状态变为 `needs_review`
- 出现在待复核列表中

### 场景2：交通协管复核

```bash
# 查看待复核列表
python cli.py list --needs-review

# 执行复核（可调整评分）
python cli.py review --complaint C001 --result "确认评分合理，坡道磨损不影响通行" --by "traffic_assistant_01"

# 或调整评分
python cli.py review --complaint C001 --result "坡道实际更严重，调整评分" --score 6.0 --by "traffic_assistant_01"
```

### 场景3：修改备注并查看历史差异

```bash
# 修改备注
python cli.py update-remark --complaint C001 --remark "树池破损约50cm，比初查更严重" --by "xiaojiang"

# 查看历史变更（能看到改前改后）
python cli.py history --complaint C001
```

### 场景4：回滚操作

```bash
# 先查看历史找到 change_id
python cli.py history --complaint C001

# 回滚指定变更
python cli.py rollback --complaint C001 --change chg_abc123 --by "system"
```

### 场景5：重复导入不翻倍

```bash
# 第一次导入
python cli.py import-complaints --ids C001

# 第二次导入同一批（C001会被跳过，不重复创建）
python cli.py import-complaints --ids C001,C002
# 输出: 导入完成: 新增 1 条, 跳过 1 条
```

### 场景6：生成可重放命令（复盘）

```bash
# 查看该记录所有操作的可重放命令
python cli.py replay --complaint C001
```

输出示例：
```
可重放命令 - C001:
  1. python cli.py import-complaints --ids C001
  2. python cli.py add-photo --complaint C001 --file photos/C001路口_20260607.jpg
  3. python cli.py update-remark --complaint C001 --remark '树池破损约50cm'
  4. python cli.py update-score --complaint C001 --score 7.5
  5. python cli.py add-ramp --complaint C001 --location '路口西南角坡道' --score 7.5
```

---

## 常用命令一览

| 命令 | 说明 |
|------|------|
| `python cli.py list` | 列出所有巡检记录 |
| `python cli.py list --needs-review` | 只看待复核的 |
| `python cli.py show --complaint C001` | 查看单条详情 |
| `python cli.py history --complaint C001` | 查看历史变更 |
| `python cli.py replay --complaint C001` | 生成可重放命令 |

---

## 数据存储

数据以 JSON 格式存储在 `data/inspections.json` 文件中。

### 数据结构溯源（3D/图表展示时可用）

```
TreePoolInspection (巡检记录)
├── complaint_id → 居民投诉编号
├── complaint → ResidentComplaint (投诉详情)
│   ├── intersection → 路口
│   └── description → 投诉描述
├── photos → [IntersectionPhoto] (路口照片列表)
│   ├── file_path → 照片文件路径
│   └── remark → 照片备注
└── history → [ChangeRecord] (完整变更历史)
```

---

## 边界规则

完整边界规则请参阅 [BOUNDARY_RULES.md](file:///Users/lzy/pro/solo/workspaces/zy72463/BOUNDARY_RULES.md)，包含：
1. 导入去重规则
2. 三步工作流规则
3. 坡道补录评分无变化处理规则
4. 备注历史追踪规则
5. 回滚规则
6. 3D/图表展示数据溯源规则
7. 可复盘与可重放规则
8. 状态机完整规则
9. 数据一致性规则

---

## 运行测试

```bash
python test_inspection.py
```

测试覆盖所有核心场景：
- 导入去重
- 三步工作流状态流转
- 坡道补录评分不变触发复核
- 备注修改历史追踪
- 回滚机制
- 可重放命令生成
