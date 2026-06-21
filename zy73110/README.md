# 施工变更图纸复核

断断续续的材料也能拼出主线，版本再多也能揪出改口径的那份，关联材料找不到就坚决挂起。

## 快速上手（三步）

**第一步：跑第一批材料**
```bash
python3 review.py run --batch 1
```

**第二步：看 CSV 明细**
- `output/复核明细.csv` — 每份材料的当前状态、版本、有没有改过口径、关联缺失标注
- `output/历史轨迹.csv` — 每次变更的完整轨迹，谁在第几批改了什么
- `output/汇总信息.csv` — 整体进度和挂起原因

**第三步：补录后重跑**
```bash
python3 review.py run --batch 2
```
再看一眼 CSV，历史没断、口径变更一目了然。

## 验证"关联缺失挂起 → 补录恢复"

四步走，看 O-001（口头说明）指向 D-003（缺失图纸）：

```bash
# 1. 重置
python3 review.py reset

# 2. 跑第一批 → 整体挂起，因为 O-001 关联的 D-003 找不到
python3 review.py run --batch 1
# 看状态：整体"挂起"
# 看 output/复核明细.csv → O-001 备注"关联缺失 D-003，需确认"

# 3. 跑第二批 → 仍挂起，D-003 还没补
python3 review.py run --batch 2
# 看 output/复核明细.csv → O-001 仍标注关联缺失

# 4. 跑第三批补 D-003 → 恢复复核中
python3 review.py run --batch 3
# 看状态：整体"复核中"，O-001 的关联缺失标注自动消失
```

最后 `python3 review.py confirm --all`，全部材料变"已完成"。

## 常用命令

| 命令 | 作用 |
|------|------|
| `python3 review.py status` | 看当前复核状态 |
| `python3 review.py run --batch N` | 跑第 N 批材料 |
| `python3 review.py confirm --all` | 全部确认通过 |
| `python3 review.py confirm --suspension` | 解除挂起继续 |
| `python3 review.py export` | 重新导出三份 CSV |
| `python3 review.py reset` | 清空状态重来 |

## 材料包怎么放

材料放在 `materials/batch_XXX/` 目录下，支持 JSON 和 CSV 两种格式。

每份材料必须有：
- `material_id` — 材料编号
- `material_type` — 类型：`visa`(签证) / `drawing`(图纸) / `withdrawal`(撤回) / `oral`(口头)
- `version` — 版本号，数字
- `title` — 标题
- `content` — 内容
- `related_to` — （可选）关联的材料编号，有则必须真实存在，否则项目挂起

样例在 `materials/batch_001/materials.json`，照着改就行。

## 它会帮你盯什么

1. **口径有没有改** — 同一份材料内容变了会标出来，历史可追溯
2. **批次缺不缺** — 批次号不连续就挂起，不瞎给结论
3. **关联对不对得上** — 任意材料的 `related_to` 指向不存在就挂起，明细里标清楚缺谁
4. **撤回对不对得上** — 撤回记录关联的材料没找到就提醒，找到了给对方打备注
5. **状态不丢失** — 重启接着上一轮继续，CSV 明细和历史都在

## 输出文件都在 output/

| 文件 | 看什么 |
|------|--------|
| `复核明细.csv` | 每份材料最新状态概览，含关联缺失标注 |
| `历史轨迹.csv` | 每一次变更的完整流水 |
| `汇总信息.csv` | 整体进度、挂起原因 |
| `review_state.json` | 状态存档（别手改） |

---
*设计院助理阿宁专用，跑一遍就懂。*
