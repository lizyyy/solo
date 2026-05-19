import json
from typing import List, Dict, Any
from datetime import datetime
from nginx_parser import NginxConfig, ServerBlock, LocationRule
from matcher import MatchResult
from conflict_detector import Conflict


class Reporter:
    def __init__(self):
        pass

    def generate_text_report(
        self,
        config: NginxConfig,
        server: ServerBlock,
        match_results: List[MatchResult],
        conflicts: List[Conflict],
    ) -> str:
        lines = []
        lines.append("=" * 70)
        lines.append("Nginx 路由匹配冲突检测报告")
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 70)
        lines.append("")

        lines.append("【配置解析摘要】")
        lines.append(f"- 服务器块数量: {len(config.servers)}")
        lines.append(f"- 解析错误: {len(config.parse_errors)} 个")
        if config.parse_errors:
            for error in config.parse_errors:
                lines.append(f"  * {error}")
        lines.append(f"- 当前检测服务器: {', '.join(server.server_name) or '未命名'}")
        lines.append(f"- 监听端口: {server.listen or '未指定'}")
        lines.append(f"- Location 规则数: {len(server.locations)}")
        lines.append("")

        lines.append("【Location 规则列表】")
        for idx, loc in enumerate(server.locations, 1):
            modifier_display = loc.modifier.value or "(普通)"
            lines.append(
                f"{idx:2d}. 第 {loc.line_number:3d} 行 [{modifier_display:6s}] {loc.pattern}"
            )
        lines.append("")

        lines.append("【路径匹配测试结果】")
        lines.append(f"测试路径数: {len(match_results)}")
        lines.append("-" * 70)
        for result in match_results:
            status = "✓" if result.is_match else "✗"
            if result.matched_rule:
                rule_info = (
                    f"命中: [{result.matched_rule.modifier.value or '普通'}] "
                    f"{result.matched_rule.pattern} (第 {result.matched_rule.line_number} 行)"
                )
            else:
                rule_info = "未命中任何规则"
            lines.append(f"{status} {result.request_path} -> {rule_info}")
        lines.append("")

        lines.append("【冲突检测结果】")
        lines.append(f"发现冲突数: {len(conflicts)}")
        lines.append("-" * 70)

        severity_order = {"high": 0, "medium": 1, "low": 2}
        sorted_conflicts = sorted(
            conflicts, key=lambda c: (severity_order[c.severity], c.conflict_type.value)
        )

        for idx, conflict in enumerate(sorted_conflicts, 1):
            severity_display = {
                "high": "高",
                "medium": "中",
                "low": "低",
            }.get(conflict.severity, conflict.severity)

            type_display = {
                "shadowed_rule": "规则被覆盖",
                "regex_order_issue": "正则顺序问题",
                "overlapping_prefix": "前缀规则重叠",
                "unreachable_regex": "正则规则不可达",
                "ambiguous_match": "匹配歧义",
            }.get(conflict.conflict_type.value, conflict.conflict_type.value)

            lines.append(f"{idx}. [{severity_display}] {type_display}")
            lines.append(f"   说明: {conflict.explanation}")
            lines.append(f"   涉及规则:")
            for rule in conflict.rules:
                modifier_str = rule.modifier.value or "普通"
                lines.append(
                    f"     * 第 {rule.line_number} 行 [{modifier_str}] {rule.pattern}"
                )
            lines.append(f"   影响路径: {', '.join(conflict.affected_paths[:3])}")
            lines.append(f"   建议: {conflict.recommendation}")
            lines.append("")

        lines.append("=" * 70)
        lines.append("报告结束")

        return "\n".join(lines)

    def generate_json_report(
        self,
        config: NginxConfig,
        server: ServerBlock,
        match_results: List[MatchResult],
        conflicts: List[Conflict],
    ) -> Dict[str, Any]:
        return {
            "report_meta": {
                "generated_at": datetime.now().isoformat(),
                "version": "1.0.0",
            },
            "config_summary": {
                "server_count": len(config.servers),
                "parse_errors": config.parse_errors,
                "current_server": {
                    "server_names": server.server_name,
                    "listen": server.listen,
                    "location_count": len(server.locations),
                },
            },
            "location_rules": [
                {
                    "line_number": loc.line_number,
                    "modifier": loc.modifier.value,
                    "pattern": loc.pattern,
                    "priority": loc.priority,
                    "raw_line": loc.raw_line,
                }
                for loc in server.locations
            ],
            "match_results": [
                {
                    "request_path": result.request_path,
                    "is_match": result.is_match,
                    "matched_rule": {
                        "line_number": result.matched_rule.line_number,
                        "modifier": result.matched_rule.modifier.value,
                        "pattern": result.matched_rule.pattern,
                    }
                    if result.matched_rule
                    else None,
                    "match_process": result.match_process,
                }
                for result in match_results
            ],
            "conflicts": [
                {
                    "type": conflict.conflict_type.value,
                    "severity": conflict.severity,
                    "explanation": conflict.explanation,
                    "recommendation": conflict.recommendation,
                    "affected_paths": conflict.affected_paths,
                    "rules": [
                        {
                            "line_number": rule.line_number,
                            "modifier": rule.modifier.value,
                            "pattern": rule.pattern,
                        }
                        for rule in conflict.rules
                    ],
                }
                for conflict in conflicts
            ],
        }

    def save_json_report(
        self,
        output_path: str,
        config: NginxConfig,
        server: ServerBlock,
        match_results: List[MatchResult],
        conflicts: List[Conflict],
    ):
        report = self.generate_json_report(
            config, server, match_results, conflicts
        )
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

    def save_text_report(
        self,
        output_path: str,
        config: NginxConfig,
        server: ServerBlock,
        match_results: List[MatchResult],
        conflicts: List[Conflict],
    ):
        report = self.generate_text_report(
            config, server, match_results, conflicts
        )
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(report)

    def print_match_details(self, result: MatchResult):
        print("\n" + "=" * 70)
        print(f"匹配详情: {result.request_path}")
        print("=" * 70)
        for line in result.match_process:
            print(line)
        print("")
        if result.matched_rule:
            print(f"最终命中规则:")
            print(
                f"  位置: 第 {result.matched_rule.line_number} 行"
            )
            print(f"  修饰符: [{result.matched_rule.modifier.value or '普通'}]")
            print(f"  模式: {result.matched_rule.pattern}")
            print(f"  原始内容: {result.matched_rule.raw_line}")
            if result.matched_rule.block_content:
                print(f"  块内容:")
                for line in result.matched_rule.block_content[:5]:
                    print(f"    {line.rstrip()}")
                if len(result.matched_rule.block_content) > 5:
                    print(f"    ... (省略更多内容)")
        else:
            print("未命中任何规则")
        print("=" * 70)
