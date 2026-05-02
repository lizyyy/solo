import os
import re
import json
from typing import Dict, List, Optional, Set
from datetime import datetime

from .models import Package, Photo, Remark, ClaimForm
from .metadata_parser import MetadataParser


class FileIndexer:
    """文件索引器 - 扫描目录并按运单号归集文件"""
    
    PHOTO_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"}
    CSV_EXTENSIONS = {".csv"}
    JSON_EXTENSIONS = {".json"}
    
    def __init__(self):
        self.packages: Dict[str, Package] = {}
        self.metadata_parser = MetadataParser()
    
    def scan_directory(self, directory: str) -> Dict[str, Package]:
        """扫描目录并按运单号归集文件"""
        self.packages = {}
        
        all_files = self._list_all_files(directory)
        
        for file_path in all_files:
            ext = os.path.splitext(file_path)[1].lower()
            
            if ext in self.PHOTO_EXTENSIONS:
                self._process_photo(file_path)
            elif ext in self.CSV_EXTENSIONS:
                self._process_csv(file_path)
            elif ext in self.JSON_EXTENSIONS:
                self._process_json(file_path)
        
        return self.packages
    
    def _list_all_files(self, directory: str) -> List[str]:
        """递归列出目录下所有文件"""
        files = []
        for root, dirs, filenames in os.walk(directory):
            for filename in filenames:
                files.append(os.path.join(root, filename))
        return files
    
    def _process_photo(self, file_path: str) -> None:
        """处理照片文件"""
        file_name = os.path.basename(file_path)
        file_size = os.path.getsize(file_path)
        
        tracking_no = self._extract_tracking_no_from_filename(file_name)
        if not tracking_no:
            tracking_no = self._extract_tracking_no_from_content(file_path)
        
        if not tracking_no:
            return
        
        photo = Photo(
            file_path=file_path,
            file_name=file_name,
            file_size=file_size,
        )
        
        photo_meta = self.metadata_parser.parse_image_metadata(file_path)
        if photo_meta:
            photo.exif_datetime = photo_meta.get("exif_datetime")
            photo.file_modified = photo_meta.get("file_modified")
            photo.width = photo_meta.get("width", 0)
            photo.height = photo_meta.get("height", 0)
            photo.timestamp = photo_meta.get("timestamp")
        
        if tracking_no not in self.packages:
            self.packages[tracking_no] = Package(tracking_no=tracking_no)
        
        self.packages[tracking_no].photos.append(photo)
    
    def _process_csv(self, file_path: str) -> None:
        """处理CSV文件（客服备注或赔付申请）"""
        remarks = self.metadata_parser.parse_remarks_csv(file_path)
        for remark in remarks:
            if remark.tracking_no not in self.packages:
                self.packages[remark.tracking_no] = Package(tracking_no=remark.tracking_no)
            self.packages[remark.tracking_no].remarks.append(remark)
        
        claim_forms = self.metadata_parser.parse_claim_forms_csv(file_path)
        for claim in claim_forms:
            if claim.tracking_no not in self.packages:
                self.packages[claim.tracking_no] = Package(tracking_no=claim.tracking_no)
            self.packages[claim.tracking_no].claim_form = claim
    
    def _process_json(self, file_path: str) -> None:
        """处理JSON文件（可能是导出的索引）"""
        pass
    
    def _extract_tracking_no_from_filename(self, filename: str) -> Optional[str]:
        """从文件名中提取运单号"""
        patterns = [
            r'(SF\d{12,14})',
            r'(YT\d{13,15})',
            r'(ZT\d{12,14})',
            r'(JD\d{12,14})',
            r'(EMS\d{9,13})',
            r'(\d{12,15})',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, filename, re.IGNORECASE)
            if match:
                return match.group(1).upper()
        
        return None
    
    def _extract_tracking_no_from_content(self, file_path: str) -> Optional[str]:
        """从文件内容中提取运单号（简单OCR模拟）"""
        return None
    
    def save_index(self, output_path: str) -> None:
        """保存索引到JSON文件"""
        data = {
            "index_version": "1.0",
            "created_at": datetime.now().isoformat(),
            "packages": {k: v.to_dict() for k, v in self.packages.items()}
        }
        
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def load_index(self, input_path: str) -> None:
        """从JSON文件加载索引"""
        with open(input_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        self.packages = {}
        packages_data = data.get("packages", {})
        
        for tracking_no, pkg_data in packages_data.items():
            self.packages[tracking_no] = Package.from_dict(pkg_data)
