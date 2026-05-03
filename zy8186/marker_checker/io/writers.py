import csv
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from ..core.packing import LayoutResult, PlacedPiece
from ..core.defects import DefectZone
from ..core.units import UnitConverter


class OutputWriter:
    def __init__(self, output_unit: str = 'mm'):
        self.output_unit = output_unit
        self.converter = UnitConverter()
    
    def _convert(self, value_mm: float) -> float:
        return self.converter.from_mm(value_mm, self.output_unit)
    
    def write_issues_csv(self, issues: List[Dict[str, Any]], filepath: str):
        if not issues:
            with open(filepath, 'w', encoding='utf-8', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=['type', 'severity', 'file', 'row', 'message'])
                writer.writeheader()
            return
        
        fieldnames = set()
        for issue in issues:
            fieldnames.update(issue.keys())
        fieldnames = sorted(list(fieldnames))
        
        with open(filepath, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for issue in issues:
                writer.writerow(issue)
    
    def write_marker_report(self, layouts: List[LayoutResult], 
                            waste_stats: Dict[str, Any],
                            input_data: Dict[str, Any],
                            issues: List[Dict[str, Any]],
                            filepath: str):
        report = self._generate_marker_report(layouts, waste_stats, input_data, issues)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(report)
    
    def _generate_marker_report(self, layouts: List[LayoutResult], 
                                  waste_stats: Dict[str, Any],
                                  input_data: Dict[str, Any],
                                  issues: List[Dict[str, Any]]) -> str:
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        lines = [
            "# 唛架排料预检报告",
            "",
            f"**生成时间**: {now}",
            f"**输出单位**: {self.output_unit}",
            "",
            "---",
            "",
        ]
        
        lines.extend([
            "## 1. 损耗统计",
            "",
            f"- **总面料面积**: {self._convert(waste_stats['total_area']):.2f} {self.output_unit}²",
            f"- **已使用面积**: {self._convert(waste_stats['used_area']):.2f} {self.output_unit}²",
            f"- **未排布面积**: {self._convert(waste_stats.get('unplaced_area', 0)):.2f} {self.output_unit}²",
            f"- **损耗面积**: {self._convert(waste_stats['waste_area']):.2f} {self.output_unit}²",
            f"- **损耗率**: {waste_stats['waste_percentage']}%",
            f"- **排版效率**: {waste_stats['efficiency']}%",
            "",
        ])
        
        lines.extend([
            "## 2. 面料使用详情",
            "",
        ])
        
        for i, layout in enumerate(layouts, 1):
            lines.extend([
                f"### 2.{i} 面料: {layout.fabric_name}",
                "",
                f"- **门幅**: {self._convert(layout.fabric_width):.2f} {self.output_unit}",
                f"- **实际用料长度**: {self._convert(layout.fabric_length):.2f} {self.output_unit}",
                f"- **已排布裁片数**: {len(layout.placed_pieces)}",
                f"- **未排布裁片数**: {len(layout.unplaced_pieces)}",
                f"- **瑕疵避让次数**: {layout.defects_avoided}",
                "",
            ])
            
            if layout.placed_pieces:
                lines.append("#### 已排布裁片列表:")
                lines.append("")
                lines.append("| 裁片名称 | 位置 (X,Y) | 尺寸 (宽x高) | 旋转角度 |")
                lines.append("|----------|------------|--------------|----------|")
                
                for p in layout.placed_pieces:
                    x = self._convert(p.x)
                    y = self._convert(p.y)
                    w = self._convert(p.width)
                    h = self._convert(p.height)
                    lines.append(f"| {p.piece.name} | ({x:.1f}, {y:.1f}) | {w:.1f}x{h:.1f} | {p.rotation}° |")
                lines.append("")
            
            if layout.unplaced_pieces:
                lines.append("#### 未排布裁片列表:")
                lines.append("")
                lines.append("| 裁片名称 | 尺寸 (宽x高) | 原因 |")
                lines.append("|----------|--------------|------|")
                
                for p in layout.unplaced_pieces:
                    w = self._convert(p.width_mm)
                    h = self._convert(p.height_mm)
                    lines.append(f"| {p.name} | {w:.1f}x{h:.1f} | 门幅不足或纹向冲突 |")
                lines.append("")
        
        lines.extend([
            "## 3. 问题汇总",
            "",
        ])
        
        if issues:
            error_issues = [i for i in issues if i.get('severity') == 'error']
            warning_issues = [i for i in issues if i.get('severity') == 'warning']
            info_issues = [i for i in issues if i.get('severity') not in ['error', 'warning']]
            
            if error_issues:
                lines.append("### 3.1 错误 (必须修复)")
                lines.append("")
                for issue in error_issues:
                    lines.append(f"- **[{issue.get('file', 'N/A')}]** {issue.get('message', '未知错误')}")
                lines.append("")
            
            if warning_issues:
                lines.append("### 3.2 警告 (建议检查)")
                lines.append("")
                for issue in warning_issues:
                    lines.append(f"- **[{issue.get('file', 'N/A')}]** {issue.get('message', '未知警告')}")
                lines.append("")
            
            if info_issues:
                lines.append("### 3.3 提示信息")
                lines.append("")
                for issue in info_issues:
                    lines.append(f"- **[{issue.get('file', 'N/A')}]** {issue.get('message', '提示')}")
                lines.append("")
        else:
            lines.append("*未检测到问题*")
            lines.append("")
        
        lines.extend([
            "---",
            "",
            "*此报告由 Marker Checker 自动生成*",
        ])
        
        return "\n".join(lines)
    
    def write_layout_html(self, layouts: List[LayoutResult], 
                           defects: List[DefectZone],
                           filepath: str):
        html = self._generate_layout_html(layouts, defects)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html)
    
    def _generate_layout_html(self, layouts: List[LayoutResult], 
                                defects: List[DefectZone]) -> str:
        max_width = max(l.fabric_width for l in layouts) if layouts else 1500
        total_height = sum(l.fabric_length + 50 for l in layouts) if layouts else 1000
        
        scale = min(800 / max_width, 600 / total_height) if max_width > 0 and total_height > 0 else 0.5
        
        defect_colors = {
            'minor': '#ffeb3b',
            'medium': '#ff9800',
            'major': '#f44336',
            'critical': '#9c27b0',
        }
        
        piece_colors = [
            '#4caf50', '#2196f3', '#9c27b0', '#ff9800', 
            '#00bcd4', '#e91e63', '#ffeb3b', '#8bc34a',
        ]
        
        html_parts = [
            '<!DOCTYPE html>',
            '<html lang="zh-CN">',
            '<head>',
            '    <meta charset="UTF-8">',
            '    <meta name="viewport" content="width=device-width, initial-scale=1.0">',
            '    <title>唛架排料布局图</title>',
            '    <style>',
            '        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }',
            '        .container { max-width: 1200px; margin: 0 auto; }',
            '        h1 { color: #333; text-align: center; }',
            '        .legend { display: flex; flex-wrap: wrap; gap: 10px; margin: 20px 0; padding: 10px; background: white; border-radius: 5px; }',
            '        .legend-item { display: flex; align-items: center; gap: 5px; font-size: 12px; }',
            '        .legend-color { width: 20px; height: 20px; border: 1px solid #333; }',
            '        .layout { background: white; padding: 20px; margin: 20px 0; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }',
            '        .layout h2 { margin-top: 0; color: #555; }',
            '        .fabric-info { font-size: 14px; color: #666; margin: 10px 0; }',
            '        .svg-container { overflow-x: auto; }',
            '        .piece-label { font-size: 10px; fill: #333; pointer-events: none; }',
            '        .tooltip { position: absolute; background: #333; color: white; padding: 5px 10px; border-radius: 3px; font-size: 12px; pointer-events: none; display: none; z-index: 1000; }',
            '    </style>',
            '</head>',
            '<body>',
            '    <div class="container">',
            '        <h1>唛架排料布局图</h1>',
            '',
            '        <div class="legend">',
            '            <div class="legend-item"><div class="legend-color" style="background: #e0e0e0;"></div> 面料区域</div>',
            '            <div class="legend-item"><div class="legend-color" style="background: #4caf50;"></div> 已排布裁片</div>',
            '            <div class="legend-item"><div class="legend-color" style="background: #ffeb3b;"></div> 轻微瑕疵</div>',
            '            <div class="legend-item"><div class="legend-color" style="background: #ff9800;"></div> 中等瑕疵</div>',
            '            <div class="legend-item"><div class="legend-color" style="background: #f44336;"></div> 严重瑕疵</div>',
            '            <div class="legend-item"><div class="legend-color" style="background: #9c27b0;"></div> 致命瑕疵</div>',
            '        </div>',
        ]
        
        current_y = 0
        for layout_idx, layout in enumerate(layouts):
            fabric_name = layout.fabric_name
            fabric_width = layout.fabric_width
            fabric_length = layout.fabric_length if layout.fabric_length > 0 else 100
            
            svg_width = fabric_width * scale
            svg_height = fabric_length * scale
            
            html_parts.extend([
                '',
                f'        <div class="layout">',
                f'            <h2>面料: {fabric_name}</h2>',
                f'            <div class="fabric-info">',
                f'                门幅: {fabric_width:.1f}mm | 用料长度: {fabric_length:.1f}mm | 已排布: {len(layout.placed_pieces)} 片',
                f'            </div>',
                f'            <div class="svg-container">',
                f'                <svg width="{svg_width + 40}" height="{svg_height + 40}" viewBox="-20 -20 {svg_width + 40} {svg_height + 40}">',
            ])
            
            html_parts.append(f'                    <rect x="0" y="0" width="{svg_width}" height="{svg_height}" fill="#e0e0e0" stroke="#999" stroke-width="1"/>')
            
            if defects and layout_idx == 0:
                for defect in defects:
                    dx = defect.x_mm * scale
                    dy = defect.y_mm * scale
                    dw = defect.width_mm * scale
                    dh = defect.height_mm * scale
                    
                    color = defect_colors.get(defect.severity.value, '#ffeb3b')
                    tooltip = f"{defect.description} ({defect.severity.value})"
                    
                    html_parts.append(
                        f'                    <rect x="{dx}" y="{dy}" width="{dw}" height="{dh}" '
                        f'fill="{color}" fill-opacity="0.5" stroke="#666" stroke-width="1" '
                        f'title="{tooltip}"/>'
                    )
            
            color_index = 0
            for piece in layout.placed_pieces:
                px = piece.x * scale
                py = piece.y * scale
                pw = piece.width * scale
                ph = piece.height * scale
                
                color = piece_colors[color_index % len(piece_colors)]
                color_index += 1
                
                html_parts.append(
                    f'                    <rect x="{px}" y="{py}" width="{pw}" height="{ph}" '
                    f'fill="{color}" fill-opacity="0.7" stroke="#333" stroke-width="1"/>'
                )
                
                text_x = px + pw / 2
                text_y = py + ph / 2
                label = f"{piece.piece.name}"
                if piece.rotation != 0:
                    label += f" ({piece.rotation}°)"
                
                html_parts.append(
                    f'                    <text x="{text_x}" y="{text_y}" class="piece-label" '
                    f'text-anchor="middle" dominant-baseline="middle">{label}</text>'
                )
            
            html_parts.extend([
                f'                </svg>',
                f'            </div>',
                f'        </div>',
            ])
            
            current_y += fabric_length + 50
        
        html_parts.extend([
            '',
            '    </div>',
            '</body>',
            '</html>',
        ])
        
        return "\n".join(html_parts)
