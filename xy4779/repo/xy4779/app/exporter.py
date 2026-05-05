import json
from typing import List, Dict, Any
from datetime import datetime
from app.schemas import IssueType, Severity


class JSONExporter:
    @staticmethod
    def export_health_check(
        service_name: str,
        service_id: int,
        health_check_id: int,
        total_routes: int,
        issues: List[Dict[str, Any]],
        fix_suggestions: List[Dict[str, Any]],
        sample_results: List[Dict[str, Any]] = None
    ) -> str:
        data = {
            "export_metadata": {
                "format": "json",
                "version": "1.0",
                "exported_at": datetime.utcnow().isoformat() + "Z",
            },
            "service": {
                "id": service_id,
                "name": service_name,
                "total_routes": total_routes
            },
            "health_check": {
                "id": health_check_id,
                "summary": JSONExporter._generate_summary(total_routes, issues),
                "issues": issues,
                "fix_order": fix_suggestions
            }
        }
        
        if sample_results:
            data["sample_requests"] = sample_results
        
        return json.dumps(data, indent=2, ensure_ascii=False)
    
    @staticmethod
    def _generate_summary(total_routes: int, issues: List[Dict[str, Any]]) -> Dict[str, Any]:
        critical = 0
        high = 0
        medium = 0
        low = 0
        issues_by_type = {}
        
        for issue in issues:
            severity = issue.get('severity', Severity.MEDIUM)
            if severity == Severity.CRITICAL:
                critical += 1
            elif severity == Severity.HIGH:
                high += 1
            elif severity == Severity.MEDIUM:
                medium += 1
            elif severity == Severity.LOW:
                low += 1
            
            issue_type = issue.get('issue_type', 'unknown')
            if issue_type not in issues_by_type:
                issues_by_type[issue_type] = 0
            issues_by_type[issue_type] += 1
        
        return {
            "total_routes": total_routes,
            "total_issues": len(issues),
            "critical_issues": critical,
            "high_issues": high,
            "medium_issues": medium,
            "low_issues": low,
            "issues_by_type": issues_by_type,
            "passing": len(issues) == 0
        }


