# 老年餐配送退餐管理系统（CLI版）

一个专为社区助餐点使用的命令行工具，帮助管理老人订餐、退餐、配送和政府补贴。

## 解决的问题

- **清晨才收到退餐电话，但厨房已经按昨天名单备餐了 → 系统自动检查退餐是否晚于截止时间，超期扣钱有记录。
- **重复导入订单 → 同一天同一位老人的同类型餐自动去重，不会备双份。
- **补贴资格变了怎么办？** → 记录补贴变更历史，订单按下单时的补贴计算。
- **异常退餐说不清楚** → 每条退餐都有拦截说明，为什么扣款、扣多少都清清楚楚。

## 系统会自动处理以下情况：

| 情况 | 处理方式 | 说明 |
|------|----------|------|
| 退餐晚于截止时间 | 按比例扣款 | 显示【异常拦截】警告 |
| 配送后再退餐 | 全额扣款（可配置） | 显示【异常拦截】警告 |
| 补贴资格变更 | 记录历史 | 新订单用新补贴，旧订单不变 |
| 同一天重复下单 | 自动去重 | 跳过重复，不报错 |
| 重复导入同一文件 | 自动去重 | 通过导入ID识别，不重复计算 |

## 一、首次使用

### 1. 安装（只需做一次）

打开终端（Command+空格，输入"终端"），运行：

```bash
cd /Users/lzy/pro/solo/workspaces/zy10228
pip3 install -r requirements.txt
```

### 2. 查看帮助

```bash
python3 elder-meal.py --help
```

## 二、日常使用流程

### 步骤1：设置系统配置（看一下就行，默认已配置好）

```bash
python3 elder-meal.py config list
```

默认配置：
- 退餐截止时间：用餐**前一天晚上 20:00
- 超时退餐扣款：50%
- 配送后退餐扣款：100%

如需修改（例如改成 18:00 截止）：

```bash
python3 elder-meal.py config set cancellation_deadline_time 18:00
```

### 步骤2：添加餐标（只需设置一次）

```bash
python3 elder-meal.py meal add --name "普通餐" --price 15 --subsidy 5 --desc "标准配置"
python3 elder-meal.py meal add --name "软食餐" --price 18 --subsidy 6 --desc "适合牙口不好"
python3 elder-meal.py meal list
```

### 步骤3：添加老人信息

```bash
python3 elder-meal.py elder add \
  --name "张三" \
  --phone "13800138001" \
  --id-card "110101195001011234" \
  --subsidy "普通补贴" \
  --address "幸福小区1号楼1单元101室" \
  --district "东区" \
  --route "路线A"
```

查看老人列表：

```bash
python3 elder-meal.py elder list
python3 elder-meal.py elder list --search "张"
```

### 步骤4：导入订单（每天下午导入明天的餐）

**方式一：批量导入（推荐）**

创建一个 CSV 文件 `orders.csv`：

```csv
老人姓名,身份证号,用餐日期,餐标
张三,110101195001011234,2026-05-12,普通餐
李四,,2026-05-12,软食餐
王五,110101195203045678,2026-05-12,普通餐
```

然后导入：

```bash
python3 elder-meal.py order import orders.csv
```

系统会显示：
- 成功导入几条
- 跳过几条重复的（同一天同一位老人的同类型餐）
- 失败几条（为什么失败）

**方式二：单条创建**

```bash
python3 elder-meal.py order create --elder-id 1 --meal-date 2026-05-12 --meal-plan-id 1
```

### 步骤5：查看订单

```bash
python3 elder-meal.py order list
python3 elder-meal.py order list --date 2026-05-12
python3 elder-meal.py order list --status "已下单"
```

### 步骤6：厨房备餐（每天早上看）

```bash
python3 elder-meal.py report kitchen --date 2026-05-12
```

显示：
- 总备餐数
- 各餐标数量
- 详细名单

**重要：已退餐的订单不计入备餐数！

### 步骤7：配送员路线

```bash
python3 elder-meal.py report routes --date 2026-05-12
```

按路线分组，每条路线列出：
- 配送顺序
- 配送地址
- 应收款金额

### 步骤8：登记送达

```bash
python3 elder-meal.py delivery record 1 "配送员小张" --receiver "张三本人"
```

