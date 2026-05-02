import hashlib
import json
import csv
import re
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any, Tuple
from .models import (
    SamplePosition, ScanLogEntry, TemperatureReading,
    TransferForm, IngestedFile, FileType
)


def calculate_file_hash(file_path: Path) -> str:
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()


def parse_position_to_row_col(position_str: str) -> Tuple[int, int]:
    match = re.match(r'^([A-Z])(\d+)$', position_str.strip().upper())
    if match:
        row_letter = match.group(1)
        col_num = int(match.group(2))
        row = ord(row_letter) - ord('A')
        return row, col_num - 1
    raise ValueError(f"Invalid position format: {position_str}")


class PositionTableParser:
    @staticmethod
    def parse(file_path: Path) -> Tuple[List[SamplePosition], Dict[str, Any]]:
        positions = []
        metadata = {"box_ids": set(), "columns": []}
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            metadata["columns"] = reader.fieldnames or []
            
            for row in reader:
                try:
                    barcode = row.get('barcode', row.get('样本条码', '')).strip()
                    box_id = row.get('box_id', row.get('冻存盒号', '')).strip()
                    position_str = row.get('position', row.get('孔位', '')).strip()
                    
                    if not barcode or not box_id or not position_str:
                        continue
                    
                    row_idx, col_idx = parse_position_to_row_col(position_str)
                    
                    position = SamplePosition(
                        barcode=barcode,
                        box_id=box_id,
                        row=row_idx,
                        col=col_idx,
                        position_str=position_str,
                        batch_id=row.get('batch_id', row.get('批次号')),
                        sample_type=row.get('sample_type', row.get('样本类型'))
                    )
                    positions.append(position)
                    metadata["box_ids"].add(box_id)
                except Exception as e:
                    continue
        
        metadata["box_ids"] = list(metadata["box_ids"])
        return positions, metadata


class ScanLogParser:
    @staticmethod
    def parse(file_path: Path) -> Tuple[List[ScanLogEntry], Dict[str, Any]]:
        entries = []
        metadata = {"scanner_ids": set(), "date_range": None}
        timestamps = []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            metadata["columns"] = reader.fieldnames or []
            
            for row in reader:
                try:
                    barcode = row.get('barcode', row.get('条码', '')).strip()
                    time_str = row.get('scan_time', row.get('扫描时间', '')).strip()
                    
                    if not barcode or not time_str:
                        continue
                    
                    scan_time = datetime.fromisoformat(time_str.replace(' ', 'T'))
                    timestamps.append(scan_time)
                    
                    entry = ScanLogEntry(
                        barcode=barcode,
                        scan_time=scan_time,
                        scanner_id=row.get('scanner_id', row.get('扫描器ID')),
                        location=row.get('location', row.get('位置')),
                        box_id=row.get('box_id', row.get('冻存盒号'))
                    )
                    entries.append(entry)
                    
                    if entry.scanner_id:
                        metadata["scanner_ids"].add(entry.scanner_id)
                except Exception as e:
                    continue
        
        if timestamps:
            metadata["date_range"] = {
                "start": min(timestamps).isoformat(),
                "end": max(timestamps).isoformat()
            }
        metadata["scanner_ids"] = list(metadata["scanner_ids"])
        return entries, metadata


class TemperatureParser:
    @staticmethod
    def parse(file_path: Path) -> Tuple[List[TemperatureReading], Dict[str, Any]]:
        readings = []
        metadata = {"freezer_ids": set(), "temp_range": None, "alerts_count": 0}
        temps = []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        records = data.get('readings', data.get('records', [data] if 'temperature' in data else []))
        
        for record in records:
            try:
                ts_str = record.get('timestamp', record.get('时间'))
                if isinstance(ts_str, str):
                    timestamp = datetime.fromisoformat(ts_str.replace(' ', 'T'))
                else:
                    continue
                
                temp = float(record.get('temperature', record.get('温度')))
                freezer_id = record.get('freezer_id', record.get('冰箱ID', 'UNKNOWN'))
                
                is_alert = record.get('is_alert', False)
                alert_marked = record.get('alert_marked', record.get('已标记', False))
                
                if is_alert:
                    metadata["alerts_count"] += 1
                
                reading = TemperatureReading(
                    timestamp=timestamp,
                    temperature=temp,
                    freezer_id=freezer_id,
                    probe_id=record.get('probe_id', record.get('探头ID')),
                    is_alert=is_alert,
                    alert_marked=alert_marked
                )
                readings.append(reading)
                temps.append(temp)
                metadata["freezer_ids"].add(freezer_id)
            except Exception as e:
                continue
        
        if temps:
            metadata["temp_range"] = {"min": min(temps), "max": max(temps)}
        metadata["freezer_ids"] = list(metadata["freezer_ids"])
        return readings, metadata


class TransferFormParser:
    @staticmethod
    def parse(file_path: Path) -> Tuple[Optional[TransferForm], Dict[str, Any]]:
        metadata = {"source": "json"}
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        try:
            transfer_date_str = data.get('transfer_date', data.get('交接日期'))
            transfer_date = datetime.fromisoformat(transfer_date_str.replace(' ', 'T')) if isinstance(transfer_date_str, str) else datetime.now()
            
            sender_sign_date = data.get('sender_sign_date', data.get('发送方签字日期'))
            if sender_sign_date and isinstance(sender_sign_date, str):
                sender_sign_date = datetime.fromisoformat(sender_sign_date.replace(' ', 'T'))
            
            receiver_sign_date = data.get('receiver_sign_date', data.get('接收方签字日期'))
            if receiver_sign_date and isinstance(receiver_sign_date, str):
                receiver_sign_date = datetime.fromisoformat(receiver_sign_date.replace(' ', 'T'))
            
            form = TransferForm(
                transfer_id=data.get('transfer_id', data.get('交接单号', '')),
                transfer_date=transfer_date,
                sender_name=data.get('sender_name', data.get('发送方', '')),
                sender_signature=data.get('sender_signature', data.get('发送方签字')),
                sender_sign_date=sender_sign_date,
                receiver_name=data.get('receiver_name', data.get('接收方', '')),
                receiver_signature=data.get('receiver_signature', data.get('接收方签字')),
                receiver_sign_date=receiver_sign_date,
                box_ids=data.get('box_ids', data.get('冻存盒列表', [])),
                notes=data.get('notes', data.get('备注'))
            )
            
            metadata["box_count"] = len(form.box_ids)
            metadata["has_signatures"] = {
                "sender": bool(form.sender_signature),
                "receiver": bool(form.receiver_signature)
            }
            
            return form, metadata
        except Exception as e:
            return None, {"error": str(e)}
