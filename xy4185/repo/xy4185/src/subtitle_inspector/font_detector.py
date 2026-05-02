import re
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple, Any

try:
    from fontTools.ttLib import TTFont
    FONTTOOLS_AVAILABLE = True
except ImportError:
    FONTTOOLS_AVAILABLE = False

from .models import FontInfo


COMMON_CHINESE_CHARS = set(
    "的一是了我不人在他有这个上们来到时大地为子中你说生国年着就那和要她出也得里后自以会家可下而过天去能对小多然于心学么之都好看起发当没成只如事把还用第样道想作种开美总从无情己面最女但现前些所同日手又行意动方期它头经长儿回位分爱老因很给名法间斯知世什两次使身者被高已亲其进此话常与活正感见明问力理尔点文几定本公特做外孩相西果走将月十实向声车全信重三机工物气每并别真打太新比才便夫再书部水像眼少家经"
)

CJK_UNIFIED_IDEOGRAPHS = (0x4E00, 0x9FFF)
CJK_UNIFIED_IDEOGRAPHS_EXT_A = (0x3400, 0x4DBF)
CJK_UNIFIED_IDEOGRAPHS_EXT_B = (0x20000, 0x2A6DF)
CJK_COMPATIBILITY_IDEOGRAPHS = (0xF900, 0xFAFF)
BASIC_LATIN = (0x0020, 0x007E)
LATIN_EXTENDED = (0x00A0, 0x024F)
HALFWIDTH_FULLWIDTH = (0xFF00, 0xFFEF)

CHINESE_CHAR_RANGES = [
    CJK_UNIFIED_IDEOGRAPHS,
    CJK_UNIFIED_IDEOGRAPHS_EXT_A,
    CJK_COMPATIBILITY_IDEOGRAPHS,
]