参数说明：
- 第一个数：订单ID
- 第二个：配送员姓名

### 步骤9：登记收费

配送完成后，记录老人实际支付的金额：

```bash
python3 elder-meal.py payment record 1 10.0 --method 现金
python3 elder-meal.py payment record 2 12.0 --method 微信
```

参数说明：
- 第一个数：订单ID
- 第二个数：收费金额
- --method：支付方式（现金、微信、支付宝、银行卡、转账、其他）

**查看订单的收费记录：**

```bash
python3 elder-meal.py payment list 1
```

显示：
- 订单信息（老人、日期、餐标、应收金额）
- 已收金额（自动计算）
- 欠收/多收提示
- 收费明细（每一笔收款的时间、方式、金额）

### 步骤10：退餐处理（核心功能）

**登记退餐：**

```bash
python3 elder-meal.py cancel record 1 "身体不适"
```

退餐原因可选：
- 身体不适
- 外出
- 家人来访
- 不需要
- 其他

**系统会自动检查并显示：**

1. **是否晚于截止时间** → 显示【异常拦截】警告，扣款50%
2. **是否已配送** → 显示【异常拦截】警告，扣款100%
3. **是否已退过餐** → 提示"已退餐，无需重复操作"（无论订单状态是什么，都通过退餐记录检查去重）

**查看退餐记录：**

```bash
python3 elder-meal.py cancel list
python3 elder-meal.py cancel list --start 2026-05-01 --end 2026-05-31
```

### 步骤11：补贴资格变更

```bash
python3 elder-meal.py elder update-subsidy 1 "特殊补贴" --notes "高龄老人认证通过"
```

- 老人ID → 新补贴类型 → 变更说明

**重要：** 变更前的历史会被记录，变更后新订单用新补贴，已存在的订单不变。

### 步骤12：汇总报表

**退餐扣减汇总（月底对账用）：

```bash
python3 elder-meal.py report cancellations --start 2026-05-01 --end 2026-05-31
```

显示：
- 退餐总数
- 超时退餐数量（晚于截止）
- 配送后退餐数量
- 退款总额
- 扣款总额
- 按退餐原因统计

**政府补贴汇总（申请补贴用）：**

```bash
python3 elder-meal.py report subsidy --start 2026-05-01 --end 2026-05-31
```

显示：
- 总订单数
- 总补贴金额（按补贴类型分组）

## 三、常用命令速查

### 配置
| 命令 | 说明 |
|------|------|
| `python3 elder-meal.py config list` | 查看配置 |
| `python3 elder-meal.py config set <key> <value>` | 修改配置 |

### 老人管理
| 命令 | 说明 |
|------|------|
| `python3 elder-meal.py elder add --name "姓名" --phone "电话" ...` | 添加老人 |
| `python3 elder-meal.py elder list` | 查看老人列表 |
| `python3 elder-meal.py elder list --search "张"` | 搜索老人 |
| `python3 elder-meal.py elder update-subsidy <ID> "新补贴类型"` | 更新补贴 |

### 餐标管理
| 命令 | 说明 |
|------|------|
| `python3 elder-meal.py meal add --name "餐标名" --price 价格 --subsidy 补贴` | 添加餐标 |
| `python3 elder-meal.py meal list` | 查看餐标 |

### 订单管理
| 命令 | 说明 |
|------|------|
| `python3 elder-meal.py order import orders.csv` | 批量导入订单 |
| `python3 elder-meal.py order list` | 查看订单 |
| `python3 elder-meal.py order list --date 2026-05-12` | 按日期查订单 |

### 退餐管理
| 命令 | 说明 |
|------|------|
| `python3 elder-meal.py cancel record <订单ID> "退餐原因"` | 登记退餐 |
| `python3 elder-meal.py cancel list` | 查看退餐记录 |

### 配送管理
| 命令 | 说明 |
|------|------|
| `python3 elder-meal.py delivery record <订单ID> "配送员"` | 登记送达 |

### 报表
| 命令 | 说明 |
|------|------|
| `python3 elder-meal.py report kitchen --date 2026-05-12` | 厨房备餐汇总 |
| `python3 elder-meal.py report routes --date 2026-05-12` | 配送路线汇总 |
| `python3 elder-meal.py report cancellations --start ... --end ...` | 退餐扣减汇总 |
| `python3 elder-meal.py report subsidy --start ... --end ...` | 政府补贴汇总 |

