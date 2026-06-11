# 施工变更图纸复核

断断续续的材料也能拼出主线，版本再多也能揪出改口径的那份。

## 快速上手（三步）

**第一步：跑第一批材料**
```bash
python review.py run --batch 1
```

**第二步：看 CSV 明细**
- `output/复核明细.csv` — 每份材料的当前状态、版本、有没有改过口径
- `output/历史轨迹.csv` — 每次变更的完整轨迹，谁在第几批改了什么
- `output/汇总信息.csv` — 整体进度和挂起原因

**第三步：补录后重跑**
```bash
python review.py run --batch 2
```
再看一眼 CSV，历史没断、口径变更一目了然。

## 常用命令

| 命令 | 作用 |
|------|------|
| `python review.py status` | 看当前复核状态 |
| `python review.py run --batch N` | 跑第 N 批材料 |
| `python review.py confirm --all` | 全部确认通过 |
| `python review.py confirm --suspension` | 解除挂起继续 |
| `python review.py export` | 重新导出三份 CSV |
| `python review.py reset` | 清空状态重来 |

## 材料包怎么放

材料放在 `materials/batch_XXX/` 目录下，支持 JSON 和 CSV 两种格式。

每份材料必须有：
- `material_id` — 材料编号
- `material_type` — 类型：`visa`(签证) / `drawing`(图纸) / `withdrawal`(撤回) / `oral`(口头)
- `version` — 版本号，数字
- `title` — 标题
- `content` — 内容

样例在 `materials/batch_001/materials.json`，照着改就行。

## 它会帮你盯什么

1. **口径有没有改** — 同一份材料内容变了会标出来，历史可追溯
2. **批次缺不缺** — 批次号不连续就挂起，不瞎给结论
3. **撤回对不对得上** — 撤回记录关联的材料没找到就提醒
4. **状态不丢失** — 重启接着上一轮继续，CSV 明细一直都在

## 输出文件都在 output/

| 文件 | 看什么 |
|------|--------|
| `复核明细.csv` | 每份材料最新状态概览 |
| `历史轨迹.csv` | 每一次变更的完整流水 |
| `汇总信息.csv` | 整体进度、挂起原因 |
| `review_state.json` | 状态存档（别手改） |

---
*设计院助理阿宁专用，跑一遍就懂。*
