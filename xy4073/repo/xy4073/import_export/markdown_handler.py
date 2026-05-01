from typing import List, Optional
from datetime import datetime

from models.project import Project
from models.piece import PiecePlacement
from models.fabric import FabricSettings
from models.validation import ValidationResult
from nesting.algorithm import NestingResult


class MarkdownExporter:
    def __init__(self):
        self.company_name = "纸样打样工作室"
        self.template = None

    def export_quote(
        self,
        filepath: str,
        project: Project,
        nesting_result: NestingResult = None,
        validation_result: ValidationResult = None
    ) -> bool:
        try:
            markdown = self._generate_quote(project, nesting_result, validation_result)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(markdown)
            return True
        except Exception as e:
            print(f"导出 Markdown 报价失败: {e}")
            return False

    def _generate_quote(
        self,
        project: Project,
        nesting_result: NestingResult = None,
        validation_result: ValidationResult = None
    ) -> str:
        lines = []
        
        lines.append(f"# {project.name}")
        lines.append(f"> 纸样排料用布预估报价单")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**工作室**: {self.company_name}")
        lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("## 1. 布料设置")
        lines.append("")
        
        fabric = project.fabric_settings
        lines.append(f"| 参数 | 值 |")
        lines.append(f"|------|-----|")
        lines.append(f"| 布料名称 | {fabric.name} |")
        lines.append(f"| 布幅宽度 | {fabric.width} cm |")
        lines.append(f"| 缩水率 (横向) | {fabric.shrinkage_x}% |")
        lines.append(f"| 缩水率 (纵向) | {fabric.shrinkage_y}% |")
        lines.append(f"| 纹向 | {'经向 (0°)' if fabric.grain_direction == 0 else f'{fabric.grain_direction}°'} |")
        
        if fabric.has_plaid:
            lines.append(f"| 格纹宽度 (横向) | {fabric.plaid_width_x} cm |")
            lines.append(f"| 格纹宽度 (纵向) | {fabric.plaid_width_y} cm |")
        
        lines.append(f"| 安全边距 | {fabric.safety_margin} cm |")
        lines.append("")
        
        if fabric.no_place_zones:
            lines.append("### 禁放区域")
            lines.append("")
            lines.append(f"| 区域名称 | 位置 | 大小 | 原因 |")
            lines.append(f"|----------|------|------|------|")
            for zone in fabric.no_place_zones:
                lines.append(f"| {zone.name} | ({zone.zone.x}, {zone.zone.y} | {zone.zone.width}×{zone.zone.height} cm | {zone.reason} |")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("## 2. 裁片清单")
        lines.append("")
        
        lines.append(f"| 序号 | 裁片名称 | 数量 | 尺寸 (宽×高) | 面积 | 可旋转 | 格纹对齐 |")
        lines.append(f"|------|----------|------|---------------|------|--------|----------|")
        
        total_area = 0.0
        for idx, piece in enumerate(project.pieces, 1):
            width = piece.get_width()
            height = piece.get_height()
            area = piece.get_area()
            total_area += area * piece.quantity
            
            can_rotate = "是" if piece.can_rotate else "否"
            if not piece.allow_rotate_180 and not piece.can_rotate:
                can_rotate = "仅180°"
            
            plaid_match = "是" if piece.has_plaid_match else "否"
            
            lines.append(f"| {idx} | {piece.name or f'裁片{idx}' | {piece.quantity} | {width:.1f}×{height:.1f} cm | {area:.1f} cm² | {can_rotate} | {plaid_match} |")
        
        lines.append("")
        lines.append(f"**裁片总数**: {len(project.pieces)} 种, 共 {sum(p.quantity for p in project.pieces)} 片")
        lines.append(f"**总面积**: {total_area:.1f} cm²")
        lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("## 3. 排料结果")
        lines.append("")
        
        if nesting_result:
            fabric_area = fabric.width * nesting_result.fabric_length
            
            lines.append(f"| 项目 | 值 |")
            lines.append(f"|------|-----|")
            lines.append(f"| 用布长度 | {nesting_result.fabric_length:.2f} cm |")
            lines.append(f"| 布料总面积 | {fabric_area:.1f} cm² |")
            lines.append(f"| 已用有效面积 | {nesting_result.used_area:.1f} cm² |")
            lines.append(f"| **余料率** | **{nesting_result.waste_rate:.1f}%** |")
            lines.append(f"| **利用率** | **{100 - nesting_result.waste_rate:.1f}%** |")
            lines.append("")
            
            lines.append("### 已放置裁片位置")
            lines.append("")
            lines.append(f"| 裁片名称 | 位置 (X,Y) | 旋转角度 | 镜像 |")
            lines.append(f"|----------|------------|----------|------|")
            
            for placement in nesting_result.placements:
                if placement.is_placed:
                    mirror = "是" if placement.mirror else "否"
                    lines.append(f"| {placement.piece.name} | ({placement.position.x:.1f}, {placement.position.y:.1f} | {placement.rotation}° | {mirror} |")
            
            lines.append("")
        else:
            lines.append("> 暂无自动排料结果，请先执行自动排料。")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("## 4. 校验结果")
        lines.append("")
        
        if validation_result:
            if validation_result.is_valid:
                lines.append("✅ **校验通过**: 所有裁片放置正确。")
                lines.append("")
            else:
                lines.append("❌ **校验失败**: 存在以下问题:")
                lines.append("")
                
                if validation_result.errors:
                    lines.append("### 错误")
                    lines.append("")
                    for error in validation_result.errors:
                        pieces = ", ".join(error.piece_ids) if error.piece_ids else "无"
                        lines.append(f"- **{error.type.value}**: {error.message} (裁片: {pieces})")
                    lines.append("")
                
                if validation_result.warnings:
                    lines.append("### 警告")
                    lines.append("")
                    for warning in validation_result.warnings:
                        pieces = ", ".join(warning.piece_ids) if warning.piece_ids else "无"
                        lines.append(f"- **{warning.type.value}**: {warning.message} (裁片: {pieces})")
                    lines.append("")
        else:
            lines.append("> 暂无校验结果，请先执行校验。")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("## 5. 备注")
        lines.append("")
        
        if project.notes:
            lines.append(project.notes)
        else:
            lines.append("> 暂无备注信息。")
        lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append(f"*此报价单由「纸样排料用布预估台」自动生成*")
        lines.append(f"*版本: 1.0.0*")
        
        return "\n".join(lines)
