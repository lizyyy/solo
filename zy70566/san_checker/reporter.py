import json
from tabulate import tabulate
from datetime import datetime

def generate_terminal_summary(result):
    lines = []
    lines.append("=" * 60)
    lines.append("SAN 核对报告")
    lines.append("=" * 60)
    lines.append("")
    compare = result.get("san_comparison", {})
    lines.append(f"期望域名数: {compare.get('expected_count', 0)}")
    lines.append(f"实际 SAN 数: {compare.get('actual_count', 0)}")
    lines.append(f"匹配成功: {compare.get('matched_count', 0)}")
    lines.append(f"缺失域名: {compare.get('missing_count', 0)}")
    lines.append(f"额外 SAN: {compare.get('extra_count', 0)}")
    lines.append(f"通配符数量: {compare.get('wildcard_count', 0)}")
    lines.append("")
    if compare.get("all_matched"):
        lines.append("✓ 所有域名均已匹配!")
    else:
        lines.append("✗ 发现缺失域名:")
        for d in compare.get("missing_domains", []):
            lines.append(f"   - {d}")
    if compare.get("extra_san"):
        lines.append("")
        lines.append("额外的 SAN 条目:")
        for d in compare.get("extra_san", []):
            lines.append(f"   + {d}")
    bad_lines = result.get("bad_lines", [])
    if bad_lines:
        lines.append("")
        lines.append(f"⚠ 发现 {len(bad_lines)} 个无效行:")
        for bl in bad_lines[:5]:
            lines.append(f"   行{bl.get('line', '?')}: {bl.get('content', '')} [{bl.get('reason', '')}]")
        if len(bad_lines) > 5:
            lines.append(f"   ... 还有 {len(bad_lines) - 5} 个")
    lines.append("")
    lines.append("=" * 60)
    return "\n".join(lines)

def generate_json_output(result, indent=2):
    return json.dumps(result, ensure_ascii=False, indent=indent)
