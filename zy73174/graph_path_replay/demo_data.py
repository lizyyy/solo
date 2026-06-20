from __future__ import annotations

import csv
import io
from pathlib import Path


class DirtyDemoDataset:
    """构建一组"不太干净"的演示数据，包含：
    - 边界样本（参数越界、难题参数不足、超长参数等）
    - 排序不稳定（多个题目共享相同 sort_key）
    - 跳过行（草稿/归档、匹配跳过规则）
    - 坏行（缺失必填字段、参数格式错误）
    - 带历史备注和旧版本截图的题目
    """

    COLUMNS = [
        "question_id", "title", "path_params", "tags", "sort_key",
        "remark", "remark_author", "remark_note",
        "screenshots", "screenshot_author", "status",
    ]

    def __init__(self):
        self.rows: list[dict] = []
        self._build()

    def _build(self) -> None:
        r = self.rows

        r.append({
            "question_id": "GRAPH-001",
            "title": "最短路径入门题",
            "path_params": "start=1;end=100;weight=2.5;depth=5",
            "tags": "easy,basic",
            "sort_key": 1,
            "remark": "2025-03初始版本，路径方向需核对",
            "remark_author": "xiaomeng",
            "remark_note": "初版录入",
            "screenshots": "s3://graph-snap/v1/GRAPH-001-v1.png|s3://graph-snap/v1/GRAPH-001-v1-case2.png",
            "screenshot_author": "qa-team",
            "status": "active",
        })

        r.append({
            "question_id": "GRAPH-002",
            "title": "Dijkstra 进阶应用",
            "path_params": "start=5;end=50;weight=3.1;k=10;limit=-1",
            "tags": "medium,dijkstra",
            "sort_key": 2,
            "remark": "数据小孟补的边界说明，k=10时需要特殊处理",
            "remark_author": "xiaomeng",
            "remark_note": "复核时追加备注",
            "screenshots": "s3://graph-snap/v2/GRAPH-002-after-fix.png",
            "screenshot_author": "qa-team",
            "status": "active",
        })

        r.append({
            "question_id": "GRAPH-003",
            "title": "边界样本：参数越界",
            "path_params": "start=0;end=99999;weight=999999;depth=-5",
            "tags": "hard,boundary",
            "sort_key": 3,
            "remark": "故意留的越界参数用于测试异常检测",
            "remark_author": "duty",
            "remark_note": "演示数据-边界样例",
            "screenshots": "",
            "screenshot_author": "",
            "status": "active",
        })

        r.append({
            "question_id": "GRAPH-004",
            "title": "排序不稳定-A题",
            "path_params": "nodes=20;edges=50;seed=42",
            "tags": "medium",
            "sort_key": 5,
            "remark": "与 GRAPH-005/006 使用相同 sort_key=5，测试不稳定排序",
            "remark_author": "qa",
            "remark_note": "同组排序键-1",
            "screenshots": "s3://graph-snap/v1/GRAPH-004.png",
            "screenshot_author": "qa",
            "status": "active",
        })

        r.append({
            "question_id": "GRAPH-005",
            "title": "排序不稳定-B题",
            "path_params": "nodes=25;edges=55;seed=42",
            "tags": "medium",
            "sort_key": 5,
            "remark": "与 GRAPH-004/006 使用相同 sort_key=5，测试不稳定排序",
            "remark_author": "qa",
            "remark_note": "同组排序键-2",
            "screenshots": "s3://graph-snap/v1/GRAPH-005.png",
            "screenshot_author": "qa",
            "status": "active",
        })

        r.append({
            "question_id": "GRAPH-006",
            "title": "排序不稳定-C题",
            "path_params": "nodes=30;edges=60;seed=42",
            "tags": "medium",
            "sort_key": 5,
            "remark": "与 GRAPH-004/005 使用相同 sort_key=5，测试不稳定排序",
            "remark_author": "qa",
            "remark_note": "同组排序键-3",
            "screenshots": "",
            "screenshot_author": "",
            "status": "active",
        })

        r.append({
            "question_id": "GRAPH-007",
            "title": "难题参数不足样例",
            "path_params": "start=1;end=10",
            "tags": "hard",
            "sort_key": 6,
            "remark": "hard标签但参数只有2个，触发异常",
            "remark_author": "duty",
            "remark_note": "演示hard参数不足",
            "screenshots": "",
            "screenshot_author": "",
            "status": "active",
        })

        r.append({
            "question_id": "GRAPH-008",
            "title": "空路径参数样例",
            "path_params": "",
            "tags": "experimental",
            "sort_key": 7,
            "remark": "",
            "remark_author": "",
            "remark_note": "",
            "screenshots": "",
            "screenshot_author": "",
            "status": "active",
        })

        r.append({
            "question_id": "GRAPH-009",
            "title": "超长参数样例",
            "path_params": "note=" + "A" * 250 + ";len=250",
            "tags": "debug",
            "sort_key": 8,
            "remark": "",
            "remark_author": "",
            "remark_note": "",
            "screenshots": "",
            "screenshot_author": "",
            "status": "active",
        })

        r.append({
            "question_id": "GRAPH-010",
            "title": "草稿题目-应该跳过",
            "path_params": "a=1;b=2",
            "tags": "draft",
            "sort_key": 9,
            "remark": "",
            "remark_author": "",
            "remark_note": "",
            "screenshots": "",
            "screenshot_author": "",
            "status": "draft",
        })

        r.append({
            "question_id": "GRAPH-011",
            "title": "包含IGNORE的题目",
            "path_params": "x=10;y=20",
            "tags": "wip",
            "sort_key": 10,
            "remark": "这里有IGNORE字样，测试跳过规则匹配",
            "remark_author": "qa",
            "remark_note": "测试跳过",
            "screenshots": "",
            "screenshot_author": "",
            "status": "active",
        })

        r.append({
            "question_id": "GRAPH-012",
            "title": "归档题目-应该跳过",
            "path_params": "deprecated=yes",
            "tags": "old",
            "sort_key": 11,
            "remark": "",
            "remark_author": "",
            "remark_note": "",
            "screenshots": "",
            "screenshot_author": "",
            "status": "archived",
        })

        r.append({
            "question_id": "",
            "title": "缺少id的坏行",
            "path_params": "a=1;b=2",
            "tags": "",
            "sort_key": 99,
            "remark": "",
            "remark_author": "",
            "remark_note": "",
            "screenshots": "",
            "screenshot_author": "",
            "status": "active",
        })

        r.append({
            "question_id": "GRAPH-BAD2",
            "title": "",
            "path_params": "a=1;b=2",
            "tags": "",
            "sort_key": 100,
            "remark": "",
            "remark_author": "",
            "remark_note": "",
            "screenshots": "",
            "screenshot_author": "",
            "status": "active",
        })

        r.append({
            "question_id": "GRAPH-BAD3",
            "title": "参数格式错误缺等号",
            "path_params": "start1;end2;weight3",
            "tags": "broken",
            "sort_key": 101,
            "remark": "",
            "remark_author": "",
            "remark_note": "",
            "screenshots": "",
            "screenshot_author": "",
            "status": "active",
        })

        r.append({
            "question_id": "GRAPH-013",
            "title": "JSON格式路径参数",
            "path_params": '{"start": 10, "end": 20, "algo": "astar", "h_boost": 1.5}',
            "tags": "advanced",
            "sort_key": 12,
            "remark": "支持JSON格式的路径参数",
            "remark_author": "xiaomeng",
            "remark_note": "新格式支持测试",
            "screenshots": "s3://graph-snap/v3/GRAPH-013-json-params.png",
            "screenshot_author": "qa-team",
            "status": "active",
        })

        r.append({
            "question_id": "GRAPH-014",
            "title": "带多轮备注的老题目",
            "path_params": "start=1;end=50;algo=floyd",
            "tags": "classic,reviewed",
            "sort_key": 13,
            "remark": "第3轮复核：2025-05-10 小孟补充了Floyd特殊情况的说明",
            "remark_author": "xiaomeng",
            "remark_note": "2025-05最新备注",
            "screenshots": (
                "s3://graph-snap/v1/GRAPH-014.png|"
                "s3://graph-snap/v2/GRAPH-014-revised.png|"
                "s3://graph-snap/v3/GRAPH-014-final-approved.png"
            ),
            "screenshot_author": "qa-team",
            "status": "active",
        })

        r.append({
            "question_id": "GRAPH-015",
            "title": "正常题目收尾",
            "path_params": "nodes=10;edges=20;type=dense",
            "tags": "easy",
            "sort_key": 14,
            "remark": "",
            "remark_author": "",
            "remark_note": "",
            "screenshots": "",
            "screenshot_author": "",
            "status": "active",
        })

    def to_csv(self) -> str:
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=self.COLUMNS, lineterminator="\n")
        writer.writeheader()
        for row in self.rows:
            for c in self.COLUMNS:
                row.setdefault(c, "")
            writer.writerow(row)
        return buf.getvalue()

    def save(self, filepath: str) -> str:
        p = Path(filepath)
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(p, "w", encoding="utf-8", newline="") as f:
            f.write(self.to_csv())
        return str(p.resolve())

    def describe(self, stream=None) -> None:
        import sys
        out = stream or sys.stdout
        sep = "-" * 50
        print("📁 演示数据说明（脏数据，非只展示正常样例）", file=out)
        print(sep, file=out)
        print(f"  总行数: {len(self.rows)}", file=out)
        print("  包含以下特意构造的场景:", file=out)
        print("    ✅ 正常样例: GRAPH-001, 002, 013, 015 等", file=out)
        print("    🔶 边界样本:", file=out)
        print("       - GRAPH-003: 参数越界 (end=99999, weight=999999, depth=-5)", file=out)
        print("       - GRAPH-007: hard标签但参数不足3个", file=out)
        print("       - GRAPH-008: 空路径参数", file=out)
        print("       - GRAPH-009: 超长参数 (note字段250+字符)", file=out)
        print("    🔀 排序不稳定组:", file=out)
        print("       - GRAPH-004/005/006: 三者 sort_key=5 相同", file=out)
        print("    ⏭️  应被跳过的行:", file=out)
        print("       - GRAPH-010: status=draft", file=out)
        print("       - GRAPH-011: remark 含 IGNORE", file=out)
        print("       - GRAPH-012: status=archived", file=out)
        print("    ❌ 坏行:", file=out)
        print("       - (第13行): 缺少 question_id", file=out)
        print("       - GRAPH-BAD2: 缺少 title", file=out)
        print("       - GRAPH-BAD3: 路径参数缺少等号", file=out)
        print("    📜 备注/截图历史样本:", file=out)
        print("       - GRAPH-001/002/013: 带备注+截图", file=out)
        print("       - GRAPH-014: 多轮备注+3张历史截图", file=out)
        print(sep, file=out)
