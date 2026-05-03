import csv
import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

from .coverage import CoverageResult
from .geo import Point
from .models import (
    Issue, IssueType, IssueSeverity,
    SurveyLine, TrackPoint, CoverageSegment, SonarParameters
)
from .risk_detection import RiskResult


class ReportGenerator:
    def __init__(
        self,
        coverage_result: CoverageResult,
        risk_result: Optional[RiskResult] = None,
        survey_lines: List[SurveyLine] = None,
        track_points: List[TrackPoint] = None,
        sonar_params: SonarParameters = None
    ):
        self.coverage_result = coverage_result
        self.risk_result = risk_result
        self.survey_lines = survey_lines or []
        self.track_points = track_points or []
        self.sonar_params = sonar_params
        
        self.issues: List[Issue] = []
        self.issues.extend(coverage_result.issues)
        if risk_result and risk_result.issues:
            self.issues.extend(risk_result.issues)
    
    def generate_issues_csv(self, output_path: str):
        path = Path(output_path)
        
        if not self.issues:
            with open(path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([
                    'issue_id', 'issue_type', 'severity', 'description',
                    'latitude', 'longitude', 'start_time', 'end_time',
                    'related_line', 'track_indices', 'metrics'
                ])
            return
        
        fieldnames = list(self.issues[0].to_csv_row().keys())
        
        with open(path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for issue in self.issues:
                writer.writerow(issue.to_csv_row())
    
    def generate_markdown_report(self, output_path: str):
        path = Path(output_path)
        
        md_content = self._build_markdown()
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(md_content)
    
    def _build_markdown(self) -> str:
        lines = []
        
        lines.append("# 侧扫声呐测线覆盖复核报告")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        lines.append("## 摘要")
        lines.append("")
        lines.append("| 指标 | 值 |")
        lines.append("|------|-----|")
        lines.append(f"| 计划测线总长度 | {self.coverage_result.total_planned_length_m:.2f} 米 |")
        lines.append(f"| 实际覆盖长度 | {self.coverage_result.total_covered_length_m:.2f} 米 |")
        lines.append(f"| 漏扫总长度 | {self.coverage_result.total_gap_length_m:.2f} 米 |")
        lines.append(f"| 重叠总长度 | {self.coverage_result.total_overlap_m:.2f} 米 |")
        lines.append(f"| **覆盖率** | **{self.coverage_result.coverage_percentage:.1f}%** |")
        lines.append(f"| 漏扫率 | {self.coverage_result.gap_percentage:.1f}% |")
        lines.append(f"| 重叠浪费率 | {self.coverage_result.overlap_percentage:.1f}% |")
        lines.append("")
        
        if self.risk_result:
            lines.append("## 速度统计")
            lines.append("")
            lines.append(f"- 平均速度: {self.risk_result.avg_speed_knots:.2f} 节")
            lines.append(f"- 最大速度: {self.risk_result.max_speed_knots:.2f} 节")
            lines.append(f"- 最小速度: {self.risk_result.min_speed_knots:.2f} 节")
            lines.append(f"- 速度方差: {self.risk_result.speed_variance:.2f}")
            lines.append("")
        
        if self.issues:
            lines.append("## 问题统计")
            lines.append("")
            
            issue_by_type: Dict[str, int] = {}
            issue_by_severity: Dict[str, int] = {}
            
            for issue in self.issues:
                itype = issue.issue_type.value
                isev = issue.severity.value
                issue_by_type[itype] = issue_by_type.get(itype, 0) + 1
                issue_by_severity[isev] = issue_by_severity.get(isev, 0) + 1
            
            lines.append("### 按类型")
            lines.append("")
            lines.append("| 类型 | 数量 |")
            lines.append("|------|------|")
            for itype, count in issue_by_type.items():
                lines.append(f"| {itype} | {count} |")
            lines.append("")
            
            lines.append("### 按严重程度")
            lines.append("")
            lines.append("| 严重程度 | 数量 |")
            lines.append("|----------|------|")
            severity_order = ['critical', 'high', 'medium', 'low']
            for sev in severity_order:
                if sev in issue_by_severity:
                    lines.append(f"| {sev} | {issue_by_severity[sev]} |")
            lines.append("")
            
            lines.append("## 问题详情")
            lines.append("")
            
            for severity in [IssueSeverity.CRITICAL, IssueSeverity.HIGH, IssueSeverity.MEDIUM, IssueSeverity.LOW]:
                severity_issues = [i for i in self.issues if i.severity == severity]
                if not severity_issues:
                    continue
                
                lines.append(f"### {severity.value.upper()} 级")
                lines.append("")
                
                for issue in severity_issues:
                    lines.append(f"**{issue.issue_id}** - {issue.issue_type.value}")
                    lines.append(f"")
                    lines.append(f"  - 描述: {issue.description}")
                    if issue.location:
                        lines.append(f"  - 位置: {issue.location.lat:.6f}, {issue.location.lon:.6f}")
                    if issue.start_time:
                        lines.append(f"  - 时间: {issue.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
                        if issue.end_time and issue.end_time != issue.start_time:
                            lines.append(f"  - 结束时间: {issue.end_time.strftime('%Y-%m-%d %H:%M:%S')}")
                    if issue.related_line:
                        lines.append(f"  - 相关测线: {issue.related_line}")
                    lines.append("")
        
        if self.coverage_result.segments:
            lines.append("## 测线详情")
            lines.append("")
            
            for segment in self.coverage_result.segments:
                line = segment.survey_line
                lines.append(f"### 测线 {line.line_id}")
                lines.append("")
                lines.append(f"- 起点: {line.start_point.lat:.6f}, {line.start_point.lon:.6f}")
                lines.append(f"- 终点: {line.end_point.lat:.6f}, {line.end_point.lon:.6f}")
                lines.append(f"- 计划长度: {line.length():.2f} 米")
                lines.append(f"- 实际覆盖: {segment.length():.2f} 米")
                lines.append(f"- 计划扫幅: 左 {line.planned_swath_left:.1f}m / 右 {line.planned_swath_right:.1f}m")
                lines.append(f"- 实际扫幅: 左 {segment.actual_swath_left:.1f}m / 右 {segment.actual_swath_right:.1f}m")
                if segment.avg_speed > 0:
                    lines.append(f"- 平均速度: {segment.avg_speed:.2f} 节")
                if segment.start_time:
                    lines.append(f"- 开始时间: {segment.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
                if segment.end_time:
                    lines.append(f"- 结束时间: {segment.end_time.strftime('%Y-%m-%d %H:%M:%S')}")
                lines.append(f"- 状态: {segment.status}")
                lines.append("")
        
        return "\n".join(lines)
    
    def generate_html_preview(self, output_path: str):
        path = Path(output_path)
        
        html_content = self._build_html()
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(html_content)
    
    def _build_html(self) -> str:
        center_lat, center_lon = self._calculate_center()
        
        track_geojson = self._track_to_geojson()
        lines_geojson = self._lines_to_geojson()
        issues_geojson = self._issues_to_geojson()
        
        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>侧扫声呐覆盖预览</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }}
        #map {{ height: 100vh; width: 100%; }}
        .legend {{
            padding: 6px 8px;
            font: 14px/16px Arial, Helvetica, sans-serif;
            background: white;
            background: rgba(255,255,255,0.9);
            box-shadow: 0 0 15px rgba(0,0,0,0.2);
            border-radius: 5px;
        }}
        .legend h4 {{ margin: 0 0 5px; color: #777; }}
        .legend i {{
            width: 18px;
            height: 18px;
            float: left;
            margin-right: 8px;
            opacity: 0.7;
        }}
        .summary-panel {{
            position: absolute;
            top: 10px;
            right: 10px;
            z-index: 1000;
            background: white;
            background: rgba(255,255,255,0.95);
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            max-width: 300px;
        }}
        .summary-panel h3 {{ margin-bottom: 10px; color: #333; }}
        .summary-panel table {{ width: 100%; border-collapse: collapse; }}
        .summary-panel td {{ padding: 4px 0; border-bottom: 1px solid #eee; }}
        .summary-panel td:last-child {{ text-align: right; font-weight: bold; }}
        .good {{ color: #28a745; }}
        .warning {{ color: #ffc107; }}
        .danger {{ color: #dc3545; }}
    </style>
</head>
<body>
    <div id="map"></div>
    
    <div class="summary-panel">
        <h3>覆盖摘要</h3>
        <table>
            <tr><td>覆盖率</td><td class="{'good' if self.coverage_result.coverage_percentage >= 95 else 'warning' if self.coverage_result.coverage_percentage >= 80 else 'danger'}">{self.coverage_result.coverage_percentage:.1f}%</td></tr>
            <tr><td>漏扫长度</td><td class="{'danger' if self.coverage_result.gap_percentage > 5 else 'warning' if self.coverage_result.gap_percentage > 1 else 'good'}">{self.coverage_result.total_gap_length_m:.1f}m</td></tr>
            <tr><td>重叠长度</td><td>{self.coverage_result.total_overlap_m:.1f}m</td></tr>
            <tr><td>问题数量</td><td class="{'danger' if len(self.issues) > 5 else 'warning' if len(self.issues) > 0 else 'good'}">{len(self.issues)}</td></tr>
        </table>
    </div>
    
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
        var map = L.map('map').setView([{center_lat}, {center_lon}], 14);
        
        L.tileLayer('https://{{s}}.tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png', {{
            attribution: '&copy; OpenStreetMap contributors'
        }}).addTo(map);
        
        var trackData = {json.dumps(track_geojson)};
        var linesData = {json.dumps(lines_geojson)};
        var issuesData = {json.dumps(issues_geojson)};
        
        L.geoJSON(linesData, {{
            style: function(feature) {{
                return {{
                    color: '#0066cc',
                    weight: 4,
                    opacity: 0.7,
                    dashArray: '10, 10'
                }};
            }},
            onEachFeature: function(feature, layer) {{
                if (feature.properties && feature.properties.name) {{
                    layer.bindPopup('<b>测线: ' + feature.properties.name + '</b><br>长度: ' + (feature.properties.length_m || 0).toFixed(1) + 'm');
                }}
            }}
        }}).addTo(map);
        
        L.geoJSON(trackData, {{
            style: function(feature) {{
                return {{
                    color: '#28a745',
                    weight: 3,
                    opacity: 0.8
                }};
            }},
            onEachFeature: function(feature, layer) {{
                if (feature.properties && feature.properties.time) {{
                    layer.bindPopup('时间: ' + feature.properties.time + '<br>速度: ' + (feature.properties.speed_knots || 0).toFixed(1) + ' 节');
                }}
            }}
        }}).addTo(map);
        
        function getIssueColor(severity) {{
            switch(severity) {{
                case 'critical': return '#dc3545';
                case 'high': return '#fd7e14';
                case 'medium': return '#ffc107';
                case 'low': return '#20c997';
                default: return '#6c757d';
            }}
        }}
        
        function getIssueRadius(severity) {{
            switch(severity) {{
                case 'critical': return 10;
                case 'high': return 8;
                case 'medium': return 6;
                case 'low': return 4;
                default: return 5;
            }}
        }}
        
        L.geoJSON(issuesData, {{
            pointToLayer: function(feature, latlng) {{
                var severity = feature.properties.severity || 'low';
                return L.circleMarker(latlng, {{
                    radius: getIssueRadius(severity),
                    fillColor: getIssueColor(severity),
                    color: '#000',
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                }});
            }},
            onEachFeature: function(feature, layer) {{
                var props = feature.properties || {{}};
                var content = '<b>' + (props.type || 'Issue') + '</b><br>';
                content += '严重程度: ' + (props.severity || 'unknown') + '<br>';
                content += '描述: ' + (props.description || '');
                layer.bindPopup(content);
            }}
        }}).addTo(map);
        
        var legend = L.control({{position: 'bottomright'}});
        legend.onAdd = function(map) {{
            var div = L.DomUtil.create('div', 'legend');
            div.innerHTML += '<h4>图例</h4>';
            div.innerHTML += '<i style="background: #0066cc; border: 1px dashed #004c99;"></i> 计划测线<br>';
            div.innerHTML += '<i style="background: #28a745;"></i> 实际轨迹<br>';
            div.innerHTML += '<i style="background: #dc3545; border-radius: 50%;"></i> Critical<br>';
            div.innerHTML += '<i style="background: #fd7e14; border-radius: 50%;"></i> High<br>';
            div.innerHTML += '<i style="background: #ffc107; border-radius: 50%;"></i> Medium<br>';
            div.innerHTML += '<i style="background: #20c997; border-radius: 50%;"></i> Low<br>';
            return div;
        }};
        legend.addTo(map);
    </script>
</body>
</html>
"""
        return html
    
    def _calculate_center(self) -> tuple:
        all_points: List[Point] = []
        
        for line in self.survey_lines:
            all_points.append(line.start_point)
            all_points.append(line.end_point)
        
        for tp in self.track_points:
            all_points.append(tp.point)
        
        for issue in self.issues:
            if issue.location:
                all_points.append(issue.location)
        
        if not all_points:
            return (30.0, 120.0)
        
        avg_lat = sum(p.lat for p in all_points) / len(all_points)
        avg_lon = sum(p.lon for p in all_points) / len(all_points)
        
        return (avg_lat, avg_lon)
    
    def _track_to_geojson(self) -> dict:
        if not self.track_points:
            return {"type": "FeatureCollection", "features": []}
        
        features = []
        
        if len(self.track_points) >= 2:
            coords = [[tp.point.lon, tp.point.lat] for tp in self.track_points]
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": coords
                },
                "properties": {
                    "name": "轨迹",
                    "point_count": len(self.track_points)
                }
            })
        
        for i, tp in enumerate(self.track_points):
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [tp.point.lon, tp.point.lat]
                },
                "properties": {
                    "index": i,
                    "time": tp.timestamp.strftime('%Y-%m-%d %H:%M:%S') if tp.timestamp else "",
                    "speed_knots": tp.speed,
                    "heading": tp.heading,
                    "depth": tp.depth
                }
            })
        
        return {"type": "FeatureCollection", "features": features}
    
    def _lines_to_geojson(self) -> dict:
        if not self.survey_lines:
            return {"type": "FeatureCollection", "features": []}
        
        features = []
        
        for line in self.survey_lines:
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [line.start_point.lon, line.start_point.lat],
                        [line.end_point.lon, line.end_point.lat]
                    ]
                },
                "properties": {
                    "name": line.line_id,
                    "length_m": line.length(),
                    "planned_swath_left": line.planned_swath_left,
                    "planned_swath_right": line.planned_swath_right,
                    "notes": line.notes
                }
            })
        
        return {"type": "FeatureCollection", "features": features}
    
    def _issues_to_geojson(self) -> dict:
        if not self.issues:
            return {"type": "FeatureCollection", "features": []}
        
        features = []
        
        for issue in self.issues:
            if not issue.location:
                continue
            
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [issue.location.lon, issue.location.lat]
                },
                "properties": {
                    "id": issue.issue_id,
                    "type": issue.issue_type.value,
                    "severity": issue.severity.value,
                    "description": issue.description,
                    "related_line": issue.related_line or ""
                }
            })
        
        return {"type": "FeatureCollection", "features": features}
