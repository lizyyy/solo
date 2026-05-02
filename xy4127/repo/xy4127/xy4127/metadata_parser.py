import os
import re
import csv
from typing import Dict, List, Optional, Any
from datetime import datetime
from pathlib import Path

try:
    from PIL import Image
    from PIL.ExifTags import TAGS
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

try:
    from dateutil.parser import parse as parse_date
    HAS_DATEUTIL = True
except ImportError:
    HAS_DATEUTIL = False

from .models import Photo, Remark, ClaimForm


class MetadataParser:
    """元数据解析器 - 解析图片和CSV文件"""
    
    REMARK_CSV_HEADERS = {
        "tracking_no": ["运单号", "快递单号", "tracking_no", "tracking number", "waybill", "单号"],
        "customer_name": ["客户姓名", "姓名", "customer", "name", "收件人"],
        "contact_phone": ["联系电话", "电话", "phone", "mobile", "tel", "联系方式"],
        "issue_type": ["问题类型", "type", "问题", "类别"],
        "issue_description": ["问题描述", "描述", "description", "备注", "说明"],
        "claim_amount": ["赔付金额", "金额", "amount", "price", "索赔金额"],
        "remark_date": ["日期", "时间", "date", "time", "操作时间", "录入时间"],
        "operator": ["操作员", "操作人", "operator", "员工"],
    }
    
    CLAIM_CSV_HEADERS = {
        "tracking_no": ["运单号", "快递单号", "tracking_no", "waybill", "单号"],
        "claim_amount": ["申请金额", "赔付金额", "金额", "amount"],
        "application_date": ["申请日期", "日期", "date", "申请时间"],
        "applicant": ["申请人", "applicant", "申请人"],
        "status": ["状态", "status", "审核状态"],
    }
    
    def parse_image_metadata(self, file_path: str) -> Optional[Dict[str, Any]]:
        """解析图片元数据"""
        result = {}
        
        stat = os.stat(file_path)
        result["file_modified"] = datetime.fromtimestamp(stat.st_mtime)
        result["file_size"] = stat.st_size
        
        filename = os.path.basename(file_path)
        timestamp_from_name = self._extract_timestamp_from_filename(filename)
        if timestamp_from_name:
            result["timestamp_from_name"] = timestamp_from_name
        
        if HAS_PIL:
            try:
                with Image.open(file_path) as img:
                    result["width"], result["height"] = img.size
                    
                    exif_data = img._getexif() if hasattr(img, '_getexif') else None
                    if exif_data:
                        for tag_id, value in exif_data.items():
                            tag = TAGS.get(tag_id, tag_id)
                            if tag in ["DateTime", "DateTimeOriginal", "DateTimeDigitized"]:
                                try:
                                    exif_dt = datetime.strptime(str(value), "%Y:%m:%d %H:%M:%S")
                                    result["exif_datetime"] = exif_dt
                                    break
                                except (ValueError, TypeError):
                                    continue
            except Exception:
                pass
        
        result["timestamp"] = (
            result.get("exif_datetime") or
            result.get("timestamp_from_name") or
            result.get("file_modified")
        )
        
        return result
    
    def _extract_timestamp_from_filename(self, filename: str) -> Optional[datetime]:
        """从文件名提取时间戳"""
        patterns = [
            r'(\d{4}[-_]?\d{2}[-_]?\d{2}[-_T]?\d{2}[:_]?\d{2}[:_]?\d{2})',
            r'(\d{8}[-_]?\d{6})',
            r'IMG[_-](\d{8})[_-](\d{6})',
            r'Screenshot[_-](\d{4})-(\d{2})-(\d{2})[_-](\d{2})-(\d{2})-(\d{2})',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, filename)
            if match:
                try:
                    ts_str = match.group(0)
                    ts_str = re.sub(r'[_-]', '', ts_str)
                    ts_str = re.sub(r'[:T]', '', ts_str)
                    
                    if len(ts_str) >= 14:
                        return datetime.strptime(ts_str[:14], "%Y%m%d%H%M%S")
                    elif len(ts_str) >= 8:
                        return datetime.strptime(ts_str[:8], "%Y%m%d")
                except (ValueError, TypeError):
                    continue
        
        return None
    
    def parse_remarks_csv(self, file_path: str) -> List[Remark]:
        """解析客服备注CSV"""
        remarks = []
        
        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                field_map = self._map_fields(reader.fieldnames or [], self.REMARK_CSV_HEADERS)
                
                for row in reader:
                    tracking_no = self._get_value(row, field_map, "tracking_no")
                    if not tracking_no:
                        continue
                    
                    remark = Remark(
                        tracking_no=str(tracking_no).strip().upper(),
                        customer_name=self._get_value(row, field_map, "customer_name", ""),
                        contact_phone=self._get_value(row, field_map, "contact_phone", ""),
                        issue_type=self._get_value(row, field_map, "issue_type", ""),
                        issue_description=self._get_value(row, field_map, "issue_description", ""),
                        claim_amount=self._parse_amount(self._get_value(row, field_map, "claim_amount", "0")),
                        operator=self._get_value(row, field_map, "operator", ""),
                        source_file=file_path,
                    )
                    
                    date_str = self._get_value(row, field_map, "remark_date")
                    if date_str:
                        remark.remark_date = self._parse_date(date_str)
                    
                    remarks.append(remark)
        except Exception as e:
            pass
        
        return remarks
    
    def parse_claim_forms_csv(self, file_path: str) -> List[ClaimForm]:
        """解析赔付申请表CSV"""
        claims = []
        
        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                field_map = self._map_fields(reader.fieldnames or [], self.CLAIM_CSV_HEADERS)
                
                if "claim_amount" not in field_map and "tracking_no" not in field_map:
                    return []
                
                for row in reader:
                    tracking_no = self._get_value(row, field_map, "tracking_no")
                    if not tracking_no:
                        continue
                    
                    claim = ClaimForm(
                        tracking_no=str(tracking_no).strip().upper(),
                        claim_amount=self._parse_amount(self._get_value(row, field_map, "claim_amount", "0")),
                        applicant=self._get_value(row, field_map, "applicant", ""),
                        status=self._get_value(row, field_map, "status", ""),
                        source_file=file_path,
                    )
                    
                    date_str = self._get_value(row, field_map, "application_date")
                    if date_str:
                        claim.application_date = self._parse_date(date_str)
                    
                    claims.append(claim)
        except Exception:
            pass
        
        return claims
    
    def _map_fields(self, actual_fields: List[str], header_map: Dict[str, List[str]]) -> Dict[str, str]:
        """映射CSV字段名"""
        field_map = {}
        
        actual_lower = {f.lower(): f for f in actual_fields}
        
        for target_field, possible_names in header_map.items():
            for name in possible_names:
                name_lower = name.lower()
                if name_lower in actual_lower:
                    field_map[target_field] = actual_lower[name_lower]
                    break
        
        for actual in actual_fields:
            actual_lower = actual.lower()
            if actual_lower == "运单号" or actual_lower == "tracking_no" or actual_lower == "单号":
                if "tracking_no" not in field_map:
                    field_map["tracking_no"] = actual
            elif "金额" in actual_lower or "amount" in actual_lower:
                if "claim_amount" not in field_map:
                    field_map["claim_amount"] = actual
        
        return field_map
    
    def _get_value(self, row: Dict, field_map: Dict[str, str], field: str, default: Any = None) -> Any:
        """从行中获取值"""
        if field in field_map and field_map[field] in row:
            value = row[field_map[field]]
            return value.strip() if isinstance(value, str) else value
        return default
    
    def _parse_amount(self, value: str) -> float:
        """解析金额"""
        if not value:
            return 0.0
        
        value = str(value).strip()
        value = re.sub(r'[¥￥$,]', '', value)
        
        try:
            return float(value)
        except (ValueError, TypeError):
            return 0.0
    
    def _parse_date(self, value: str) -> Optional[datetime]:
        """解析日期"""
        if not value:
            return None
        
        value = str(value).strip()
        
        try:
            if HAS_DATEUTIL:
                return parse_date(value, fuzzy=True)
        except Exception:
            pass
        
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d",
            "%Y年%m月%d日",
            "%Y%m%d%H%M%S",
            "%Y%m%d",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(value, fmt)
            except (ValueError, TypeError):
                continue
        
        return None
