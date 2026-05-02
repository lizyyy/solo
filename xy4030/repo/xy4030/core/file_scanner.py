import os
import re
from typing import List, Dict, Optional, Any, Tuple
from dataclasses import dataclass, field
from pathlib import Path
from datetime import datetime

from PIL import Image
import fitz
import cv2
import numpy as np

from config import Config


@dataclass
class FileInfo:
    filename: str
    filepath: str
    file_type: str
    size: int
    width: Optional[int] = None
    height: Optional[int] = None
    resolution: Optional[int] = None
    orientation: Optional[str] = None
    is_blank: bool = False
    blank_confidence: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)
    extracted_case_number: Optional[str] = None
    extracted_page_number: Optional[int] = None
    extracted_box_number: Optional[str] = None


class FileScanner:
    def __init__(self, directory: str, config: Dict = None):
        self.directory = directory
        self.config = config or {}
        self.min_resolution = self.config.get('min_resolution', Config.DEFAULT_MIN_RESOLUTION)
        self.blank_page_threshold = self.config.get('blank_page_threshold', Config.DEFAULT_BLANK_PAGE_THRESHOLD)
        self.supported_extensions = self.config.get('supported_extensions', Config.DEFAULT_SUPPORTED_EXTENSIONS)
    
    def scan(self) -> List[FileInfo]:
        files_info = []
        
        if not os.path.exists(self.directory):
            raise ValueError(f"目录不存在: {self.directory}")
        
        for root, dirs, files in os.walk(self.directory):
            for filename in files:
                ext = os.path.splitext(filename)[1].lower()
                if ext in self.supported_extensions:
                    filepath = os.path.join(root, filename)
                    try:
                        file_info = self._analyze_file(filepath)
                        if file_info:
                            files_info.append(file_info)
                    except Exception as e:
                        print(f"警告: 无法分析文件 {filepath}: {e}")
        
        return files_info
    
    def _analyze_file(self, filepath: str) -> Optional[FileInfo]:
        filename = os.path.basename(filepath)
        ext = os.path.splitext(filename)[1].lower()
        size = os.path.getsize(filepath)
        
        file_info = FileInfo(
            filename=filename,
            filepath=filepath,
            file_type=ext.lstrip('.'),
            size=size
        )
        
        self._extract_info_from_filename(file_info)
        
        if ext in {'.jpg', '.jpeg', '.png', '.tiff', '.tif'}:
            self._analyze_image(filepath, file_info)
        elif ext == '.pdf':
            self._analyze_pdf(filepath, file_info)
        
        return file_info
    
    def _extract_info_from_filename(self, file_info: FileInfo):
        filename = file_info.filename
        
        patterns = [
            r'(?:盒|H|h)(\d+)[_-]?(?:案|A|a)(\d+)[_-]?(\d+)',
            r'(?:盒|H|h)(\d+).*?(?:案|A|a)(\d+).*?(\d+)',
            r'(\d+)[_-](\d+)[_-](\d+)',
            r'(\d+)[-_.](\d+)[-_.](\d+)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, filename)
            if match:
                groups = match.groups()
                if len(groups) >= 3:
                    file_info.extracted_box_number = groups[0]
                    file_info.extracted_case_number = groups[1]
                    try:
                        file_info.extracted_page_number = int(groups[2])
                    except ValueError:
                        pass
                    return
        
        page_match = re.search(r'[_-]?(\d+)\.\w+$', filename)
        if page_match:
            try:
                file_info.extracted_page_number = int(page_match.group(1))
            except ValueError:
                pass
        
        case_match = re.search(r'[A-Za-z]?(\d{4,})', filename)
        if case_match:
            file_info.extracted_case_number = case_match.group(1)
    
    def _analyze_image(self, filepath: str, file_info: FileInfo):
        try:
            with Image.open(filepath) as img:
                file_info.width = img.width
                file_info.height = img.height
                
                if img.width > img.height:
                    file_info.orientation = 'landscape'
                else:
                    file_info.orientation = 'portrait'
                
                resolution = self._get_image_resolution(img)
                file_info.resolution = resolution
                
                if img.info:
                    file_info.metadata['image_info'] = dict(img.info)
                
                is_blank, confidence = self._detect_blank_page(filepath)
                file_info.is_blank = is_blank
                file_info.blank_confidence = confidence
                
        except Exception as e:
            file_info.metadata['analysis_error'] = str(e)
    
    def _get_image_resolution(self, img: Image.Image) -> int:
        if hasattr(img, 'info') and 'dpi' in img.info:
            dpi = img.info['dpi']
            if isinstance(dpi, tuple) and len(dpi) >= 1:
                return int(dpi[0])
        
        return 96
    
    def _detect_blank_page(self, filepath: str) -> Tuple[bool, float]:
        try:
            img = cv2.imread(filepath, cv2.IMREAD_GRAYSCALE)
            if img is None:
                return False, 0.0
            
            _, binary = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            
            total_pixels = binary.size
            white_pixels = cv2.countNonZero(binary)
            white_ratio = white_pixels / total_pixels
            
            is_blank = white_ratio >= self.blank_page_threshold
            
            return is_blank, white_ratio
            
        except Exception:
            return False, 0.0
    
    def _analyze_pdf(self, filepath: str, file_info: FileInfo):
        try:
            doc = fitz.open(filepath)
            
            file_info.metadata['pdf_page_count'] = len(doc)
            file_info.metadata['pdf_info'] = dict(doc.metadata) if doc.metadata else {}
            
            if len(doc) > 0:
                page = doc[0]
                rect = page.rect
                file_info.width = int(rect.width)
                file_info.height = int(rect.height)
                
                if rect.width > rect.height:
                    file_info.orientation = 'landscape'
                else:
                    file_info.orientation = 'portrait'
                
                zoom = 2
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat)
                
                img_data = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
                
                if pix.n >= 3:
                    gray = cv2.cvtColor(img_data, cv2.COLOR_RGB2GRAY)
                else:
                    gray = img_data
                
                _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
                total_pixels = binary.size
                white_pixels = cv2.countNonZero(binary)
                white_ratio = white_pixels / total_pixels
                
                file_info.is_blank = white_ratio >= self.blank_page_threshold
                file_info.blank_confidence = white_ratio
            
            doc.close()
            
        except Exception as e:
            file_info.metadata['analysis_error'] = str(e)


def scan_directory(directory: str, config: Dict = None) -> List[Dict]:
    scanner = FileScanner(directory, config)
    files_info = scanner.scan()
    
    result = []
    for info in files_info:
        result.append({
            'filename': info.filename,
            'filepath': info.filepath,
            'file_type': info.file_type,
            'size': info.size,
            'width': info.width,
            'height': info.height,
            'resolution': info.resolution,
            'orientation': info.orientation,
            'is_blank': info.is_blank,
            'blank_confidence': info.blank_confidence,
            'metadata': info.metadata,
            'extracted_case_number': info.extracted_case_number,
            'extracted_page_number': info.extracted_page_number,
            'extracted_box_number': info.extracted_box_number
        })
    
    return result
