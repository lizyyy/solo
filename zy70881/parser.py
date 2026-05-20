import pandas as pd
import json
import io
from datetime import datetime
from typing import List, Dict, Any
from dateutil import parser as date_parser

from models import MeterData, TenantContract, TemperatureZone


class FileParser:
    def parse_meter_csv(self, content: bytes) -> List[MeterData]:
        df = pd.read_csv(io.BytesIO(content))
        df = df.fillna('')
        
        meter_data_list = []
        
        for idx, row in df.iterrows():
            row_dict = row.to_dict()
            
            reading_date = self._parse_date(row_dict.get('reading_date') or row_dict.get('date') or '')
            meter_id = str(row_dict.get('meter_id') or row_dict.get('meter') or f'meter_{idx}')
            
            total_kwh = float(row_dict.get('total_kwh') or row_dict.get('kwh') or 0)
            peak_kwh = float(row_dict.get('peak_kwh') or row_dict.get('peak') or 0)
            valley_kwh = float(row_dict.get('valley_kwh') or row_dict.get('valley') or 0)
            normal_kwh = float(row_dict.get('normal_kwh') or row_dict.get('normal') or 0)
            
            if total_kwh == 0:
                total_kwh = peak_kwh + valley_kwh + normal_kwh
            
            meter_data = MeterData(
                meter_id=meter_id,
                tenant_id=str(row_dict.get('tenant_id') or '') or None,
                zone_id=str(row_dict.get('zone_id') or '') or None,
                reading_date=reading_date,
                peak_kwh=peak_kwh,
                valley_kwh=valley_kwh,
                normal_kwh=normal_kwh,
                total_kwh=total_kwh,
                power_factor=float(row_dict.get('power_factor') or 0) if row_dict.get('power_factor') else None,
                raw_data=row_dict
            )
            
            meter_data_list.append(meter_data)
        
        return meter_data_list

    def parse_contract_json(self, content: bytes) -> List[TenantContract]:
        data = json.loads(content.decode('utf-8'))
        
        if isinstance(data, dict):
            contracts = data.get('contracts', [data])
        else:
            contracts = data
        
        contract_list = []
        
        for item in contracts:
            start_date = self._parse_date(item.get('start_date') or item.get('start'))
            end_date = self._parse_date(item.get('end_date') or item.get('end')) if item.get('end_date') or item.get('end') else None
            multiplier_effective_date = self._parse_date(item.get('multiplier_effective_date')) if item.get('multiplier_effective_date') else None
            
            contract = TenantContract(
                contract_id=str(item.get('contract_id') or item.get('id')),
                tenant_id=str(item.get('tenant_id')),
                tenant_name=str(item.get('tenant_name') or item.get('name')),
                zone_id=str(item.get('zone_id')),
                start_date=start_date,
                end_date=end_date,
                power_multiplier=float(item.get('power_multiplier') or item.get('multiplier') or 1.0),
                multiplier_effective_date=multiplier_effective_date,
                overtime_rates=item.get('overtime_rates', {}),
                is_active=bool(item.get('is_active', True))
            )
            
            contract_list.append(contract)
        
        return contract_list

    def parse_zone_csv(self, content: bytes) -> List[TemperatureZone]:
        df = pd.read_csv(io.BytesIO(content))
        df = df.fillna('')
        
        zone_list = []
        
        for idx, row in df.iterrows():
            row_dict = row.to_dict()
            
            zone = TemperatureZone(
                zone_id=str(row_dict.get('zone_id') or row_dict.get('zone') or f'zone_{idx}'),
                zone_name=str(row_dict.get('zone_name') or row_dict.get('name') or f'Zone {idx}'),
                base_temperature=float(row_dict.get('base_temperature') or row_dict.get('temperature') or -18),
                power_multiplier=float(row_dict.get('power_multiplier') or row_dict.get('multiplier') or 1.0),
                area_sqm=float(row_dict.get('area_sqm') or row_dict.get('area') or 0)
            )
            
            zone_list.append(zone)
        
        return zone_list

    def _parse_date(self, date_str: Any) -> datetime:
        if isinstance(date_str, datetime):
            return date_str
        if not date_str:
            return datetime.now()
        try:
            return date_parser.parse(str(date_str))
        except:
            return datetime.now()
