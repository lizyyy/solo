from datetime import datetime
from typing import List, Dict, Any, Optional
import os

from models import PreflightCheck, PreflightStatus


class FontChecker:
    def __init__(self, system_fonts: Optional[List[str]] = None):
        self.system_fonts = system_fonts or self._get_system_fonts()
    
    def _get_system_fonts(self) -> List[str]:
        common_fonts = [
            "Arial", "Helvetica", "Times New Roman", "Times",
            "Courier New", "Courier", "Verdana", "Georgia",
            "Comic Sans MS", "Impact", "Trebuchet MS",
            "SimSun", "SimHei", "Microsoft YaHei", "KaiTi",
            "FangSong", "STSong", "STHeiti", "STKaiti",
            "Songti SC", "Heiti SC", "PingFang SC",
            "Noto Sans CJK SC", "Noto Serif CJK SC",
            "AdobeSongStd-Light", "AdobeHeitiStd-Regular"
        ]
        return common_fonts
    
    def check_fonts(self, work_order, pdf_reader=None) -> PreflightCheck:
        check_name = "Font Availability Check"
        check_type = "font"
        
        required_fonts = getattr(work_order, 'required_fonts', []) or []
        
        if not required_fonts:
            if pdf_reader:
                required_fonts = self._extract_fonts_from_pdf(pdf_reader)
                work_order.required_fonts = required_fonts
            else:
                return PreflightCheck(
                    check_name=check_name,
                    check_type=check_type,
                    status=PreflightStatus.WARNING,
                    message="未找到字体信息，无法进行字体检查",
                    details={"note": "工单中未指定所需字体，且未提供PDF阅读器"},
                    severity="normal"
                )
        
        missing_fonts = []
        for font in required_fonts:
            if not self._is_font_available(font):
                missing_fonts.append(font)
        
        work_order.missing_fonts = missing_fonts
        
        if missing_fonts:
            return PreflightCheck(
                check_name=check_name,
                check_type=check_type,
                status=PreflightStatus.FAILED,
                message=f"发现 {len(missing_fonts)} 种缺失字体",
                details={
                    "required_fonts": required_fonts,
                    "missing_fonts": missing_fonts,
                    "available_count": len(required_fonts) - len(missing_fonts),
                    "missing_count": len(missing_fonts)
                },
                severity="high"
            )
        else:
            return PreflightCheck(
                check_name=check_name,
                check_type=check_type,
                status=PreflightStatus.PASSED,
                message=f"所有 {len(required_fonts)} 种字体均可用",
                details={
                    "required_fonts": required_fonts,
                    "available_count": len(required_fonts)
                },
                severity="normal"
            )
    
    def _is_font_available(self, font_name: str) -> bool:
        font_name_lower = font_name.lower()
        
        for sys_font in self.system_fonts:
            sys_font_lower = sys_font.lower()
            
            if font_name_lower == sys_font_lower:
                return True
            
            if font_name_lower in sys_font_lower:
                return True
            
            if sys_font_lower in font_name_lower:
                return True
        
        return False
    
    def _extract_fonts_from_pdf(self, pdf_reader) -> List[str]:
        fonts = set()
        
        try:
            if hasattr(pdf_reader, 'pages'):
                for page in pdf_reader.pages:
                    page_fonts = self._extract_fonts_from_page(page)
                    fonts.update(page_fonts)
        except Exception:
            pass
        
        return list(fonts)
    
    def _extract_fonts_from_page(self, page) -> List[str]:
        fonts = []
        
        try:
            if '/Resources' in page:
                resources = page['/Resources']
                
                if '/Font' in resources:
                    font_dict = resources['/Font']
                    
                    for font_name in font_dict.keys():
                        font_obj = font_dict[font_name]
                        
                        try:
                            base_font = font_obj.get('/BaseFont', '')
                            if base_font:
                                font_clean = base_font.replace('/', '').replace('+', '')
                                if font_clean and font_clean not in fonts:
                                    fonts.append(font_clean)
                        except Exception:
                            pass
        except Exception:
            pass
        
        return fonts
