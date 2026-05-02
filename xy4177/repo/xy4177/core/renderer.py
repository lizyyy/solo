# -*- coding: utf-8 -*-
"""
预览渲染模块
使用PIL/Pillow渲染标签预览图像
"""

import io
from typing import Dict, Any, Optional, Tuple, List
from PIL import Image, ImageDraw, ImageFont
from core.models import LabelTemplate, TemplateField, SKUData, LabelPreview
from core.constants import BarcodeType, MM_TO_INCH, INCH_TO_MM


class BarcodeRenderer:
    """条码渲染器 - 简化实现"""
    
    def render_code128(self, data: str, width: int, height: int) -> Image.Image:
        """渲染CODE128条码（简化版本）"""
        img = Image.new('1', (width, height), 1)
        draw = ImageDraw.Draw(img)
        
        bar_width = max(1, width // (len(data) * 2 + 20))
        x = 10
        
        for char in data:
            pattern = self._get_code128_pattern(char)
            for bit in pattern:
                if bit == '1':
                    draw.rectangle([x, 0, x + bar_width - 1, height - 1], fill=0)
                x += bar_width
        
        return img
    
    def _get_code128_pattern(self, char: str) -> str:
        """获取字符的条码模式（简化）"""
        patterns = {
            '0': '11011001100', '1': '11001101100', '2': '11001100110',
            '3': '10010011000', '4': '10010001100', '5': '10001001100',
            '6': '10011001000', '7': '10011000100', '8': '10001100100',
            '9': '11001001000',
        }
        return patterns.get(char, '10101010101')
    
    def render_qrcode(self, data: str, size: int) -> Image.Image:
        """渲染QR Code（简化版本 - 实际项目可使用qrcode库）"""
        img = Image.new('1', (size, size), 1)
        draw = ImageDraw.Draw(img)
        
        module_size = max(2, size // 25)
        
        for i in range(min(21, size // module_size)):
            for j in range(min(21, size // module_size)):
                if (i < 7 and j < 7) or (i < 7 and j >= 14) or (i >= 14 and j < 7):
                    if (i < 7 and j < 7) and (i == 0 or i == 6 or j == 0 or j == 6):
                        fill = 0
                    elif (i < 7 and j < 7) and (i == 2 or i == 4 or j == 2 or j == 4):
                        fill = 0
                    elif (i < 7 and j < 7) and 2 <= i <= 4 and 2 <= j <= 4:
                        fill = 0
                    else:
                        fill = 1
                else:
                    fill = 0 if (hash(data) + i + j) % 3 == 0 else 1
                
                x = j * module_size
                y = i * module_size
                if fill == 0:
                    draw.rectangle([x, y, x + module_size - 1, y + module_size - 1], fill=0)
        
        return img
    
    def render_barcode(
        self,
        barcode_type: BarcodeType,
        data: str,
        width: int,
        height: int
    ) -> Image.Image:
        """根据类型渲染条码"""
        if barcode_type == BarcodeType.QRCODE:
            return self.render_qrcode(data, min(width, height))
        elif barcode_type == BarcodeType.DATAMATRIX:
            return self.render_qrcode(data, min(width, height))
        else:
            return self.render_code128(data, width, height)


class LabelRenderer:
    """标签渲染器"""
    
    def __init__(self, dpi: int = 203):
        self.dpi = dpi
        self.barcode_renderer = BarcodeRenderer()
    
    def _mm_to_pixels(self, mm: float) -> int:
        """毫米转像素"""
        return int(mm * MM_TO_INCH * self.dpi)
    
    def _get_font(self, size_mm: float) -> ImageFont.FreeTypeFont:
        """获取字体"""
        size_px = self._mm_to_pixels(size_mm)
        try:
            return ImageFont.truetype("/System/Library/Fonts/PingFang.ttc", size_px)
        except:
            try:
                return ImageFont.truetype("Arial.ttf", size_px)
            except:
                return ImageFont.load_default()
    
    def render_label(
        self,
        sku_data: SKUData,
        template: LabelTemplate
    ) -> LabelPreview:
        """渲染单个标签"""
        data_dict = sku_data.to_dict()
        
        width_px = self._mm_to_pixels(template.width_mm)
        height_px = self._mm_to_pixels(template.height_mm)
        
        img = Image.new('RGB', (width_px, height_px), 'white')
        draw = ImageDraw.Draw(img)
        
        margin_px = self._mm_to_pixels(template.margin_mm)
        draw.rectangle(
            [margin_px, margin_px, width_px - margin_px, height_px - margin_px],
            outline='lightgray',
            width=1
        )
        
        for field in template.fields:
            field_value = str(data_dict.get(field.name, field.default_value or ''))
            
            x_px = self._mm_to_pixels(field.x)
            y_px = self._mm_to_pixels(field.y)
            
            if field.field_type == 'barcode' and field.barcode_type and field_value:
                bc_width = self._mm_to_pixels(field.width or 40)
                bc_height = self._mm_to_pixels(field.height or 15)
                
                bc_img = self.barcode_renderer.render_barcode(
                    field.barcode_type, field_value, bc_width, bc_height
                )
                bc_img = bc_img.convert('RGB')
                
                img.paste(bc_img, (x_px, y_px))
                
                font = self._get_font(2.5)
                draw.text((x_px, y_px + bc_height), field_value, font=font, fill='black')
                
            else:
                font_size = field.font_size or 3.0
                font = self._get_font(font_size)
                draw.text((x_px, y_px), field_value, font=font, fill='black')
        
        draw.rectangle([0, 0, width_px - 1, height_px - 1], outline='black', width=1)
        
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        image_data = buffer.getvalue()
        
        return LabelPreview(
            sku_data=sku_data,
            template=template,
            image_data=image_data,
        )
    
    def render_to_image(
        self,
        sku_data: SKUData,
        template: LabelTemplate
    ) -> Image.Image:
        """渲染为PIL Image对象"""
        preview = self.render_label(sku_data, template)
        return Image.open(io.BytesIO(preview.image_data))
    
    def render_batch(
        self,
        sku_list: List[SKUData],
        template: LabelTemplate
    ) -> List[LabelPreview]:
        """批量渲染标签"""
        return [self.render_label(sku, template) for sku in sku_list]
