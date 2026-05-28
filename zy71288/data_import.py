import pandas as pd
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
            raw_data = row.to_dict()
            record_hash = self._compute_record_hash(raw_data)
            
            if self._check_duplicate(record_hash):
                anomaly = AnomalyRecord(
                    anomaly_type="duplicate_record",
                    severity="warning",
                    message=f"重复的预约记录: {raw_data.get('booking_id', 'unknown')}",
                    related_data={"booking_id": raw_data.get('booking_id')},
                    suggestion="该记录已存在，已跳过处理"
                )
                anomalies.append(anomaly)
                continue
            
            try:
                record = ReservationRecord(
                    booking_id=str(row['booking_id']),
                    date=str(row['date']),
                    hour=int(row['hour']),
                    people_count=int(row['people_count']),
                    status=str(row['status']).lower(),
                    visitor_type=row.get('visitor_type'),
                    group_id=row.get('group_id'),
                    raw_data=raw_data,
                    manual_notes=row.get('manual_notes', row.get('备注', None)),
                    data_source=DataSourceType.RESERVATIONS
                )
                records.append(record)
            except Exception as e:
                anomaly = AnomalyRecord(
                    anomaly_type="invalid_record",
                    severity="error",
                    message=f"预约记录验证失败: {str(e)}",
                    related_data={"raw_data": raw_data},
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
            raw_data = row.to_dict()
            record_hash = self._compute_record_hash(raw_data)
            
            if self._check_duplicate(record_hash):
                continue
            
            try:
                temp = row.get('temperature')
                rain_prob = row.get('rain_probability')
                weather_cond = row.get('weather_condition')
                
                if pd.isna(temp) or pd.isna(rain_prob) or pd.isna(weather_cond):
                    anomaly = AnomalyRecord(
                        anomaly_type="weather_missing",
                        severity="warning",
                        message=f"{row['date']} {row['hour']}时天气数据缺失",
                        related_data={"date": str(row['date']), "hour": int(row['hour'])},
                        suggestion="将使用历史均值填充，建议检查天气数据源"
                    )
                    anomalies.append(anomaly)
                
                record = WeatherRecord(
                    date=str(row['date']),
                    hour=int(row['hour']),
                    temperature=float(temp) if not pd.isna(temp) else None,
                    rain_probability=float(rain_prob) if not pd.isna(rain_prob) else None,
                    weather_condition=str(weather_cond).lower() if not pd.isna(weather_cond) else None,
                    wind_speed=float(row['wind_speed']) if 'wind_speed' in df and not pd.isna(row['wind_speed']) else None,
                    raw_data=raw_data,
                    manual_notes=row.get('manual_notes', row.get('备注', None)),
                    data_source=DataSourceType.WEATHER
                )
                records.append(record)
            except Exception as e:
                anomaly = AnomalyRecord(
                    anomaly_type="invalid_record",
                    severity="error",
                    message=f"天气记录验证失败: {str(e)}",
                    related_data={"raw_data": raw_data},
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
            raw_data = row.to_dict()
            record_hash = self._compute_record_hash(raw_data)
            
            if self._check_duplicate(record_hash):
                anomaly = AnomalyRecord(
                    anomaly_type="duplicate_record",
                    severity="warning",
                    message=f"重复的活动记录: {raw_data.get('event_id', 'unknown')}",
                    related_data={"event_id": raw_data.get('event_id')},
                    suggestion="该活动已存在，已跳过"
                )
                anomalies.append(anomaly)
                continue
            
            try:
                expected_attendance = int(row['expected_attendance'])
                if expected_attendance > config.GALLERY_CAPACITY:
                    anomaly = AnomalyRecord(
                        anomaly_type="event_abnormal",
                        severity="warning",
                        message=f"活动 {row['event_id']} 预期参与人数({expected_attendance})超过展厅容量({config.GALLERY_CAPACITY})",
                        related_data={"event_id": row['event_id'], "expected": expected_attendance, "capacity": config.GALLERY_CAPACITY},
                        suggestion="建议评估场地承载能力，考虑分流或增加场次"
                    )
                    anomalies.append(anomaly)
                
                record = EventRecord(
                    event_id=str(row['event_id']),
                    date=str(row['date']),
                    hour=int(row['hour']),
                    event_type=str(row['event_type']),
                    expected_attendance=expected_attendance,
                    event_name=row.get('event_name'),
                    is_vip=bool(row.get('is_vip', False)),
                    location=row.get('location'),
                    raw_data=raw_data,
                    manual_notes=row.get('manual_notes', row.get('备注', None)),
                    data_source=DataSourceType.EVENTS
                )
                records.append(record)
            except Exception as e:
                anomaly = AnomalyRecord(
                    anomaly_type="invalid_record",
                    severity="error",
                    message=f"活动记录验证失败: {str(e)}",
                    related_data={"raw_data": raw_data},
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
            raw_data = row.to_dict()
            record_hash = self._compute_record_hash(raw_data)
            
            if self._check_duplicate(record_hash):
                continue
            
            try:
                record = HistoricalRecord(
                    date=str(row['date']),
                    hour=int(row['hour']),
                    actual_visitors=int(row['actual_visitors']),
                    exhibition_id=row.get('exhibition_id'),
                    is_weekend=bool(row.get('is_weekend')) if 'is_weekend' in df else None,
                    is_holiday=bool(row.get('is_holiday')) if 'is_holiday' in df else None,
                    raw_data=raw_data,
                    manual_notes=row.get('manual_notes', row.get('备注', None)),
                    data_source=DataSourceType.HISTORICAL
                )
                records.append(record)
            except Exception as e:
                anomaly = AnomalyRecord(
                    anomaly_type="invalid_record",
                    severity="error",
                    message=f"历史客流记录验证失败: {str(e)}",
                    related_data={"raw_data": raw_data},
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
            raw_data = row.to_dict()
            record_hash = self._compute_record_hash(raw_data)
            
            if self._check_duplicate(record_hash):
                continue
            
            try:
                max_capacity = int(row['max_capacity'])
                if max_capacity <= 0:
                    anomaly = AnomalyRecord(
                        anomaly_type="capacity_invalid",
                        severity="error",
                        message=f"区域 {row['area_name']} 容量值无效: {max_capacity}",
                        related_data={"area_id": row['area_id'], "capacity": max_capacity},
                        suggestion="容量值必须为正整数"
                    )
                    anomalies.append(anomaly)
                    continue
                
                record = CapacityRecord(
                    area_id=str(row['area_id']),
                    area_name=str(row['area_name']),
                    max_capacity=max_capacity,
                    current_count=int(row['current_count']) if 'current_count' in df and not pd.isna(row['current_count']) else None,
                    exhibition_name=row.get('exhibition_name'),
                    raw_data=raw_data,
                    manual_notes=row.get('manual_notes', row.get('备注', None)),
                    data_source=DataSourceType.CAPACITY
                )
                records.append(record)
            except Exception as e:
                anomaly = AnomalyRecord(
                    anomaly_type="invalid_record",
                    severity="error",
                    message=f"容量记录验证失败: {str(e)}",
                    related_data={"raw_data": raw_data},
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