## 四、数据文件位置

所有数据存在这里：`~/.elder_meal/elder_meal.db`

如需备份，复制这个文件即可。

## 五、示例场景

### 场景1：清晨才收到退餐电话

**问题：** 张三今天早上8点打电话说今天的餐不要了，但厨房已经备好了。

**操作：**

```bash
python3 elder-meal.py order list --date 2026-05-12
# 找到张三的订单ID（假设是 42）

python3 elder-meal.py cancel record 42 "身体不适"
```

**系统显示：**

```
✓ 成功处理退餐: 订单 42, 退款 5.00元, 扣款 5.00元

【异常拦截说明】
  ⚠ 【异常拦截】退餐时间 2026-05-12 08:00 晚于截止时间 - 用餐日期: 2026-05-12, 退餐截止时间: 2026-05-11 20:00
```

**解释：**
- 退餐时间是用餐当天早上8点
- 截止时间是用餐**前一天**晚上8点（20:00）
- 超时了，扣款50%
- 退款5元（原价10元，补贴5元）

### 场景2：配送员送完餐了，老人说不要了

**操作：**

```bash
python3 elder-meal.py cancel record 43 "不需要"
```

**系统显示：**

```
✓ 成功处理退餐: 订单 43, 退款 0.00元, 扣款 10.00元

【异常拦截说明】
  ⚠ 【异常拦截】订单 43 已送达，禁止退餐或需全额扣款 - 配送员: 小王, 送达时间: ...
```

### 场景3：重复导入同一份CSV

**操作：**

```bash
# 第一次导入：
python3 elder-meal.py order import orders.csv
# 成功导入 10 条

# 不小心又导入了一次：
python3 elder-meal.py order import orders.csv
# 跳过 10 条重复记录
```

系统自动识别，不会重复下单。

### 场景4：老人补贴变了

**操作：**

```bash
python3 elder-meal.py elder list
# 张三 ID 1 的补贴从"普通补贴"改成"特殊补贴"

python3 elder-meal.py elder update-subsidy 1 "特殊补贴"
```

**效果：**
- 历史订单不变（用的是之前的补贴）
- 新订单用新补贴
- 变更记录被保存

## 六、常见问题

### Q: 订单导入失败，系统说"未找到老人"？
A: 请先用 `elder add` 添加老人信息，或者检查姓名/身份证号是否正确。

### Q: 退餐扣款比例可以改吗？
A: 可以。修改配置：
```bash
python3 elder-meal.py config set deduction_after_deadline_rate 0.3
# 改成30%扣款
```

### Q: 数据存在哪里？可以备份吗？
A: 在 `~/.elder_meal/elder_meal.db`。直接复制这个文件就是备份。

### Q: 一条订单多次退餐怎么办？
A: 系统会检测到，提示"已退餐，无需重复操作"。无论订单状态如何，只要有退餐记录就会拦截。

### Q: 同一天同一位老人订了两餐？
A: 系统自动去重，第二餐会被跳过。

## 七、快速开始（给新手上路）

```bash
# 1. 查看帮助
python3 elder-meal.py --help

# 2. 添加餐标
python3 elder-meal.py meal add --name "普通餐" --price 15 --subsidy 5

# 3. 添加老人
python3 elder-meal.py elder add --name "测试老人" --subsidy "普通补贴" --address "测试地址"

# 4. 导入订单（创建 CSV 然后）
python3 elder-meal.py order import orders.csv

# 5. 看备餐
python3 elder-meal.py report kitchen

# 6. 登记送达
python3 elder-meal.py delivery record 1 "配送员小王"

# 7. 登记收费
python3 elder-meal.py payment record 1 10.0 --method 现金

# 8. 查看收费记录
python3 elder-meal.py payment list 1

# 9. 退餐
python3 elder-meal.py cancel record 1 "身体不适"

# 10. 看报表
python3 elder-meal.py report cancellations
python3 elder-meal.py report subsidy
```

---

**有问题？先看 `--help`，每条命令都有详细说明。
