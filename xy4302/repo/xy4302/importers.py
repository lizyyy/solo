import csv
import json
import os
from typing import Dict, List, Optional, Tuple
from pathlib import Path
from datetime import datetime

from models import (
    Actor, Prop, Scene, PropUsage, Cue, ShowData, Alert, AlertType
)


class CSVImporter:
    def __init__(self):
        self.errors: List[str] = []

    def import_scenes(self, file_path: str) -> Dict[str, Scene]:
        scenes = {}
        self.errors = []
        
        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                
                for row_num, row in enumerate(reader, start=2):
                    try:
                        scene_id = row.get('scene_id', row.get('id', f'scene_{row_num-1}'))
                        scene_name = row.get('scene_name', row.get('name', f'场景 {row_num-1}'))
                        
                        try:
                            act = int(row.get('act', row.get('幕', 1)))
                        except (ValueError, TypeError):
                            act = 1
                            
                        try:
                            scene_number = int(row.get('scene_number', row.get('场', row_num-1)))
                        except (ValueError, TypeError):
                            scene_number = row_num - 1
                            
                        try:
                            duration = int(row.get('duration', row.get('时长(分钟)', 0)))
                        except (ValueError, TypeError):
                            duration = 0
                        
                        props_str = row.get('props', row.get('道具', ''))
                        cues_str = row.get('cues', row.get('提示词', ''))
                        
                        scene = Scene(
                            id=scene_id,
                            name=scene_name,
                            act=act,
                            scene_number=scene_number,
                            duration=duration,
                            notes=row.get('notes', row.get('备注', ''))
                        )
                        
                        scenes[scene_id] = scene
                        
                    except Exception as e:
                        self.errors.append(f"第 {row_num} 行解析失败: {str(e)}")
                        
        except FileNotFoundError:
            self.errors.append(f"文件不存在: {file_path}")
        except Exception as e:
            self.errors.append(f"读取文件失败: {str(e)}")
            
        return scenes

    def import_props_from_csv(self, file_path: str, scenes: Dict[str, Scene]) -> Tuple[Dict[str, Prop], List[PropUsage]]:
        props = {}
        prop_usages = []
        self.errors = []
        
        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                
                for row_num, row in enumerate(reader, start=2):
                    try:
                        prop_id = row.get('prop_id', row.get('id', f'prop_{row_num-1}'))
                        prop_name = row.get('prop_name', row.get('道具名称', f'道具 {row_num-1}'))
                        
                        if prop_id not in props:
                            props[prop_id] = Prop(
                                id=prop_id,
                                name=prop_name,
                                notes=row.get('notes', row.get('备注', ''))
                            )
                        
                        scene_id = row.get('scene_id', row.get('场景ID', ''))
                        if scene_id and scene_id in scenes:
                            usage_type = row.get('usage_type', row.get('类型', '上场'))
                            usage = PropUsage(
                                prop_id=prop_id,
                                prop_name=prop_name,
                                usage_type=usage_type,
                                scene_id=scene_id,
                                scene_name=scenes[scene_id].name,
                                actor_id=row.get('actor_id', row.get('演员ID', None)),
                                actor_name=row.get('actor_name', row.get('演员', None)),
                                notes=row.get('notes', row.get('备注', ''))
                            )
                            prop_usages.append(usage)
                            scenes[scene_id].props.append(usage)
                            
                    except Exception as e:
                        self.errors.append(f"第 {row_num} 行解析失败: {str(e)}")
                        
        except FileNotFoundError:
            self.errors.append(f"文件不存在: {file_path}")
        except Exception as e:
            self.errors.append(f"读取文件失败: {str(e)}")
            
        return props, prop_usages

    def import_cues_from_csv(self, file_path: str, scenes: Dict[str, Scene]) -> List[Cue]:
        cues = []
        self.errors = []
        
        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                
                for row_num, row in enumerate(reader, start=2):
                    try:
                        cue_id = row.get('cue_id', row.get('id', f'cue_{row_num-1}'))
                        scene_id = row.get('scene_id', row.get('场景ID', ''))
                        
                        if scene_id and scene_id in scenes:
                            cue = Cue(
                                id=cue_id,
                                scene_id=scene_id,
                                cue_type=row.get('cue_type', row.get('类型', '其他')),
                                content=row.get('content', row.get('内容', '')),
                                actor_id=row.get('actor_id', row.get('演员ID', None)),
                                actor_name=row.get('actor_name', row.get('演员', None)),
                                notes=row.get('notes', row.get('备注', ''))
                            )
                            cues.append(cue)
                            scenes[scene_id].cues.append(cue)
                            
                    except Exception as e:
                        self.errors.append(f"第 {row_num} 行解析失败: {str(e)}")
                        
        except FileNotFoundError:
            self.errors.append(f"文件不存在: {file_path}")
        except Exception as e:
            self.errors.append(f"读取文件失败: {str(e)}")
            
        return cues


