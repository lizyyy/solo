from datetime import datetime
from typing import Dict, List, Any, Optional
from uuid import uuid4

from src.models import Sample, Fridge, Rack, HandoverRecord, SampleType, HandoverStatus
from src.parsers import CSVParser, JSONParser, ExcelParser


class DataImporter:
    
    def __init__(self):
        self.csv_parser = CSVParser()
        self.json_parser = JSONParser()
        self.excel_parser = None
    
    def import_samples_from_csv(self, file_path: str, field_mapping: Optional[Dict[str, str]] = None) -> List[Sample]:
        default_mapping = {
            "sample_id": ["样本ID", "sample_id", "SampleID", "id"],
            "sample_type": ["样本类型", "sample_type", "type"],
            "rack_id": ["架位ID", "rack_id", "rack"],
            "position": ["位置", "position", "pos"],
            "scan_time": ["扫描时间", "scan_time", "时间", "time"],
            "in_fridge_time": ["入柜时间", "in_fridge_time"],
            "out_fridge_time": ["离柜时间", "out_fridge_time"],
            "status": ["状态", "status"]
        }
        mapping = field_mapping or default_mapping
        
        data = self.csv_parser.parse(file_path)
        samples = []
        
        for row in data:
            sample_data = self._map_fields(row, mapping)
            sample = self._create_sample(sample_data)
            if sample:
                samples.append(sample)
        
        return samples
    
    def import_samples_from_json(self, file_path: str, field_mapping: Optional[Dict[str, str]] = None) -> List[Sample]:
        default_mapping = {
            "sample_id": ["sample_id", "SampleID", "id", "样本ID"],
            "sample_type": ["sample_type", "type", "样本类型"],
            "rack_id": ["rack_id", "rack", "架位ID"],
            "position": ["position", "pos", "位置"],
            "scan_time": ["scan_time", "时间", "time", "扫描时间"],
            "in_fridge_time": ["in_fridge_time", "入柜时间"],
            "out_fridge_time": ["out_fridge_time", "离柜时间"],
            "status": ["status", "状态"]
        }
        mapping = field_mapping or default_mapping
        
        data = self.json_parser.parse(file_path)
        samples = []
        
        for row in data:
            sample_data = self._map_fields(row, mapping)
            sample = self._create_sample(sample_data)
            if sample:
                samples.append(sample)
        
        return samples
    
    def import_temperature_from_json(self, file_path: str) -> List[Dict[str, Any]]:
        data = self.json_parser.parse(file_path)
        records = []
        
        for row in data:
            record = {}
            fridge_id = row.get("fridge_id") or row.get("冰箱ID") or row.get("fridge")
            temp = row.get("temperature") or row.get("温度") or row.get("temp")
            timestamp = row.get("timestamp") or row.get("时间") or row.get("time")
            
            if fridge_id and temp is not None:
                record["fridge_id"] = str(fridge_id)
                record["temperature"] = float(temp) if temp is not None else None
                record["timestamp"] = timestamp if isinstance(timestamp, datetime) else datetime.now()
                records.append(record)
        
        return records
    
    def import_handover_from_csv(self, file_path: str) -> List[HandoverRecord]:
        data = self.csv_parser.parse(file_path)
        records = []
        
        for row in data:
            record = HandoverRecord(
                record_id=str(uuid4()),
                sample_id=str(row.get("样本ID") or row.get("sample_id") or row.get("SampleID") or ""),
                from_operator=str(row.get("移交人") or row.get("from_operator") or row.get("from") or ""),
                to_operator=str(row.get("接收人") or row.get("to_operator") or row.get("to") or ""),
                handover_time=row.get("交接时间") or row.get("handover_time") or row.get("time") or datetime.now()
            )
            
            status_str = row.get("状态") or row.get("status")
            if status_str:
                try:
                    record.status = HandoverStatus(str(status_str))
                except ValueError:
                    pass
            
            record.notes = str(row.get("备注") or row.get("notes") or "")
            records.append(record)
        
        return records
    
    def _map_fields(self, row: Dict[str, Any], mapping: Dict[str, List[str]]) -> Dict[str, Any]:
        result = {}
        for target_key, possible_keys in mapping.items():
            for possible_key in possible_keys:
                if possible_key in row:
                    result[target_key] = row[possible_key]
                    break
                if possible_key.lower() in [k.lower() for k in row.keys()]:
                    for k in row.keys():
                        if k.lower() == possible_key.lower():
                            result[target_key] = row[k]
                            break
                    break
        return result
    
    def _create_sample(self, data: Dict[str, Any]) -> Optional[Sample]:
        sample_id = data.get("sample_id")
        if not sample_id:
            return None
        
        sample_type_str = data.get("sample_type", "其他")
        if "血" in str(sample_type_str) or "blood" in str(sample_type_str).lower():
            sample_type = SampleType.BLOOD
        elif "试剂" in str(sample_type_str) or "reagent" in str(sample_type_str).lower():
            sample_type = SampleType.REAGENT
        else:
            sample_type = SampleType.OTHER
        
        sample = Sample(
            sample_id=str(sample_id),
            sample_type=sample_type,
            rack_id=str(data.get("rack_id", "")),
            position=str(data.get("position", "")),
            scan_time=data.get("scan_time") or datetime.now()
        )
        
        if data.get("in_fridge_time"):
            sample.in_fridge_time = data["in_fridge_time"]
        if data.get("out_fridge_time"):
            sample.out_fridge_time = data["out_fridge_time"]
        if data.get("status"):
            sample.status = str(data["status"])
        
        return sample
