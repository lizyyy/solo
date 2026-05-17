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
    lines.append("期望域名数: {}".format(compare.get("expected_count", 0)))
    lines.append("实际 SAN 数: {}".format(compare.get("actual_count", 0)))
    lines.append("匹配成功: {}".format(compare.get("matched_count", 0)))
    lines.append("缺失域名: {}".format(compare.get("missing_count", 0)))
    lines.append("额外 SAN: {}".format(compare.get("extra_count", 0)))
    lines.append("通配符数量: {}".format(compare.get("wildcard_count", 0)))
    lines.append("")
    if compare.get("all_matched"):
        lines.append("✓ 所有域名均已匹配!")
    else:
        lines.append("✗ 发现缺失域名:")
        for d in compare.get("missing_domains", []):
            lines.append("   - {}".format(d))
    if compare.get("extra_san"):
        lines.append("")
        lines.append("额外的 SAN 条目:")
        for d in compare.get("extra_san", []):
            lines.append("   + {}".format(d))
    bad_lines = result.get("bad_lines", [])
    if bad_lines:
        lines.append("")
        lines.append("⚠ 发现 {} 个无效行:".format(len(bad_lines)))
        for bl in bad_lines[:5]:
            lines.append("   行{}: {} [{}]".format(bl.get("line", "?"), bl.get("content", ""), bl.get("reason", "")))
        if len(bad_lines) > 5:
            lines.append("   ... 还有 {} 个".format(len(bad_lines) - 5))
    lines.append("")
    lines.append("=" * 60)
    return "\n".join(lines)

def generate_json_output(result, indent=2):
    return json.dumps(result, ensure_ascii=False, indent=indent)

