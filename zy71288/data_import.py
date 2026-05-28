import pandas as pd
import numpy as np
import json
import hashlib
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime
import logging

from config import config
from data_models import (
    DataSourceType, ReservationRecord, WeatherRecord, EventRecord,
    HistoricalRecord, CapacityRecord, AnomalyRecord, ProcessingStatus
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class DataImportManager:
    def __init__(self):
        self.processed_hashes = set()
        self.anomalies: List[AnomalyRecord] = []
        self.imported_records = {
            'reservations': [],
            'weather': [],
            'events': [],
            'historical': [],
            'capacity': []
        }
    
    def _compute_record_hash(self, record_data: Dict[str, Any]) -> str:
        sorted_data = json.dumps(record_data, sort_keys=True)
        return hashlib.md5(sorted_data.encode()).hexdigest()
    
    def _check_duplicate(self, record_hash: str) -> bool:
        if record_hash in self.processed_hashes:
            return True
        self.processed_hashes.add(record_hash)
        return False
    
    @staticmethod
    def _clean_row(row: 'pd.Series') -> Dict[str, Any]:
        cleaned = {}
        for key, value in row.items():
            if pd.isna(value):
                cleaned[key] = None
            else:
                cleaned[key] = value
        return cleaned
    
    @staticmethod
    def _str_val(value: Any) -> Optional[str]:
        if value is None:
            return None
        s = str(value)
        if s == 'nan':
            return None
        return s
    
    @staticmethod
    def _int_val(value: Any) -> Optional[int]:
        if value is None or (isinstance(value, float) and pd.isna(value)):
            return None
        try:
            return int(value)
        except (ValueError, TypeError):
            return None
    
    @staticmethod
    def _float_val(value: Any) -> Optional[float]:
        if value is None or (isinstance(value, float) and pd.isna(value)):
            return None
        try:
            return float(value)
        except (ValueError, TypeError):
            return None
    
    @staticmethod
    def _bool_val(value: Any) -> Optional[bool]:
        if value is None or (isinstance(value, float) and pd.isna(value)):
            return None
        if isinstance(value, (bool, np.bool_)):
            return bool(value)
        if isinstance(value, str):
            return value.lower() in ('true', '1', 'yes')
        return None
    
    def _validate_required_fields(self, df: pd.DataFrame, source_type: DataSourceType) -> List[str]:
        required_fields = config.REQUIRED_FIELDS.get(source_type.value, [])
        missing_fields = [f for f in required_fields if f not in df.columns]
        return missing_fields
    
    def import_reservations(self, file_path: Path) -> Tuple[List[ReservationRecord], List[AnomalyRecord]]:
        logger.info(f"导入预约数据: {file_path}")
        records: List[ReservationRecord] = []
        anomalies: List[AnomalyRecord] = []
        
        df = pd.read_excel(file_path) if file_path.suffix in ['.xlsx', '.xls'] else pd.read_csv(file_path)
        
        missing_fields = self._validate_required_fields(df, DataSourceType.RESERVATIONS)
        if missing_fields:
            anomaly = AnomalyRecord(
                anomaly_type="missing_fields",
                severity="error",
                message=f"预约数据缺少必需字段: {', '.join(missing_fields)}",
                related_data={"source": str(file_path), "missing_fields": missing_fields},
                suggestion="请补充缺失字段后重新导入，或确认数据源是否正确"
            )
            anomalies.append(anomaly)
            return records, anomalies
        
        for _, row in df.iterrows():
            cleaned = self._clean_row(row)
            record_hash = self._compute_record_hash(cleaned)
            
            if self._check_duplicate(record_hash):
                anomaly = AnomalyRecord(
                    anomaly_type="duplicate_record",
                    severity="warning",
                    message=f"重复的预约记录: {cleaned.get('booking_id', 'unknown')}",
                    related_data={"booking_id": cleaned.get('booking_id')},
                    suggestion="该记录已存在，已跳过处理"
                )
                anomalies.append(anomaly)
                continue
            
            try:
                record = ReservationRecord(
                    booking_id=self._str_val(cleaned['booking_id']),
                    date=self._str_val(cleaned['date']),
                    hour=self._int_val(cleaned['hour']),
                    people_count=self._int_val(cleaned['people_count']),
                    status=self._str_val(cleaned['status']).lower(),
                    visitor_type=self._str_val(cleaned.get('visitor_type')),
                    group_id=self._str_val(cleaned.get('group_id')),
                    raw_data=cleaned,
                    manual_notes=self._str_val(cleaned.get('manual_notes') or cleaned.get('备注')),
                    data_source=DataSourceType.RESERVATIONS
                )
                records.append(record)
            except Exception as e:
                anomaly = AnomalyRecord(
                    anomaly_type="invalid_record",
                    severity="error",
                    message=f"预约记录验证失败: {str(e)}",
                    related_data={"raw_data": cleaned},
                    suggestion="请检查数据格式是否正确"
                )
                anomalies.append(anomaly)
        
        self.imported_records['reservations'].extend(records)
        self.anomalies.extend(anomalies)
        logger.info(f"成功导入 {len(records)} 条预约记录，发现 {len(anomalies)} 个异常")
        return records, anomalies
    
    def import_weather(self, file_path: Path) -> Tuple[List[WeatherRecord], List[AnomalyRecord]]:
        logger.info(f"导入天气数据: {file_path}")
        records: List[WeatherRecord] = []
        anomalies: List[AnomalyRecord] = []
        
        df = pd.read_excel(file_path) if file_path.suffix in ['.xlsx', '.xls'] else pd.read_csv(file_path)
        
        missing_fields = self._validate_required_fields(df, DataSourceType.WEATHER)
        if missing_fields:
            anomaly = AnomalyRecord(
                anomaly_type="missing_fields",
                severity="warning",
                message=f"天气数据缺少字段: {', '.join(missing_fields)}，将尝试使用可用数据",
                related_data={"source": str(file_path), "missing_fields": missing_fields},
                suggestion="天气数据缺失可能影响预测准确性，建议补充"
            )
            anomalies.append(anomaly)
        
        for _, row in df.iterrows():
            cleaned = self._clean_row(row)
            record_hash = self._compute_record_hash(cleaned)
            
            if self._check_duplicate(record_hash):
                continue
            
            try:
                temp = cleaned.get('temperature')
                rain_prob = cleaned.get('rain_probability')
                weather_cond = cleaned.get('weather_condition')
                
                if temp is None or rain_prob is None or weather_cond is None:
                    anomaly = AnomalyRecord(
                        anomaly_type="weather_missing",
                        severity="warning",
                        message=f"{cleaned.get('date', '?')} {cleaned.get('hour', '?')}时天气数据缺失",
                        related_data={"date": self._str_val(cleaned.get('date')), "hour": self._int_val(cleaned.get('hour'))},
                        suggestion="将使用历史均值填充，建议检查天气数据源"
                    )
                    anomalies.append(anomaly)
                
                record = WeatherRecord(
                    date=self._str_val(cleaned['date']),
                    hour=self._int_val(cleaned['hour']),
                    temperature=self._float_val(temp),
                    rain_probability=self._float_val(rain_prob),
                    weather_condition=self._str_val(weather_cond).lower() if weather_cond else None,
                    wind_speed=self._float_val(cleaned.get('wind_speed')),
                    raw_data=cleaned,
                    manual_notes=self._str_val(cleaned.get('manual_notes') or cleaned.get('备注')),
                    data_source=DataSourceType.WEATHER
                )
                records.append(record)
            except Exception as e:
                anomaly = AnomalyRecord(
                    anomaly_type="invalid_record",
                    severity="error",
                    message=f"天气记录验证失败: {str(e)}",
                    related_data={"raw_data": cleaned},
                    suggestion="请检查数据格式"
                )
                anomalies.append(anomaly)
        
        self.imported_records['weather'].extend(records)
        self.anomalies.extend(anomalies)
        logger.info(f"成功导入 {len(records)} 条天气记录，发现 {len(anomalies)} 个异常")
        return records, anomalies
    
    def import_events(self, file_path: Path) -> Tuple[List[EventRecord], List[AnomalyRecord]]:
        logger.info(f"导入活动数据: {file_path}")
        records: List[EventRecord] = []
        anomalies: List[AnomalyRecord] = []
        
        df = pd.read_excel(file_path) if file_path.suffix in ['.xlsx', '.xls'] else pd.read_csv(file_path)
        
        missing_fields = self._validate_required_fields(df, DataSourceType.EVENTS)
        if missing_fields:
            anomaly = AnomalyRecord(
                anomaly_type="missing_fields",
                severity="error",
                message=f"活动数据缺少必需字段: {', '.join(missing_fields)}",
                related_data={"source": str(file_path), "missing_fields": missing_fields},
                suggestion="请补充缺失的活动信息"
            )
            anomalies.append(anomaly)
            return records, anomalies
        
        for _, row in df.iterrows():
            cleaned = self._clean_row(row)
            record_hash = self._compute_record_hash(cleaned)
            
            if self._check_duplicate(record_hash):
                anomaly = AnomalyRecord(
                    anomaly_type="duplicate_record",
                    severity="warning",
                    message=f"重复的活动记录: {cleaned.get('event_id', 'unknown')}",
                    related_data={"event_id": cleaned.get('event_id')},
                    suggestion="该活动已存在，已跳过"
                )
                anomalies.append(anomaly)
                continue
            
            try:
                expected_attendance = self._int_val(cleaned['expected_attendance'])
                if expected_attendance is None:
                    raise ValueError("expected_attendance 不能为空")
                    
                if expected_attendance > config.GALLERY_CAPACITY:
                    anomaly = AnomalyRecord(
                        anomaly_type="event_abnormal",
                        severity="warning",
                        message=f"活动 {cleaned['event_id']} 预期参与人数({expected_attendance})超过展厅容量({config.GALLERY_CAPACITY})",
                        related_data={"event_id": cleaned['event_id'], "expected": expected_attendance, "capacity": config.GALLERY_CAPACITY},
                        suggestion="建议评估场地承载能力，考虑分流或增加场次"
                    )
                    anomalies.append(anomaly)
                
                record = EventRecord(
                    event_id=self._str_val(cleaned['event_id']),
                    date=self._str_val(cleaned['date']),
                    hour=self._int_val(cleaned['hour']),
                    event_type=self._str_val(cleaned['event_type']),
                    expected_attendance=expected_attendance,
                    event_name=self._str_val(cleaned.get('event_name')),
                    is_vip=self._bool_val(cleaned.get('is_vip')) or False,
                    location=self._str_val(cleaned.get('location')),
                    raw_data=cleaned,
                    manual_notes=self._str_val(cleaned.get('manual_notes') or cleaned.get('备注')),
                    data_source=DataSourceType.EVENTS
                )
                records.append(record)
            except Exception as e:
                anomaly = AnomalyRecord(
                    anomaly_type="invalid_record",
                    severity="error",
                    message=f"活动记录验证失败: {str(e)}",
                    related_data={"raw_data": cleaned},
                    suggestion="请检查活动数据格式"
                )
                anomalies.append(anomaly)
        
        self.imported_records['events'].extend(records)
        self.anomalies.extend(anomalies)
        logger.info(f"成功导入 {len(records)} 条活动记录，发现 {len(anomalies)} 个异常")
        return records, anomalies
    
    def import_historical(self, file_path: Path) -> Tuple[List[HistoricalRecord], List[AnomalyRecord]]:
        logger.info(f"导入历史客流数据: {file_path}")
        records: List[HistoricalRecord] = []
        anomalies: List[AnomalyRecord] = []
        
        df = pd.read_excel(file_path) if file_path.suffix in ['.xlsx', '.xls'] else pd.read_csv(file_path)
        
        missing_fields = self._validate_required_fields(df, DataSourceType.HISTORICAL)
        if missing_fields:
            anomaly = AnomalyRecord(
                anomaly_type="missing_fields",
                severity="error",
                message=f"历史客流数据缺少必需字段: {', '.join(missing_fields)}",
                related_data={"source": str(file_path), "missing_fields": missing_fields},
                suggestion="历史数据是预测模型的基础，必须提供完整字段"
            )
            anomalies.append(anomaly)
            return records, anomalies
        
        for _, row in df.iterrows():
            cleaned = self._clean_row(row)
            record_hash = self._compute_record_hash(cleaned)
            
            if self._check_duplicate(record_hash):
                continue
            
            try:
                record = HistoricalRecord(
                    date=self._str_val(cleaned['date']),
                    hour=self._int_val(cleaned['hour']),
                    actual_visitors=self._int_val(cleaned['actual_visitors']),
                    exhibition_id=self._str_val(cleaned.get('exhibition_id')),
                    is_weekend=self._bool_val(cleaned.get('is_weekend')),
                    is_holiday=self._bool_val(cleaned.get('is_holiday')),
                    raw_data=cleaned,
                    manual_notes=self._str_val(cleaned.get('manual_notes') or cleaned.get('备注')),
                    data_source=DataSourceType.HISTORICAL
                )
                records.append(record)
            except Exception as e:
                anomaly = AnomalyRecord(
                    anomaly_type="invalid_record",
                    severity="error",
                    message=f"历史客流记录验证失败: {str(e)}",
                    related_data={"raw_data": cleaned},
                    suggestion="请检查历史数据格式"
                )
                anomalies.append(anomaly)
        
        self.imported_records['historical'].extend(records)
        self.anomalies.extend(anomalies)
        logger.info(f"成功导入 {len(records)} 条历史客流记录，发现 {len(anomalies)} 个异常")
        return records, anomalies
    
    def import_capacity(self, file_path: Path) -> Tuple[List[CapacityRecord], List[AnomalyRecord]]:
        logger.info(f"导入展厅容量数据: {file_path}")
        records: List[CapacityRecord] = []
        anomalies: List[AnomalyRecord] = []
        
        df = pd.read_excel(file_path) if file_path.suffix in ['.xlsx', '.xls'] else pd.read_csv(file_path)
        
        missing_fields = self._validate_required_fields(df, DataSourceType.CAPACITY)
        if missing_fields:
            anomaly = AnomalyRecord(
                anomaly_type="missing_fields",
                severity="error",
                message=f"容量数据缺少必需字段: {', '.join(missing_fields)}",
                related_data={"source": str(file_path), "missing_fields": missing_fields},
                suggestion="容量数据用于超限预警，必须完整提供"
            )
            anomalies.append(anomaly)
            return records, anomalies
        
        for _, row in df.iterrows():
            cleaned = self._clean_row(row)
            record_hash = self._compute_record_hash(cleaned)
            
            if self._check_duplicate(record_hash):
                continue
            
            try:
                max_capacity = self._int_val(cleaned['max_capacity'])
                if max_capacity is None or max_capacity <= 0:
                    anomaly = AnomalyRecord(
                        anomaly_type="capacity_invalid",
                        severity="error",
                        message=f"区域 {cleaned.get('area_name', '?')} 容量值无效: {cleaned.get('max_capacity')}",
                        related_data={"area_id": cleaned.get('area_id'), "capacity": cleaned.get('max_capacity')},
                        suggestion="容量值必须为正整数"
                    )
                    anomalies.append(anomaly)
                    continue
                
                record = CapacityRecord(
                    area_id=self._str_val(cleaned['area_id']),
                    area_name=self._str_val(cleaned['area_name']),
                    max_capacity=max_capacity,
                    current_count=self._int_val(cleaned.get('current_count')),
                    exhibition_name=self._str_val(cleaned.get('exhibition_name')),
                    raw_data=cleaned,
                    manual_notes=self._str_val(cleaned.get('manual_notes') or cleaned.get('备注')),
                    data_source=DataSourceType.CAPACITY
                )
                records.append(record)
            except Exception as e:
                anomaly = AnomalyRecord(
                    anomaly_type="invalid_record",
                    severity="error",
                    message=f"容量记录验证失败: {str(e)}",
                    related_data={"raw_data": cleaned},
                    suggestion="请检查容量数据格式"
                )
                anomalies.append(anomaly)
        
        self.imported_records['capacity'].extend(records)
        self.anomalies.extend(anomalies)
        logger.info(f"成功导入 {len(records)} 条容量记录，发现 {len(anomalies)} 个异常")
        return records, anomalies
    
    def import_all_from_directory(self, dir_path: Optional[Path] = None) -> Dict[str, Any]:
        if dir_path is None:
            dir_path = config.RAW_DATA_DIR
        
        logger.info(f"从目录批量导入数据: {dir_path}")
        
        import_functions = {
            'reservation': self.import_reservations,
            'reservations': self.import_reservations,
            'weather': self.import_weather,
            'event': self.import_events,
            'events': self.import_events,
            'historical': self.import_historical,
            'history': self.import_historical,
            'capacity': self.import_capacity,
            'capacities': self.import_capacity
        }
        
        results = {
            'total_records': 0,
            'total_anomalies': 0,
            'by_source': {},
            'anomalies': []
        }
        
        for file_path in dir_path.glob('*'):
            if file_path.suffix not in ['.csv', '.xlsx', '.xls']:
                continue
            
            file_name = file_path.stem.lower()
            matched = False
            
            for keyword, import_func in import_functions.items():
                if keyword in file_name:
                    records, anomalies = import_func(file_path)
                    results['by_source'][file_name] = {
                        'records': len(records),
                        'anomalies': len(anomalies)
                    }
                    results['total_records'] += len(records)
                    results['total_anomalies'] += len(anomalies)
                    matched = True
                    break
            
            if not matched:
                logger.warning(f"未识别的数据源文件: {file_path.name}")
        
        results['anomalies'] = [a.model_dump() for a in self.anomalies]
        return results
    
    def save_processed_data(self, output_dir: Optional[Path] = None):
        if output_dir is None:
            output_dir = config.PROCESSED_DATA_DIR
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        for source_type, records in self.imported_records.items():
            if not records:
                continue
            
            records_data = [r.model_dump() for r in records]
            df = pd.DataFrame(records_data)
            
            output_file = output_dir / f"{source_type}_processed_{timestamp}.csv"
            df.to_csv(output_file, index=False, encoding='utf-8-sig')
            logger.info(f"已保存处理后的数据: {output_file}")
        
        if self.anomalies:
            anomalies_df = pd.DataFrame([a.model_dump() for a in self.anomalies])
            anomalies_file = output_dir / f"anomalies_{timestamp}.csv"
            anomalies_df.to_csv(anomalies_file, index=False, encoding='utf-8-sig')
            logger.info(f"已保存异常记录: {anomalies_file}")
