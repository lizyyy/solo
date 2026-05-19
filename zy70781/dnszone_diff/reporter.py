import json
from datetime import datetime
from typing import Optional
from pathlib import Path
from tabulate import tabulate
import yaml
from .comparator import DiffResult, MissingRecordValue as MissingRecord, TTLDiff, ValueDiff
from .parser import BadLine


class ReportGenerator:
    def __init__(self, diff_result: DiffResult):
        self.result = diff_result
        self.timestamp = datetime.now().isoformat()

    def generate_text(self) -> str:
        lines = []
        lines.append("=" * 80)
        lines.append("DNS ZONE 环境差异排查报告")
        lines.append(f"生成时间: {self.timestamp}")
        lines.append(f"对比环境: {', '.join(self.result.envs)}")
        lines.append("=" * 80)
        lines.append("")

        lines.append("统计汇总")
        lines.append("-" * 40)
        for env in self.result.envs:
            count = self.result.total_records_by_env.get(env, 0)
            lines.append(f"  {env}: {count} 条记录")
        lines.append(f"  共有记录: {self.result.common_records} 条")
        lines.append("")

        if self.result.bad_lines:
            lines.append("⚠️  解析错误 (坏行)")
            lines.append("-" * 40)
            for bad in self.result.bad_lines:
                lines.append(f"  [{bad.source.env}] {bad.source.file_path}:{bad.source.line_number}")
                lines.append(f"    错误: {bad.error}")
                lines.append(f"    原文: {bad.source.raw_line}")
                lines.append("")
            lines.append("")

        if self.result.missing_records:
            lines.append("❌ 缺失记录")
            lines.append("-" * 40)
            table_data = []
            for mr in self.result.missing_records:
                name = mr.name
                rtype = mr.record_type
                value = mr.value
                present = ", ".join(sorted(mr.present_envs))
                missing = ", ".join(sorted(mr.missing_envs))
                table_data.append([name, rtype, value, present, missing])
            
            lines.append(tabulate(table_data, headers=["记录名", "类型", "值", "存在环境", "缺失环境"], tablefmt="simple"))
            lines.append("")
            lines.append("")

        if self.result.ttl_diffs:
            lines.append("⏱️  TTL 差异")
            lines.append("-" * 40)
            table_data = []
            for td in self.result.ttl_diffs:
                name = td.name
                rtype = td.record_type
                value = td.value
                ttls = [str(td.env_ttls.get(env, "-")) for env in self.result.envs]
                table_data.append([name, rtype, value] + ttls)
            
            headers = ["记录名", "类型", "值"] + [f"{e} TTL" for e in self.result.envs]
            lines.append(tabulate(table_data, headers=headers, tablefmt="simple"))
            lines.append("")
            lines.append("")

        if self.result.value_diffs:
            lines.append("🔄 记录值集合差异")
            lines.append("-" * 40)
            for vd in self.result.value_diffs:
                lines.append(f"  {vd.name} {vd.record_type}")
                for env in self.result.envs:
                    vals = vd.env_values.get(env, [])
                    vals_str = ", ".join(vals) if vals else "-"
                    lines.append(f"    {env}: {vals_str}")
                lines.append("")
            lines.append("")

        if not self.result.has_issues():
            lines.append("✅ 未发现差异")
            lines.append("")

        return "\n".join(lines)

    def generate_json(self) -> str:
        data = {
            "timestamp": self.timestamp,
            "environments": self.result.envs,
            "summary": {
                "total_records_by_env": self.result.total_records_by_env,
                "common_records": self.result.common_records,
                "has_issues": self.result.has_issues(),
                "missing_count": len(self.result.missing_records),
                "ttl_diff_count": len(self.result.ttl_diffs),
                "value_diff_count": len(self.result.value_diffs),
                "bad_line_count": len(self.result.bad_lines),
            },
            "missing_records": [],
            "ttl_diffs": [],
            "value_diffs": [],
            "bad_lines": [],
        }

        for mr in self.result.missing_records:
            sample = mr.sample_record
            data["missing_records"].append({
                "name": mr.name,
                "type": mr.record_type,
                "value": mr.value,
                "present_envs": sorted(list(mr.present_envs)),
                "missing_envs": sorted(list(mr.missing_envs)),
                "sources": [
                    {
                        "env": s.env,
                        "file": s.file_path,
                        "line": s.line_number,
                        "raw": s.raw_line,
                    }
                    for s in sample.sources
                ] if sample else [],
            })

        for td in self.result.ttl_diffs:
            data["ttl_diffs"].append({
                "name": td.name,
                "type": td.record_type,
                "value": td.value,
                "ttls_by_env": td.env_ttls,
            })

        for vd in self.result.value_diffs:
            data["value_diffs"].append({
                "name": vd.name,
                "type": vd.record_type,
                "values_by_env": vd.env_values,
            })

        for bl in self.result.bad_lines:
            data["bad_lines"].append({
                "env": bl.source.env,
                "file": bl.source.file_path,
                "line_number": bl.source.line_number,
                "raw_line": bl.source.raw_line,
                "error": bl.error,
            })

        return json.dumps(data, indent=2, ensure_ascii=False)

    def generate_yaml(self) -> str:
        json_data = json.loads(self.generate_json())
        return yaml.dump(json_data, default_flow_style=False, allow_unicode=True, sort_keys=False)

    def generate_html(self) -> str:
        json_data = json.loads(self.generate_json())
        
        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DNS Zone 环境差异报告</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; background: #f5f5f5; }}
        .container {{ max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
        h1 {{ color: #333; border-bottom: 3px solid #007bff; padding-bottom: 10px; }}
        h2 {{ color: #555; margin-top: 30px; }}
        .summary {{ background: #e9ecef; padding: 15px; border-radius: 6px; margin: 20px 0; }}
        .summary-item {{ margin: 8px 0; }}
        .alert {{ padding: 15px; border-radius: 6px; margin: 10px 0; }}
        .alert-warning {{ background: #fff3cd; border: 1px solid #ffeaa7; }}
        .alert-danger {{ background: #f8d7da; border: 1px solid #f5c6cb; }}
        .alert-info {{ background: #d1ecf1; border: 1px solid #bee5eb; }}
        .alert-success {{ background: #d4edda; border: 1px solid #c3e6cb; }}
        table {{ width: 100%; border-collapse: collapse; margin: 15px 0; }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }}
        th {{ background: #f8f9fa; font-weight: 600; }}
        tr:hover {{ background: #f5f5f5; }}
        .badge {{ display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; margin-right: 4px; }}
        .badge-present {{ background: #d4edda; color: #155724; }}
        .badge-missing {{ background: #f8d7da; color: #721c24; }}
        .code {{ background: #f8f9fa; padding: 8px 12px; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 13px; }}
        .meta {{ color: #666; font-size: 14px; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 DNS Zone 环境差异报告</h1>
        <div class="meta">
            <p><strong>生成时间:</strong> {json_data['timestamp']}</p>
            <p><strong>对比环境:</strong> {', '.join(json_data['environments'])}</p>
        </div>

        <h2>📊 统计汇总</h2>
        <div class="summary">
"""
        
        for env, count in json_data['summary']['total_records_by_env'].items():
            html += f'            <div class="summary-item"><strong>{env}:</strong> {count} 条记录</div>\n'
        html += f'            <div class="summary-item"><strong>共有记录:</strong> {json_data["summary"]["common_records"]} 条</div>\n'
        html += '        </div>\n'

        if json_data['bad_lines']:
            html += '        <h2>⚠️ 解析错误</h2>\n'
            for bl in json_data['bad_lines']:
                html += f'        <div class="alert alert-warning">\n'
                html += f'            <strong>[{bl["env"]}]</strong> {bl["file"]}:{bl["line_number"]}<br>\n'
                html += f'            错误: {bl["error"]}<br>\n'
                html += f'            <div class="code">{bl["raw_line"]}</div>\n'
                html += '        </div>\n'

        if json_data['missing_records']:
            html += '        <h2>❌ 缺失记录</h2>\n'
            html += '        <table>\n'
            html += '            <tr><th>记录名</th><th>类型</th><th>值</th><th>状态</th></tr>\n'
            for mr in json_data['missing_records']:
                badges = []
                for env in mr['present_envs']:
                    badges.append(f'<span class="badge badge-present">{env} ✓</span>')
                for env in mr['missing_envs']:
                    badges.append(f'<span class="badge badge-missing">{env} ✗</span>')
                html += f'            <tr><td>{mr["name"]}</td><td>{mr["type"]}</td><td>{mr["value"]}</td><td>{"".join(badges)}</td></tr>\n'
            html += '        </table>\n'

        if json_data['ttl_diffs']:
            html += '        <h2>⏱️ TTL 差异</h2>\n'
            html += '        <table>\n'
            html += '            <tr><th>记录名</th><th>类型</th><th>值</th>'
            for env in json_data['environments']:
                html += f'<th>{env} TTL</th>'
            html += '</tr>\n'
            for td in json_data['ttl_diffs']:
                html += f'            <tr><td>{td["name"]}</td><td>{td["type"]}</td><td>{td["value"]}</td>'
                for env in json_data['environments']:
                    ttl = td['ttls_by_env'].get(env, '-')
                    html += f'<td>{ttl}</td>'
                html += '</tr>\n'
            html += '        </table>\n'

        if json_data['value_diffs']:
            html += '        <h2>🔄 记录值集合差异</h2>\n'
            for vd in json_data['value_diffs']:
                html += f'        <div class="alert alert-info">\n'
                html += f'            <strong>{vd["name"]} {vd["type"]}</strong><br>\n'
                for env in json_data['environments']:
                    vals = vd['values_by_env'].get(env, [])
                    vals_str = ", ".join(vals) if vals else "-"
                    html += f'            {env}: <span class="code">{vals_str}</span><br>\n'
                html += '        </div>\n'

        if not json_data['summary']['has_issues']:
            html += '        <div class="alert alert-success">\n'
            html += '            <strong>✅ 未发现差异!</strong> 所有环境配置一致。\n'
            html += '        </div>\n'

        html += """
    </div>
</body>
</html>"""
        return html

    def save_report(self, output_path: str, fmt: str = "text"):
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        if fmt == "json":
            content = self.generate_json()
        elif fmt == "yaml":
            content = self.generate_yaml()
        elif fmt == "html":
            content = self.generate_html()
        else:
            content = self.generate_text()
        
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)


def generate_report(diff_result: DiffResult, output_path: Optional[str] = None, fmt: str = "text") -> str:
    generator = ReportGenerator(diff_result)
    
    if fmt == "json":
        content = generator.generate_json()
    elif fmt == "yaml":
        content = generator.generate_yaml()
    elif fmt == "html":
        content = generator.generate_html()
    else:
        content = generator.generate_text()
    
    if output_path:
        generator.save_report(output_path, fmt)
    
    return content
