import pandas as pd
import numpy as np
import json
from pathlib import Path
from typing import Dict, Any, List, Tuple
from datetime import datetime, timedelta
from faker import Faker
import logging
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from config import SAMPLE_DATA_DIR

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SampleDataGenerator:
    """示例数据生成器"""
    
    GRID_CONFIGS = [
        {"grid_id": "G001", "grid_name": "中心商务区", "area": 2.5, "population": 15000, "zone_type": "商业区", "base_lon": 116.40, "base_lat": 39.91},
        {"grid_id": "G002", "grid_name": "老城区居住区", "area": 3.2, "population": 25000, "zone_type": "居住区", "base_lon": 116.41, "base_lat": 39.92},
        {"grid_id": "G003", "grid_name": "科技园区", "area": 4.1, "population": 8000, "zone_type": "工业区", "base_lon": 116.38, "base_lat": 39.90},
        {"grid_id": "G004", "grid_name": "大学城", "area": 5.0, "population": 30000, "zone_type": "文教区", "base_lon": 116.42, "base_lat": 39.89},
        {"grid_id": "G005", "grid_name": "交通枢纽区", "area": 1.8, "population": 5000, "zone_type": "交通枢纽", "base_lon": 116.39, "base_lat": 39.93},
        {"grid_id": "G006", "grid_name": "高端住宅区", "area": 3.5, "population": 12000, "zone_type": "居住区", "base_lon": 116.43, "base_lat": 39.91},
        {"grid_id": "G007", "grid_name": "商业娱乐区", "area": 2.0, "population": 8000, "zone_type": "商业区", "base_lon": 116.41, "base_lat": 39.89},
        {"grid_id": "G008", "grid_name": "工业园区", "area": 6.0, "population": 3000, "zone_type": "工业区", "base_lon": 116.37, "base_lat": 39.92},
    ]
    
    COMPLAINT_TYPES = ["噪声扰民", "施工噪声", "夜间施工", "交通噪声", "娱乐噪声", "装修噪声"]
    SEVERITY_LEVELS = ["轻微", "一般", "严重", "紧急"]
    
    COMPLAINT_DESCRIPTIONS = {
        "short_construction": [
            "楼上邻居正在装修，电钻声音很大，影响休息",
            "小区内有人在砸墙，持续了一个小时",
            "楼下商铺装修，切割机声音刺耳",
            "住户打孔施工，噪音非常大",
            "装修敲打声不断，无法正常生活"
        ],
        "bar_closing": [
            "楼下酒吧晚上音乐声很大，影响睡眠",
            "KTV凌晨还在唱歌，隔音效果差",
            "夜店散场时客人吵闹，持续到凌晨",
            "附近会所夜间有音乐声，无法入睡",
            "商业区夜间娱乐活动噪音扰民"
        ],
        "road_construction": [
            "主干道正在修路，大型机械作业声很大",
            "市政工程夜间施工，噪音严重",
            "沥青铺路作业，持续到深夜",
            "道路挖掘工程，重型车辆进出频繁",
            "拆迁施工，噪音和震动都很大"
        ],
        "traffic": [
            "早晚高峰车辆拥堵，鸣笛声不断",
            "大货车夜间经过，发动机声音很大",
            "交通路口车辆刹车声刺耳",
            "附近有货车停车场，夜间车辆进出噪音",
            "道路施工导致交通拥堵，喇叭声不停"
        ],
        "unknown": [
            "夜间有不明噪音来源",
            "偶尔听到奇怪的声音",
            "环境噪音比平时大",
            "无法确定噪音来源",
            "疑似有施工但没有看到备案"
        ]
    }
    
    CONSTRUCTION_TYPES = ["道路施工", "房屋建筑", "装修改造", "市政工程", "管线敷设", "拆迁工程"]
    PERMIT_STATUSES = ["有效", "已过期", "待审批"]
    
    def __init__(self):
        self.fake = Faker("zh_CN")
        self.sample_dir = SAMPLE_DATA_DIR
        self.sample_dir.mkdir(parents=True, exist_ok=True)
    
    def generate_grids(self) -> pd.DataFrame:
        """生成街区网格数据"""
        grids = []
        
        for config in self.GRID_CONFIGS:
            boundary = self._generate_polygon_boundary(
                config["base_lon"],
                config["base_lat"],
                config["area"]
            )
            
            grid = {
                "grid_id": config["grid_id"],
                "grid_name": config["grid_name"],
                "area": config["area"],
                "population": config["population"],
                "zone_type": config["zone_type"],
                "longitude": config["base_lon"],
                "latitude": config["base_lat"],
                "boundary": boundary
            }
            grids.append(grid)
        
        return pd.DataFrame(grids)
    
    def _generate_polygon_boundary(
        self,
        center_lon: float,
        center_lat: float,
        area_km2: float
    ) -> List[Tuple[float, float]]:
        """生成多边形边界"""
        import math
        
        side_length = math.sqrt(area_km2) / 2
        km_per_deg_lat = 111.0
        km_per_deg_lon = 111.0 * math.cos(math.radians(center_lat))
        
        delta_lat = side_length / km_per_deg_lat
        delta_lon = side_length / km_per_deg_lon
        
        corners = [
            (center_lon - delta_lon, center_lat - delta_lat),
            (center_lon + delta_lon, center_lat - delta_lat),
            (center_lon + delta_lon, center_lat + delta_lat),
            (center_lon - delta_lon, center_lat + delta_lat),
            (center_lon - delta_lon, center_lat - delta_lat)
        ]
        
        return corners
    
    def generate_complaints(
        self,
        start_date: datetime,
        end_date: datetime,
        grids_df: pd.DataFrame,
        count: int = 200
    ) -> pd.DataFrame:
        """生成居民投诉数据"""
        complaints = []
        
        date_range = end_date - start_date
        
        for i in range(count):
            random_days = np.random.randint(0, date_range.days + 1)
            random_hours = np.random.randint(0, 24)
            random_minutes = np.random.randint(0, 60)
            
            complaint_time = start_date + timedelta(
                days=random_days,
                hours=random_hours,
                minutes=random_minutes
            )
            
            source_probs = {
                "short_construction": 0.25,
                "bar_closing": 0.20,
                "road_construction": 0.25,
                "traffic": 0.20,
                "unknown": 0.10
            }
            
            hour = complaint_time.hour
            if 22 <= hour <= 23 or 0 <= hour <= 2:
                source_probs["bar_closing"] = 0.35
                source_probs["short_construction"] = 0.15
            elif 8 <= hour <= 18:
                source_probs["road_construction"] = 0.35
                source_probs["bar_closing"] = 0.10
            elif 7 <= hour <= 9 or 17 <= hour <= 19:
                source_probs["traffic"] = 0.35
            
            source_types = list(source_probs.keys())
            source_probs_list = [source_probs[k] for k in source_types]
            source_type = np.random.choice(source_types, p=source_probs_list)
            
            grid = grids_df.sample(1).iloc[0]
            
            descriptions = self.COMPLAINT_DESCRIPTIONS.get(source_type, self.COMPLAINT_DESCRIPTIONS["unknown"])
            description = np.random.choice(descriptions)
            
            complaint = {
                "complaint_id": f"C{10001 + i:06d}",
                "complaint_time": complaint_time,
                "location": f"{grid['grid_name']}附近",
                "longitude": grid["longitude"] + np.random.uniform(-0.01, 0.01),
                "latitude": grid["latitude"] + np.random.uniform(-0.01, 0.01),
                "description": description,
                "complaint_type": np.random.choice(self.COMPLAINT_TYPES),
                "severity": np.random.choice(self.SEVERITY_LEVELS, p=[0.3, 0.4, 0.2, 0.1]),
                "grid_id": grid["grid_id"],
                "true_source_type": source_type
            }
            complaints.append(complaint)
        
        df = pd.DataFrame(complaints)
        df = df.sort_values("complaint_time").reset_index(drop=True)
        
        return df
    
    def generate_permits(
        self,
        start_date: datetime,
        end_date: datetime,
        grids_df: pd.DataFrame,
        count: int = 30
    ) -> pd.DataFrame:
        """生成施工备案数据"""
        permits = []
        
        date_range = end_date - start_date
        
        for i in range(count):
            start_days = np.random.randint(0, max(1, date_range.days - 7))
            duration_days = np.random.randint(1, 30)
            
            permit_start = start_date + timedelta(days=start_days)
            permit_end = permit_start + timedelta(days=duration_days)
            
            grid = grids_df.sample(1).iloc[0]
            
            const_type = np.random.choice(self.CONSTRUCTION_TYPES)
            if "道路" in const_type or "拆迁" in const_type:
                duration_hours = np.random.randint(8, 24)
            else:
                duration_hours = np.random.randint(2, 12)
            
            contractor = f"{self.fake.company()}工程有限公司"
            
            permit = {
                "permit_id": f"P{2024001 + i:07d}",
                "project_name": f"{grid['grid_name']}{const_type}项目",
                "location": f"{grid['grid_name']}施工区域",
                "longitude": grid["longitude"] + np.random.uniform(-0.005, 0.005),
                "latitude": grid["latitude"] + np.random.uniform(-0.005, 0.005),
                "start_time": permit_start,
                "end_time": permit_end,
                "construction_type": const_type,
                "contractor": contractor,
                "permit_status": "有效",
                "grid_id": grid["grid_id"],
                "daily_start_hour": np.random.randint(6, 10),
                "daily_end_hour": np.random.randint(18, 23),
                "estimated_noise_level": np.random.randint(70, 95)
            }
            permits.append(permit)
        
        return pd.DataFrame(permits)
    
    def generate_monitoring(
        self,
        start_date: datetime,
        end_date: datetime,
        grids_df: pd.DataFrame,
        monitor_count: int = 10,
        interval_minutes: int = 5
    ) -> pd.DataFrame:
        """生成噪声监测分钟级记录"""
        monitoring = []
        
        total_minutes = int((end_date - start_date).total_seconds() / 60)
        intervals = int(total_minutes / interval_minutes)
        
        for monitor_idx in range(monitor_count):
            grid = grids_df.sample(1).iloc[0]
            
            monitor_id = f"M{monitor_idx + 1:03d}"
            
            base_noise = 50 + np.random.rand() * 15
            
            for interval_idx in range(intervals):
                record_time = start_date + timedelta(minutes=interval_idx * interval_minutes)
                hour = record_time.hour
                
                noise_variation = 0
                
                if 22 <= hour <= 23 or 0 <= hour <= 5:
                    base_noise_adjusted = base_noise - 5
                    if np.random.rand() < 0.1:
                        noise_variation = np.random.uniform(10, 25)
                elif 7 <= hour <= 9 or 17 <= hour <= 19:
                    base_noise_adjusted = base_noise + 10
                    noise_variation = np.random.uniform(5, 15)
                elif 8 <= hour <= 18:
                    base_noise_adjusted = base_noise + 5
                    if np.random.rand() < 0.15:
                        noise_variation = np.random.uniform(15, 30)
                else:
                    base_noise_adjusted = base_noise
                
                db_level = base_noise_adjusted + np.random.normal(0, 3) + noise_variation
                db_peak = db_level + np.random.uniform(2, 10)
                db_leq = db_level - np.random.uniform(1, 3)
                
                status = "正常"
                if np.random.rand() < 0.01:
                    status = "异常"
                
                record = {
                    "monitor_id": monitor_id,
                    "monitor_time": record_time,
                    "longitude": grid["longitude"] + np.random.uniform(-0.002, 0.002),
                    "latitude": grid["latitude"] + np.random.uniform(-0.002, 0.002),
                    "db_level": round(db_level, 1),
                    "db_peak": round(db_peak, 1),
                    "db_leq": round(db_leq, 1),
                    "status": status,
                    "grid_id": grid["grid_id"]
                }
                monitoring.append(record)
        
        df = pd.DataFrame(monitoring)
        df = df.sort_values(["monitor_id", "monitor_time"]).reset_index(drop=True)
        
        return df
    
    def generate_all_samples(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        save_to_files: bool = True
    ) -> Dict[str, pd.DataFrame]:
        """
        生成所有示例数据
        
        Args:
            start_date: 开始日期
            end_date: 结束日期
            save_to_files: 是否保存到文件
            
        Returns:
            数据字典
        """
        if start_date is None:
            start_date = datetime.now() - timedelta(days=7)
        if end_date is None:
            end_date = datetime.now()
        
        logger.info(f"生成示例数据，时间范围: {start_date} 至 {end_date}")
        
        grids_df = self.generate_grids()
        logger.info(f"生成 {len(grids_df)} 个街区网格")
        
        complaints_df = self.generate_complaints(start_date, end_date, grids_df, count=200)
        logger.info(f"生成 {len(complaints_df)} 条投诉记录")
        
        permits_df = self.generate_permits(start_date, end_date, grids_df, count=30)
        logger.info(f"生成 {len(permits_df)} 条施工备案")
        
        monitoring_df = self.generate_monitoring(start_date, end_date, grids_df, monitor_count=10, interval_minutes=5)
        logger.info(f"生成 {len(monitoring_df)} 条噪声监测记录")
        
        if save_to_files:
            self._save_samples(grids_df, complaints_df, permits_df, monitoring_df)
        
        return {
            "grids": grids_df,
            "complaints": complaints_df,
            "permits": permits_df,
            "monitoring": monitoring_df
        }
    
    def _save_samples(
        self,
        grids_df: pd.DataFrame,
        complaints_df: pd.DataFrame,
        permits_df: pd.DataFrame,
        monitoring_df: pd.DataFrame
    ):
        """保存示例数据到文件"""
        
        complaints_path = self.sample_dir / "complaints_sample.csv"
        complaints_export = complaints_df.drop(columns=["true_source_type"])
        complaints_export.to_csv(complaints_path, index=False, encoding="utf-8-sig")
        logger.info(f"投诉数据已保存: {complaints_path}")
        
        permits_path = self.sample_dir / "permits_sample.json"
        permits_dict = permits_df.to_dict(orient="records")
        for record in permits_dict:
            for key in ["start_time", "end_time"]:
                if key in record and pd.notna(record[key]):
                    record[key] = record[key].isoformat()
        
        with open(permits_path, "w", encoding="utf-8") as f:
            json.dump(permits_dict, f, ensure_ascii=False, indent=2)
        logger.info(f"施工备案已保存: {permits_path}")
        
        monitoring_path = self.sample_dir / "monitoring_sample.csv"
        monitoring_df.to_csv(monitoring_path, index=False, encoding="utf-8-sig")
        logger.info(f"监测数据已保存: {monitoring_path}")
        
        grids_path = self.sample_dir / "grids_sample.json"
        grids_dict = grids_df.to_dict(orient="records")
        
        with open(grids_path, "w", encoding="utf-8") as f:
            json.dump(grids_dict, f, ensure_ascii=False, indent=2)
        logger.info(f"网格数据已保存: {grids_path}")
        
        meta = {
            "generated_at": datetime.now().isoformat(),
            "description": "夜间噪声投诉溯源台示例数据",
            "files": {
                "complaints": str(complaints_path.name),
                "permits": str(permits_path.name),
                "monitoring": str(monitoring_path.name),
                "grids": str(grids_path.name)
            },
            "record_counts": {
                "complaints": len(complaints_df),
                "permits": len(permits_df),
                "monitoring": len(monitoring_df),
                "grids": len(grids_df)
            }
        }
        
        meta_path = self.sample_dir / "sample_meta.json"
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)
        
        logger.info("示例数据生成完成")


if __name__ == "__main__":
    generator = SampleDataGenerator()
    generator.generate_all_samples()
