import csv
import pandas as pd
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from pathlib import Path

from .models import (
    Material, MaterialType, ScanRecord, ReturnRecord,
    RecordSource, RecordStatus, MaterialUsage, ProjectReport
)


def parse_datetime(dt_str: str) -> datetime:
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%Y%m%d%H%M%S",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(dt_str, fmt)
        except ValueError:
            continue
    raise ValueError(f"无法解析时间格式: {dt_str}")


def load_materials_ledger(file_path: Path) -> List[Material]:
    materials = []
    df = pd.read_excel(file_path) if str(file_path).endswith('.xlsx') else pd.read_csv(file_path)
    
    for _, row in df.iterrows():
        material_type_map = {
            "桁架": MaterialType.TRUSS,
            "灯具": MaterialType.LIGHTING,
            "桌椅": MaterialType.FURNITURE,
        }
        material_type = material_type_map.get(str(row.get("物料类型", "")).strip(), MaterialType.TRUSS)
        
        material = Material(
            qr_code=str(row.get("二维码编号", "")).strip(),
            name=str(row.get("物料名称", "")).strip(),
            material_type=material_type,
            specification=str(row.get("规格型号", "")).strip(),
            initial_quantity=int(row.get("初始数量", 1)),
            project=str(row.get("展会项目", "")).strip(),
            location=str(row.get("存放位置", "")).strip(),
            remarks=str(row.get("备注", "")).strip(),
        )
        materials.append(material)
    
    return materials


def load_scan_records(file_path: Path) -> List[ScanRecord]:
    records = []
    df = pd.read_excel(file_path) if str(file_path).endswith('.xlsx') else pd.read_csv(file_path)
    
    for _, row in df.iterrows():
        try:
            scan_time = parse_datetime(str(row.get("扫码时间", "")).strip())
        except ValueError:
            scan_time = datetime.now()
        
        source_map = {
            "扫码": RecordSource.SCAN,
            "离线补录": RecordSource.OFFLINE,
        }
        source = source_map.get(str(row.get("来源", "扫码")).strip(), RecordSource.SCAN)
        
        record = ScanRecord(
            qr_code=str(row.get("二维码编号", "")).strip(),
            scan_time=scan_time,
            receiver=str(row.get("领用人", "")).strip(),
            receiver_department=str(row.get("领用部门", "")).strip(),
            project=str(row.get("展会项目", "")).strip(),
            source=source,
            quantity=int(row.get("领用数量", 1)),
            original_record=row.to_dict(),
        )
        records.append(record)
    
    return records


def load_return_records(file_path: Path) -> List[ReturnRecord]:
    records = []
    df = pd.read_excel(file_path) if str(file_path).endswith('.xlsx') else pd.read_csv(file_path)
    
    for _, row in df.iterrows():
        try:
            return_time = parse_datetime(str(row.get("归还时间", "")).strip())
        except ValueError:
            return_time = datetime.now()
        
        record = ReturnRecord(
            qr_code=str(row.get("二维码编号", "")).strip(),
            return_time=return_time,
            returner=str(row.get("归还人", "")).strip(),
            return_department=str(row.get("归还部门", "")).strip(),
            project=str(row.get("展会项目", "")).strip(),
            quantity=int(row.get("归还数量", 1)),
        )
        records.append(record)
    
    return records


def deduplicate_scan_records(records: List[ScanRecord]) -> Tuple[List[ScanRecord], List[Dict]]:
    seen = {}
    result = []
    duplicates = []
    
    for record in records:
        key = (record.qr_code, record.receiver, record.scan_time.date())
        
        if key in seen:
            record.status = RecordStatus.DUPLICATE
            record.skip_reason = f"与 {seen[key].scan_time.strftime('%Y-%m-%d %H:%M:%S')} 的记录重复"
            duplicates.append({
                "original": seen[key].to_dict(),
                "duplicate": record.to_dict(),
            })
        else:
            seen[key] = record
        result.append(record)
    
    return result, duplicates


def merge_offline_records(
    scan_records: List[ScanRecord],
    offline_records: List[ScanRecord]
) -> Tuple[List[ScanRecord], List[Dict]]:
    result = scan_records.copy()
    merged_info = []
    
    scanned_keys = set()
    for record in scan_records:
        if record.status == RecordStatus.ACTIVE:
            scanned_keys.add((record.qr_code, record.receiver))
    
    for offline in offline_records:
        key = (offline.qr_code, offline.receiver)
        
        if key in scanned_keys:
            offline.status = RecordStatus.SKIPPED
            offline.skip_reason = "该物料已通过扫码领用，离线记录被跳过"
            merged_info.append({
                "action": "跳过",
                "reason": "已存在扫码记录",
                "record": offline.to_dict(),
            })
        else:
            offline.source = RecordSource.OFFLINE
            merged_info.append({
                "action": "合并",
                "reason": "新增离线补录",
                "record": offline.to_dict(),
            })
        result.append(offline)
    
    result.sort(key=lambda r: r.scan_time)
    return result, merged_info


