"""
示例数据生成器

生成用于测试的示例数据文件，包括:
- 通告单 CSV
- 场记 JSON (包含有意的连续性问题)
- 截图清单 CSV
- 服装规则 JSON
- 道具规则 JSON
"""

import csv
import json
from pathlib import Path
from typing import Dict, List, Any


class ExampleGenerator:
    """示例数据生成器"""
    
    def __init__(self):
        self.characters = ["李雷", "韩梅梅", "王大爷", "刘阿姨", "张警官"]
        self.locations = ["老街区", "咖啡馆", "警局", "医院", "学校"]
    
    def generate_all(self, output_dir: str):
        """生成所有示例数据文件"""
        out_path = Path(output_dir)
        out_path.mkdir(parents=True, exist_ok=True)
        
        self.generate_call_sheet(out_path / "call_sheet.csv")
        self.generate_script_notes(out_path / "script_notes.json")
        self.generate_screenshots(out_path / "screenshots.csv")
        self.generate_costume_rules(out_path / "costume_rules.json")
        self.generate_prop_rules(out_path / "prop_rules.json")
    
    def generate_call_sheet(self, file_path: Path):
        """生成通告单 CSV"""
        data = [
            {
                "scene_id": "1-01",
                "shot_number": "1",
                "description": "老街区全景 - 李雷独自走在街上",
                "characters": "李雷",
                "props": "旧照片",
                "scheduled_time": "09:00",
                "location": "老街区",
                "page_count": "1.5"
            },
            {
                "scene_id": "1-01",
                "shot_number": "2",
                "description": "中景 - 李雷掏出旧照片查看",
                "characters": "李雷",
                "props": "旧照片",
                "scheduled_time": "09:30",
                "location": "老街区",
                "page_count": "0.8"
            },
            {
                "scene_id": "1-02",
                "shot_number": "1",
                "description": "咖啡馆内 - 李雷和韩梅梅对坐",
                "characters": "李雷,韩梅梅",
                "props": "咖啡杯,旧照片",
                "scheduled_time": "10:30",
                "location": "咖啡馆",
                "page_count": "2.0"
            },
            {
                "scene_id": "1-02",
                "shot_number": "2",
                "description": "特写 - 韩梅梅看照片时的表情",
                "characters": "韩梅梅",
                "props": "旧照片",
                "scheduled_time": "11:00",
                "location": "咖啡馆",
                "page_count": "0.5"
            },
            {
                "scene_id": "1-02",
                "shot_number": "3",
                "description": "双人镜头 - 李雷和韩梅梅交谈",
                "characters": "李雷,韩梅梅",
                "props": "咖啡杯",
                "scheduled_time": "11:30",
                "location": "咖啡馆",
                "page_count": "1.2"
            },
            {
                "scene_id": "2-01",
                "shot_number": "1",
                "description": "警局办公室 - 张警官查看文件",
                "characters": "张警官",
                "props": "档案袋",
                "scheduled_time": "14:00",
                "location": "警局",
                "page_count": "1.0"
            }
        ]
        
        headers = ["scene_id", "shot_number", "description", "characters", 
                  "props", "scheduled_time", "location", "page_count"]
        
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            writer.writerows(data)
    
    def generate_script_notes(self, file_path: Path):
        """生成场记 JSON (包含有意的连续性问题)"""
        data = {
            "script_notes": [
                {
                    "scene_id": "1-01",
                    "shot_number": "1",
                    "take": 1,
                    "status": "已拍摄",
                    "characters": ["李雷"],
                    "costumes": {
                        "李雷": "蓝色西装+白衬衫+黑领带"
                    },
                    "props": ["旧照片"],
                    "notes": "情绪到位，阳光角度好",
                    "shot_date": "2026-05-01",
                    "camera_angle": "全景",
                    "lens": "24mm",
                    "duration": "00:01:30"
                },
                {
                    "scene_id": "1-01",
                    "shot_number": "2",
                    "take": 1,
                    "status": "已拍摄",
                    "characters": ["李雷"],
                    "costumes": {
                        "李雷": "蓝色西装+白衬衫+红领带"
                    },
                    "props": ["旧照片"],
                    "notes": "注意表情很好",
                    "shot_date": "2026-05-01",
                    "camera_angle": "中景",
                    "lens": "50mm",
                    "duration": "00:00:45"
                },
                {
                    "scene_id": "1-02",
                    "shot_number": "1",
                    "take": 1,
                    "status": "已拍摄",
                    "characters": ["李雷", "韩梅梅"],
                    "costumes": {
                        "李雷": "蓝色西装+白衬衫+黑领带",
                        "韩梅梅": "红色连衣裙+白色外套"
                    },
                    "props": ["咖啡杯", "旧照片"],
                    "notes": "构图不错",
                    "shot_date": "2026-05-01",
                    "camera_angle": "中景",
                    "lens": "35mm",
                    "duration": "00:02:00"
                },
                {
                    "scene_id": "1-02",
                    "shot_number": "2",
                    "take": 1,
                    "status": "已拍摄",
                    "characters": ["韩梅梅"],
                    "costumes": {
                        "韩梅梅": "红色连衣裙"
                    },
                    "props": ["旧照片"],
                    "notes": "情绪到位",
                    "shot_date": "2026-05-01",
                    "camera_angle": "特写",
                    "lens": "85mm",
                    "duration": "00:00:30"
                },
                {
                    "scene_id": "1-02",
                    "shot_number": "3",
                    "take": 1,
                    "status": "已拍摄",
                    "characters": ["李雷", "韩梅梅"],
                    "costumes": {
                        "李雷": "蓝色西装+白衬衫+黑领带",
                        "韩梅梅": "红色连衣裙+白色外套"
                    },
                    "props": ["咖啡杯"],
                    "notes": "对话自然",
                    "shot_date": "2026-05-01",
                    "camera_angle": "双人",
                    "lens": "40mm",
                    "duration": "00:01:15"
                },
                {
                    "scene_id": "1-01",
                    "shot_number": "1",
                    "take": 2,
                    "status": "补拍",
                    "characters": ["李雷"],
                    "costumes": {
                        "李雷": "灰色西装+花衬衫"
                    },
                    "props": ["旧照片"],
                    "notes": "重拍，光线更好",
                    "shot_date": "2026-05-02",
                    "camera_angle": "全景",
                    "lens": "24mm",
                    "duration": "00:01:20"
                },
                {
                    "scene_id": "2-01",
                    "shot_number": "1",
                    "take": 1,
                    "status": "已拍摄",
                    "characters": ["张警官"],
                    "costumes": {
                        "张警官": "警服"
                    },
                    "props": [],
                    "notes": "严肃的表情",
                    "shot_date": "2026-05-01",
                    "camera_angle": "中景",
                    "lens": "50mm",
                    "duration": "00:00:50"
                },
                {
                    "scene_id": "3-01",
                    "shot_number": "1",
                    "take": 1,
                    "status": "已拍摄",
                    "characters": ["王大爷"],
                    "costumes": {
                        "王大爷": "中山装"
                    },
                    "props": ["拐杖"],
                    "notes": "临时加的镜头",
                    "shot_date": "2026-05-01",
                    "camera_angle": "中景",
                    "lens": "50mm",
                    "duration": "00:00:40"
                }
            ]
        }
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def generate_screenshots(self, file_path: Path):
        """生成截图清单 CSV (故意缺少一些截图)"""
        data = [
            {
                "file_path": "/footage/1-01_01_take1.000001.jpg",
                "scene_id": "1-01",
                "shot_number": "1",
                "take": "1",
                "timestamp": "2026-05-01 09:15:00"
            },
            {
                "file_path": "/footage/1-01_02_take1.000001.jpg",
                "scene_id": "1-01",
                "shot_number": "2",
                "take": "1",
                "timestamp": "2026-05-01 09:45:00"
            },
            {
                "file_path": "/footage/1-02_01_take1.000001.jpg",
                "scene_id": "1-02",
                "shot_number": "1",
                "take": "1",
                "timestamp": "2026-05-01 10:45:00"
            },
            {
                "file_path": "/footage/1-02_02_take1.000001.jpg",
                "scene_id": "1-02",
                "shot_number": "2",
                "take": "1",
                "timestamp": "2026-05-01 11:15:00"
            },
            {
                "file_path": "/footage/2-01_01_take1.000001.jpg",
                "scene_id": "2-01",
                "shot_number": "1",
                "take": "1",
                "timestamp": "2026-05-01 14:15:00"
            }
        ]
        
        headers = ["file_path", "scene_id", "shot_number", "take", "timestamp"]
        
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            writer.writerows(data)
    
    def generate_costume_rules(self, file_path: Path):
        """生成服装规则 JSON"""
        data = {
            "costume_rules": [
                {
                    "character": "李雷",
                    "scene_id": "1-*",
                    "description": "蓝色西装+白衬衫+黑领带",
                    "accessories": ["手表", "戒指"],
                    "notes": "第一幕，回忆场景，统一西装颜色要一致"
                },
                {
                    "character": "韩梅梅",
                    "scene_id": "1-*",
                    "description": "红色连衣裙+白色外套",
                    "accessories": ["项链"],
                    "notes": "回忆场景的标志性服装"
                },
                {
                    "character": "张警官",
                    "scene_id": "2-*",
                    "description": "警服",
                    "accessories": ["警帽", "警徽"],
                    "notes": "警局场景必须穿警服"
                },
                {
                    "character": "王大爷",
                    "scene_id": "3-*",
                    "description": "中山装",
                    "accessories": ["拐杖"],
                    "notes": "老年角色的固定服装"
                }
            ]
        }
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def generate_prop_rules(self, file_path: Path):
        """生成道具规则 JSON"""
        data = {
            "prop_rules": [
                {
                    "prop_name": "旧照片",
                    "scene_id": "1-*",
                    "required": True,
                    "state": "泛黄、有折痕",
                    "notes": "关键剧情道具，第一幕必须一致"
                },
                {
                    "prop_name": "咖啡杯",
                    "scene_id": "1-02",
                    "required": True,
                    "state": "白色瓷杯",
                    "notes": "咖啡馆场景道具"
                },
                {
                    "prop_name": "档案袋",
                    "scene_id": "2-*",
                    "required": True,
                    "state": "棕色牛皮纸",
                    "notes": "警局场景道具"
                },
                {
                    "prop_name": "拐杖",
                    "scene_id": "3-*",
                    "required": False,
                    "state": "木质",
                    "notes": "王大爷的随身道具"
                }
            ]
        }
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
