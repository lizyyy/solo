import csv
import io
import json
from typing import List, Dict
from datetime import datetime, timezone
from .models import CrashCluster, CrashReport


def generate_trend(clusters: List[CrashCluster], crashes: List[CrashReport],
                   group_by: str = "day") -> Dict:
    date_counts: Dict[str, Dict[str, int]] = {}

    for crash in crashes:
        try:
            dt = datetime.fromisoformat(crash.created_at)
        except (ValueError, TypeError):
            continue

        if group_by == "hour":
            key = dt.strftime("%Y-%m-%d %H:00")
        elif group_by == "week":
            key = dt.strftime("%Y-W%W")
        elif group_by == "month":
            key = dt.strftime("%Y-%m")
        else:
            key = dt.strftime("%Y-%m-%d")

        if key not in date_counts:
            date_counts[key] = {"total": 0, "obfuscated": 0, "clusters": set()}

        date_counts[key]["total"] += 1
        if crash.is_obfuscated:
            date_counts[key]["obfuscated"] += 1
        if crash.cluster_id:
            date_counts[key]["clusters"].add(crash.cluster_id)

    sorted_keys = sorted(date_counts.keys())
    trend = []
    for k in sorted_keys:
        v = date_counts[k]
        trend.append({
            "period": k,
            "crash_count": v["total"],
            "obfuscated_count": v["obfuscated"],
            "cluster_count": len(v["clusters"]),
        })

    return {
        "group_by": group_by,
        "data_points": len(trend),
        "trend": trend,
    }


def export_csv(clusters: List[CrashCluster], _crashes: List[CrashReport]) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "cluster_id", "crash_count", "version_bucket",
        "obfuscated_count", "device_distribution",
        "version_distribution", "first_seen", "last_seen",
        "representative_stack",
    ])
    for c in clusters:
        writer.writerow([
            c.id,
            len(c.crash_ids),
            c.version_bucket,
            c.obfuscated_count,
            json.dumps(c.device_distribution, ensure_ascii=False),
            json.dumps(c.version_distribution, ensure_ascii=False),
            c.first_seen,
            c.last_seen,
            c.representative_stack[:500],
        ])
    return output.getvalue()


def export_json(clusters: List[CrashCluster], crashes: List[CrashReport]) -> Dict:
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "total_crashes": len(crashes),
            "total_clusters": len(clusters),
            "obfuscated_crashes": sum(1 for c in crashes if c.is_obfuscated),
            "version_buckets": list({c.version_bucket for c in crashes if c.version_bucket}),
            "device_families": list({c.device_family for c in crashes if c.device_family}),
        },
        "clusters": [
            {
                "id": c.id,
                "crash_count": len(c.crash_ids),
                "version_bucket": c.version_bucket,
                "obfuscated_count": c.obfuscated_count,
                "device_distribution": c.device_distribution,
                "version_distribution": c.version_distribution,
                "first_seen": c.first_seen,
                "last_seen": c.last_seen,
                "representative_stack": c.representative_stack,
                "crash_ids": c.crash_ids,
            }
            for c in sorted(clusters, key=lambda x: len(x.crash_ids), reverse=True)
        ],
    }


def export_markdown(clusters: List[CrashCluster], crashes: List[CrashReport]) -> str:
    lines = ["# Crash Clustering Report", ""]
    lines.append(f"- Total crashes: {len(crashes)}")
    lines.append(f"- Total clusters: {len(clusters)}")
    lines.append(f"- Obfuscated: {sum(1 for c in crashes if c.is_obfuscated)}")
    lines.append("")

    for c in sorted(clusters, key=lambda x: len(x.crash_ids), reverse=True):
        lines.append(f"## Cluster {c.id} ({len(c.crash_ids)} crashes)")
        lines.append(f"- Version: {c.version_bucket}")
        lines.append(f"- Obfuscated frames: {c.obfuscated_count}")
        lines.append(f"- Devices: {json.dumps(c.device_distribution, ensure_ascii=False)}")
        lines.append(f"- Versions: {json.dumps(c.version_distribution, ensure_ascii=False)}")
        lines.append(f"- First seen: {c.first_seen}")
        lines.append(f"- Last seen: {c.last_seen}")
        lines.append("")
        lines.append("```")
        lines.append(c.representative_stack[:800])
        lines.append("```")

        lines.append("")

    return "\n".join(lines)
