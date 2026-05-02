"""CSV数据解析器"""

import csv
from datetime import datetime, time
from typing import Dict, List, Optional, Any
from pathlib import Path

from ..models import (
    CropZone, LightThreshold,
    LEDSpectrum, SpectrumChannel,
    SensorData, SensorReading,
    ElectricityPrice, PriceTier
)


class CSVParser:
    
    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []
    
    def parse_crop_zones(self, filepath: str) -> List[CropZone]:
        self.errors = []
        self.warnings = []
        zones = []
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row_num, row in enumerate(reader, start=2):
                    try:
                        zone = self._parse_crop_zone_row(row, row_num)
                        if zone:
                            zones.append(zone)
                    except Exception as e:
                        self.errors.append(f"行 {row_num}: 解析失败 - {str(e)}")
        except FileNotFoundError:
            self.errors.append(f"文件不存在: {filepath}")
        except Exception as e:
            self.errors.append(f"读取文件失败: {str(e)}")
        
        return zones
    
    def _parse_crop_zone_row(self, row: Dict[str, str], row_num: int) -> Optional[CropZone]:
        required_fields = ['zone_id', 'zone_name', 'crop_type', 'shelf_count',
                          'shelf_height', 'shelf_width', 'led_spectrum_id', 'sensor_id',
                          'min_dli', 'max_dli', 'target_dli', 'installed_power',
                          'photoperiod_start', 'photoperiod_end']
        
        for field in required_fields:
            if field not in row or not row[field].strip():
                self.errors.append(f"行 {row_num}: 缺少必需字段 '{field}'")
                return None
        
        try:
            min_dli = float(row['min_dli'])
            max_dli = float(row['max_dli'])
            target_dli = float(row['target_dli'])
            
            spectrum_reqs = {}
            for key, value in row.items():
                if key.startswith('spectrum_') and value.strip():
                    spectrum_reqs[key[9:]] = float(value)
            
            threshold = LightThreshold(
                min_dli=min_dli,
                max_dli=max_dli,
                target_dli=target_dli,
                spectrum_requirements=spectrum_reqs
            )
            
            custom_attrs = {}
            for key, value in row.items():
                if key.startswith('attr_') and value.strip():
                    custom_attrs[key[5:]] = value
            
            return CropZone(
                zone_id=row['zone_id'].strip(),
                zone_name=row['zone_name'].strip(),
                crop_type=row['crop_type'].strip(),
                shelf_count=int(row['shelf_count']),
                shelf_height=float(row['shelf_height']),
                shelf_width=float(row['shelf_width']),
                led_spectrum_id=row['led_spectrum_id'].strip(),
                sensor_id=row['sensor_id'].strip(),
                light_threshold=threshold,
                installed_power=float(row['installed_power']),
                photoperiod_start=self._parse_time(row['photoperiod_start']),
                photoperiod_end=self._parse_time(row['photoperiod_end']),
                notes=row.get('notes', ''),
                custom_attributes=custom_attrs
            )
        except ValueError as e:
            self.errors.append(f"行 {row_num}: 数值解析错误 - {str(e)}")
            return None
    
    def parse_led_spectra(self, filepath: str) -> List[LEDSpectrum]:
        self.errors = []
        self.warnings = []
        spectra = []
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                current_spectrum = None
                current_spectrum_id = None
                
                for row_num, row in enumerate(reader, start=2):
                    try:
                        spectrum_id = row.get('spectrum_id', '').strip()
                        
                        if spectrum_id and spectrum_id != '' and spectrum_id != current_spectrum_id:
                            if current_spectrum:
                                spectra.append(current_spectrum)
                            current_spectrum = self._parse_spectrum_header(row, row_num)
                            current_spectrum_id = spectrum_id
                        
                        if current_spectrum:
                            channel = self._parse_channel_row(row, row_num)
                            if channel:
                                current_spectrum.channels.append(channel)
                    except Exception as e:
                        self.errors.append(f"行 {row_num}: 解析失败 - {str(e)}")
                
                if current_spectrum:
                    spectra.append(current_spectrum)
        except FileNotFoundError:
            self.errors.append(f"文件不存在: {filepath}")
        except Exception as e:
            self.errors.append(f"读取文件失败: {str(e)}")
        
        return spectra
    
    def _parse_spectrum_header(self, row: Dict[str, str], row_num: int) -> Optional[LEDSpectrum]:
        try:
            return LEDSpectrum(
                spectrum_id=row['spectrum_id'].strip(),
                spectrum_name=row.get('spectrum_name', '').strip(),
                manufacturer=row.get('manufacturer', '').strip(),
                model=row.get('model', '').strip(),
                total_power=float(row.get('total_power', 0)),
                photon_flux_density=float(row.get('photon_flux_density', 0)),
                channels=[],
                notes=row.get('notes', '')
            )
        except (KeyError, ValueError) as e:
            self.errors.append(f"行 {row_num}: 灯谱标题解析错误 - {str(e)}")
            return None
    
    def _parse_channel_row(self, row: Dict[str, str], row_num: int) -> Optional[SpectrumChannel]:
        wavelength_range = row.get('wavelength_range', '').strip()
        wavelength_nm = row.get('wavelength_nm', '').strip()
        intensity_ratio = row.get('intensity_ratio', '').strip()
        photon_efficiency = row.get('photon_efficiency', '').strip()
        
        if not wavelength_range:
            return None
        
        try:
            return SpectrumChannel(
                wavelength_range=wavelength_range,
                wavelength_nm=float(wavelength_nm) if wavelength_nm else 0,
                intensity_ratio=float(intensity_ratio) if intensity_ratio else 0,
                photon_efficiency=float(photon_efficiency) if photon_efficiency else 1.0
            )
        except ValueError as e:
            self.errors.append(f"行 {row_num}: 通道数据解析错误 - {str(e)}")
            return None
    
    def parse_sensor_data(self, filepath: str) -> List[SensorData]:
        self.errors = []
        self.warnings = []
        sensors: Dict[str, SensorData] = {}
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row_num, row in enumerate(reader, start=2):
                    try:
                        sensor_id = row.get('sensor_id', '').strip()
                        if not sensor_id:
                            self.errors.append(f"行 {row_num}: 缺少sensor_id")
                            continue
                        
                        if sensor_id not in sensors:
                            sensors[sensor_id] = SensorData(
                                sensor_id=sensor_id,
                                sensor_name=row.get('sensor_name', '').strip(),
                                location=row.get('location', '').strip(),
                                readings=[]
                            )
                        
                        reading = self._parse_sensor_reading(row, row_num)
                        if reading:
                            sensors[sensor_id].readings.append(reading)
                    except Exception as e:
                        self.errors.append(f"行 {row_num}: 解析失败 - {str(e)}")
        except FileNotFoundError:
            self.errors.append(f"文件不存在: {filepath}")
        except Exception as e:
            self.errors.append(f"读取文件失败: {str(e)}")
        
        return list(sensors.values())
    
    def _parse_sensor_reading(self, row: Dict[str, str], row_num: int) -> Optional[SensorReading]:
        timestamp_str = row.get('timestamp', '').strip()
        ppfd_str = row.get('ppfd', '').strip()
        
        if not timestamp_str or not ppfd_str:
            self.errors.append(f"行 {row_num}: 缺少timestamp或ppfd")
            return None
        
        try:
            timestamp = self._parse_timestamp(timestamp_str)
            ppfd = float(ppfd_str)
            
            temp_str = row.get('temp', '').strip()
            humidity_str = row.get('humidity', '').strip()
            co2_str = row.get('co2', '').strip()
            
            return SensorReading(
                timestamp=timestamp,
                ppfd=ppfd,
                temp=float(temp_str) if temp_str else None,
                humidity=float(humidity_str) if humidity_str else None,
                co2=float(co2_str) if co2_str else None
            )
        except (ValueError, Exception) as e:
            self.errors.append(f"行 {row_num}: 传感器读数解析错误 - {str(e)}")
            return None
    
    def parse_electricity_price(self, filepath: str) -> List[ElectricityPrice]:
        self.errors = []
        self.warnings = []
        prices = []
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                current_price = None
                current_price_id = None
                
                for row_num, row in enumerate(reader, start=2):
                    try:
                        price_id = row.get('price_id', '').strip()
                        
                        if price_id and price_id != '' and price_id != current_price_id:
                            if current_price:
                                prices.append(current_price)
                            current_price = self._parse_price_header(row, row_num)
                            current_price_id = price_id
                        
                        if current_price:
                            tier = self._parse_price_tier(row, row_num)
                            if tier:
                                current_price.tiers.append(tier)
                    except Exception as e:
                        self.errors.append(f"行 {row_num}: 解析失败 - {str(e)}")
                
                if current_price:
                    prices.append(current_price)
        except FileNotFoundError:
            self.errors.append(f"文件不存在: {filepath}")
        except Exception as e:
            self.errors.append(f"读取文件失败: {str(e)}")
        
        return prices
    
    def _parse_price_header(self, row: Dict[str, str], row_num: int) -> Optional[ElectricityPrice]:
        try:
            return ElectricityPrice(
                price_id=row['price_id'].strip(),
                price_name=row.get('price_name', '').strip(),
                region=row.get('region', '').strip(),
                effective_date=row.get('effective_date', '').strip(),
                tiers=[],
                notes=row.get('notes', '')
            )
        except KeyError as e:
            self.errors.append(f"行 {row_num}: 电价标题解析错误 - 缺少字段 {str(e)}")
            return None
    
    def _parse_price_tier(self, row: Dict[str, str], row_num: int) -> Optional[PriceTier]:
        tier_name = row.get('tier_name', '').strip()
        start_time = row.get('start_time', '').strip()
        end_time = row.get('end_time', '').strip()
        price_str = row.get('price_per_kwh', '').strip()
        
        if not tier_name or not start_time or not end_time or not price_str:
            return None
        
        try:
            return PriceTier(
                tier_name=tier_name,
                price_per_kwh=float(price_str),
                start_time=self._parse_time(start_time),
                end_time=self._parse_time(end_time)
            )
        except ValueError as e:
            self.errors.append(f"行 {row_num}: 电价时段解析错误 - {str(e)}")
            return None
    
    def _parse_time(self, time_str: str) -> time:
        time_str = time_str.strip()
        
        formats = ['%H:%M', '%H:%M:%S', '%H']
        for fmt in formats:
            try:
                return datetime.strptime(time_str, fmt).time()
            except ValueError:
                continue
        
        if ':' in time_str:
            parts = time_str.split(':')
            return time(hour=int(parts[0]), minute=int(parts[1]) if len(parts) > 1 else 0)
        
        return time(hour=int(time_str))
    
    def _parse_timestamp(self, ts_str: str) -> datetime:
        ts_str = ts_str.strip()
        
        formats = [
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%d %H:%M',
            '%Y/%m/%d %H:%M:%S',
            '%Y/%m/%d %H:%M',
            '%m-%d %H:%M',
            '%m/%d %H:%M',
        ]
        
        for fmt in formats:
            try:
                dt = datetime.strptime(ts_str, fmt)
                if dt.year == 1900:
                    dt = dt.replace(year=datetime.now().year)
                return dt
            except ValueError:
                continue
        
        return datetime.fromisoformat(ts_str)
    
    def get_last_errors(self) -> List[str]:
        return self.errors.copy()
    
    def get_last_warnings(self) -> List[str]:
        return self.warnings.copy()
