import json
import re
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from uuid import uuid4

from models import CalibrationCertificate, Device
from config import CALIBRATION_VALIDITY_DAYS


class CertificateParseError(Exception):
    pass


class CertificateParser:
    def __init__(self):
        self.errors: List[str] = []
    
    def parse(self, file_path: Path) -> List[CalibrationCertificate]:
        self.errors.clear()
        certificates: List[CalibrationCertificate] = []
        
        if not file_path.exists():
            raise CertificateParseError(f"文件不存在: {file_path}")
        
        if file_path.suffix.lower() == ".json":
            return self._parse_json(file_path)
        elif file_path.suffix.lower() == ".txt":
            return self._parse_text(file_path)
        else:
            raise CertificateParseError(f"不支持的文件格式: {file_path.suffix}")
    
    def _parse_json(self, file_path: Path) -> List[CalibrationCertificate]:
        certificates: List[CalibrationCertificate] = []
        
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            raise CertificateParseError(f"JSON解析错误: {e}")
        except UnicodeDecodeError:
            try:
                with open(file_path, "r", encoding="gbk") as f:
                    data = json.load(f)
            except Exception as e:
                raise CertificateParseError(f"无法读取文件: {e}")
        
        if isinstance(data, dict):
            items = self._extract_certificates_from_dict(data)
        elif isinstance(data, list):
            items = data
        else:
            raise CertificateParseError("JSON格式不支持")
        
        for idx, item in enumerate(items):
            try:
                cert = self._parse_single_certificate(item)
                cert.source_file = str(file_path)
                certificates.append(cert)
            except Exception as e:
                self.errors.append(f"第{idx}个证书解析失败: {e}")
        
        return certificates
    
    def _extract_certificates_from_dict(self, data: Dict) -> List[Dict]:
        possible_keys = [
            "certificates", "calibration_certificates",
            "data", "items", "list", "certificate"
        ]
        
        for key in possible_keys:
            if key in data and isinstance(data[key], list):
                return data[key]
        
        return [data]
    
    def _parse_single_certificate(self, item: Dict) -> CalibrationCertificate:
        certificate_id = item.get("certificate_id", item.get("id", item.get("cert_number", str(uuid4()))))
        device_id = item.get("device_id", item.get("设备ID", item.get("设备编号", item.get("device", ""))))
        
        if not device_id:
            raise ValueError("缺少设备ID")
        
        calibration_date = None
        date_str = item.get("calibration_date", item.get("校准日期", item.get("date")))
        if date_str:
            calibration_date = self._parse_datetime(date_str)
        
        if calibration_date is None:
            calibration_date = datetime.now()
        
        valid_until = None
        valid_str = item.get("valid_until", item.get("有效期至", item.get("expiry_date")))
        if valid_str:
            valid_until = self._parse_datetime(valid_str)
        
        if valid_until is None and calibration_date:
            validity_days = item.get("validity_days", item.get("有效天数", CALIBRATION_VALIDITY_DAYS))
            try:
                valid_until = calibration_date + timedelta(days=int(validity_days))
            except (ValueError, TypeError):
                valid_until = calibration_date + timedelta(days=CALIBRATION_VALIDITY_DAYS)
        
        left_calibration = self._parse_calibration_data(
            item.get("left_ear", item.get("左耳", item.get("left", {})))
        )
        right_calibration = self._parse_calibration_data(
            item.get("right_ear", item.get("右耳", item.get("right", {})))
        )
        
        return CalibrationCertificate(
            certificate_id=str(certificate_id),
            device_id=str(device_id),
            calibration_date=calibration_date,
            valid_until=valid_until,
            issued_by=item.get("issued_by", item.get("签发机构", item.get("机构"))),
            certificate_number=item.get("certificate_number", item.get("证书编号", item.get("编号"))),
            calibration_standard=item.get("calibration_standard", item.get("校准标准")),
            technician=item.get("technician", item.get("技师", item.get("校准人员"))),
            left_ear_calibration=left_calibration,
            right_ear_calibration=right_calibration,
            notes=item.get("notes", item.get("备注"))
        )
    
    def _parse_calibration_data(self, data: Any) -> Dict[int, Optional[float]]:
        result: Dict[int, Optional[float]] = {}
        
        if not isinstance(data, dict):
            return result
        
        freq_map = {
            500: ["500", "500Hz", "五百"],
            1000: ["1000", "1000Hz", "1k", "一千"],
            2000: ["2000", "2000Hz", "2k", "两千"],
            4000: ["4000", "4000Hz", "4k", "四千"],
            8000: ["8000", "8000Hz", "8k", "八千"],
        }
        
        for freq, aliases in freq_map.items():
            for key in data:
                key_lower = str(key).lower().strip()
                if any(alias.lower() == key_lower for alias in aliases):
                    value = data[key]
                    if value is not None:
                        try:
                            result[freq] = float(value)
                        except (ValueError, TypeError):
                            result[freq] = None
                    else:
                        result[freq] = None
                    break
        
        return result
    
    def _parse_datetime(self, value: Any) -> Optional[datetime]:
        if value is None:
            return None
        
        if isinstance(value, datetime):
            return value
        
        s = str(value).strip()
        
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%Y/%m/%d",
            "%Y年%m月%d日 %H:%M:%S",
            "%Y年%m月%d日 %H:%M",
            "%Y年%m月%d日",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(s, fmt)
            except ValueError:
                continue
        
        try:
            return datetime.fromisoformat(s)
        except ValueError:
            pass
        
        return None
    
    def _parse_text(self, file_path: Path) -> List[CalibrationCertificate]:
        certificates: List[CalibrationCertificate] = []
        
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
        except UnicodeDecodeError:
            try:
                with open(file_path, "r", encoding="gbk") as f:
                    content = f.read()
            except Exception as e:
                raise CertificateParseError(f"无法读取文件: {e}")
        
        cert_blocks = self._split_into_certificates(content)
        
        for block in cert_blocks:
            try:
                cert = self._parse_text_block(block)
                cert.source_file = str(file_path)
                certificates.append(cert)
            except Exception as e:
                self.errors.append(f"证书块解析失败: {e}")
        
        return certificates
    
    def _split_into_certificates(self, content: str) -> List[str]:
        separator_patterns = [
            r"[-=]{3,}",
            r"证书[编号]?[:：]\s*\S+",
            r"设备[编号ID]?[:：]\s*\S+",
        ]
        
        lines = content.splitlines()
        blocks: List[str] = []
        current_block: List[str] = []
        
        for line in lines:
            is_separator = False
            for pattern in separator_patterns:
                if re.match(pattern, line.strip()):
                    if current_block:
                        blocks.append("\n".join(current_block))
                        current_block = []
                    break
            
            if line.strip():
                current_block.append(line)
        
        if current_block:
            blocks.append("\n".join(current_block))
        
        if not blocks:
            return [content]
        
        return blocks
    
    def _parse_text_block(self, block: str) -> CalibrationCertificate:
        lines = block.splitlines()
        
        device_id = None
        certificate_id = str(uuid4())
        calibration_date = None
        valid_until = None
        issued_by = None
        certificate_number = None
        
        date_patterns = [
            (r"校准日期[：:]\s*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)", "calibration"),
            (r"有效期[至到]?[：:]\s*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)", "valid_until"),
            (r"(\d{4}[-/年]\d{1,2}[-/月]\d{1,2})", "date"),
        ]
        
        for line in lines:
            line_lower = line.lower()
            
            device_match = re.search(r"设备[编号ID]?[：:]\s*(\S+)", line, re.IGNORECASE)
            if device_match and not device_id:
                device_id = device_match.group(1).strip()
            
            cert_match = re.search(r"证书[编号]?[：:]\s*(\S+)", line, re.IGNORECASE)
            if cert_match:
                certificate_number = cert_match.group(1).strip()
                certificate_id = certificate_number
            
            org_match = re.search(r"(签发机构|校准单位|机构)[：:]\s*(.+)", line)
            if org_match and not issued_by:
                issued_by = org_match.group(2).strip()
            
            for pattern, date_type in date_patterns:
                match = re.search(pattern, line)
                if match:
                    date_str = match.group(1)
                    parsed_date = self._parse_datetime(date_str)
                    if parsed_date:
                        if date_type == "calibration":
                            calibration_date = parsed_date
                        elif date_type == "valid_until":
                            valid_until = parsed_date
                        elif date_type == "date" and not calibration_date:
                            calibration_date = parsed_date
        
        if not device_id:
            for line in lines:
                match = re.search(r"[A-Z]{2,}\d{3,}|[A-Z]+\d+[A-Z]*", line)
                if match:
                    device_id = match.group(0)
                    break
        
        if not device_id:
            raise ValueError("无法从文本中识别设备ID")
        
        if calibration_date is None:
            calibration_date = datetime.now()
        
        if valid_until is None and calibration_date:
            for line in lines:
                days_match = re.search(r"有效期?[：:]?\s*(\d+)\s*[天日]?", line)
                if days_match:
                    try:
                        days = int(days_match.group(1))
                        valid_until = calibration_date + timedelta(days=days)
                        break
                    except ValueError:
                        pass
            
            if valid_until is None:
                valid_until = calibration_date + timedelta(days=CALIBRATION_VALIDITY_DAYS)
        
        return CalibrationCertificate(
            certificate_id=certificate_id,
            device_id=device_id,
            calibration_date=calibration_date,
            valid_until=valid_until,
            issued_by=issued_by,
            certificate_number=certificate_number
        )


def parse_calibration_certificate(file_path: Path) -> tuple[List[CalibrationCertificate], List[str]]:
    parser = CertificateParser()
    try:
        certificates = parser.parse(file_path)
        return certificates, parser.errors
    except CertificateParseError as e:
        return [], [str(e)]
