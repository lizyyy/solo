"""
打包模块 - 复制通过校验的病例并生成交付清单
"""

import csv
import json
import os
import shutil
from datetime import datetime
from typing import Dict, List, Any, Optional

from .models import OrderCase, OrderStatus


class Packer:
    def __init__(self, output_dir: str):
        self.output_dir = os.path.abspath(output_dir)
        self.packed_cases: List[OrderCase] = []
        self._ensure_dir_exists()
    
    def _ensure_dir_exists(self):
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir, exist_ok=True)
    
    def pack_passed_cases(self, cases: List[OrderCase]) -> Dict[str, Any]:
        passed_cases = [
            case for case in cases 
            if case.status == OrderStatus.PASSED
        ]
        
        if not passed_cases:
            return {
                "packed_count": 0,
                "cases": [],
                "manifest_path": None,
                "output_dir": self.output_dir
            }
        
        pack_timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        pack_dir = os.path.join(self.output_dir, f"delivery_{pack_timestamp}")
        os.makedirs(pack_dir, exist_ok=True)
        
        manifest_entries = []
        
        for case in passed_cases:
            case_dir = os.path.join(pack_dir, case.case_id)
            os.makedirs(case_dir, exist_ok=True)
            
            copied_files = []
            for model_file in case.model_files:
                try:
                    src_path = model_file.file_path
                    dst_path = os.path.join(case_dir, model_file.file_name)
                    
                    shutil.copy2(src_path, dst_path)
                    copied_files.append({
                        "original_path": src_path,
                        "copied_to": dst_path,
                        "file_name": model_file.file_name,
                        "hash_sha256": model_file.hash_sha256,
                        "file_size": model_file.file_size
                    })
                except Exception as e:
                    print(f"Warning: Failed to copy {model_file.file_name}: {e}")
            
            case_info = self._create_case_info(case, copied_files)
            case_info_path = os.path.join(case_dir, f"{case.case_id}_info.json")
            with open(case_info_path, "w", encoding="utf-8") as f:
                json.dump(case_info, f, ensure_ascii=False, indent=2)
            
            manifest_entries.append({
                "case_id": case.case_id,
                "patient_id": case.patient.patient_id,
                "patient_name": case.patient.patient_name,
                "tooth_position": case.tooth_position.raw_position,
                "material_type": case.material.material_type.value if case.material.material_type else "",
                "color_shade": case.material.color_shade,
                "files_count": len(copied_files),
                "model_files": copied_files
            })
            
            self.packed_cases.append(case)
        
        manifest_path = os.path.join(pack_dir, "delivery_manifest.csv")
        self._write_manifest_csv(manifest_entries, manifest_path)
        
        manifest_json_path = os.path.join(pack_dir, "delivery_manifest.json")
        with open(manifest_json_path, "w", encoding="utf-8") as f:
            json.dump({
                "generated_at": datetime.now().isoformat(),
                "total_cases": len(manifest_entries),
                "cases": manifest_entries
            }, f, ensure_ascii=False, indent=2)
        
        return {
            "packed_count": len(passed_cases),
            "cases": manifest_entries,
            "pack_dir": pack_dir,
            "manifest_csv": manifest_path,
            "manifest_json": manifest_json_path,
            "output_dir": self.output_dir
        }
    
    def _create_case_info(self, case: OrderCase, copied_files: List[Dict]) -> Dict[str, Any]:
        return {
            "case_id": case.case_id,
            "patient": {
                "patient_id": case.patient.patient_id,
                "patient_name": case.patient.patient_name,
                "gender": case.patient.gender,
                "age": case.patient.age
            },
            "tooth_position": {
                "raw_position": case.tooth_position.raw_position,
                "teeth": case.tooth_position.teeth
            },
            "material": {
                "material_type": case.material.material_type.value if case.material.material_type else "",
                "color_shade": case.material.color_shade,
                "brand": case.material.brand,
                "model": case.material.model
            },
            "resin_batch": {
                "batch_number": case.resin_batch.batch_number if case.resin_batch else None,
                "expiration_date": case.resin_batch.expiration_date.isoformat() if case.resin_batch and case.resin_batch.expiration_date else None
            } if case.resin_batch else None,
            "validation_summary": {
                "status": case.status.value,
                "total_issues": len(case.validation_issues),
                "critical_issues": len([i for i in case.validation_issues if i.severity == "critical"]),
                "warning_issues": len([i for i in case.validation_issues if i.severity == "warning"])
            },
            "model_files": copied_files,
            "packed_at": datetime.now().isoformat()
        }
    
    def _write_manifest_csv(self, entries: List[Dict], output_path: str):
        if not entries:
            return
        
        fieldnames = [
            "序号", "病例编号", "患者编号", "患者姓名", 
            "牙位", "材料类型", "色号", "文件数量", "备注"
        ]
        
        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for idx, entry in enumerate(entries, start=1):
                writer.writerow({
                    "序号": idx,
                    "病例编号": entry["case_id"],
                    "患者编号": entry["patient_id"],
                    "患者姓名": entry["patient_name"],
                    "牙位": entry["tooth_position"],
                    "材料类型": entry["material_type"],
                    "色号": entry["color_shade"],
                    "文件数量": entry["files_count"],
                    "备注": ""
                })
    
    def get_packing_summary(self) -> Dict[str, Any]:
        return {
            "output_dir": self.output_dir,
            "total_packed": len(self.packed_cases),
            "cases": [
                {
                    "case_id": case.case_id,
                    "patient_id": case.patient.patient_id,
                    "patient_name": case.patient.patient_name,
                    "tooth_position": case.tooth_position.raw_position,
                    "status": case.status.value
                }
                for case in self.packed_cases
            ]
        }
