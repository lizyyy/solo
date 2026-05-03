"""
示例数据模块
用于生成测试数据，包括：
- 正常巡检包数据
- 包含各种问题的巡检包数据（用于测试校验功能）
- 多机器人重复标注的缺陷数据（用于测试归并功能）
"""

import json
import csv
import yaml
from pathlib import Path
from typing import Dict, List, Any, Optional, Union
from datetime import datetime, timedelta
import random
import os


class SampleDataGenerator:
    """
    示例数据生成器
    """
    
    def __init__(self, seed: int = 42):
        random.seed(seed)
        self.base_time = datetime.now() - timedelta(days=7)
    
    def generate_normal_package(
        self,
        output_dir: Path,
        package_name: str = "robot_001_normal",
        robot_id: str = "robot_001"
    ) -> Path:
        """
        生成正常的巡检包数据
        """
        package_dir = output_dir / package_name
        package_dir.mkdir(parents=True, exist_ok=True)
        
        # 生成视频索引数据
        video_data = self._generate_video_index(
            start_mileage=0,
            end_mileage=500,
            segment_count=20,
            robot_id=robot_id
        )
        with open(package_dir / "video_index.json", 'w', encoding='utf-8') as f:
            json.dump(video_data, f, ensure_ascii=False, indent=2)
        
        # 生成传感器数据
        sensor_data = self._generate_sensor_data(
            start_mileage=0,
            end_mileage=500,
            record_count=100,
            robot_id=robot_id
        )
        with open(package_dir / "sensor_data.csv", 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=[
                "timestamp", "mileage", "temperature", "humidity", 
                "vibration", "gas_level", "robot_id"
            ])
            writer.writeheader()
            writer.writerows(sensor_data)
        
        # 生成缺陷标注数据
        defect_data = self._generate_defect_annotations(
            start_mileage=50,
            end_mileage=450,
            defect_count=5,
            robot_id=robot_id
        )
        with open(package_dir / "defect_annotations.yaml", 'w', encoding='utf-8') as f:
            yaml.dump({"defects": defect_data}, f, allow_unicode=True, default_flow_style=False)
        
        return package_dir
    
    def generate_package_with_timestamp_jump(
        self,
        output_dir: Path,
        package_name: str = "robot_002_timestamp_jump"
    ) -> Path:
        """
        生成包含时间戳跳变问题的巡检包（模拟断电）
        """
        package_dir = output_dir / package_name
        package_dir.mkdir(parents=True, exist_ok=True)
        
        base_ts = self.base_time.timestamp()
        
        # 生成视频索引数据（包含时间戳跳变）
        video_data = []
        mileage = 0
        for i in range(20):
            # 正常时间间隔
            if i < 10:
                timestamp = base_ts + i * 30  # 每30秒一个片段
            # 模拟断电：时间戳跳变（跳过了10分钟）
            elif i == 10:
                timestamp = base_ts + 10 * 30 + 600  # 跳过600秒
            else:
                timestamp = base_ts + i * 30 + 600
            
            video_data.append({
                "segment_id": i + 1,
                "timestamp": timestamp,
                "mileage": i * 25,
                "file_name": f"video_{i+1:03d}.mp4",
                "duration": 30
            })
        
        with open(package_dir / "video_index.json", 'w', encoding='utf-8') as f:
            json.dump(video_data, f, ensure_ascii=False, indent=2)
        
        # 生成传感器数据
        sensor_data = []
        for i in range(100):
            if i < 50:
                timestamp = base_ts + i * 6
            elif i == 50:
                timestamp = base_ts + 50 * 6 + 600  # 时间戳跳变
            else:
                timestamp = base_ts + i * 6 + 600
            
            sensor_data.append({
                "timestamp": timestamp,
                "mileage": i * 5,
                "temperature": round(20 + random.uniform(-2, 2), 1),
                "humidity": round(60 + random.uniform(-10, 10), 1),
                "vibration": round(random.uniform(0, 5), 2),
                "gas_level": round(random.uniform(0, 100), 1),
                "robot_id": "robot_002"
            })
        
        with open(package_dir / "sensor_data.csv", 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=[
                "timestamp", "mileage", "temperature", "humidity", 
                "vibration", "gas_level", "robot_id"
            ])
            writer.writeheader()
            writer.writerows(sensor_data)
        
        # 生成缺陷标注
        defect_data = self._generate_defect_annotations(
            start_mileage=100,
            end_mileage=400,
            defect_count=3,
            robot_id="robot_002"
        )
        with open(package_dir / "defect_annotations.yaml", 'w', encoding='utf-8') as f:
            yaml.dump({"defects": defect_data}, f, allow_unicode=True, default_flow_style=False)
        
        return package_dir
    
    def generate_package_with_mileage_backtrack(
        self,
        output_dir: Path,
        package_name: str = "robot_003_mileage_backtrack"
    ) -> Path:
        """
        生成包含里程桩号倒退问题的巡检包
        """
        package_dir = output_dir / package_name
        package_dir.mkdir(parents=True, exist_ok=True)
        
        base_ts = self.base_time.timestamp()
        
        # 生成视频索引数据（包含里程倒退）
        video_data = []
        for i in range(20):
            # 正常增加
            if i < 12:
                mileage = i * 25
            # 里程倒退
            elif i == 12:
                mileage = 200  # 从300倒退到200
            else:
                mileage = 200 + (i - 12) * 25
            
            video_data.append({
                "segment_id": i + 1,
                "timestamp": base_ts + i * 30,
                "mileage": mileage,
                "file_name": f"video_{i+1:03d}.mp4",
                "duration": 30
            })
        
        with open(package_dir / "video_index.json", 'w', encoding='utf-8') as f:
            json.dump(video_data, f, ensure_ascii=False, indent=2)
        
        # 生成传感器数据
        sensor_data = []
        for i in range(100):
            if i < 60:
                mileage = i * 5
            elif i == 60:
                mileage = 200  # 里程倒退
            else:
                mileage = 200 + (i - 60) * 5
            
            sensor_data.append({
                "timestamp": base_ts + i * 6,
                "mileage": mileage,
                "temperature": round(20 + random.uniform(-2, 2), 1),
                "humidity": round(60 + random.uniform(-10, 10), 1),
                "vibration": round(random.uniform(0, 5), 2),
                "gas_level": round(random.uniform(0, 100), 1),
                "robot_id": "robot_003"
            })
        
        with open(package_dir / "sensor_data.csv", 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=[
                "timestamp", "mileage", "temperature", "humidity", 
                "vibration", "gas_level", "robot_id"
            ])
            writer.writeheader()
            writer.writerows(sensor_data)
        
        # 生成缺陷标注
        defect_data = self._generate_defect_annotations(
            start_mileage=50,
            end_mileage=350,
            defect_count=4,
            robot_id="robot_003"
        )
        with open(package_dir / "defect_annotations.yaml", 'w', encoding='utf-8') as f:
            yaml.dump({"defects": defect_data}, f, allow_unicode=True, default_flow_style=False)
        
        return package_dir
    
    def generate_overlapping_packages(
        self,
        output_dir: Path,
        package_count: int = 3
    ) -> List[Path]:
        """
        生成多个包含重复缺陷标注的巡检包（用于测试归并功能）
        模拟多台机器人巡检同一管段，标注相同的缺陷
        """
        packages = []
        
        # 定义一些共享的缺陷位置（模拟同一管段的相同缺陷）
        shared_defects = [
            {"mileage": 120.5, "type": "crack", "severity": "high", "description": "管壁纵向裂缝"},
            {"mileage": 245.0, "type": "leak", "severity": "critical", "description": "接头处漏水"},
            {"mileage": 378.2, "type": "corrosion", "severity": "medium", "description": "金属表面锈蚀"},
        ]
        
        for pkg_idx in range(package_count):
            robot_id = f"robot_{100 + pkg_idx:03d}"
            package_name = f"{robot_id}_overlapping"
            package_dir = output_dir / package_name
            package_dir.mkdir(parents=True, exist_ok=True)
            
            base_ts = (self.base_time + timedelta(hours=pkg_idx * 2)).timestamp()
            
            # 生成视频索引
            video_data = self._generate_video_index(
                start_mileage=100,
                end_mileage=400,
                segment_count=15,
                robot_id=robot_id,
                base_timestamp=base_ts
            )
            with open(package_dir / "video_index.json", 'w', encoding='utf-8') as f:
                json.dump(video_data, f, ensure_ascii=False, indent=2)
            
            # 生成传感器数据
            sensor_data = self._generate_sensor_data(
                start_mileage=100,
                end_mileage=400,
                record_count=60,
                robot_id=robot_id,
                base_timestamp=base_ts
            )
            with open(package_dir / "sensor_data.csv", 'w', encoding='utf-8', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=[
                    "timestamp", "mileage", "temperature", "humidity", 
                    "vibration", "gas_level", "robot_id"
                ])
                writer.writeheader()
                writer.writerows(sensor_data)
            
            # 生成缺陷标注（包含共享缺陷和一些独有缺陷）
            defect_data = []
            
            # 添加共享缺陷（每个机器人标注的位置略有不同，模拟实际情况）
            for defect in shared_defects:
                # 每个机器人标注的位置有微小差异（±1米）
                mileage_offset = random.uniform(-1.0, 1.0)
                defect_data.append({
                    "defect_id": f"{robot_id}_{defect['type']}_{int(defect['mileage'])}",
                    "defect_type": defect["type"],
                    "mileage": round(defect["mileage"] + mileage_offset, 2),
                    "pipe_segment": "segment_001",
                    "severity": defect["severity"],
                    "description": defect["description"],
                    "timestamp": base_ts + random.uniform(0, 3600),
                    "source": robot_id,
                    "annotator": "auto"
                })
            
            # 添加一些独有缺陷
            for i in range(2):
                mileage = random.uniform(100, 400)
                defect_types = ["crack", "leak", "corrosion", "deformation"]
                severities = ["low", "medium", "high"]
                
                defect_data.append({
                    "defect_id": f"{robot_id}_unique_{i}",
                    "defect_type": random.choice(defect_types),
                    "mileage": round(mileage, 2),
                    "pipe_segment": "segment_001",
                    "severity": random.choice(severities),
                    "description": f"{robot_id} 独有缺陷 #{i+1}",
                    "timestamp": base_ts + random.uniform(0, 3600),
                    "source": robot_id,
                    "annotator": "auto"
                })
            
            with open(package_dir / "defect_annotations.yaml", 'w', encoding='utf-8') as f:
                yaml.dump({"defects": defect_data}, f, allow_unicode=True, default_flow_style=False)
            
            packages.append(package_dir)
        
        return packages
    
    def generate_empty_package(
        self,
        output_dir: Path,
        package_name: str = "robot_999_empty"
    ) -> Path:
        """
        生成空的巡检包（用于测试错误处理）
        """
        package_dir = output_dir / package_name
        package_dir.mkdir(parents=True, exist_ok=True)
        
        # 只创建一个空的README文件
        with open(package_dir / "README.txt", 'w', encoding='utf-8') as f:
            f.write("这是一个空的巡检包，用于测试错误处理。\n")
        
        return package_dir
    
    def generate_corrupt_package(
        self,
        output_dir: Path,
        package_name: str = "robot_998_corrupt"
    ) -> Path:
        """
        生成包含损坏数据的巡检包（用于测试错误处理）
        """
        package_dir = output_dir / package_name
        package_dir.mkdir(parents=True, exist_ok=True)
        
        # 损坏的JSON文件
        with open(package_dir / "video_index.json", 'w', encoding='utf-8') as f:
            f.write('{"segments": [{"timestamp": 123, "mileage": 456, ')  # 不完整的JSON
        
        # 损坏的CSV文件
        with open(package_dir / "sensor_data.csv", 'w', encoding='utf-8') as f:
            f.write('timestamp,mileage,temperature\n')
            f.write('123,abc,25.5\n')  # 无效的里程数据
            f.write('456,100,xyz\n')  # 无效的温度数据
        
        # 损坏的YAML文件
        with open(package_dir / "defect_annotations.yaml", 'w', encoding='utf-8') as f:
            f.write('defects:\n')
            f.write('  - defect_id: D001\n')
            f.write('    defect_type: crack\n')
            f.write('      mileage: 100.5\n')  # 缩进错误
        
        return package_dir
    
    def _generate_video_index(
        self,
        start_mileage: float,
        end_mileage: float,
        segment_count: int,
        robot_id: str,
        base_timestamp: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """
        生成视频索引数据
        """
        if base_timestamp is None:
            base_timestamp = self.base_time.timestamp()
        
        segments = []
        mileage_step = (end_mileage - start_mileage) / segment_count
        
        for i in range(segment_count):
            segments.append({
                "segment_id": i + 1,
                "timestamp": base_timestamp + i * 30,
                "mileage": round(start_mileage + i * mileage_step, 2),
                "file_name": f"{robot_id}_video_{i+1:03d}.mp4",
                "duration": 30,
                "robot_id": robot_id
            })
        
        return {"segments": segments}
    
    def _generate_sensor_data(
        self,
        start_mileage: float,
        end_mileage: float,
        record_count: int,
        robot_id: str,
        base_timestamp: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """
        生成传感器数据
        """
        if base_timestamp is None:
            base_timestamp = self.base_time.timestamp()
        
        records = []
        mileage_step = (end_mileage - start_mileage) / record_count
        
        for i in range(record_count):
            records.append({
                "timestamp": round(base_timestamp + i * 6, 2),
                "mileage": round(start_mileage + i * mileage_step, 2),
                "temperature": round(20 + random.uniform(-3, 3), 1),
                "humidity": round(55 + random.uniform(-15, 15), 1),
                "vibration": round(random.uniform(0, 8), 2),
                "gas_level": round(random.uniform(0, 200), 1),
                "robot_id": robot_id
            })
        
        return records
    
    def _generate_defect_annotations(
        self,
        start_mileage: float,
        end_mileage: float,
        defect_count: int,
        robot_id: str
    ) -> List[Dict[str, Any]]:
        """
        生成缺陷标注数据
        """
        defect_types = ["crack", "leak", "corrosion", "deformation", "blockage"]
        severities = ["low", "medium", "high", "critical"]
        descriptions = {
            "crack": ["管壁纵向裂缝", "环向裂缝", "微裂纹扩展", "结构性裂缝"],
            "leak": ["接头处漏水", "管壁渗漏", "密封失效", "积水渗漏"],
            "corrosion": ["金属表面锈蚀", "电化学腐蚀", "焊缝腐蚀", "防腐层破损"],
            "deformation": ["管段变形", "沉降变形", "挤压变形", "椭圆度超标"],
            "blockage": ["杂物堵塞", "沉积物堆积", "管线堵塞", "接口错位"]
        }
        
        defects = []
        mileages = sorted(random.sample(
            [round(start_mileage + i * (end_mileage - start_mileage) / defect_count, 2) 
             for i in range(defect_count)],
            defect_count
        ))
        
        for i, mileage in enumerate(mileages):
            defect_type = random.choice(defect_types)
            severity = random.choice(severities)
            description = random.choice(descriptions.get(defect_type, ["未知缺陷"]))
            
            defects.append({
                "defect_id": f"{robot_id}_{i+1:03d}",
                "defect_type": defect_type,
                "mileage": mileage,
                "pipe_segment": f"segment_{int(mileage // 100):03d}",
                "severity": severity,
                "description": description,
                "timestamp": self.base_time.timestamp() + random.uniform(0, 3600),
                "source": robot_id,
                "annotator": "auto"
            })
        
        return defects
    
    def generate_all_samples(self, output_dir: Union[str, Path]) -> Dict[str, Path]:
        """
        生成所有示例数据
        """
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        packages = {}
        
        # 正常包
        packages["normal"] = self.generate_normal_package(output_dir)
        
        # 时间戳跳变包
        packages["timestamp_jump"] = self.generate_package_with_timestamp_jump(output_dir)
        
        # 里程倒退包
        packages["mileage_backtrack"] = self.generate_package_with_mileage_backtrack(output_dir)
        
        # 重叠包（多机器人）
        overlapping_packages = self.generate_overlapping_packages(output_dir, package_count=3)
        for i, pkg in enumerate(overlapping_packages):
            packages[f"overlapping_{i+1}"] = pkg
        
        # 空包
        packages["empty"] = self.generate_empty_package(output_dir)
        
        # 损坏包
        packages["corrupt"] = self.generate_corrupt_package(output_dir)
        
        return packages


if __name__ == "__main__":
    # 示例：生成测试数据
    generator = SampleDataGenerator()
    sample_dir = Path(__file__).parent.parent / "test_samples"
    packages = generator.generate_all_samples(sample_dir)
    
    print(f"生成的示例数据保存在: {sample_dir}")
    print("\n生成的巡检包:")
    for name, path in packages.items():
        print(f"  - {name}: {path}")