class MarkdownExporter:
    @staticmethod
    def export_health_check(
        service_name: str,
        service_id: int,
        health_check_id: int,
        total_routes: int,
        issues: List[Dict[str, Any]],
        fix_suggestions: List[Dict[str, Any]],
        sample_results: List[Dict[str, Any]] = None
    ) -> str:
        lines = []
        
        lines.append(f"# FastAPI 路由体检报告")
        lines.append("")
        lines.append(f"**服务名称**: {service_name}")
        lines.append(f"**服务ID**: {service_id}")
        lines.append(f"**体检ID**: {health_check_id}")
        lines.append(f"**生成时间**: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
        lines.append("")
        
        lines.append("## 摘要")
        lines.append("")
        summary = JSONExporter._generate_summary(total_routes, issues)
        lines.append(f"- **总路由数**: {summary['total_routes']}")
        lines.append(f"- **问题总数**: {summary['total_issues']}")
        lines.append(f"- **严重问题**: {summary['critical_issues']}")
        lines.append(f"- **高优先级问题**: {summary['high_issues']}")
        lines.append(f"- **中优先级问题**: {summary['medium_issues']}")
        lines.append(f"- **低优先级问题**: {summary['low_issues']}")
        lines.append("")
        
        if summary['passing']:
            lines.append("✅ **所有路由检查通过！**")
        else:
            lines.append("⚠️ **发现问题，请查看详细信息**")
        lines.append("")
        
        if issues:
            lines.append("## 问题详情")
            lines.append("")
            
            for i, issue in enumerate(issues, 1):
                severity_emoji = {
                    Severity.CRITICAL: "🔴",
                    Severity.HIGH: "🟠",
                    Severity.MEDIUM: "🟡",
                    Severity.LOW: "🟢"
                }.get(issue.get('severity'), "⚪")
                
                issue_type_name = MarkdownExporter._get_issue_type_name(issue.get('issue_type'))
                
                lines.append(f"### {i}. {severity_emoji} {issue_type_name}")
                lines.append("")
                lines.append(f"- **路径**: `{issue.get('path')}`")
                if issue.get('method'):
                    lines.append(f"- **方法**: {issue.get('method')}")
                lines.append(f"- **严重程度**: {issue.get('severity')}")
                lines.append("")
                
                if issue.get('description'):
                    lines.append("**描述:**")
                    lines.append(f"> {issue.get('description')}")
                    lines.append("")
                
                if issue.get('affected_routes'):
                    lines.append("**受影响的路由:**")
                    lines.append("")
                    for idx, route in enumerate(issue['affected_routes'], 1):
                        lines.append(f"{idx}. `{route.get('path')}` ({route.get('method')}) - 定义顺序: {route.get('order_index')}")
                    lines.append("")
                
                if issue.get('suggestion'):
                    lines.append("**建议修复:**")
                    lines.append(f"> {issue.get('suggestion')}")
                    lines.append("")
                
                lines.append("---")
                lines.append("")
        
        if fix_suggestions:
            lines.append("## 修复顺序建议")
            lines.append("")
            lines.append("建议按照以下优先级顺序修复问题：")
            lines.append("")
            
            for suggestion in fix_suggestions:
                priority = suggestion.get('priority', 0)
                issue_type = MarkdownExporter._get_issue_type_name(suggestion.get('issue_type'))
                
                lines.append(f"### 优先级 {priority}: {issue_type}")
                lines.append("")
                lines.append(f"- **描述**: {suggestion.get('description')}")
                lines.append(f"- **受影响路径**: {', '.join([f'`{p}`' for p in suggestion.get('affected_paths', [])])}")
                lines.append(f"- **建议操作**: {suggestion.get('suggested_action')}")
                lines.append("")
        
        if sample_results:
            lines.append("## 样例请求回放结果")
            lines.append("")
            lines.append("以下是样例请求 URL 的匹配结果：")
            lines.append("")
            
            for result in sample_results:
                url = result.get('url')
                method = result.get('method', 'GET')
                matched = result.get('matched', False)
                
                lines.append(f"### `{method} {url}`")
                lines.append("")
                
                if matched:
                    lines.append(f"- ✅ **匹配成功**")
                    lines.append(f"- **匹配路由**: `{result.get('matched_route')}`")
                    lines.append(f"- **匹配方法**: {result.get('matched_method')}")
                    lines.append(f"- **定义顺序**: {result.get('matched_order')}")
                    lines.append(f"- **是否动态路由**: {'是' if result.get('is_dynamic') else '否'}")
                    
                    all_matches = result.get('all_matches', [])
                    if len(all_matches) > 1:
                        lines.append("")
                        lines.append("**所有可能匹配的路由（按定义顺序）:**")
                        lines.append("")
                        for idx, match in enumerate(all_matches, 1):
                            dynamic_mark = " (动态)" if match.get('is_dynamic') else ""
                            lines.append(f"{idx}. `{match.get('path')}` ({match.get('method')}){dynamic_mark}")
                else:
                    lines.append(f"- ❌ **无匹配路由**")
                    lines.append(f"> 该 URL 没有匹配到任何已定义的路由")
                
                lines.append("")
        
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append("*此报告由 FastAPI 路由体检服务自动生成*")
        
        return "\n".join(lines)
    
    @staticmethod
    def _get_issue_type_name(issue_type: str) -> str:
        type_names = {
            IssueType.DYNAMIC_PARAM_CAPTURE: "动态参数截获",
            IssueType.DUPLICATE_PATH: "重复路径",
            IssueType.METHOD_CONFLICT: "HTTP 方法冲突",
            IssueType.UNREACHABLE: "不可达路由"
        }
        return type_names.get(issue_type, issue_type)
