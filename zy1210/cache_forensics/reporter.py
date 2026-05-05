from __future__ import annotations

import json
from collections import Counter
from datetime import datetime
from typing import Any, Optional

from .models import RiskType, SimulationStats


class Reporter:
    @staticmethod
    def to_dict(stats: SimulationStats, risk_events: list[dict]) -> dict[str, Any]:
        severity_counts = Counter(e["severity"] for e in risk_events)
        type_counts = Counter(e["risk_type"] for e in risk_events)

        return {
            "run_id": stats.run_id,
            "policy_name": stats.policy_name,
            "simulation_period": {
                "started_at": stats.started_at.isoformat(),
                "finished_at": stats.finished_at.isoformat(),
            },
            "summary": {
                "total_requests": stats.total_requests,
                "cache_hits": stats.cache_hits,
                "cache_misses": stats.cache_misses,
                "db_queries": stats.db_queries,
                "db_writes": stats.db_writes,
            },
            "hit_rates": {
                "overall": round(stats.hit_rate * 100, 2),
                "local_cache": round(stats.local_hit_rate * 100, 2),
                "redis_cache": round(stats.redis_hit_rate * 100, 2),
            },
            "consistency": {
                "consistency_violations": stats.consistency_violations,
                "stale_reads": stats.stale_reads,
            },
            "risk_events": {
                "total": len(risk_events),
                "by_severity": dict(severity_counts),
                "by_type": dict(type_counts),
                "events": [
                    {
                        "risk_type": e["risk_type"],
                        "timestamp": e["timestamp"],
                        "key": e["key"],
                        "description": e["description"],
                        "severity": e["severity"],
                        "context": e.get("context"),
                    }
                    for e in risk_events
                ],
            },
            "top_keys": Reporter._get_top_keys(stats.key_access_counts, 10),
        }

    @staticmethod
    def to_json(stats: SimulationStats, risk_events: list[dict], indent: int = 2) -> str:
        data = Reporter.to_dict(stats, risk_events)
        return json.dumps(data, ensure_ascii=False, indent=indent)

    @staticmethod
    def to_markdown(stats: SimulationStats, risk_events: list[dict]) -> str:
        data = Reporter.to_dict(stats, risk_events)

        md_lines = [
            f"# 缓存事故复盘报告 - 运行 {stats.run_id}",
            "",
            f"> 生成时间: {datetime.now().isoformat()}",
            f"> 策略名称: {stats.policy_name}",
            "",
            "## 1. 模拟概览",
            "",
            "| 指标 | 数值 |",
            "|------|------|",
            f"| 总请求数 | {stats.total_requests} |",
            f"| 缓存命中 | {stats.cache_hits} |",
            f"| 缓存未命中 | {stats.cache_misses} |",
            f"| 数据库查询 | {stats.db_queries} |",
            f"| 数据库写入 | {stats.db_writes} |",
            f"| 一致性违规 | {stats.consistency_violations} |",
            f"| 旧值读取 | {stats.stale_reads} |",
            "",
            "## 2. 命中率分析",
            "",
            "| 层级 | 命中率 |",
            "|------|--------|",
            f"| 整体 | {data['hit_rates']['overall']}% |",
            f"| 本地缓存 | {data['hit_rates']['local_cache']}% |",
            f"| Redis 缓存 | {data['hit_rates']['redis_cache']}% |",
            "",
            "## 3. 风险事件",
            "",
        ]

        if risk_events:
            severity_counts = data["risk_events"]["by_severity"]
            type_counts = data["risk_events"]["by_type"]

            md_lines.extend([
                f"**总计: {len(risk_events)} 个风险事件",
                "",
                "### 3.1 按严重程度分布",
                "",
            ])

            for severity, count in sorted(severity_counts.items()):
                md_lines.append(f"- **{severity}**: {count} 个")

            md_lines.extend([
                "",
                "### 3.2 按类型分布",
                "",
            ])

            for risk_type, count in sorted(type_counts.items()):
                md_lines.append(f"- **{risk_type}**: {count} 个")

            md_lines.extend([
                "",
                "### 3.3 详细事件列表",
                "",
            ])

            high_risk = [e for e in risk_events if e["severity"] == "high"]
            medium_risk = [e for e in risk_events if e["severity"] == "medium"]
            low_risk = [e for e in risk_events if e["severity"] == "low"]

            if high_risk:
                md_lines.extend(["#### 高严重程度", ""])
                for e in high_risk[:20]:
                    md_lines.extend([
                        f"**时间**: {e['timestamp']}",
                        f"**类型**: {e['risk_type']}",
                        f"**Key**: `{e['key']}`",
                        f"**描述**: {e['description']}",
                        "",
                    ])

            if medium_risk:
                md_lines.extend(["#### 中严重程度", ""])
                for e in medium_risk[:20]:
                    md_lines.extend([
                        f"**时间**: {e['timestamp']}",
                        f"**类型**: {e['risk_type']}",
                        f"**Key**: `{e['key']}`",
                        f"**描述**: {e['description']}",
                        "",
                    ])

        else:
            md_lines.append("未检测到风险事件。")

        md_lines.extend([
            "",
            "## 4. 热点 Key 分析",
            "",
        ])

        top_keys = data["top_keys"]
        if top_keys:
            md_lines.append("| Key | 访问次数 |")
            md_lines.append("|-----|---------|")
            for key, count in top_keys:
                md_lines.append(f"| `{key}` | {count} |")
        else:
            md_lines.append("无热点 Key 数据。")

        md_lines.extend([
            "",
            "---",
            "",
            "*此报告由 cache-forensics 工具生成。",
        ])

        return "\n".join(md_lines)

    @staticmethod
    def compare_runs(
        run1_data: dict,
        run1_risks: list[dict],
        run2_data: dict,
        run2_risks: list[dict],
    ) -> dict[str, Any]:
        comparison = {
            "runs": {
                "run1": {"id": run1_data["id"], "policy": run1_data["policy_name"]},
                "run2": {"id": run2_data["id"], "policy": run2_data["policy_name"]},
            },
            "metrics_comparison": [],
            "risk_comparison": [],
            "key_differences": [],
        }

        metrics = [
            ("total_requests", "总请求数"),
            ("cache_hits", "缓存命中"),
            ("cache_misses", "缓存未命中"),
            ("db_queries", "数据库查询"),
            ("db_writes", "数据库写入"),
            ("hit_rate", "整体命中率"),
            ("local_hit_rate", "本地缓存命中率"),
            ("redis_hit_rate", "Redis 命中率"),
            ("consistency_violations", "一致性违规"),
            ("stale_reads", "旧值读取"),
        ]

        for key, name in metrics:
            v1 = run1_data.get(key, 0)
            v2 = run2_data.get(key, 0)
            diff = v2 - v1
            comparison["metrics_comparison"].append({
                "metric": name,
                "run1": v1,
                "run2": v2,
                "difference": diff,
                "percent_change": round((diff / v1 * 100), 2) if v1 else 0,
            })

        risk_types = list(
                set(e["risk_type"] for e in run1_risks)
                | set(e["risk_type"] for e in run2_risks)
            )
        for rt in risk_types:
            c1 = sum(1 for e in run1_risks if e["risk_type"] == rt)
            c2 = sum(1 for e in run2_risks if e["risk_type"] == rt)
            comparison["risk_comparison"].append({
                "risk_type": rt,
                "run1_count": c1,
                "run2_count": c2,
                "difference": c2 - c1,
            })

        return comparison

    @staticmethod
    def comparison_to_markdown(comparison: dict[str, Any]) -> str:
        md_lines = [
            "# 策略对比报告",
            "",
            f"运行 1: {comparison['runs']['run1']['id']} (策略: {comparison['runs']['run1']['policy']})",
            f"运行 2: {comparison['runs']['run2']['id']} (策略: {comparison['runs']['run2']['policy']})",
            "",
            "## 1. 指标对比",
            "",
            "| 指标 | 运行 1 | 运行 2 | 差异 | 变化率 |",
            "|------|--------|--------|------|--------|",
        ]

        for m in comparison["metrics_comparison"]:
            v1 = m["run1"]
            v2 = m["run2"]
            diff = m["difference"]
            pct = m["percent_change"]

            if isinstance(v1, float) and v1 <= 1:
                v1 = f"{v1 * 100:.2f}%"
                v2 = f"{v2 * 100:.2f}%"
                diff = f"{diff * 100:.2f}%"
            else:
                v1 = str(v1)
                v2 = str(v2)
                diff = f"{diff:+d}"

            pct_str = f"{pct:+.2f}%"
            md_lines.append(f"| {m['metric']} | {v1} | {v2} | {diff} | {pct_str} |")

        md_lines.extend([
            "",
            "## 2. 风险事件对比",
            "",
            "| 风险类型 | 运行 1 | 运行 2 | 差异 |",
            "|----------|--------|--------|------|",
        ])

        for r in comparison["risk_comparison"]:
            diff = r["difference"]
            md_lines.append(
                f"| {r['risk_type']} | {r['run1_count']} | {r['run2_count']} | {diff:+d} |"
            )

        md_lines.extend([
            "",
            "---",
            "",
            "*此报告由 cache-forensics 工具生成。",
        ])

        return "\n".join(md_lines)

    @staticmethod
    def _get_top_keys(counts: dict[str, int], limit: int) -> list[tuple[str, int]]:
        sorted_keys = sorted(counts.items(), key=lambda x: x[1], reverse=True)
        return sorted_keys[:limit]
