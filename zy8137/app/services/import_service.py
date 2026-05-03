import json
import csv
import yaml
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.models import (
    Machinery, GPSTrajectory, PlotContract, PricingRule
)


class ImportService:
    def __init__(self, db: Session):
        self.db = db
    
    def import_machinery_ledger(self, json_content: str) -> Dict[str, Any]:
        try:
            data = json.loads(json_content)
            if isinstance(data, dict):
                data = [data]
            
            imported_count = 0
            errors = []
            
            for idx, item in enumerate(data):
                try:
                    existing = self.db.query(Machinery).filter(
                        Machinery.machine_id == item.get('machine_id')
                    ).first()
                    
                    if existing:
                        existing.machine_type = item.get('machine_type', existing.machine_type)
                        existing.machine_name = item.get('machine_name', existing.machine_name)
                        existing.driver_name = item.get('driver_name', existing.driver_name)
                        existing.driver_phone = item.get('driver_phone', existing.driver_phone)
                        existing.working_width = item.get('working_width', existing.working_width)
                        existing.updated_at = datetime.now()
                    else:
                        machinery = Machinery(
                            machine_id=item.get('machine_id'),
                            machine_type=item.get('machine_type'),
                            machine_name=item.get('machine_name'),
                            driver_name=item.get('driver_name'),
                            driver_phone=item.get('driver_phone'),
                            working_width=item.get('working_width'),
                            created_at=datetime.now(),
                            updated_at=datetime.now()
                        )
                        self.db.add(machinery)
                    
                    imported_count += 1
                except Exception as e:
                    errors.append(f"第 {idx + 1} 条数据错误: {str(e)}")
            
            self.db.commit()
            
            return {
                "success": True,
                "imported_count": imported_count,
                "errors": errors,
                "total": len(data)
            }
            
        except Exception as e:
            self.db.rollback()
            return {
                "success": False,
                "error": f"解析JSON失败: {str(e)}",
                "imported_count": 0
            }
    
    def import_gps_trajectory(self, jsonl_content: str) -> Dict[str, Any]:
        try:
            lines = jsonl_content.strip().split('\n')
            
            imported_count = 0
            errors = []
            
            for idx, line in enumerate(lines):
                try:
                    if not line.strip():
                        continue
                    
                    item = json.loads(line)
                    
                    timestamp_str = item.get('timestamp')
                    if isinstance(timestamp_str, str):
                        timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                    else:
                        timestamp = timestamp_str
                    
                    machine_id = item.get('machine_id')
                    if not machine_id:
                        errors.append(f"第 {idx + 1} 行缺少 machine_id")
                        continue
                    
                    existing_machine = self.db.query(Machinery).filter(
                        Machinery.machine_id == machine_id
                    ).first()
                    
                    if not existing_machine:
                        machine = Machinery(
                            machine_id=machine_id,
                            machine_type="unknown",
                            created_at=datetime.now(),
                            updated_at=datetime.now()
                        )
                        self.db.add(machine)
                        self.db.flush()
                    
                    cross_midnight = item.get('cross_midnight', False)
                    
                    trajectory = GPSTrajectory(
                        machine_id=machine_id,
                        timestamp=timestamp,
                        latitude=float(item.get('latitude', 0)),
                        longitude=float(item.get('longitude', 0)),
                        speed=float(item.get('speed', 0)) if item.get('speed') else None,
                        direction=float(item.get('direction', 0)) if item.get('direction') else None,
                        working_status=item.get('working_status'),
                        raw_data=line,
                        cross_midnight=cross_midnight
                    )
                    self.db.add(trajectory)
                    imported_count += 1
                    
                except Exception as e:
                    errors.append(f"第 {idx + 1} 行错误: {str(e)}")
            
            self.db.commit()
            
            return {
                "success": True,
                "imported_count": imported_count,
                "errors": errors,
                "total_lines": len(lines)
            }
            
        except Exception as e:
            self.db.rollback()
            return {
                "success": False,
                "error": f"导入失败: {str(e)}",
                "imported_count": 0
            }
    
    def import_plot_contract(self, csv_content: str) -> Dict[str, Any]:
        try:
            lines = csv_content.strip().split('\n')
            reader = csv.DictReader(lines)
            
            imported_count = 0
            errors = []
            
            for idx, row in enumerate(reader):
                try:
                    plot_id = row.get('plot_id') or row.get('地块编号')
                    if not plot_id:
                        errors.append(f"第 {idx + 2} 行缺少地块编号")
                        continue
                    
                    existing = self.db.query(PlotContract).filter(
                        PlotContract.plot_id == plot_id
                    ).first()
                    
                    contract_start_date = None
                    if row.get('contract_start_date') or row.get('合同开始日期'):
                        date_str = row.get('contract_start_date') or row.get('合同开始日期')
                        try:
                            contract_start_date = datetime.fromisoformat(date_str)
                        except:
                            pass
                    
                    contract_end_date = None
                    if row.get('contract_end_date') or row.get('合同结束日期'):
                        date_str = row.get('contract_end_date') or row.get('合同结束日期')
                        try:
                            contract_end_date = datetime.fromisoformat(date_str)
                        except:
                            pass
                    
                    plot_area = None
                    if row.get('plot_area') or row.get('地块面积'):
                        area_str = row.get('plot_area') or row.get('地块面积')
                        try:
                            plot_area = float(area_str)
                        except:
                            pass
                    
                    price_per_mu = None
                    if row.get('price_per_mu') or row.get('每亩价格'):
                        price_str = row.get('price_per_mu') or row.get('每亩价格')
                        try:
                            price_per_mu = float(price_str)
                        except:
                            pass
                    
                    boundary_wkt = row.get('boundary_wkt') or row.get('边界WKT')
                    boundary_missing = not boundary_wkt or boundary_wkt.strip() == ''
                    
                    if existing:
                        existing.plot_name = row.get('plot_name') or row.get('地块名称') or existing.plot_name
                        existing.village = row.get('village') or row.get('村庄') or existing.village
                        existing.farmer_name = row.get('farmer_name') or row.get('农户姓名') or existing.farmer_name
                        existing.plot_area = plot_area if plot_area is not None else existing.plot_area
                        existing.boundary_wkt = boundary_wkt if boundary_wkt else existing.boundary_wkt
                        existing.boundary_missing = boundary_missing
                        existing.contract_start_date = contract_start_date or existing.contract_start_date
                        existing.contract_end_date = contract_end_date or existing.contract_end_date
                        existing.price_per_mu = price_per_mu if price_per_mu is not None else existing.price_per_mu
                    else:
                        contract = PlotContract(
                            plot_id=plot_id,
                            plot_name=row.get('plot_name') or row.get('地块名称'),
                            village=row.get('village') or row.get('村庄'),
                            farmer_name=row.get('farmer_name') or row.get('农户姓名'),
                            plot_area=plot_area,
                            boundary_wkt=boundary_wkt,
                            boundary_missing=boundary_missing,
                            contract_start_date=contract_start_date,
                            contract_end_date=contract_end_date,
                            price_per_mu=price_per_mu,
                            created_at=datetime.now()
                        )
                        self.db.add(contract)
                    
                    imported_count += 1
                except Exception as e:
                    errors.append(f"第 {idx + 2} 行错误: {str(e)}")
            
            self.db.commit()
            
            return {
                "success": True,
                "imported_count": imported_count,
                "errors": errors,
                "total_rows": len(list(reader)) + 1 if reader else 0
            }
            
        except Exception as e:
            self.db.rollback()
            return {
                "success": False,
                "error": f"导入失败: {str(e)}",
                "imported_count": 0
            }
    
    def import_pricing_rules(self, yaml_content: str) -> Dict[str, Any]:
        try:
            data = yaml.safe_load(yaml_content)
            
            if not data:
                return {
                    "success": False,
                    "error": "YAML内容为空",
                    "imported_count": 0
                }
            
            if isinstance(data, dict):
                if 'rules' in data:
                    rules = data['rules']
                else:
                    rules = [data]
            elif isinstance(data, list):
                rules = data
            else:
                return {
                    "success": False,
                    "error": "YAML格式不正确",
                    "imported_count": 0
                }
            
            imported_count = 0
            errors = []
            
            for idx, rule_data in enumerate(rules):
                try:
                    rule_name = rule_data.get('rule_name')
                    if not rule_name:
                        rule_name = f"rule_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{idx}"
                    
                    existing = self.db.query(PricingRule).filter(
                        PricingRule.rule_name == rule_name
                    ).first()
                    
                    if existing:
                        existing.machine_type = rule_data.get('machine_type', existing.machine_type)
                        existing.base_price_per_mu = rule_data.get('base_price_per_mu', existing.base_price_per_mu)
                        existing.night_surcharge_rate = rule_data.get('night_surcharge_rate', existing.night_surcharge_rate)
                        existing.night_start_hour = rule_data.get('night_start_hour', existing.night_start_hour)
                        existing.night_end_hour = rule_data.get('night_end_hour', existing.night_end_hour)
                        existing.empty_driving_deduction_rate = rule_data.get('empty_driving_deduction_rate', existing.empty_driving_deduction_rate)
                        existing.empty_driving_speed_threshold = rule_data.get('empty_driving_speed_threshold', existing.empty_driving_speed_threshold)
                        existing.minimum_working_speed = rule_data.get('minimum_working_speed', existing.minimum_working_speed)
                        existing.maximum_working_speed = rule_data.get('maximum_working_speed', existing.maximum_working_speed)
                        existing.work_session_gap_minutes = rule_data.get('work_session_gap_minutes', existing.work_session_gap_minutes)
                        existing.overlap_detection_distance = rule_data.get('overlap_detection_distance', existing.overlap_detection_distance)
                    else:
                        rule = PricingRule(
                            rule_name=rule_name,
                            machine_type=rule_data.get('machine_type'),
                            base_price_per_mu=rule_data.get('base_price_per_mu'),
                            night_surcharge_rate=rule_data.get('night_surcharge_rate', 0.0),
                            night_start_hour=rule_data.get('night_start_hour', 22),
                            night_end_hour=rule_data.get('night_end_hour', 6),
                            empty_driving_deduction_rate=rule_data.get('empty_driving_deduction_rate', 0.0),
                            empty_driving_speed_threshold=rule_data.get('empty_driving_speed_threshold', 15.0),
                            minimum_working_speed=rule_data.get('minimum_working_speed', 2.0),
                            maximum_working_speed=rule_data.get('maximum_working_speed', 12.0),
                            work_session_gap_minutes=rule_data.get('work_session_gap_minutes', 30),
                            overlap_detection_distance=rule_data.get('overlap_detection_distance', 5.0),
                            created_at=datetime.now(),
                            is_active=rule_data.get('is_active', True)
                        )
                        self.db.add(rule)
                    
                    imported_count += 1
                except Exception as e:
                    errors.append(f"第 {idx + 1} 条规则错误: {str(e)}")
            
            self.db.commit()
            
            return {
                "success": True,
                "imported_count": imported_count,
                "errors": errors,
                "total_rules": len(rules)
            }
            
        except Exception as e:
            self.db.rollback()
            return {
                "success": False,
                "error": f"导入失败: {str(e)}",
                "imported_count": 0
            }
