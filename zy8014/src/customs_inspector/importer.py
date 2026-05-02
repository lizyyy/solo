import csv
import json
import os
from datetime import datetime
from typing import List, Optional, Dict, Any

import yaml

from .models import Manifest, ManifestItem, PackingList, PackingItem, DeclarationRule, RiskLevel


class ImportError(Exception):
    pass


class Importer:
    
    @staticmethod
    def import_manifest(csv_path: str) -> Manifest:
        if not os.path.exists(csv_path):
            raise ImportError(f"舱单文件不存在: {csv_path}")
        
        with open(csv_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        
        if not rows:
            raise ImportError("舱单文件为空")
        
        first_row = rows[0]
        
        voyage_no = first_row.get('voyage_no', first_row.get('VoyageNo', first_row.get('voyage', '')))
        vessel_name = first_row.get('vessel_name', first_row.get('VesselName', first_row.get('vessel', '')))
        
        eta_str = first_row.get('eta', first_row.get('ETA', ''))
        etd_str = first_row.get('etd', first_row.get('ETD', ''))
        
        eta = Importer._parse_datetime(eta_str) if eta_str else None
        etd = Importer._parse_datetime(etd_str) if etd_str else None
        
        items: List[ManifestItem] = []
        for i, row in enumerate(rows):
            item = ManifestItem(
                ticket_no=row.get('ticket_no', row.get('TicketNo', row.get('ticket', ''))).strip(),
                container_no=row.get('container_no', row.get('ContainerNo', row.get('container', ''))).strip(),
                description=row.get('description', row.get('Description', row.get('goods_name', row.get('品名', '')))).strip(),
                hs_code=Importer._clean_hs_code(row.get('hs_code', row.get('HSCode', row.get('hs', '')))).strip() or None,
                weight=Importer._parse_float(row.get('weight', row.get('Weight', row.get('gross_weight', '')))),
                weight_unit=row.get('weight_unit', row.get('WeightUnit', 'KG')).upper().strip(),
                volume=Importer._parse_float(row.get('volume', row.get('Volume', row.get('cbm', '')))),
                volume_unit=row.get('volume_unit', row.get('VolumeUnit', 'CBM')).upper().strip(),
                quantity=Importer._parse_int(row.get('quantity', row.get('Quantity', ''))),
                origin_country=row.get('origin_country', row.get('OriginCountry', row.get('origin', ''))).strip() or None,
                destination_country=row.get('destination_country', row.get('DestinationCountry', row.get('destination', ''))).strip() or None,
                is_cancelled=Importer._parse_bool(row.get('is_cancelled', row.get('IsCancelled', row.get('cancelled', 'false')))),
                raw_data=dict(row)
            )
            items.append(item)
        
        return Manifest(
            voyage_no=voyage_no,
            vessel_name=vessel_name,
            eta=eta,
            etd=etd,
            items=items,
            raw_data={'file_path': csv_path}
        )
    
    @staticmethod
    def import_packing_list(json_path: str) -> PackingList:
        if not os.path.exists(json_path):
            raise ImportError(f"装箱单文件不存在: {json_path}")
        
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        ticket_no = data.get('ticket_no', data.get('TicketNo', data.get('ticket', '')))
        packing_date_str = data.get('packing_date', data.get('PackingDate', ''))
        packing_date = Importer._parse_datetime(packing_date_str) if packing_date_str else None
        
        total_weight = Importer._parse_float(data.get('total_weight', data.get('TotalWeight', 0)))
        total_volume = Importer._parse_float(data.get('total_volume', data.get('TotalVolume', 0)))
        
        items_data = data.get('items', data.get('Items', []))
        items: List[PackingItem] = []
        
        for item_data in items_data:
            item = PackingItem(
                ticket_no=item_data.get('ticket_no', item_data.get('TicketNo', ticket_no)).strip(),
                container_no=item_data.get('container_no', item_data.get('ContainerNo', item_data.get('container', ''))).strip(),
                description=item_data.get('description', item_data.get('Description', item_data.get('goods_name', ''))).strip(),
                hs_code=Importer._clean_hs_code(item_data.get('hs_code', item_data.get('HSCode', item_data.get('hs', '')))).strip() or None,
                weight=Importer._parse_float(item_data.get('weight', item_data.get('Weight', item_data.get('gross_weight', 0)))),
                weight_unit=item_data.get('weight_unit', item_data.get('WeightUnit', 'KG')).upper().strip(),
                volume=Importer._parse_float(item_data.get('volume', item_data.get('Volume', item_data.get('cbm', 0)))),
                volume_unit=item_data.get('volume_unit', item_data.get('VolumeUnit', 'CBM')).upper().strip(),
                quantity=Importer._parse_int(item_data.get('quantity', item_data.get('Quantity', 0))),
                package_type=item_data.get('package_type', item_data.get('PackageType', None)),
                marks=item_data.get('marks', item_data.get('Marks', None)),
                raw_data=item_data
            )
            items.append(item)
        
        return PackingList(
            ticket_no=ticket_no,
            packing_date=packing_date,
            items=items,
            total_weight=total_weight,
            total_volume=total_volume,
            raw_data=data
        )
    
    @staticmethod
    def import_multiple_packing_lists(json_paths: List[str]) -> List[PackingList]:
        packing_lists = []
        for path in json_paths:
            pl = Importer.import_packing_list(path)
            packing_lists.append(pl)
        return packing_lists
    
    @staticmethod
    def import_rules(yaml_path: str) -> List[DeclarationRule]:
        if not os.path.exists(yaml_path):
            raise ImportError(f"规则文件不存在: {yaml_path}")
        
        with open(yaml_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        rules_data = data.get('rules', data.get('Rules', [])) if isinstance(data, dict) else data
        if not isinstance(rules_data, list):
            rules_data = [rules_data]
        
        rules: List[DeclarationRule] = []
        
        for rule_data in rules_data:
            if not isinstance(rule_data, dict):
                continue
            
            risk_level_str = rule_data.get('risk_level', rule_data.get('RiskLevel', 'MEDIUM'))
            try:
                risk_level = RiskLevel(risk_level_str.upper())
            except ValueError:
                risk_level = RiskLevel.MEDIUM
            
            rule = DeclarationRule(
                rule_id=rule_data.get('rule_id', rule_data.get('RuleId', '')).strip(),
                rule_name=rule_data.get('rule_name', rule_data.get('RuleName', '')).strip(),
                rule_type=rule_data.get('rule_type', rule_data.get('RuleType', 'validation')).strip(),
                conditions=rule_data.get('conditions', rule_data.get('Conditions', {})),
                required_certificates=rule_data.get('required_certificates', rule_data.get('RequiredCertificates', [])),
                risk_level=risk_level,
                description=rule_data.get('description', rule_data.get('Description', '')).strip(),
                priority=int(rule_data.get('priority', rule_data.get('Priority', 100)))
            )
            rules.append(rule)
        
        return rules
    
    @staticmethod
    def _parse_float(value: Any) -> Optional[float]:
        if value is None or value == '':
            return None
        try:
            if isinstance(value, str):
                value = value.replace(',', '').strip()
            return float(value)
        except (ValueError, TypeError):
            return None
    
    @staticmethod
    def _parse_int(value: Any) -> Optional[int]:
        if value is None or value == '':
            return None
        try:
            if isinstance(value, str):
                value = value.replace(',', '').strip()
            return int(float(value))
        except (ValueError, TypeError):
            return None
    
    @staticmethod
    def _parse_bool(value: Any) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.lower() in ('true', 'yes', 'y', '1', '是', '已撤单')
        return bool(value)
    
    @staticmethod
    def _parse_datetime(value: str) -> Optional[datetime]:
        if not value or not isinstance(value, str):
            return None
        
        formats = [
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%d %H:%M',
            '%Y-%m-%d',
            '%Y/%m/%d %H:%M:%S',
            '%Y/%m/%d %H:%M',
            '%Y/%m/%d',
            '%d-%m-%Y %H:%M:%S',
            '%d-%m-%Y',
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(value.strip(), fmt)
            except ValueError:
                continue
        return None
    
    @staticmethod
    def _clean_hs_code(hs_code: str) -> str:
        if not hs_code:
            return ''
        return ''.join(c for c in hs_code if c.isdigit() or c == '.')