def validate_return_records(
    scan_records: List[ScanRecord],
    return_records: List[ReturnRecord]
) -> Tuple[List[ReturnRecord], List[Dict]]:
    total_received_by_qr = {}
    for record in scan_records:
        if record.status == RecordStatus.ACTIVE:
            total_received_by_qr[record.qr_code] = total_received_by_qr.get(record.qr_code, 0) + record.quantity
    
    total_returned_by_qr = {}
    result = []
    issues = []
    
    for record in return_records:
        qr_code = record.qr_code
        new_returned = total_returned_by_qr.get(qr_code, 0) + record.quantity
        total_received = total_received_by_qr.get(qr_code, 0)
        
        if new_returned > total_received:
            record.status = RecordStatus.OVER_RETURN
            record.skip_reason = f"归还数量({new_returned})超过领用数量({total_received})"
            issues.append({
                "type": "归还超额",
                "qr_code": qr_code,
                "total_received": total_received,
                "total_returned": new_returned,
                "excess": new_returned - total_received,
            })
        total_returned_by_qr[qr_code] = new_returned
        result.append(record)
    
    return result, issues


def check_inventory_discrepancies(
    materials: List[Material],
    scan_records: List[ScanRecord],
    return_records: List[ReturnRecord]
) -> Dict[str, ProjectReport]:
    reports = {}
    
    material_map = {m.qr_code: m for m in materials}
    
    for material in materials:
        if material.project not in reports:
            reports[material.project] = ProjectReport(project=material.project)
        
        if material.qr_code not in reports[material.project].materials:
            reports[material.project].materials[material.qr_code] = MaterialUsage(
                qr_code=material.qr_code,
                material=material,
            )
    
    for record in scan_records:
        if record.project not in reports:
            reports[record.project] = ProjectReport(project=record.project)
        
        if record.qr_code not in reports[record.project].materials:
            if record.qr_code in material_map:
                material = material_map[record.qr_code]
            else:
                material = Material(
                    qr_code=record.qr_code,
                    name="未知物料",
                    material_type=MaterialType.TRUSS,
                    specification="未知",
                    initial_quantity=0,
                    project=record.project,
                    remarks="物料台账中未找到",
                )
                reports[record.project].issues.append(f"物料 {record.qr_code} 不在台账中")
            
            reports[record.project].materials[record.qr_code] = MaterialUsage(
                qr_code=record.qr_code,
                material=material,
            )
        
        reports[record.project].materials[record.qr_code].scan_records.append(record)
    
    for record in return_records:
        if record.project not in reports:
            reports[record.project] = ProjectReport(project=record.project)
        
        if record.qr_code not in reports[record.project].materials:
            if record.qr_code in material_map:
                material = material_map[record.qr_code]
            else:
                material = Material(
                    qr_code=record.qr_code,
                    name="未知物料",
                    material_type=MaterialType.TRUSS,
                    specification="未知",
                    initial_quantity=0,
                    project=record.project,
                    remarks="物料台账中未找到",
                )
                reports[record.project].issues.append(f"物料 {record.qr_code} 不在台账中")
            
            reports[record.project].materials[record.qr_code] = MaterialUsage(
                qr_code=record.qr_code,
                material=material,
            )
        
        reports[record.project].materials[record.qr_code].return_records.append(record)
    
    return reports


def generate_sample_qr_codes(
    project: str,
    output_dir: Path
) -> Dict[str, List[str]]:
    output_dir.mkdir(parents=True, exist_ok=True)
    
    samples = {
        "桁架": [
            f"TRUSS-{project}-001",
            f"TRUSS-{project}-002",
            f"TRUSS-{project}-003",
            f"TRUSS-{project}-004",
            f"TRUSS-{project}-005",
        ],
        "灯具": [
            f"LIGHT-{project}-001",
            f"LIGHT-{project}-002",
            f"LIGHT-{project}-003",
            f"LIGHT-{project}-004",
            f"LIGHT-{project}-005",
        ],
        "桌椅": [
            f"FURN-{project}-001",
            f"FURN-{project}-002",
            f"FURN-{project}-003",
            f"FURN-{project}-004",
            f"FURN-{project}-005",
        ],
    }
    
    df_data = []
    for material_type, codes in samples.items():
        for i, code in enumerate(codes):
            names = {
                "桁架": "铝合金桁架",
                "灯具": "LED帕灯",
                "桌椅": "会议桌椅套装",
            }
            specs = {
                "桁架": "300x300mm 2米",
                "灯具": "200W RGBW",
                "桌椅": "1.2米圆桌+6椅",
            }
            df_data.append({
                "二维码编号": code,
                "物料名称": names[material_type],
                "物料类型": material_type,
                "规格型号": specs[material_type],
                "初始数量": 1,
                "展会项目": project,
                "存放位置": f"A区-{i+1:02d}号货架",
                "备注": "",
            })
    
    df = pd.DataFrame(df_data)
    output_file = output_dir / f"物料台账_{project}.xlsx"
    df.to_excel(output_file, index=False)
    
    return samples
