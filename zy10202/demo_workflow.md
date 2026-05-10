# 小剧场排练场地冲突 CLI 演示流程

## 1. 初始化基础数据
```bash
python3 init_data.py
```
- 创建 3 个排练厅（一号、二号、三号）
- 创建 3 个设备包（灯光、音响、多媒体）
- 创建 4 个剧组联系人

## 2. 导入预约数据
```bash
python3 theater-cli import demo_data.json
```
- 导入 4 个预约
- 自动检测跨午夜排练（《暗恋桃花源》22:00-02:00）
- 通过 import_hash 去重

## 3. 检查冲突
```bash
python3 theater-cli check
```
会发现：
- **排练厅冲突**：《雷雨》14:00-18:00 与 《茶馆》17:00-21:00 在一号厅重叠
- **设备冲突**：两者都使用了灯光设备包，时段重叠

## 4. 查看冲突清单
```bash
python3 theater-cli report conflicts
```

## 5. 人工修正（改期）
```bash
python3 theater-cli fix --booking-id b002 reschedule \
  --new-start "2026-05-13 14:00" \
  --new-end "2026-05-13 18:00" \
  --reason "与《雷雨》剧组时间冲突，导演协调后改期"
```

## 6. 再次检查确认无冲突
```bash
python3 theater-cli check
```
输出："所有检查通过，未发现异常"

## 7. 查看改期历史
```bash
python3 theater-cli report reschedule
```
显示：
- 原时段: 2026-05-12 17:00 - 2026-05-12 21:00
- 新时段: 2026-05-13 14:00 - 2026-05-13 18:00
- 原因: 与《雷雨》剧组时间冲突，导演协调后改期

## 8. 领取钥匙
```bash
python3 theater-cli key pickup --booking-id b001 --contact-id c001
```

## 9. 测试钥匙保护（尝试删除已领钥匙的预约）
```bash
python3 theater-cli fix --booking-id b001 delete
```
输出："该预约已有钥匙领取记录，无法直接删除。请先处理钥匙领取记录。"

## 10. 最终确认预约
```bash
python3 theater-cli confirm b001
```

## 11. 查看可排时段
```bash
python3 theater-cli report available --start 2026-05-12 --end 2026-05-14
```

## 12. 查看本周排练表
```bash
python3 theater-cli report weekly --start 2026-05-11
```

---

## 特殊情况处理说明

### 跨午夜排练
- 自动检测并标记 🌙 图标
- 冲突检测时正确拆分多天时段进行比较

### 设备冲突
- 同一设备包不能在重叠时段被多个预约使用
- 即使在不同排练厅也会检测到

### 重复导入
- 通过 import_hash（room_id + start_time + end_time + contact_id 的 MD5）去重
- 重复提交不会重复计算

### 钥匙领取保护
- 已有钥匙领取记录的预约无法直接删除
- 需要先归还钥匙才能删除预约

### 取消后重新导入
- 取消的预约状态为 "cancelled"，冲突检测会忽略
- 重新导入同一条记录会被检测为重复（import_hash 相同）
