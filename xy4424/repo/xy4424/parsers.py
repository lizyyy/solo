import csv
import json
from datetime import datetime
from io import StringIO
from typing import List, Dict, Any, Optional, Tuple
from models import (
    Device, Schedule, Detour, Template, generate_id
)


class CSVParser:
    @staticmethod
    def parse_devices(csv_content: str) -> List[Device]:
        devices = []
        reader = csv.DictReader(StringIO(csv_content))
        
        for row in reader:
            device_id = row.get('device_id', row.get('设备ID', ''))
            station_name = row.get('station_name', row.get('站点名称', ''))
            station_id = row.get('station_id', row.get('站点ID', ''))
            is_online_str = row.get('is_online', row.get('在线状态', 'true'))
            is_online = str(is_online_str).lower() in ('true', '1', 'yes', '在线')
            
            template_id = row.get('template_id', row.get('模板ID'))
            location = row.get('location', row.get('位置'))
            
            last_seen = None
            last_seen_str = row.get('last_seen', row.get('最后在线时间'))
            if last_seen_str:
                try:
                    last_seen = datetime.fromisoformat(last_seen_str)
                except ValueError:
                    pass
            
            devices.append(Device(
                device_id=device_id,
                station_name=station_name,
                station_id=station_id,
                is_online=is_online,
                template_id=template_id,
                location=location,
                last_seen=last_seen
            ))
        
        return devices
    
    @staticmethod
    def parse_schedules(csv_content: str) -> List[Schedule]:
        schedules = []
        reader = csv.DictReader(StringIO(csv_content))
        
        for row in reader:
            route_name = row.get('route_name', row.get('线路名称', ''))
            route_id = row.get('route_id', row.get('线路ID', ''))
            station_name = row.get('station_name', row.get('站点名称', ''))
            station_id = row.get('station_id', row.get('站点ID', ''))
            departure_time = row.get('departure_time', row.get('发车时间', ''))
            direction = row.get('direction', row.get('方向', ''))
            device_id = row.get('device_id', row.get('设备ID'))
            
            schedules.append(Schedule(
                schedule_id=generate_id(),
                route_name=route_name,
                route_id=route_id,
                station_name=station_name,
                station_id=station_id,
                departure_time=departure_time,
                direction=direction,
                device_id=device_id
            ))
        
        return schedules


class JSONParser:
    @staticmethod
    def parse_detours(json_content: str) -> List[Detour]:
        data = json.loads(json_content)
        detours = []
        
        detour_list = data if isinstance(data, list) else data.get('detours', [])
        
        for item in detour_list:
            detour_id = item.get('detour_id', generate_id())
            route_id = item.get('route_id', '')
            route_name = item.get('route_name', '')
            
            effective_from = datetime.now()
            effective_from_str = item.get('effective_from')
            if effective_from_str:
                try:
                    effective_from = datetime.fromisoformat(effective_from_str)
                except ValueError:
                    pass
            
            effective_to = datetime.now()
            effective_to_str = item.get('effective_to')
            if effective_to_str:
                try:
                    effective_to = datetime.fromisoformat(effective_to_str)
                except ValueError:
                    pass
            
            affected_stations = item.get('affected_stations', [])
            detour_stations = item.get('detour_stations', [])
            reason = item.get('reason', '')
            
            detours.append(Detour(
                detour_id=detour_id,
                route_id=route_id,
                route_name=route_name,
                effective_from=effective_from,
                effective_to=effective_to,
                affected_stations=affected_stations,
                detour_stations=detour_stations,
                reason=reason
            ))
        
        return detours
    
    @staticmethod
    def parse_templates(json_content: str) -> List[Template]:
        data = json.loads(json_content)
        templates = []
        
        template_list = data if isinstance(data, list) else data.get('templates', [])
        
        for item in template_list:
            template_id = item.get('template_id', '')
            template_name = item.get('template_name', '')
            required_fields = item.get('required_fields', [])
            description = item.get('description', '')
            
            templates.append(Template(
                template_id=template_id,
                template_name=template_name,
                required_fields=required_fields,
                description=description
            ))
        
        return templates
    
    @staticmethod
    def parse_template_package(json_content: str) -> Tuple[List[Template], Dict[str, Any]]:
        data = json.loads(json_content)
        
        templates = []
        if 'templates' in data:
            for item in data['templates']:
                templates.append(Template(
                    template_id=item.get('template_id', ''),
                    template_name=item.get('template_name', ''),
                    required_fields=item.get('required_fields', []),
                    description=item.get('description', '')
                ))
        
        metadata = data.get('metadata', {})
        
        return templates, metadata


def detect_file_type(filename: str) -> str:
    if filename.endswith('.csv'):
        return 'csv'
    elif filename.endswith('.json'):
        return 'json'
    return 'unknown'
