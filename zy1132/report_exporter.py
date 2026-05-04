import json
import csv
from typing import Dict, List, Any
from datetime import datetime
import os

import config


class ReportExporter:
    def __init__(self, exports_dir: str):
        self.exports_dir = exports_dir
        os.makedirs(exports_dir, exist_ok=True)

    def export_markdown(self, assessment: Dict, scheme_data: Dict = None) -> str:
        md_lines = []
        
        md_lines.append("# 城市更新评估报告")
        md_lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        if scheme_data:
            md_lines.append(f"**方案名称**: {scheme_data.get('name', '未命名方案')}")
            md_lines.append(f"**方案ID**: {scheme_data.get('id', '')}")
        
        md_lines.append("\n---\n")
        
        metrics = assessment.get('parcel_metrics', {})
        md_lines.append("## 一、地块指标统计")
        md_lines.append("")
        md_lines.append("| 指标 | 数值 |")
        md_lines.append("|------|------|")
        md_lines.append(f"| 总地块数 | {metrics.get('total_parcels', 0)} 个 |")
        md_lines.append(f"| 总用地面积 | {metrics.get('total_area_sqm', 0):,.0f} 平方米 |")
        md_lines.append(f"| 居住用地面积 | {metrics.get('total_residential_area_sqm', 0):,.0f} 平方米 |")
        md_lines.append(f"| 商业用地面积 | {metrics.get('total_commercial_area_sqm', 0):,.0f} 平方米 |")
        md_lines.append(f"| 公共服务用地面积 | {metrics.get('total_public_area_sqm', 0):,.0f} 平方米 |")
        md_lines.append(f"| 绿地面积 | {metrics.get('total_green_area_sqm', 0):,.0f} 平方米 |")
        md_lines.append(f"| 绿地率 | {metrics.get('green_space_ratio', 0)}% |")
        md_lines.append(f"| 现状居住人口 | {metrics.get('existing_total_population', 0):,} 人 |")
        md_lines.append(f"| 估算规划人口 | {metrics.get('estimated_total_population', 0):,} 人 |")
        md_lines.append("")
        
        land_use = metrics.get('land_use_breakdown', {})
        if land_use:
            md_lines.append("### 用地性质分布")
            md_lines.append("")
            md_lines.append("| 用地类型 | 地块数 | 面积(平方米) | 占比 |")
            md_lines.append("|----------|--------|--------------|------|")
            for name, data in land_use.items():
                md_lines.append(f"| {name} | {data['count']} | {data['area_sqm']:,.0f} | {data['percentage']}% |")
            md_lines.append("")
        
        md_lines.append("\n---\n")
        
        service_scores = assessment.get('service_scores', {})
        total_score = service_scores.get('total_score', 0)
        category_scores = service_scores.get('category_scores', {})
        
        md_lines.append("## 二、服务设施评估")
        md_lines.append("")
        md_lines.append(f"### 综合评分: **{total_score} / 100**")
        md_lines.append("")
        md_lines.append("#### 分项评分")
        md_lines.append("")
        md_lines.append("| 类别 | 评分 | 权重 |")
        md_lines.append("|------|------|------|")
        
        category_names = {
            'education': '教育设施',
            'healthcare_elderly': '医疗养老',
            'green_space': '绿地空间',
            'commerce_market': '商业市场',
            'transportation': '交通出行',
            'community_services': '社区服务'
        }
        
        weights = service_scores.get('weights', {})
        for key, name in category_names.items():
            score = category_scores.get(key, 0)
            weight = weights.get(key, 0)
            md_lines.append(f"| {name} | {score} | {weight*100}% |")
        md_lines.append("")
        
        md_lines.append("\n---\n")
        
        md_lines.append("## 三、服务缺口分析")
        md_lines.append("")
        
        gaps = assessment.get('service_gaps', [])
        if gaps:
            md_lines.append("| 设施类型 | 服务半径 | 需求量 | 供应量 | 缺口 | 缺口率 | 严重程度 |")
            md_lines.append("|----------|----------|--------|--------|------|--------|----------|")
            
            severity_display = {
                'critical': '🔴 严重',
                'high': '🟠 较高',
                'medium': '🟡 中等',
                'low': '🟢 较低'
            }
            
            for gap in gaps:
                severity = severity_display.get(gap.get('severity', 'low'), gap.get('severity'))
                md_lines.append(f"| {gap.get('facility_name')} | {gap.get('radius_meters')}米 | "
                              f"{gap.get('demand')} | {gap.get('supply')} | "
                              f"{gap.get('gap')} | {gap.get('gap_percentage')}% | {severity} |")
            md_lines.append("")
            
            for gap in gaps:
                if gap.get('gap', 0) > 0:
                    md_lines.append(f"### {gap.get('facility_name')} 缺口详情")
                    md_lines.append(f"- 缺口: {gap.get('gap')} {gap.get('unit', '单位')}")
                    md_lines.append(f"- 缺口率: {gap.get('gap_percentage')}%")
                    md_lines.append(f"- 影响地块: {', '.join(gap.get('affected_parcels', [])) or '无'}")
                    md_lines.append(f"- 影响人口: {gap.get('affected_population', 0):,} 人")
                    md_lines.append("")
        else:
            md_lines.append("暂无服务缺口数据")
            md_lines.append("")
        
        md_lines.append("\n---\n")
        
        md_lines.append("## 四、冲突检查")
        md_lines.append("")
        
        conflicts = assessment.get('conflicts', [])
        if conflicts:
            md_lines.append(f"共发现 **{len(conflicts)}** 个冲突问题:")
            md_lines.append("")
            
            severity_display = {
                'high': '🔴 高风险',
                'medium': '🟡 中风险',
                'low': '🟢 低风险'
            }
            
            for i, conflict in enumerate(conflicts, 1):
                severity = severity_display.get(conflict.get('severity', 'medium'), conflict.get('severity'))
                md_lines.append(f"### {i}. {conflict.get('description')} [{severity}]")
                md_lines.append(f"- 位置: {conflict.get('location')}")
                md_lines.append(f"- 当前值: {conflict.get('current_value')}")
                md_lines.append(f"- 限值: {conflict.get('limit_value')}")
                md_lines.append(f"- 建议: {conflict.get('recommendation')}")
                md_lines.append("")
        else:
            md_lines.append("✅ 未发现明显冲突问题")
            md_lines.append("")
        
        md_lines.append("\n---\n")
        md_lines.append("*报告生成工具: 城市更新评估系统*")
        
        return "\n".join(md_lines)

    def export_html(self, assessment: Dict, scheme_data: Dict = None) -> str:
        markdown = self.export_markdown(assessment, scheme_data)
        
        html_template = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>城市更新评估报告</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }
        h1, h2, h3, h4 {
            color: #2c3e50;
            border-bottom: 2px solid #3498db;
            padding-bottom: 10px;
        }
        h1 {
            text-align: center;
            font-size: 2em;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
        }
        table th, table td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }
        table th {
            background-color: #3498db;
            color: white;
            font-weight: bold;
        }
        table tr:nth-child(even) {
            background-color: #f8f9fa;
        }
        hr {
            border: 0;
            border-top: 2px solid #eee;
            margin: 30px 0;
        }
        .score-high { color: #27ae60; font-weight: bold; }
        .score-medium { color: #f39c12; font-weight: bold; }
        .score-low { color: #e74c3c; font-weight: bold; }
        ul { margin: 10px 0 10px 20px; }
        li { margin: 5px 0; }
        .severity-critical { color: #c0392b; font-weight: bold; }
        .severity-high { color: #e67e22; font-weight: bold; }
        .severity-medium { color: #f1c40f; font-weight: bold; }
        .severity-low { color: #27ae60; font-weight: bold; }
        .footer {
            text-align: center;
            color: #7f8c8d;
            font-size: 0.9em;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
        }
    </style>
</head>
<body>
{{content}}
</body>
</html>"""
        
        html_content = markdown
        html_content = html_content.replace('## ', '<h2>').replace('\n---\n', '</h2>\n')
        html_content = html_content.replace('### ', '<h3>')
        html_content = html_content.replace('#### ', '<h4>')
        
        lines = html_content.split('\n')
        result = []
        in_table = False
        
        for line in lines:
            if line.startswith('| '):
                if not in_table:
                    result.append('<table>')
                    in_table = True
                cells = [c.strip() for c in line.strip('|').split('|')]
                if cells and all('---' in c for c in cells):
                    continue
                cell_tag = 'th' if len(result) == 1 and in_table else 'td'
                result.append('<tr>' + ''.join(f'<{cell_tag}>{c}</{cell_tag}>' for c in cells) + '</tr>')
            else:
                if in_table:
                    result.append('</table>')
                    in_table = False
                if line.startswith('# '):
                    result.append(f"<h1>{line[2:]}</h1>")
                elif line.startswith('- '):
                    result.append(f"<li>{line[2:]}</li>")
                elif line.startswith('**') and '**' in line[2:]:
                    result.append(f"<p>{line}</p>")
                elif line.strip():
                    result.append(f"<p>{line}</p>")
        
        if in_table:
            result.append('</table>')
        
        content = '\n'.join(result)
        return html_template.replace('{{content}}', content)

    def export_csv(self, assessment: Dict, scheme_data: Dict = None) -> Dict[str, str]:
        csv_files = {}
        
        metrics = assessment.get('parcel_metrics', {})
        metrics_lines = [
            ['指标', '数值'],
            ['总地块数', metrics.get('total_parcels', 0)],
            ['总用地面积(平方米)', metrics.get('total_area_sqm', 0)],
            ['居住用地面积(平方米)', metrics.get('total_residential_area_sqm', 0)],
            ['商业用地面积(平方米)', metrics.get('total_commercial_area_sqm', 0)],
            ['公共服务用地面积(平方米)', metrics.get('total_public_area_sqm', 0)],
            ['绿地面积(平方米)', metrics.get('total_green_area_sqm', 0)],
            ['绿地率(%)', metrics.get('green_space_ratio', 0)],
            ['现状居住人口', metrics.get('existing_total_population', 0)],
            ['估算规划人口', metrics.get('estimated_total_population', 0)]
        ]
        csv_files['metrics.csv'] = self._lines_to_csv(metrics_lines)
        
        gaps = assessment.get('service_gaps', [])
        if gaps:
            gaps_lines = [
                ['设施类型', '服务半径(米)', '需求量', '供应量', '缺口', '缺口率(%)', '严重程度', '影响地块数', '影响人口']
            ]
            for gap in gaps:
                gaps_lines.append([
                    gap.get('facility_name'),
                    gap.get('radius_meters'),
                    gap.get('demand'),
                    gap.get('supply'),
                    gap.get('gap'),
                    gap.get('gap_percentage'),
                    gap.get('severity'),
                    len(gap.get('affected_parcels', [])),
                    gap.get('affected_population')
                ])
            csv_files['service_gaps.csv'] = self._lines_to_csv(gaps_lines)
        
        conflicts = assessment.get('conflicts', [])
        if conflicts:
            conflicts_lines = [
                ['序号', '类型', '严重程度', '描述', '位置', '当前值', '限值', '建议']
            ]
            for i, c in enumerate(conflicts, 1):
                conflicts_lines.append([
                    i,
                    c.get('type'),
                    c.get('severity'),
                    c.get('description'),
                    c.get('location'),
                    c.get('current_value'),
                    c.get('limit_value'),
                    c.get('recommendation')
                ])
            csv_files['conflicts.csv'] = self._lines_to_csv(conflicts_lines)
        
        return csv_files

    def export_geojson(self, parcels: List[Dict], facilities: List[Dict] = None) -> Dict[str, str]:
        geojson_files = {}
        
        parcels_geojson = {
            "type": "FeatureCollection",
            "name": "parcels",
            "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
            "features": []
        }
        
        for parcel in parcels:
            feature = {
                "type": "Feature",
                "properties": {
                    "id": parcel.get('id'),
                    "name": parcel.get('name'),
                    "land_use": parcel.get('land_use'),
                    "area_sqm": parcel.get('area_sqm'),
                    "current_far": parcel.get('current_far'),
                    "plan_far": parcel.get('plan_far'),
                    "max_far": parcel.get('max_far'),
                    "building_area": parcel.get('building_area'),
                    "estimated_population": parcel.get('estimated_population')
                },
                "geometry": parcel.get('geometry')
            }
            parcels_geojson['features'].append(feature)
        
        geojson_files['parcels.geojson'] = json.dumps(parcels_geojson, ensure_ascii=False, indent=2)
        
        if facilities:
            facilities_geojson = {
                "type": "FeatureCollection",
                "name": "facilities",
                "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
                "features": []
            }
            
            for facility in facilities:
                feature = {
                    "type": "Feature",
                    "properties": {
                        "id": facility.get('id'),
                        "name": facility.get('name'),
                        "type": facility.get('type'),
                        "capacity": facility.get('capacity'),
                        "status": facility.get('status'),
                        "description": facility.get('description')
                    },
                    "geometry": {
                        "type": "Point",
                        "coordinates": [facility.get('lon'), facility.get('lat')]
                    }
                }
                facilities_geojson['features'].append(feature)
            
            geojson_files['facilities.geojson'] = json.dumps(facilities_geojson, ensure_ascii=False, indent=2)
        
        return geojson_files

    def _lines_to_csv(self, lines: List[List]) -> str:
        import io
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerows(lines)
        return output.getvalue()

    def save_report(self, filename: str, content: str) -> str:
        filepath = os.path.join(self.exports_dir, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return filepath
