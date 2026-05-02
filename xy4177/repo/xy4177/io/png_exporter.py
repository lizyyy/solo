# -*- coding: utf-8 -*-
"""
PNG导出器
"""

import io
from pathlib import Path
from typing import List, Optional
from PIL import Image
from core.models import LabelPreview, LabelTemplate, SKUData


class PNGExporter:
    """PNG导出器"""
    
    def __init__(self, scale: float = 2.0):
        self.scale = scale
    
    def export_single(
        self,
        preview: LabelPreview,
        output_path: str,
        scale: Optional[float] = None
    ):
        """导出单个标签为PNG"""
        if preview.image_data:
            img = Image.open(io.BytesIO(preview.image_data))
        else:
            return
        
        scale_factor = scale or self.scale
        if scale_factor != 1.0:
            new_width = int(img.width * scale_factor)
            new_height = int(img.height * scale_factor)
            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        img.save(str(path), 'PNG')
    
    def export_batch(
        self,
        previews: List[LabelPreview],
        output_dir: str,
        naming_pattern: str = "{box_number}_{row_index}.png",
        scale: Optional[float] = None
    ) -> List[str]:
        """批量导出标签为PNG"""
        dir_path = Path(output_dir)
        dir_path.mkdir(parents=True, exist_ok=True)
        
        exported_paths = []
        
        for preview in previews:
            filename = naming_pattern.format(
                box_number=preview.sku_data.box_number or "unknown",
                row_index=preview.sku_data.row_index,
                sku=preview.sku_data.sku or "unknown"
            )
            
            safe_filename = "".join(c if c.isalnum() or c in '._- ' else '_' for c in filename)
            output_path = dir_path / safe_filename
            
            self.export_single(preview, str(output_path), scale)
            exported_paths.append(str(output_path))
        
        return exported_paths
    
    def export_sheet(
        self,
        previews: List[LabelPreview],
        output_path: str,
        cols: int = 3,
        rows: int = 2,
        padding: int = 20,
        scale: Optional[float] = None
    ):
        """将多个标签合并导出为一张PNG"""
        if not previews:
            return
        
        scale_factor = scale or self.scale
        
        first_img = Image.open(io.BytesIO(previews[0].image_data)) if previews[0].image_data else None
        if first_img is None:
            return
        
        label_w = int(first_img.width * scale_factor)
        label_h = int(first_img.height * scale_factor)
        
        sheet_w = cols * label_w + (cols + 1) * padding
        sheet_h = rows * label_h + (rows + 1) * padding
        
        sheet = Image.new('RGB', (sheet_w, sheet_h), 'white')
        
        for idx, preview in enumerate(previews[:cols * rows]):
            if not preview.image_data:
                continue
            
            img = Image.open(io.BytesIO(preview.image_data))
            if scale_factor != 1.0:
                img = img.resize((label_w, label_h), Image.Resampling.LANCZOS)
            
            col = idx % cols
            row = idx // cols
            
            x = padding + col * (label_w + padding)
            y = padding + row * (label_h + padding)
            
            sheet.paste(img, (x, y))
        
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(str(path), 'PNG')
