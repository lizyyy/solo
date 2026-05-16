import json
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime


class Reporter:
    def __init__(self, output_dir: Path, use_color: bool = True):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.use_color = use_color

    def _color_text(self, text: str, color: str) -> str:
        if not self.use_color:
            return text
        colors = {
            "red": "\033[91m",
            "green": "\033[92m",
            "yellow": "\033[93m",
            "blue": "\033[94m",
            "bold": "\033[1m",
            "reset": "\033[0m"
        }
        return f"{colors.get(color, '')}{text}{colors['reset']}"

    def print_terminal_summary(self, servers: List[Dict[str, Any]], conflicts: List[Dict[str, Any]]) -> None:
        print("\n" + "=" * 70)
        print(self._color_text("路由冲突检测报告", "bold"))
        print("=" * 70)

        print(f"\n{self._color_text('统计摘要:', 'bold')}")
        print(f"  Server 块数: {len(servers)}")
        total_locations = sum(len(s["locations"]) for s in servers)
        print(f"  Location 规则数: {total_locations}")
        print(f"  检测到冲突: {len(conflicts)}")

        if conflicts:
            errors = [c for c in conflicts if c["severity"] == "error"]
            warnings = [c for c in conflicts if c["severity"] == "warning"]
            print(f"  - 错误级冲突: {len(errors)}")
            print(f"  - 警告级冲突: {len(warnings)}")

        print()

        if not conflicts:
            print(self._color_text("✓ 未检测到路由冲突", "green"))
            print()
            return

        print(self._color_text("冲突详情:", "bold"))
        print()

        for i, conflict in enumerate(conflicts, 1):
            severity_color = "red" if conflict["severity"] == "error" else "yellow"
            conflict_header = f"[{i}] {conflict['severity'].upper()}"
            print(f"{self._color_text(conflict_header, severity_color)}")
            print(f"    Server: {conflict['server_name']}")
            print(f"    类型: {conflict['overlap_type']}")
            print(f"    影响: {conflict['impact']}")
            print(f"    说明: {conflict['description']}")
            print()
            print(f"    Location 1: {conflict['location1']['raw']}")
            print(f"      文件: {conflict['location1']['file']}:{conflict['location1']['line']}")
            print(f"      类型: {conflict['location1']['match_type']} (优先级 {conflict['location1']['priority']})")
            print()
            print(f"    Location 2: {conflict['location2']['raw']}")
            print(f"      文件: {conflict['location2']['file']}:{conflict['location2']['line']}")
            print(f"      类型: {conflict['location2']['match_type']} (优先级 {conflict['location2']['priority']})")
            print()
            print("-" * 70)
            print()

        self._print_fix_suggestions()

    def _print_fix_suggestions(self) -> None:
        print(self._color_text("修复建议:", "bold"))
        print()
        print("  1. 对于被覆盖的规则 (shadowed):")
        print("     - 检查是否确实需要该规则，如不需要可删除")
        print("     - 如需保留，调整修饰符提高优先级 (如使用 ^~ 或 =)")
        print()
        print("  2. 对于相同路径的规则 (identical):")
        print("     - 删除重复配置")
        print("     - 合并配置内容")
        print()
        print("  3. 对于路径子集冲突 (subset):")
        print("     - 将更具体的路径放在更一般的路径之前")
        print("     - 使用 = 精确匹配修饰符提高优先级")
        print()
        print("  4. 对于正则表达式重叠 (regex_overlap):")
        print("     - 简化正则表达式")
        print("     - 使用 ^~ 前缀匹配阻止正则匹配")
        print()

    def generate_json_report(self, servers: List[Dict[str, Any]], conflicts: List[Dict[str, Any]]) -> Path:
        report = {
            "generated_at": datetime.now().isoformat(),
            "summary": {
                "total_servers": len(servers),
                "total_locations": sum(len(s["locations"]) for s in servers),
                "total_conflicts": len(conflicts),
                "error_conflicts": sum(1 for c in conflicts if c["severity"] == "error"),
                "warning_conflicts": sum(1 for c in conflicts if c["severity"] == "warning")
            },
            "servers": [
                {
                    "name": s["name"],
                    "file": s["file"],
                    "listen": s["listen"],
                    "server_name": s["server_name"],
                    "location_count": len(s["locations"]),
                    "locations": [
                        {
                            "raw": loc["raw"],
                            "pattern": loc["pattern"],
                            "modifier": loc["modifier"],
                            "match_type": loc["match_type"],
                            "priority": loc["priority"],
                            "file": loc["file"],
                            "line": loc["start_line"]
                        }
                        for loc in s["locations"]
                    ]
                }
                for s in servers
            ],
            "conflicts": conflicts
        }

        output_path = self.output_dir / "nginx-route-report.json"
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        return output_path

    def generate_markdown_report(self, servers: List[Dict[str, Any]], conflicts: List[Dict[str, Any]]) -> Path:
        lines = []
        lines.append("# Nginx 路由冲突检测报告")
        lines.append("")
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        lines.append("## 统计摘要")
        lines.append("")
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| Server 块数 | {len(servers)} |")
        total_locations = sum(len(s["locations"]) for s in servers)
        lines.append(f"| Location 规则数 | {total_locations} |")
        lines.append(f"| 检测到冲突 | {len(conflicts)} |")
        if conflicts:
            errors = sum(1 for c in conflicts if c["severity"] == "error")
            warnings = sum(1 for c in conflicts if c["severity"] == "warning")
            lines.append(f"| 错误级冲突 | {errors} |")
            lines.append(f"| 警告级冲突 | {warnings} |")
        lines.append("")

        lines.append("## Server 配置详情")
        lines.append("")
        for server in servers:
            lines.append(f"### {server['name']}")
            lines.append("")
            lines.append(f"- 文件: `{server['file']}`")
            lines.append(f"- 监听: {', '.join(server['listen']) if server['listen'] else 'N/A'}")
            lines.append(f"- 域名: {', '.join(server['server_name']) if server['server_name'] else 'N/A'}")
            lines.append(f"- Location 规则数: {len(server['locations'])}")
            lines.append("")
            lines.append("#### Location 规则列表")
            lines.append("")
            lines.append("| 优先级 | 匹配类型 | 规则 | 文件位置 |")
            lines.append("|--------|----------|------|----------|")
            for loc in sorted(server["locations"], key=lambda x: (-x["priority"], -len(x["pattern"]))):
                lines.append(f"| {loc['priority']} | {loc['match_type']} | `{loc['raw']}` | `{Path(loc['file']).name}:{loc['start_line']}` |")
            lines.append("")

        if conflicts:
            lines.append("## 冲突详情")
            lines.append("")
            for i, conflict in enumerate(conflicts, 1):
                severity_emoji = "🔴" if conflict["severity"] == "error" else "🟡"
                lines.append(f"### {severity_emoji} 冲突 #{i}: {conflict['overlap_type']}")
                lines.append("")
                lines.append(f"- **Server**: `{conflict['server_name']}`")
                lines.append(f"- **严重级别**: {conflict['severity']}")
                lines.append(f"- **影响**: {conflict['impact']}")
                lines.append(f"- **说明**: {conflict['description']}")
                lines.append("")
                lines.append("#### 涉及的 Location 规则")
                lines.append("")
                lines.append("| # | 规则 | 匹配类型 | 优先级 | 文件位置 |")
                lines.append("|---|------|----------|--------|----------|")
                lines.append(f"| 1 | `{conflict['location1']['raw']}` | {conflict['location1']['match_type']} | {conflict['location1']['priority']} | `{conflict['location1']['file']}:{conflict['location1']['line']}` |")
                lines.append(f"| 2 | `{conflict['location2']['raw']}` | {conflict['location2']['match_type']} | {conflict['location2']['priority']} | `{conflict['location2']['file']}:{conflict['location2']['line']}` |")
                lines.append("")
                lines.append("---")
                lines.append("")

        lines.append("## 修复建议")
        lines.append("")
        lines.append("### 对于被覆盖的规则 (shadowed)")
        lines.append("- 检查是否确实需要该规则，如不需要可删除")
        lines.append("- 如需保留，调整修饰符提高优先级 (如使用 `^~` 或 `=`)")
        lines.append("")
        lines.append("### 对于相同路径的规则 (identical)")
        lines.append("- 删除重复配置")
        lines.append("- 合并配置内容")
        lines.append("")
        lines.append("### 对于路径子集冲突 (subset)")
        lines.append("- 将更具体的路径放在更一般的路径之前")
        lines.append("- 使用 `=` 精确匹配修饰符提高优先级")
        lines.append("")
        lines.append("### 对于正则表达式重叠 (regex_overlap)")
        lines.append("- 简化正则表达式")
        lines.append("- 使用 `^~` 前缀匹配阻止正则匹配")
        lines.append("")

        lines.append("## Nginx Location 优先级参考")
        lines.append("")
        lines.append("| 修饰符 | 类型 | 优先级 | 说明 |")
        lines.append("|--------|------|--------|------|")
        lines.append("| `=` | 精确匹配 | 4 | 最高优先级，完全匹配后停止搜索 |")
        lines.append("| `^~` | 前缀匹配(禁用正则) | 3 | 匹配成功后不再检查正则 |")
        lines.append("| `~` / `~*` | 正则匹配 | 2 | 按配置顺序匹配 |")
        lines.append("| (无) | 前缀匹配 | 1 | 最长前缀优先 |")
        lines.append("")

        output_path = self.output_dir / "nginx-route-report.md"
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

        return output_path

    def generate_html_report(self, servers: List[Dict[str, Any]], conflicts: List[Dict[str, Any]]) -> Path:
        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nginx 路由冲突检测报告</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f5f5f5; }}
        .container {{ background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        h1 {{ color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; margin-bottom: 20px; }}
        h2 {{ color: #34495e; margin-top: 30px; margin-bottom: 15px; border-left: 4px solid #3498db; padding-left: 10px; }}
        h3 {{ color: #555; margin-top: 20px; margin-bottom: 10px; }}
        .summary-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }}
        .summary-card {{ background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; }}
        .summary-card .number {{ font-size: 2em; font-weight: bold; color: #3498db; }}
        .summary-card .label {{ color: #666; font-size: 0.9em; }}
        .error {{ color: #e74c3c; }}
        .warning {{ color: #f39c12; }}
        table {{ width: 100%; border-collapse: collapse; margin: 15px 0; }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }}
        th {{ background: #3498db; color: white; font-weight: 600; }}
        tr:hover {{ background: #f8f9fa; }}
        .conflict-card {{ background: #fef5f5; border: 1px solid #fecaca; border-radius: 6px; padding: 20px; margin: 15px 0; }}
        .conflict-card.warning {{ background: #fffbeb; border-color: #fcd34d; }}
        .conflict-header {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }}
        .conflict-title {{ font-size: 1.1em; font-weight: 600; }}
        .severity-badge {{ padding: 4px 12px; border-radius: 20px; font-size: 0.85em; font-weight: 600; }}
        .severity-badge.error {{ background: #fee2e2; color: #dc2626; }}
        .severity-badge.warning {{ background: #fef3c7; color: #d97706; }}
        .location-item {{ background: white; padding: 10px; border-radius: 4px; margin: 8px 0; border-left: 3px solid #3498db; }}
        .location-path {{ font-family: 'Monaco', 'Consolas', monospace; color: #2c3e50; font-weight: 600; }}
        .location-meta {{ color: #666; font-size: 0.9em; margin-top: 5px; }}
        .suggestion-box {{ background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 15px; margin: 15px 0; }}
        .suggestion-title {{ font-weight: 600; color: #065f46; margin-bottom: 8px; }}
        code {{ background: #f3f4f6; padding: 2px 6px; border-radius: 3px; font-family: 'Monaco', 'Consolas', monospace; font-size: 0.9em; }}
        .generated-at {{ color: #999; text-align: right; font-size: 0.9em; margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 Nginx 路由冲突检测报告</h1>

        <h2>📊 统计摘要</h2>
        <div class="summary-grid">
            <div class="summary-card">
                <div class="number">{len(servers)}</div>
                <div class="label">Server 块数</div>
            </div>
            <div class="summary-card">
                <div class="number">{sum(len(s['locations']) for s in servers)}</div>
                <div class="label">Location 规则数</div>
            </div>
            <div class="summary-card">
                <div class="number {'error' if conflicts else ''}">{len(conflicts)}</div>
                <div class="label">检测到冲突</div>
            </div>
            {f'''
            <div class="summary-card">
                <div class="number error">{sum(1 for c in conflicts if c['severity'] == 'error')}</div>
                <div class="label">错误级冲突</div>
            </div>
            <div class="summary-card">
                <div class="number warning">{sum(1 for c in conflicts if c['severity'] == 'warning')}</div>
                <div class="label">警告级冲突</div>
            </div>
            ''' if conflicts else ''}
        </div>

        <h2>📋 Server 配置详情</h2>
"""

        for server in servers:
            html += f"""
        <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 6px;">
            <h3>🖥️ {server['name']}</h3>
            <div style="margin: 10px 0; color: #666;">
                <div>📁 文件: <code>{server['file']}</code></div>
                <div>🔌 监听: {', '.join(server['listen']) if server['listen'] else 'N/A'}</div>
                <div>🌐 域名: {', '.join(server['server_name']) if server['server_name'] else 'N/A'}</div>
                <div>📍 Location 规则数: {len(server['locations'])}</div>
            </div>

            <h4>Location 规则列表 (按优先级排序)</h4>
            <table>
                <thead>
                    <tr>
                        <th>优先级</th>
                        <th>匹配类型</th>
                        <th>规则</th>
                        <th>文件位置</th>
                    </tr>
                </thead>
                <tbody>
"""
            for loc in sorted(server["locations"], key=lambda x: (-x["priority"], -len(x["pattern"]))):
                html += f"""
                    <tr>
                        <td>{loc['priority']}</td>
                        <td>{loc['match_type']}</td>
                        <td><code>{loc['raw']}</code></td>
                        <td><code>{Path(loc['file']).name}:{loc['start_line']}</code></td>
                    </tr>
"""
            html += """
                </tbody>
            </table>
        </div>
"""

        if conflicts:
            html += f"""
        <h2>⚠️ 冲突详情</h2>
"""
            for i, conflict in enumerate(conflicts, 1):
                css_class = "error" if conflict["severity"] == "error" else "warning"
                emoji = "🔴" if conflict["severity"] == "error" else "🟡"
                html += f"""
        <div class="conflict-card {css_class}">
            <div class="conflict-header">
                <div class="conflict-title">{emoji} 冲突 #{i}: {conflict['overlap_type']}</div>
                <span class="severity-badge {css_class}">{conflict['severity'].upper()}</span>
            </div>

            <div style="margin: 10px 0;">
                <div><strong>Server:</strong> <code>{conflict['server_name']}</code></div>
                <div><strong>影响:</strong> {conflict['impact']}</div>
                <div><strong>说明:</strong> {conflict['description']}</div>
            </div>

            <h4>涉及的 Location 规则</h4>
            <div class="location-item">
                <div class="location-path">#1 {conflict['location1']['raw']}</div>
                <div class="location-meta">
                    类型: {conflict['location1']['match_type']} |
                    优先级: {conflict['location1']['priority']} |
                    文件: <code>{conflict['location1']['file']}:{conflict['location1']['line']}</code>
                </div>
            </div>
            <div class="location-item">
                <div class="location-path">#2 {conflict['location2']['raw']}</div>
                <div class="location-meta">
                    类型: {conflict['location2']['match_type']} |
                    优先级: {conflict['location2']['priority']} |
                    文件: <code>{conflict['location2']['file']}:{conflict['location2']['line']}</code>
                </div>
            </div>
        </div>
"""

        html += """
        <h2>💡 修复建议</h2>

        <div class="suggestion-box">
            <div class="suggestion-title">对于被覆盖的规则 (shadowed)</div>
            <ul style="margin-left: 20px; margin-top: 8px;">
                <li>检查是否确实需要该规则，如不需要可删除</li>
                <li>如需保留，调整修饰符提高优先级 (如使用 <code>^~</code> 或 <code>=</code>)</li>
            </ul>
        </div>

        <div class="suggestion-box">
            <div class="suggestion-title">对于相同路径的规则 (identical)</div>
            <ul style="margin-left: 20px; margin-top: 8px;">
                <li>删除重复配置</li>
                <li>合并配置内容</li>
            </ul>
        </div>

        <div class="suggestion-box">
            <div class="suggestion-title">对于路径子集冲突 (subset)</div>
            <ul style="margin-left: 20px; margin-top: 8px;">
                <li>将更具体的路径放在更一般的路径之前</li>
                <li>使用 <code>=</code> 精确匹配修饰符提高优先级</li>
            </ul>
        </div>

        <div class="suggestion-box">
            <div class="suggestion-title">对于正则表达式重叠 (regex_overlap)</div>
            <ul style="margin-left: 20px; margin-top: 8px;">
                <li>简化正则表达式</li>
                <li>使用 <code>^~</code> 前缀匹配阻止正则匹配</li>
            </ul>
        </div>

        <h2>📖 Nginx Location 优先级参考</h2>
        <table>
            <thead>
                <tr>
                    <th>修饰符</th>
                    <th>类型</th>
                    <th>优先级</th>
                    <th>说明</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><code>=</code></td>
                    <td>精确匹配</td>
                    <td>4 (最高)</td>
                    <td>完全匹配后停止搜索</td>
                </tr>
                <tr>
                    <td><code>^~</code></td>
                    <td>前缀匹配(禁用正则)</td>
                    <td>3</td>
                    <td>匹配成功后不再检查正则</td>
                </tr>
                <tr>
                    <td><code>~</code> / <code>~*</code></td>
                    <td>正则匹配</td>
                    <td>2</td>
                    <td>按配置顺序匹配</td>
                </tr>
                <tr>
                    <td>(无)</td>
                    <td>前缀匹配</td>
                    <td>1 (最低)</td>
                    <td>最长前缀优先</td>
                </tr>
            </tbody>
        </table>

        <div class="generated-at">
            生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
        </div>
    </div>
</body>
</html>
"""

        output_path = self.output_dir / "nginx-route-report.html"
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html)

        return output_path
