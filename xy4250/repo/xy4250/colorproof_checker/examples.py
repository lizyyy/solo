import csv
import json
from datetime import datetime, date, timedelta
from pathlib import Path
from decimal import Decimal
from typing import Dict, List, Any


class SampleDataGenerator:
    def __init__(self, output_dir: str):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def generate_all_samples(self) -> Dict[str, str]:
        paths = {}
        
        paths['color_measurements'] = self.generate_color_measurements_csv()
        paths['ink_formulas'] = self.generate_ink_formulas_json()
        paths['paper_batches'] = self.generate_paper_batches_csv()
        paths['drying_records'] = self.generate_drying_records_csv()
        paths['customer_tolerances'] = self.generate_customer_tolerances_json()
        
        return paths
    
    def generate_color_measurements_csv(self) -> str:
        filepath = self.output_dir / "color_measurements.csv"
        
        headers = [
            "sample_name", "batch_number", "color_code", "delta_e",
            "delta_l", "delta_a", "delta_b", "lab_l", "lab_a", "lab_b",
            "measurement_date", "notes"
        ]
        
        rows = [headers]
        
        now = datetime.now()
        
        rows.append([
            "样品001-正常", "BATCH-2026-001", "CUST-PANTONE-186C", "1.25",
            "0.30", "-0.15", "0.80", "52.50", "75.20", "48.30",
            now.isoformat(), "正常样品，DeltaE在容差范围内"
        ])
        
        rows.append([
            "样品002-轻微超标", "BATCH-2026-002", "CUST-PANTONE-286C", "2.85",
            "1.20", "-0.45", "1.80", "45.30", "25.80", "65.20",
            now.isoformat(), "轻微超标，需要注意"
        ])
        
        rows.append([
            "样品003-严重超标", "BATCH-2026-003", "CUST-PANTONE-485C", "5.30",
            "2.10", "3.50", "-1.20", "68.50", "55.30", "82.10",
            now.isoformat(), "严重超标，建议重印"
        ])
        
        with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerows(rows)
        
        return str(filepath)
    
    def generate_ink_formulas_json(self) -> str:
        filepath = self.output_dir / "ink_formulas.json"
        
        formulas = [
            {
                "color_code": "CUST-PANTONE-186C",
                "color_name": "Pantone Red 186 C",
                "customer_id": "CUST001",
                "customer_name": "宏达包装有限公司",
                "pantone_code": "186 C",
                "base_inks": {
                    "PANTONE Rubine Red": Decimal("65.0"),
                    "PANTONE Transparent White": Decimal("20.0"),
                    "PANTONE Yellow": Decimal("15.0")
                },
                "total_weight": Decimal("100"),
                "viscosity": Decimal("18.5"),
                "ph_value": Decimal("8.2"),
                "create_date": str(date.today()),
                "notes": "宏达包装常用红色配方"
            },
            {
                "color_code": "CUST-PANTONE-286C",
                "color_name": "Pantone Blue 286 C",
                "customer_id": "CUST001",
                "customer_name": "宏达包装有限公司",
                "pantone_code": "286 C",
                "base_inks": {
                    "PANTONE Reflex Blue": Decimal("70.0"),
                    "PANTONE Process Blue": Decimal("20.0"),
                    "PANTONE Transparent White": Decimal("10.0")
                },
                "total_weight": Decimal("100"),
                "viscosity": Decimal("17.8"),
                "ph_value": Decimal("8.0"),
                "create_date": str(date.today()),
                "notes": "宏达包装常用蓝色配方"
            },
            {
                "color_code": "CUST-PANTONE-485C",
                "color_name": "Pantone Orange 485 C",
                "customer_id": "CUST002",
                "customer_name": "悦达纸品股份有限公司",
                "pantone_code": "485 C",
                "base_inks": {
                    "PANTONE Orange": Decimal("80.0"),
                    "PANTONE Yellow": Decimal("15.0"),
                    "PANTONE Transparent White": Decimal("5.0")
                },
                "total_weight": Decimal("100"),
                "viscosity": Decimal("19.2"),
                "ph_value": Decimal("8.1"),
                "create_date": str(date.today()),
                "notes": "悦达纸品橙色专用"
            }
        ]
        
        def convert_decimal(obj):
            if isinstance(obj, Decimal):
                return str(obj)
            raise TypeError
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(formulas, f, ensure_ascii=False, indent=2, default=convert_decimal)
        
        return str(filepath)
    
    def generate_paper_batches_csv(self) -> str:
        filepath = self.output_dir / "paper_batches.csv"
        
        headers = [
            "batch_number", "paper_type", "paper_name", "grammage",
            "width", "length", "supplier", "manufacture_date",
            "expiry_date", "received_date", "total_quantity",
            "warehouse_location", "notes"
        ]
        
        rows = [headers]
        
        today = date.today()
        
        rows.append([
            "PAPER-BATCH-001", "铜版纸", "特级铜版纸 157g", "157",
            "889", "1194", "华光纸业",
            str(today - timedelta(days=60)),
            str(today + timedelta(days=300)),
            str(today - timedelta(days=50)),
            "50000",
            "A区-01-03",
            "有效期充足，适合印刷"
        ])
        
        rows.append([
            "PAPER-BATCH-002", "哑粉纸", "高级哑粉纸 200g", "200",
            "889", "1194", "晨鸣纸业",
            str(today - timedelta(days=350)),
            str(today + timedelta(days=10)),
            str(today - timedelta(days=340)),
            "30000",
            "A区-02-05",
            "即将过期，请尽快使用"
        ])
        
        rows.append([
            "PAPER-BATCH-003", "双胶纸", "普通双胶纸 128g", "128",
            "787", "1092", "华泰纸业",
            str(today - timedelta(days=730)),
            str(today - timedelta(days=60)),
            str(today - timedelta(days=400)),
            "20000",
            "B区-03-12",
            "已过期，建议不要使用"
        ])
        
        with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerows(rows)
        
        return str(filepath)
    
    def generate_drying_records_csv(self) -> str:
        filepath = self.output_dir / "drying_records.csv"
        
        headers = [
            "proof_id", "batch_number", "print_time", "drying_start_time",
            "drying_end_time", "drying_method", "drying_temperature",
            "drying_humidity", "coating_type", "coating_amount",
            "operator_name", "visual_check_result", "touch_check_result", "notes"
        ]
        
        rows = [headers]
        
        now = datetime.now()
        
        rows.append([
            "PROOF-001", "BATCH-2026-001",
            (now - timedelta(hours=12)).isoformat(),
            (now - timedelta(hours=10)).isoformat(),
            (now - timedelta(hours=4)).isoformat(),
            "自然晾干", "25", "65",
            "水性光油", "1.2",
            "张师傅", "yes", "yes",
            "干燥良好，无粘连"
        ])
        
        rows.append([
            "PROOF-002", "BATCH-2026-002",
            (now - timedelta(hours=8)).isoformat(),
            (now - timedelta(hours=6)).isoformat(),
            (now - timedelta(hours=1)).isoformat(),
            "烘干箱", "45", "50",
            "UV上光", "1.5",
            "李师傅", "yes", "yes",
            "UV固化完成"
        ])
        
        rows.append([
            "PROOF-003", "BATCH-2026-003",
            (now - timedelta(hours=3)).isoformat(),
            (now - timedelta(hours=2)).isoformat(),
            "",
            "自然晾干", "26", "68",
            "", "",
            "王师傅", "", "",
            "正在干燥中，尚未完成"
        ])
        
        with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerows(rows)
        
        return str(filepath)
    
    def generate_customer_tolerances_json(self) -> str:
        filepath = self.output_dir / "customer_tolerances.json"
        
        tolerances = [
            {
                "customer_id": "CUST001",
                "customer_name": "宏达包装有限公司",
                "delta_e_tolerance": "2.0",
                "special_tolerances": {
                    "CUST-PANTONE-186C": "1.5",
                    "CUST-PANTONE-286C": "1.8"
                },
                "min_drying_hours": "4",
                "notes": "宏达包装对颜色要求较高，红色和蓝色有特殊容差"
            },
            {
                "customer_id": "CUST002",
                "customer_name": "悦达纸品股份有限公司",
                "delta_e_tolerance": "2.5",
                "min_drying_hours": "6",
                "notes": "悦达纸品干燥时间要求较长"
            }
        ]
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(tolerances, f, ensure_ascii=False, indent=2)
        
        return str(filepath)