class FontDetector:
    def __init__(self):
        self._font_cache: Dict[Path, FontInfo] = {}
    
    def detect_fonts(self, directory: Path) -> List[FontInfo]:
        font_files: List[Path] = []
        
        for ext in ["*.ttf", "*.otf", "*.ttc", "*.woff", "*.woff2"]:
            font_files.extend(directory.rglob(ext))
        
        results: List[FontInfo] = []
        for font_path in font_files:
            if font_path in self._font_cache:
                results.append(self._font_cache[font_path])
            else:
                font_info = self._parse_font(font_path)
                if font_info:
                    self._font_cache[font_path] = font_info
                    results.append(font_info)
        
        return results
    
    def _parse_font(self, font_path: Path) -> Optional[FontInfo]:
        if FONTTOOLS_AVAILABLE:
            return self._parse_with_fonttools(font_path)
        else:
            return self._parse_simple(font_path)
    
    def _parse_with_fonttools(self, font_path: Path) -> Optional[FontInfo]:
        try:
            font = TTFont(font_path)
            
            family = self._get_font_name(font, 1) or font_path.stem
            style = self._get_font_name(font, 2) or "Regular"
            
            weight = 400
            if "OS/2" in font:
                weight = font["OS/2"].usWeightClass
            
            supported_codepoints = self._get_supported_codepoints(font)
            
            supported_chars = []
            for cp in supported_codepoints:
                try:
                    supported_chars.append(chr(cp))
                except ValueError:
                    pass
            
            font.close()
            
            return FontInfo(
                path=font_path,
                family=family,
                style=style,
                weight=weight,
                supported_chars=supported_chars[:1000],
                missing_chars=[]
            )
        except Exception as e:
            return self._parse_simple(font_path)
    
    def _get_font_name(self, font: Any, name_id: int) -> Optional[str]:
        if "name" not in font:
            return None
        
        for record in font["name"].names:
            if record.nameID == name_id:
                try:
                    return record.toUnicode()
                except Exception:
                    try:
                        return str(record.string, encoding="utf-8")
                    except Exception:
                        pass
        return None
    
    def _get_supported_codepoints(self, font: Any) -> Set[int]:
        codepoints: Set[int] = set()
        
        for table in font["cmap"].tables:
            if hasattr(table, "cmap"):
                codepoints.update(table.cmap.keys())
        
        return codepoints
    
    def _parse_simple(self, font_path: Path) -> Optional[FontInfo]:
        family = font_path.stem
        
        style = "Regular"
        style_patterns = [
            (r"(bold|heavy|black)", "Bold"),
            (r"(italic|oblique)", "Italic"),
            (r"(bold.*italic|italic.*bold)", "BoldItalic"),
            (r"(light|thin)", "Light"),
            (r"(medium)", "Medium"),
        ]
        
        name_lower = family.lower()
        for pattern, style_name in style_patterns:
            if re.search(pattern, name_lower):
                style = style_name
        
        weight = 400
        if "bold" in name_lower:
            weight = 700
        elif "light" in name_lower:
            weight = 300
        elif "medium" in name_lower:
            weight = 500
        
        common_chars = list(COMMON_CHINESE_CHARS)[:100]
        
        return FontInfo(
            path=font_path,
            family=family,
            style=style,
            weight=weight,
            supported_chars=common_chars,
            missing_chars=[]
        )
    
    def check_missing_chars(
        self, 
        font_info: FontInfo, 
        text: str,
        use_fonttools: bool = FONTTOOLS_AVAILABLE
    ) -> List[str]:
        if not text.strip():
            return []
        
        unique_chars = set(text)
        whitespace_chars = set(" \t\n\r\f\v")
        unique_chars = unique_chars - whitespace_chars
        
        if not use_fonttools or not font_info.supported_chars:
            return self._check_missing_chars_simple(font_info, unique_chars)
        
        supported_set = set(font_info.supported_chars)
        missing = []
        
        for char in unique_chars:
            if char not in supported_set:
                if ord(char) < 128:
                    if char in "'\".,!?;:()[]{}<>-=+_*/\\@#$%^&*`~|":
                        continue
                    if char.isalpha() or char.isdigit():
                        continue
                
                missing.append(char)
        
        return sorted(missing)
    
    def _check_missing_chars_simple(
        self, 
        font_info: FontInfo, 
        chars: Set[str]
    ) -> List[str]:
        missing = []
        family_lower = font_info.family.lower()
        
        likely_chinese_font = any(kw in family_lower for kw in [
            "song", "hei", "kai", "fang", "yuan", "sim", "ming", "st",
            "noto sans cjk", "noto serif cjk", "source han",
            "pingfang", "hiragino", "meiryo", "msyh", "simsun"
        ])
        
        for char in chars:
            cp = ord(char)
            
            is_chinese = any(
                start <= cp <= end 
                for start, end in CHINESE_CHAR_RANGES
            )
            
            is_latin = (BASIC_LATIN[0] <= cp <= BASIC_LATIN[1]) or \
                       (LATIN_EXTENDED[0] <= cp <= LATIN_EXTENDED[1])
            
            is_punctuation = (HALFWIDTH_FULLWIDTH[0] <= cp <= HALFWIDTH_FULLWIDTH[1])
            
            if is_chinese and not likely_chinese_font:
                if char not in font_info.supported_chars:
                    missing.append(char)
            elif is_latin or is_punctuation:
                pass
        
        return sorted(missing)
    
    def check_font_compatibility(
        self,
        font_info: FontInfo,
        subtitle_texts: List[str]
    ) -> FontInfo:
        all_text = "".join(subtitle_texts)
        missing = self.check_missing_chars(font_info, all_text)
        
        font_info.missing_chars = missing
        return font_info


def detect_fonts_in_directory(directory: Path) -> List[FontInfo]:
    detector = FontDetector()
    return detector.detect_fonts(directory)


def check_font_for_text(font_path: Path, text: str) -> List[str]:
    detector = FontDetector()
    fonts = detector.detect_fonts(font_path.parent)
    
    for font in fonts:
        if font.path == font_path:
            return detector.check_missing_chars(font, text)
    
    return list(set(text))
