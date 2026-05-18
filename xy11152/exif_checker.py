import piexif
from PIL import Image
from datetime import datetime
from typing import Dict, List, Optional, Tuple


class ExifChecker:
    def __init__(self, config: Dict):
        self.config = config
        self.required_fields = config.get('exif_check', {}).get('required_fields', [])

    def extract_exif(self, image_path: str) -> Tuple[Dict, List[str]]:
        exif_data = {}
        warnings = []
        
        try:
            img = Image.open(image_path)
            if not hasattr(img, '_getexif') or img._getexif() is None:
                warnings.append("EXIF数据完全缺失")
                return exif_data, warnings
            
            exif_dict = piexif.load(image_path)
            
            exif_data['0th'] = self._extract_ifd_data(exif_dict.get('0th', {}), '0th')
            exif_data['Exif'] = self._extract_ifd_data(exif_dict.get('Exif', {}), 'Exif')
            exif_data['GPS'] = self._extract_gps_data(exif_dict.get('GPS', {}))
            
            for field in self.required_fields:
                if field == 'DateTimeOriginal':
                    if 'DateTimeOriginal' not in exif_data['Exif'] and 36867 not in exif_data['Exif']:
                        warnings.append(f"缺少必填EXIF字段: {field}")
                    else:
                        if 'DateTimeOriginal' not in exif_data['Exif'] and 36867 in exif_data['Exif']:
                            exif_data['Exif']['DateTimeOriginal'] = exif_data['Exif'][36867]
                elif field == 'GPSInfo':
                    if not exif_data['GPS']:
                        warnings.append(f"缺少必填EXIF字段: {field}")
                elif field in ['Make', 'Model']:
                    if field not in exif_data['0th']:
                        warnings.append(f"缺少必填EXIF字段: {field}")
            
            if exif_data['Exif'].get('DateTimeOriginal'):
                try:
                    exif_data['parsed_datetime'] = datetime.strptime(
                        exif_data['Exif']['DateTimeOriginal'],
                        '%Y:%m:%d %H:%M:%S'
                    )
                except ValueError:
                    warnings.append("拍摄时间格式解析失败")
            
        except Exception as e:
            warnings.append(f"EXIF解析失败: {str(e)}")
        
        return exif_data, warnings

    def _extract_ifd_data(self, ifd_dict: Dict, ifd_type: str = '0th') -> Dict:
        result = {}
        for tag, value in ifd_dict.items():
            tag_name = piexif.TAGS.get(ifd_type, {}).get(tag, {}).get('name', str(tag))
            if isinstance(value, bytes):
                try:
                    result[tag_name] = value.decode('utf-8', errors='ignore').strip('\x00')
                except:
                    result[tag_name] = str(value)
            else:
                result[tag_name] = value
        return result

    def _extract_gps_data(self, gps_dict: Dict) -> Dict:
        result = {}
        if not gps_dict:
            return result
        
        try:
            lat_ref = gps_dict.get(piexif.GPSIFD.GPSLatitudeRef, b'N').decode('utf-8')
            lat = gps_dict.get(piexif.GPSIFD.GPSLatitude)
            lng_ref = gps_dict.get(piexif.GPSIFD.GPSLongitudeRef, b'E').decode('utf-8')
            lng = gps_dict.get(piexif.GPSIFD.GPSLongitude)
            
            if lat and lng:
                result['latitude'] = self._convert_to_degrees(lat, lat_ref)
                result['longitude'] = self._convert_to_degrees(lng, lng_ref)
            
            if piexif.GPSIFD.GPSAltitude in gps_dict:
                alt = gps_dict[piexif.GPSIFD.GPSAltitude]
                if isinstance(alt, tuple) and alt[1] != 0:
                    result['altitude'] = alt[0] / alt[1]
            
        except Exception as e:
            pass
        
        return result

    def _convert_to_degrees(self, coordinate: Tuple, ref: str) -> float:
        degrees = coordinate[0][0] / coordinate[0][1]
        minutes = coordinate[1][0] / coordinate[1][1]
        seconds = coordinate[2][0] / coordinate[2][1]
        
        decimal = degrees + (minutes / 60.0) + (seconds / 3600.0)
        
        if ref in ['S', 'W']:
            decimal = -decimal
        
        return round(decimal, 6)

    def check_exif_compliance(self, image_path: str) -> Dict:
        result = {
            'has_exif': False,
            'missing_fields': [],
            'warnings': [],
            'exif_data': {}
        }
        
        exif_data, warnings = self.extract_exif(image_path)
        
        result['exif_data'] = exif_data
        result['warnings'] = warnings
        result['has_exif'] = bool(exif_data)
        
        if exif_data:
            missing = []
            for field in self.required_fields:
                if field == 'DateTimeOriginal':
                    exif_exif = exif_data.get('Exif', {})
                    if 'DateTimeOriginal' not in exif_exif and 36867 not in exif_exif:
                        missing.append(field)
                elif field == 'GPSInfo':
                    if not exif_data.get('GPS'):
                        missing.append(field)
                elif field in ['Make', 'Model']:
                    if field not in exif_data.get('0th', {}):
                        missing.append(field)
            result['missing_fields'] = missing
        
        return result
