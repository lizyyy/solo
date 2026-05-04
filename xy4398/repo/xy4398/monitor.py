from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from dateutil.parser import parse as parse_date

from database import Database


class FridgeMonitor:
    ANOMALY_TOO_HOT = 'too_hot'
    ANOMALY_TOO_COLD = 'too_cold'
    ANOMALY_OFFLINE = 'offline'

    def __init__(self, db: Database, fridges_config: List[Dict[str, Any]], 
                 offline_threshold_minutes: int = 30):
        self.db = db
        self.fridges = {f['sensor_id']: f for f in fridges_config}
        self.offline_threshold = timedelta(minutes=offline_threshold_minutes)

    def _parse_time(self, time_str: str) -> datetime:
        return parse_date(time_str)

    def check_temperature_threshold(self, sensor_id: str, temperature: float) -> Tuple[bool, Optional[str]]:
        if sensor_id not in self.fridges:
            return (False, None)
        
        fridge = self.fridges[sensor_id]
        min_temp = fridge.get('min_temp', -100.0)
        max_temp = fridge.get('max_temp', 100.0)
        
        if temperature > max_temp:
            return (True, self.ANOMALY_TOO_HOT)
        elif temperature < min_temp:
            return (True, self.ANOMALY_TOO_COLD)
        
        return (False, None)

    def get_current_status(self) -> List[Dict[str, Any]]:
        now = datetime.now()
        statuses = []
        
        for sensor_id, fridge in self.fridges.items():
            latest_record = self.db.get_latest_record(sensor_id)
            
            status = {
                'fridge_id': fridge['id'],
                'fridge_name': fridge['name'],
                'location': fridge.get('location', ''),
                'sensor_id': sensor_id,
                'min_temp': fridge['min_temp'],
                'max_temp': fridge['max_temp'],
                'current_temp': None,
                'last_seen': None,
                'status': 'unknown',
                'status_text': '未知状态',
                'minutes_since_last': None
            }
            
            if latest_record:
                last_time = self._parse_time(latest_record['timestamp'])
                minutes_since = (now - last_time).total_seconds() / 60
                
                status['current_temp'] = latest_record['temperature']
                status['last_seen'] = latest_record['timestamp']
                status['minutes_since_last'] = round(minutes_since, 1)
                
                is_offline = minutes_since > self.offline_threshold.total_seconds() / 60
                
                if is_offline:
                    status['status'] = 'offline'
                    status['status_text'] = '传感器离线'
                else:
                    is_anomaly, anomaly_type = self.check_temperature_threshold(
                        sensor_id, latest_record['temperature']
                    )
                    
                    if is_anomaly:
                        if anomaly_type == self.ANOMALY_TOO_HOT:
                            status['status'] = 'too_hot'
                            status['status_text'] = '温度过高'
                        else:
                            status['status'] = 'too_cold'
                            status['status_text'] = '温度过低'
                    else:
                        status['status'] = 'normal'
                        status['status_text'] = '正常'
            else:
                status['status'] = 'no_data'
                status['status_text'] = '无数据'
            
            statuses.append(status)
        
        return statuses

    def check_and_update_anomalies(self) -> Dict[str, Any]:
        results = {
            'new_anomalies': 0,
            'closed_anomalies': 0,
            'ongoing_anomalies': 0,
            'details': []
        }
        
        for sensor_id, fridge in self.fridges.items():
            fridge_id = fridge['id']
            open_anomalies = self.db.get_open_anomalies(fridge_id)
            
            latest_record = self.db.get_latest_record(sensor_id)
            now = datetime.now()
            
            current_anomaly_type = None
            
            if latest_record:
                last_time = self._parse_time(latest_record['timestamp'])
                minutes_since = (now - last_time).total_seconds() / 60
                
                is_offline = minutes_since > self.offline_threshold.total_seconds() / 60
                
                if is_offline:
                    current_anomaly_type = self.ANOMALY_OFFLINE
                else:
                    is_anomaly, anomaly_type = self.check_temperature_threshold(
                        sensor_id, latest_record['temperature']
                    )
                    if is_anomaly:
                        current_anomaly_type = anomaly_type
            
            for open_anomaly in open_anomalies:
                if open_anomaly['anomaly_type'] != current_anomaly_type:
                    self._close_anomaly(open_anomaly, fridge)
                    results['closed_anomalies'] += 1
                    results['details'].append({
                        'action': 'closed',
                        'fridge_id': fridge_id,
                        'anomaly_type': open_anomaly['anomaly_type']
                    })
            
            remaining_open = self.db.get_open_anomalies(fridge_id)
            
            if current_anomaly_type and not remaining_open:
                start_time = latest_record['timestamp'] if latest_record else now.isoformat()
                self.db.create_anomaly_interval(
                    fridge_id, sensor_id, start_time, current_anomaly_type
                )
                results['new_anomalies'] += 1
                results['details'].append({
                    'action': 'created',
                    'fridge_id': fridge_id,
                    'anomaly_type': current_anomaly_type
                })
        
        total_open = self.db.get_open_anomalies()
        results['ongoing_anomalies'] = len(total_open)
        
        return results

    def _close_anomaly(self, anomaly: Dict[str, Any], fridge: Dict[str, Any]):
        sensor_id = anomaly['sensor_id']
        start_time = anomaly['start_time']
        
        end_time = datetime.now().isoformat()
        latest_record = self.db.get_latest_record(sensor_id)
        if latest_record:
            end_time = latest_record['timestamp']
        
        records = self.db.get_records_by_time(sensor_id, start_time, end_time)
        
        if records:
            temps = [r['temperature'] for r in records]
            min_temp = min(temps)
            max_temp = max(temps)
            avg_temp = sum(temps) / len(temps)
        else:
            min_temp = max_temp = avg_temp = None
        
        self.db.close_anomaly_interval(
            anomaly['id'], end_time, min_temp, max_temp, avg_temp
        )

    def get_recent_anomalies(self, fridge_id: Optional[str] = None, 
                               confirmed: Optional[bool] = None,
                               limit: int = 50) -> List[Dict[str, Any]]:
        anomalies = self.db.get_anomalies(fridge_id, confirmed, limit)
        
        for anomaly in anomalies:
            if anomaly['sensor_id'] in self.fridges:
                fridge = self.fridges[anomaly['sensor_id']]
                anomaly['fridge_name'] = fridge.get('name', anomaly['fridge_id'])
                anomaly['location'] = fridge.get('location', '')
                anomaly['min_threshold'] = fridge.get('min_temp')
                anomaly['max_threshold'] = fridge.get('max_temp')
            
            anomaly_type_text = {
                self.ANOMALY_TOO_HOT: '温度过高',
                self.ANOMALY_TOO_COLD: '温度过低',
                self.ANOMALY_OFFLINE: '传感器离线'
            }
            anomaly['anomaly_type_text'] = anomaly_type_text.get(
                anomaly['anomaly_type'], anomaly['anomaly_type']
            )
        
        return anomalies

    def confirm_anomaly(self, anomaly_id: int, confirmed_by: str, notes: str = '') -> bool:
        try:
            self.db.confirm_anomaly(anomaly_id, confirmed_by, notes)
            return True
        except Exception:
            return False

    def get_fridge_config(self, sensor_id: str) -> Optional[Dict[str, Any]]:
        return self.fridges.get(sensor_id)

    def get_all_fridges(self) -> List[Dict[str, Any]]:
        return list(self.fridges.values())

    def get_offline_sensors(self) -> List[Dict[str, Any]]:
        now = datetime.now()
        offline = []
        
        for sensor_id, fridge in self.fridges.items():
            latest_record = self.db.get_latest_record(sensor_id)
            
            if latest_record:
                last_time = self._parse_time(latest_record['timestamp'])
                minutes_since = (now - last_time).total_seconds() / 60
                
                if minutes_since > self.offline_threshold.total_seconds() / 60:
                    offline.append({
                        'fridge_id': fridge['id'],
                        'fridge_name': fridge['name'],
                        'sensor_id': sensor_id,
                        'last_seen': latest_record['timestamp'],
                        'minutes_offline': round(minutes_since, 1)
                    })
            else:
                offline.append({
                    'fridge_id': fridge['id'],
                    'fridge_name': fridge['name'],
                    'sensor_id': sensor_id,
                    'last_seen': None,
                    'minutes_offline': None
                })
        
        return offline
