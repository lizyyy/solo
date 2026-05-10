import json
import csv
import os
from typing import List, Dict, Optional
from datetime import date, time
from .models import Plot, Harvester, MaintenanceWindow, DriverRestRule, Schedule
from .store import DataStore


class SampleDataInitializer:
    @staticmethod
    def create_sample_data():
        plots = [
            Plot(
                plot_id="P001",
                village="东风村",
                area=8.5,
                crop_type="小麦",
                ripening_start=date(2024, 6, 10),
                ripening_end=date(2024, 6, 20),
                priority=2
            ),
            Plot(
                plot_id="P002",
                village="红星村",
                area=12.3,
                crop_type="小麦",
                ripening_start=date(2024, 6, 12),
                ripening_end=date(2024, 6, 22),
                priority=1
            ),
            Plot(
                plot_id="P003",
                village="新华村",
                area=6.7,
                crop_type="油菜",
                ripening_start=date(2024, 5, 25),
                ripening_end=date(2024, 6, 5),
                priority=3
            )
        ]
        
        harvesters = [
            Harvester(
                harvester_id="H001",
                model="约翰迪尔 S790",
                driver_name="张师傅",
                efficiency_ha_per_day=15.0,
                maintenance_windows=[
                    MaintenanceWindow(
                        start_date=date(2024, 6, 14),
                        end_date=date(2024, 6, 15),
                        reason="季度保养"
                    )
                ],
                rest_rule=DriverRestRule(max_daily_hours=8.0)
            ),
            Harvester(
                harvester_id="H002",
                model="久保田 PRO988",
                driver_name="李师傅",
                efficiency_ha_per_day=8.0,
                maintenance_windows=[
                    MaintenanceWindow(
                        start_date=date(2024, 6, 18),
                        end_date=date(2024, 6, 18),
                        reason="零部件更换"
                    )
                ],
                rest_rule=DriverRestRule(max_daily_hours=8.0)
            )
        ]
        
        schedules = [
            Schedule(
                schedule_id="S001",
                plot_id="P001",
                harvester_id="H001",
                scheduled_date=date(2024, 6, 12),
                start_time=time(8, 0),
                end_time=time(12, 30),
                status="pending"
            )
        ]
        
        return plots, harvesters, schedules
    
    @staticmethod
    def initialize_store(store: DataStore):
        plots, harvesters, schedules = SampleDataInitializer.create_sample_data()
        
        for plot in plots:
            store.add_plot(plot, source="sample_init")
        
        for harvester in harvesters:
            store.add_harvester(harvester, source="sample_init")
        
        for schedule in schedules:
            store.add_schedule(schedule, source="sample_init")


class DataImporter:
    @staticmethod
    def import_plots(store: DataStore, filepath: str):
        _, ext = os.path.splitext(filepath)
        ext = ext.lower()
        
        if ext == '.json':
            DataImporter._import_plots_json(store, filepath)
        elif ext == '.csv':
            DataImporter._import_plots_csv(store, filepath)
        else:
            raise ValueError(f"不支持的文件格式：{ext}")
    
    @staticmethod
    def _import_plots_json(store: DataStore, filepath: str):
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        for item in data:
            plot = Plot(
                plot_id=item['plot_id'],
                village=item['village'],
                area=float(item['area']),
                crop_type=item['crop_type'],
                ripening_start=date.fromisoformat(item['ripening_start']),
                ripening_end=date.fromisoformat(item['ripening_end']),
                priority=int(item.get('priority', 1))
            )
            store.add_plot(plot, source=f"import:{os.path.basename(filepath)}")
    
    @staticmethod
    def _import_plots_csv(store: DataStore, filepath: str):
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                plot = Plot(
                    plot_id=row['plot_id'],
                    village=row['village'],
                    area=float(row['area']),
                    crop_type=row['crop_type'],
                    ripening_start=date.fromisoformat(row['ripening_start']),
                    ripening_end=date.fromisoformat(row['ripening_end']),
                    priority=int(row.get('priority', 1))
                )
                store.add_plot(plot, source=f"import:{os.path.basename(filepath)}")
    
    @staticmethod
    def import_harvesters(store: DataStore, filepath: str):
        _, ext = os.path.splitext(filepath)
        ext = ext.lower()
        
        if ext == '.json':
            DataImporter._import_harvesters_json(store, filepath)
        elif ext == '.csv':
            DataImporter._import_harvesters_csv(store, filepath)
        else:
            raise ValueError(f"不支持的文件格式：{ext}")
    
    @staticmethod
    def _import_harvesters_json(store: DataStore, filepath: str):
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        for item in data:
            maintenance_windows = [
                MaintenanceWindow(
                    start_date=date.fromisoformat(mw['start_date']),
                    end_date=date.fromisoformat(mw['end_date']),
                    reason=mw.get('reason', '例行维护')
                )
                for mw in item.get('maintenance_windows', [])
            ]
            
            rest_rule = DriverRestRule(
                max_daily_hours=float(item.get('rest_rule', {}).get('max_daily_hours', 8.0))
            )
            
            harvester = Harvester(
                harvester_id=item['harvester_id'],
                model=item['model'],
                driver_name=item['driver_name'],
                efficiency_ha_per_day=float(item['efficiency_ha_per_day']),
                maintenance_windows=maintenance_windows,
                rest_rule=rest_rule
            )
            store.add_harvester(harvester, source=f"import:{os.path.basename(filepath)}")
    
    @staticmethod
    def _import_harvesters_csv(store: DataStore, filepath: str):
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                harvester = Harvester(
                    harvester_id=row['harvester_id'],
                    model=row['model'],
                    driver_name=row['driver_name'],
                    efficiency_ha_per_day=float(row['efficiency_ha_per_day']),
                    maintenance_windows=[],
                    rest_rule=DriverRestRule()
                )
                store.add_harvester(harvester, source=f"import:{os.path.basename(filepath)}")


class DataExporter:
    @staticmethod
    def export_schedules(store: DataStore, filepath: str, include_cancelled: bool = False):
        _, ext = os.path.splitext(filepath)
        ext = ext.lower()
        
        schedules = list(store.schedules.values())
        if not include_cancelled:
            schedules = [s for s in schedules if s.status != "cancelled"]
        
        schedules.sort(key=lambda s: (s.scheduled_date, s.start_time))
        
        if ext == '.json':
            DataExporter._export_json(schedules, filepath)
        elif ext == '.csv':
            DataExporter._export_csv(schedules, filepath)
        else:
            raise ValueError(f"不支持的文件格式：{ext}")
    
    @staticmethod
    def _export_json(schedules: List[Schedule], filepath: str):
        data = [s.to_dict() for s in schedules]
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    @staticmethod
    def _export_csv(schedules: List[Schedule], filepath: str):
        with open(filepath, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['调度ID', '地块ID', '农机ID', '日期', '开始时间', '结束时间', '状态'])
            for s in schedules:
                writer.writerow([
                    s.schedule_id,
                    s.plot_id,
                    s.harvester_id,
                    s.scheduled_date.isoformat(),
                    s.start_time.isoformat(),
                    s.end_time.isoformat(),
                    s.status
                ])
