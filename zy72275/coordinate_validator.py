import re
from typing import Tuple, Optional
from models import CoordinateType, ProcessingStatus


class CoordinateValidator:
    LAT_LNG_PATTERN = re.compile(
        r'(-?\d+\.?\d*)\s*[,，\s]\s*(-?\d+\.?\d*)'
    )
    
    METRIC_PATTERN = re.compile(
        r'([XYxy]?\s*[:：=]?\s*\d+\.?\d*)\s*[,，\s]\s*([XYxy]?\s*[:：=]?\s*\d+\.?\d*)'
    )

    @classmethod
    def detect_coordinate_type(cls, content: str) -> Tuple[CoordinateType, Optional[dict]]:
        lat_lng_match = cls.LAT_LNG_PATTERN.search(content)
        metric_match = cls.METRIC_PATTERN.search(content)
        
        has_lat_lng_keywords = any(k in content.lower() for k in ['lat', 'lng', '经度', '纬度', '经纬度'])
        has_metric_keywords = any(k in content.lower() for k in ['x=', 'y=', 'x:', 'y:', '米制', '坐标'])
        
        lat_lng_values = None
        metric_values = None
        
        if lat_lng_match:
            try:
                val1 = float(lat_lng_match.group(1))
                val2 = float(lat_lng_match.group(2))
                if -90 <= val1 <= 90 and -180 <= val2 <= 180:
                    lat_lng_values = {'latitude': val1, 'longitude': val2}
                elif -90 <= val2 <= 90 and -180 <= val1 <= 180:
                    lat_lng_values = {'latitude': val2, 'longitude': val1}
            except ValueError:
                pass
        
        xy_matches = re.findall(r'[XYxy]\s*[:：=]\s*(\d+\.?\d*)', content)
        if len(xy_matches) >= 2:
            try:
                metric_values = {'metric_x': float(xy_matches[0]), 'metric_y': float(xy_matches[1])}
            except ValueError:
                pass
        elif metric_match and not lat_lng_values:
            try:
                raw1 = metric_match.group(1)
                raw2 = metric_match.group(2)
                num1 = float(re.sub(r'[XYxy\s:：=]', '', raw1))
                num2 = float(re.sub(r'[XYxy\s:：=]', '', raw2))
                metric_values = {'metric_x': num1, 'metric_y': num2}
            except ValueError:
                pass
        
        has_lat_lng = bool(lat_lng_values or has_lat_lng_keywords)
        
        explicit_metric_markers = has_metric_keywords or (
            metric_match and 
            (re.search(r'[XYxy][:=]', content) or '米制' in content or '坐标' in content)
        )
        has_metric = bool((metric_values and explicit_metric_markers) or has_metric_keywords)
        
        if has_lat_lng and has_metric:
            return CoordinateType.MIXED, {**(lat_lng_values or {}), **(metric_values or {})}
        elif has_lat_lng:
            return CoordinateType.LAT_LNG, lat_lng_values
        elif has_metric:
            return CoordinateType.METRIC, metric_values
        else:
            return CoordinateType.UNKNOWN, None

    @classmethod
    def determine_processing_status(cls, coord_type: CoordinateType, manual_review: bool = False) -> ProcessingStatus:
        if coord_type == CoordinateType.MIXED:
            return ProcessingStatus.NEEDS_REVIEW
        elif coord_type == CoordinateType.UNKNOWN:
            return ProcessingStatus.ABNORMAL
        elif manual_review:
            return ProcessingStatus.NORMAL
        else:
            return ProcessingStatus.PENDING

    @classmethod
    def validate_boundary_rules(cls) -> dict:
        return {
            'mixed_coordinate_handling': {
                'detection': '经纬度和米制坐标关键词同时出现，或同时匹配两种坐标格式',
                'classification': '自动标记为 NEEDS_REVIEW（待巡检组复核）',
                'action_required': '不得自动归为 NORMAL，需人工确认后处理',
                'rollback_support': '保留原始行内容，支持一键回滚'
            },
            'unknown_coordinate_handling': {
                'detection': '无法识别任何坐标格式',
                'classification': '自动标记为 ABNORMAL',
                'action_required': '需人工补全坐标信息'
            },
            'normal_coordinate_handling': {
                'detection': '单一坐标类型且格式正确',
                'classification': '初始为 PENDING，人工复核后变为 NORMAL'
            }
        }