class JSONImporter:
    def __init__(self):
        self.errors: List[str] = []

    def import_actors(self, file_path: str) -> Dict[str, Actor]:
        actors = {}
        self.errors = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if isinstance(data, list):
                actor_list = data
            elif isinstance(data, dict) and 'actors' in data:
                actor_list = data['actors']
            else:
                actor_list = [data]
                
            for actor_data in actor_list:
                actor_id = actor_data.get('id', actor_data.get('actor_id'))
                if not actor_id:
                    actor_id = f"actor_{len(actors) + 1}"
                    
                actor = Actor(
                    id=actor_id,
                    name=actor_data.get('name', actor_data.get('actor_name', f'演员 {len(actors) + 1}')),
                    is_present=actor_data.get('is_present', actor_data.get('到场', True)),
                    notes=actor_data.get('notes', actor_data.get('备注', ''))
                )
                actors[actor_id] = actor
                
        except FileNotFoundError:
            self.errors.append(f"文件不存在: {file_path}")
        except json.JSONDecodeError as e:
            self.errors.append(f"JSON 解析失败: {str(e)}")
        except Exception as e:
            self.errors.append(f"读取文件失败: {str(e)}")
            
        return actors


class PhotoScanner:
    def __init__(self):
        self.errors: List[str] = []
        self.photo_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}

    def scan_photos(self, directory: str, props: Dict[str, Prop]) -> Dict[str, str]:
        photo_map = {}
        self.errors = []
        
        if not os.path.exists(directory):
            self.errors.append(f"目录不存在: {directory}")
            return photo_map
            
        if not os.path.isdir(directory):
            self.errors.append(f"路径不是目录: {directory}")
            return photo_map
            
        try:
            for filename in os.listdir(directory):
                filepath = os.path.join(directory, filename)
                if os.path.isfile(filepath):
                    ext = os.path.splitext(filename)[1].lower()
                    if ext in self.photo_extensions:
                        prop_name = os.path.splitext(filename)[0]
                        photo_map[prop_name] = filepath
                        
                        for prop_id, prop in props.items():
                            if prop.name == prop_name or prop_name in prop.name:
                                prop.photo_path = filepath
                                break
                                
        except Exception as e:
            self.errors.append(f"扫描目录失败: {str(e)}")
            
        return photo_map


class DataImporter:
    def __init__(self):
        self.csv_importer = CSVImporter()
        self.json_importer = JSONImporter()
        self.photo_scanner = PhotoScanner()
        self.errors: List[str] = []

    def import_all(
        self,
        scenes_csv: Optional[str] = None,
        actors_json: Optional[str] = None,
        props_csv: Optional[str] = None,
        cues_csv: Optional[str] = None,
        photos_dir: Optional[str] = None
    ) -> ShowData:
        show_data = ShowData()
        self.errors = []
        
        if scenes_csv:
            show_data.scenes = self.csv_importer.import_scenes(scenes_csv)
            self.errors.extend(self.csv_importer.errors)
            
        if actors_json:
            show_data.actors = self.json_importer.import_actors(actors_json)
            self.errors.extend(self.json_importer.errors)
            
        if props_csv and show_data.scenes:
            show_data.props, _ = self.csv_importer.import_props_from_csv(
                props_csv, show_data.scenes
            )
            self.errors.extend(self.csv_importer.errors)
            
        if cues_csv and show_data.scenes:
            self.csv_importer.import_cues_from_csv(cues_csv, show_data.scenes)
            self.errors.extend(self.csv_importer.errors)
            
        if photos_dir and show_data.props:
            show_data.prop_photos_dir = photos_dir
            self.photo_scanner.scan_photos(photos_dir, show_data.props)
            self.errors.extend(self.photo_scanner.errors)
            
        show_data.last_updated = datetime.now()
        
        return show_data
