import json
import os
from datetime import datetime
from typing import Dict, List, Any, Optional
from pathlib import Path
import aiofiles


class ReportService:
    def __init__(self, reports_dir: str = "./reports"):
        self.reports_dir = Path(reports_dir)
        self.reports_dir.mkdir(parents=True, exist_ok=True)
    
    def _get_score_color(self, score: float) -> str:
        if score >= 80:
            return "green"
        elif score >= 60:
            return "yellow"
        else:
            return "red"
    
    def _get_score_label(self, score: float) -> str:
        if score >= 80:
            return "Good"
        elif score >= 60:
            return "Fair"
        elif score >= 40:
            return "Needs Attention"
        else:
            return "Poor"
    
    async def generate_report_data(
        self,
        session_data: Dict[str, Any],
        analysis_results: List[Dict[str, Any]],
        key_analyses: List[Dict[str, Any]],
        comparison_results: List[Dict[str, Any]],
        report_type: str = "full"
    ) -> Dict[str, Any]:
        report_data = {
            "report_metadata": {
                "report_type": report_type,
                "generated_at": datetime.utcnow().isoformat(),
                "session_id": session_data.get("id"),
                "session_name": session_data.get("session_name"),
                "session_created_at": session_data.get("created_at").isoformat() if session_data.get("created_at") else None,
            },
            "summary": {},
            "structure_analysis": {},
            "memory_analysis": {},
            "risk_assessment": {},
            "migration_analysis": {},
            "key_details": [],
            "comparisons": [],
            "recommendations": [],
        }
        
        total_keys = len(key_analyses)
        if total_keys > 0:
            avg_suitability = sum(
                ka.get("current_type_suitability", 50) or 50
                for ka in key_analyses
            ) / total_keys
            
            hot_keys = sum(1 for ka in key_analyses if ka.get("is_hot_key"))
            big_keys = sum(1 for ka in key_analyses if ka.get("is_big_key"))
            high_ttl_risk = sum(1 for ka in key_analyses if ka.get("ttl_risk_level") == "high")
            high_migration_risk = sum(1 for ka in key_analyses if ka.get("migration_risk_level") == "high")
            
            type_distribution: Dict[str, int] = {}
            scenario_distribution: Dict[str, int] = {}
            for ka in key_analyses:
                dt = ka.get("data_type", "unknown")
                type_distribution[dt] = type_distribution.get(dt, 0) + 1
                
                sc = ka.get("scenario", "unknown")
                scenario_distribution[sc] = scenario_distribution.get(sc, 0) + 1
            
            total_memory = sum(
                ka.get("estimated_memory_bytes", 0) or 0
                for ka in key_analyses
            )
            
            report_data["summary"] = {
                "total_keys_analyzed": total_keys,
                "average_suitability_score": round(avg_suitability, 2),
                "suitability_label": self._get_score_label(avg_suitability),
                "hot_keys": hot_keys,
                "big_keys": big_keys,
                "high_ttl_risk_keys": high_ttl_risk,
                "high_migration_risk_keys": high_migration_risk,
                "total_estimated_memory_bytes": total_memory,
                "total_estimated_memory_mb": round(total_memory / (1024 * 1024), 2),
                "data_type_distribution": type_distribution,
                "scenario_distribution": scenario_distribution,
            }
        
        for ar in analysis_results:
            analysis_type = ar.get("analysis_type", "unknown")
            if analysis_type == "structure":
                report_data["structure_analysis"] = {
                    "score": ar.get("score"),
                    "summary": ar.get("summary"),
                    "issues_found": ar.get("issues_found"),
                    "warnings_found": ar.get("warnings_found"),
                }
            elif analysis_type == "memory":
                report_data["memory_analysis"] = {
                    "score": ar.get("score"),
                    "summary": ar.get("summary"),
                    "issues_found": ar.get("issues_found"),
                    "warnings_found": ar.get("warnings_found"),
                }
            elif analysis_type == "risk":
                report_data["risk_assessment"] = {
                    "score": ar.get("score"),
                    "summary": ar.get("summary"),
                    "issues_found": ar.get("issues_found"),
                    "warnings_found": ar.get("warnings_found"),
                }
            elif analysis_type == "migration":
                report_data["migration_analysis"] = {
                    "score": ar.get("score"),
                    "summary": ar.get("summary"),
                    "issues_found": ar.get("issues_found"),
                    "warnings_found": ar.get("warnings_found"),
                }
        
        if report_type == "full":
            report_data["key_details"] = key_analyses
            report_data["comparisons"] = comparison_results
        elif report_type == "summary":
            report_data["key_details"] = [
                ka for ka in key_analyses
                if ka.get("is_hot_key") or ka.get("is_big_key") 
                or ka.get("ttl_risk_level") == "high"
                or ka.get("migration_risk_level") == "high"
            ]
            report_data["comparisons"] = []
        elif report_type == "migration":
            report_data["key_details"] = [
                ka for ka in key_analyses
                if ka.get("migration_risk_level") in ["high", "medium"]
            ]
            report_data["comparisons"] = comparison_results
        
        recommendations = []
        
        for ka in key_analyses:
            if ka.get("is_hot_key"):
                recommendations.append({
                    "category": "hot_key",
                    "key": ka.get("key_name"),
                    "severity": "high",
                    "message": f"Hot key detected: {ka.get('key_name')} - Consider sharding or caching",
                })
            
            if ka.get("is_big_key"):
                recommendations.append({
                    "category": "big_key",
                    "key": ka.get("key_name"),
                    "severity": "high",
                    "message": f"Big key detected: {ka.get('key_name')} - Consider splitting or using appropriate data structure",
                })
            
            if ka.get("ttl_risk_level") == "high":
                recommendations.append({
                    "category": "ttl",
                    "key": ka.get("key_name"),
                    "severity": "high",
                    "message": f"High TTL risk: {ka.get('key_name')} - Review TTL settings",
                })
            
            if ka.get("migration_risk_level") == "high":
                recommendations.append({
                    "category": "migration",
                    "key": ka.get("key_name"),
                    "severity": "high",
                    "message": f"High migration risk: {ka.get('key_name')} - Plan migration carefully",
                })
            
            suitability = ka.get("current_type_suitability") or 50
            if suitability < 60 and ka.get("recommended_type"):
                recommendations.append({
                    "category": "structure",
                    "key": ka.get("key_name"),
                    "severity": "medium",
                    "message": f"Consider migrating {ka.get('key_name')} from {ka.get('data_type')} to {ka.get('recommended_type')}",
                })
        
        seen = set()
        unique_recommendations = []
        for rec in recommendations:
            key = (rec["key"], rec["category"])
            if key not in seen:
                seen.add(key)
                unique_recommendations.append(rec)
        
        report_data["recommendations"] = unique_recommendations
        
        return report_data
    
    async def generate_json_report(
        self,
        report_data: Dict[str, Any],
        session_id: int,
        report_type: str
    ) -> str:
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"report_{session_id}_{report_type}_{timestamp}.json"
        filepath = self.reports_dir / filename
        
        async with aiofiles.open(filepath, "w", encoding="utf-8") as f:
            await f.write(json.dumps(report_data, indent=2, ensure_ascii=False))
        
        return str(filepath)
    
    async def generate_markdown_report(
        self,
        report_data: Dict[str, Any],
        session_id: int,
        report_type: str
    ) -> str:
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"report_{session_id}_{report_type}_{timestamp}.md"
        filepath = self.reports_dir / filename
        
        md_lines = []
        
        md_lines.append("# Redis Structure Audit Report")
        md_lines.append("")
        
        md_lines.append("## Report Metadata")
        md_lines.append("")
        metadata = report_data.get("report_metadata", {})
        md_lines.append(f"- **Report Type**: {metadata.get('report_type', 'unknown')}")
        md_lines.append(f"- **Generated At**: {metadata.get('generated_at', 'unknown')}")
        md_lines.append(f"- **Session ID**: {metadata.get('session_id', 'unknown')}")
        md_lines.append(f"- **Session Name**: {metadata.get('session_name', 'unknown')}")
        md_lines.append("")
        
        md_lines.append("## Executive Summary")
        md_lines.append("")
        summary = report_data.get("summary", {})
        if summary:
            avg_score = summary.get("average_suitability_score", 0)
            md_lines.append(f"### Overall Score: {avg_score:.2f}/100 ({self._get_score_label(avg_score)})")
            md_lines.append("")
            md_lines.append("| Metric | Value |")
            md_lines.append("|--------|-------|")
            md_lines.append(f"| Total Keys Analyzed | {summary.get('total_keys_analyzed', 0)} |")
            md_lines.append(f"| Hot Keys | {summary.get('hot_keys', 0)} |")
            md_lines.append(f"| Big Keys | {summary.get('big_keys', 0)} |")
            md_lines.append(f"| High TTL Risk | {summary.get('high_ttl_risk_keys', 0)} |")
            md_lines.append(f"| High Migration Risk | {summary.get('high_migration_risk_keys', 0)} |")
            md_lines.append(f"| Total Estimated Memory | {summary.get('total_estimated_memory_mb', 0)} MB |")
            md_lines.append("")
            
            type_dist = summary.get("data_type_distribution", {})
            if type_dist:
                md_lines.append("### Data Type Distribution")
                md_lines.append("")
                for dtype, count in type_dist.items():
                    md_lines.append(f"- **{dtype}**: {count} keys")
                md_lines.append("")
            
            scenario_dist = summary.get("scenario_distribution", {})
            if scenario_dist:
                md_lines.append("### Scenario Distribution")
                md_lines.append("")
                for scenario, count in scenario_dist.items():
                    md_lines.append(f"- **{scenario}**: {count} keys")
                md_lines.append("")
        
        md_lines.append("## Recommendations")
        md_lines.append("")
        recommendations = report_data.get("recommendations", [])
        if recommendations:
            high_recs = [r for r in recommendations if r.get("severity") == "high"]
            medium_recs = [r for r in recommendations if r.get("severity") == "medium"]
            
            if high_recs:
                md_lines.append("### High Priority")
                md_lines.append("")
                for rec in high_recs:
                    md_lines.append(f"1. **{rec.get('category').upper()}**: {rec.get('key')}")
                    md_lines.append(f"   - {rec.get('message')}")
                    md_lines.append("")
            
            if medium_recs:
                md_lines.append("### Medium Priority")
                md_lines.append("")
                for rec in medium_recs:
                    md_lines.append(f"1. **{rec.get('category').upper()}**: {rec.get('key')}")
                    md_lines.append(f"   - {rec.get('message')}")
                    md_lines.append("")
        else:
            md_lines.append("No critical recommendations found. Your Redis structure looks good!")
            md_lines.append("")
        
        key_details = report_data.get("key_details", [])
        if key_details and report_type == "full":
            md_lines.append("## Key Details")
            md_lines.append("")
            
            for ka in key_details[:50]:
                md_lines.append(f"### {ka.get('key_name', 'Unknown')}")
                md_lines.append("")
                md_lines.append(f"- **Data Type**: {ka.get('data_type', 'unknown')}")
                md_lines.append(f"- **Scenario**: {ka.get('scenario', 'unknown')}")
                md_lines.append(f"- **Suitability Score**: {ka.get('current_type_suitability', 0):.2f}/100")
                md_lines.append(f"- **Recommended Type**: {ka.get('recommended_type', 'N/A')}")
                md_lines.append(f"- **Estimated Memory**: {ka.get('estimated_memory_bytes', 0)} bytes")
                md_lines.append(f"- **Hot Key**: {'Yes' if ka.get('is_hot_key') else 'No'}")
                md_lines.append(f"- **Big Key**: {'Yes' if ka.get('is_big_key') else 'No'}")
                md_lines.append(f"- **TTL Risk**: {ka.get('ttl_risk_level', 'unknown')}")
                md_lines.append(f"- **Migration Risk**: {ka.get('migration_risk_level', 'unknown')}")
                
                issues = ka.get("issues", [])
                if issues:
                    md_lines.append(f"- **Issues**:")
                    for issue in issues:
                        md_lines.append(f"  - {issue}")
                
                suggestions = ka.get("suggestions", [])
                if suggestions:
                    md_lines.append(f"- **Suggestions**:")
                    for sug in suggestions:
                        md_lines.append(f"  - {sug}")
                
                md_lines.append("")
        
        async with aiofiles.open(filepath, "w", encoding="utf-8") as f:
            await f.write("\n".join(md_lines))
        
        return str(filepath)
    
    async def generate_html_report(
        self,
        report_data: Dict[str, Any],
        session_id: int,
        report_type: str
    ) -> str:
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"report_{session_id}_{report_type}_{timestamp}.html"
        filepath = self.reports_dir / filename
        
        summary = report_data.get("summary", {})
        avg_score = summary.get("average_suitability_score", 0)
        score_color = self._get_score_color(avg_score)
        score_label = self._get_score_label(avg_score)
        
        metadata = report_data.get("report_metadata", {})
        
        recommendations = report_data.get("recommendations", [])
        high_recs = [r for r in recommendations if r.get("severity") == "high"]
        medium_recs = [r for r in recommendations if r.get("severity") == "medium"]
        
        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Redis Structure Audit Report</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; padding: 20px; }}
        .container {{ max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 40px; }}
        h1 {{ color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 15px; margin-bottom: 30px; }}
        h2 {{ color: #34495e; margin: 30px 0 20px; border-left: 4px solid #3498db; padding-left: 15px; }}
        h3 {{ color: #5d6d7e; margin: 20px 0 15px; }}
        .score-badge {{ display: inline-block; padding: 10px 30px; border-radius: 50px; font-size: 24px; font-weight: bold; color: white; margin: 20px 0; }}
        .score-green {{ background: #27ae60; }}
        .score-yellow {{ background: #f39c12; }}
        .score-red {{ background: #e74c3c; }}
        .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }}
        .card {{ background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }}
        .card .value {{ font-size: 32px; font-weight: bold; color: #3498db; }}
        .card .label {{ font-size: 14px; color: #7f8c8d; margin-top: 5px; }}
        table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
        th, td {{ padding: 12px 15px; text-align: left; border-bottom: 1px solid #ddd; }}
        th {{ background: #3498db; color: white; font-weight: 600; }}
        tr:hover {{ background: #f8f9fa; }}
        .alert {{ padding: 15px; margin: 15px 0; border-radius: 4px; border-left: 4px solid; }}
        .alert-danger {{ background: #fdf2f2; border-color: #e74c3c; color: #c0392b; }}
        .alert-warning {{ background: #fff8e6; border-color: #f39c12; color: #d35400; }}
        .alert-success {{ background: #f0fdf4; border-color: #27ae60; color: #1e8449; }}
        .metadata {{ background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }}
        .metadata p {{ margin: 8px 0; }}
        .key-item {{ background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 15px 0; }}
        .key-item h4 {{ color: #2c3e50; margin-bottom: 15px; }}
        .key-item p {{ margin: 8px 0; }}
        .tag {{ display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-right: 8px; }}
        .tag-green {{ background: #d4edda; color: #155724; }}
        .tag-red {{ background: #f8d7da; color: #721c24; }}
        .tag-yellow {{ background: #fff3cd; color: #856404; }}
        .footer {{ text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #7f8c8d; font-size: 14px; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>Redis Structure Audit Report</h1>
        
        <div class="metadata">
            <p><strong>Report Type:</strong> {metadata.get('report_type', 'unknown')}</p>
            <p><strong>Generated At:</strong> {metadata.get('generated_at', 'unknown')}</p>
            <p><strong>Session ID:</strong> {metadata.get('session_id', 'unknown')}</p>
            <p><strong>Session Name:</strong> {metadata.get('session_name', 'unknown')}</p>
        </div>
        
        <h2>Executive Summary</h2>
        
        <div class="score-badge score-{score_color}">
            {avg_score:.2f}/100 - {score_label}
        </div>
        
        <div class="grid">
            <div class="card">
                <div class="value">{summary.get('total_keys_analyzed', 0)}</div>
                <div class="label">Total Keys</div>
            </div>
            <div class="card">
                <div class="value">{summary.get('hot_keys', 0)}</div>
                <div class="label">Hot Keys</div>
            </div>
            <div class="card">
                <div class="value">{summary.get('big_keys', 0)}</div>
                <div class="label">Big Keys</div>
            </div>
            <div class="card">
                <div class="value">{summary.get('total_estimated_memory_mb', 0)} MB</div>
                <div class="label">Estimated Memory</div>
            </div>
        </div>
        
        <h2>Recommendations</h2>
"""
        
        if high_recs:
            html_content += f"""
        <h3>High Priority ({len(high_recs)})</h3>
"""
            for rec in high_recs:
                html_content += f"""
        <div class="alert alert-danger">
            <strong>{rec.get('category', '').upper()}</strong>: {rec.get('key')}<br>
            {rec.get('message')}
        </div>
"""
        
        if medium_recs:
            html_content += f"""
        <h3>Medium Priority ({len(medium_recs)})</h3>
"""
            for rec in medium_recs:
                html_content += f"""
        <div class="alert alert-warning">
            <strong>{rec.get('category', '').upper()}</strong>: {rec.get('key')}<br>
            {rec.get('message')}
        </div>
"""
        
        if not high_recs and not medium_recs:
            html_content += """
        <div class="alert alert-success">
            <strong>Excellent!</strong> No critical recommendations found. Your Redis structure looks good!
        </div>
"""
        
        key_details = report_data.get("key_details", [])
        if key_details and report_type == "full":
            html_content += f"""
        <h2>Key Details ({len(key_details)} keys)</h2>
"""
            for ka in key_details[:50]:
                suitability = ka.get('current_type_suitability', 0) or 0
                suit_color = "green" if suitability >= 60 else "yellow" if suitability >= 40 else "red"
                tags = []
                if ka.get('is_hot_key'):
                    tags.append('<span class="tag tag-red">Hot Key</span>')
                if ka.get('is_big_key'):
                    tags.append('<span class="tag tag-red">Big Key</span>')
                if ka.get('ttl_risk_level') == "high":
                    tags.append('<span class="tag tag-yellow">High TTL Risk</span>')
                if ka.get('migration_risk_level') == "high":
                    tags.append('<span class="tag tag-yellow">High Migration Risk</span>')
                
                html_content += f"""
        <div class="key-item">
            <h4>{ka.get('key_name', 'Unknown')} {''.join(tags)}</h4>
            <p><strong>Data Type:</strong> {ka.get('data_type', 'unknown')} | 
               <strong>Scenario:</strong> {ka.get('scenario', 'unknown')} | 
               <strong>Suitability:</strong> <span class="tag tag-{suit_color}">{suitability:.2f}/100</span></p>
            <p><strong>Recommended Type:</strong> {ka.get('recommended_type', 'N/A')} | 
               <strong>Estimated Memory:</strong> {ka.get('estimated_memory_bytes', 0)} bytes</p>
"""
                issues = ka.get("issues", [])
                if issues:
                    html_content += f"""
            <p><strong>Issues:</strong></p>
            <ul>
"""
                    for issue in issues:
                        html_content += f"                <li>{issue}</li>\n"
                    html_content += "            </ul>\n"
                
                suggestions = ka.get("suggestions", [])
                if suggestions:
                    html_content += f"""
            <p><strong>Suggestions:</strong></p>
            <ul>
"""
                    for sug in suggestions:
                        html_content += f"                <li>{sug}</li>\n"
                    html_content += "            </ul>\n"
                
                html_content += "        </div>\n"
        
        html_content += f"""
        <div class="footer">
            <p>Generated by Redis Structure Audit API</p>
        </div>
    </div>
</body>
</html>
"""
        
        async with aiofiles.open(filepath, "w", encoding="utf-8") as f:
            await f.write(html_content)
        
        return str(filepath)
