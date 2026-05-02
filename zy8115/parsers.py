import csv
import json
import re
from typing import Dict, List, Any, Optional
from pathlib import Path

import yaml

from models import (
    LightingCue,
    TrackMarker,
    DeviceChannel,
    ReviewProject
)


class DataParser:
    """数据解析器基类"""
    
    @staticmethod
    def parse_channels_string(channels_str: str) -> Dict[int, int]:
        """解析通道字符串，支持多种格式"""
        if not channels_str:
            return {}
        
        # 移除引号和空格
        channels_str = channels_str.strip().strip('"\'')
        
        # 尝试解析为JSON格式
        try:
            channels = json.loads(channels_str)
            if isinstance(channels, dict):
                # 确保键是整数
                return {int(k): int(v) for k, v in channels.items()}
        except json.JSONDecodeError:
            pass
        
        # 尝试解析为简单格式，如 "1:100,2:80,3:50"
        channels = {}
        # 匹配模式：数字:数字
        pattern = r'(\d+)\s*:\s*(\d+)'
        matches = re.findall(pattern, channels_str)
        for match in matches:
            channel = int(match[0])
            value = int(match[1])
            channels[channel] = value
        
        return channels


class LightingCuesParser(DataParser):
    """灯光CUE CSV解析器"""
    
    @classmethod
    def parse(cls, file_path: str) -> List[LightingCue]:
        """解析灯光CUE CSV文件"""
        cues = []
        file_path = Path(file_path)
        
        if not file_path.exists():
            raise FileNotFoundError(f"灯光CUE文件不存在: {file_path}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            for row_num, row in enumerate(reader, start=2):
                try:
                    # 解析通道
                    channels = cls.parse_channels_string(row.get('channels', '{}'))
                    
                    # 解析时间
                    try:
                        time = float(row.get('time', 0.0))
                    except ValueError:
                        time = 0.0
                    
                    # 解析曲目时间
                    track_time = None
                    if row.get('track_time'):
                        try:
                            track_time = float(row['track_time'])
                        except ValueError:
                            pass
                    
                    # 解析淡入淡出
                    fade_in = None
                    if row.get('fade_in'):
                        try:
                            fade_in = float(row['fade_in'])
                        except ValueError:
                            pass
                    
                    fade_out = None
                    if row.get('fade_out'):
                        try:
                            fade_out = float(row['fade_out'])
                        except ValueError:
                            pass
                    
                    cue = LightingCue(
                        cue_number=row.get('cue_number', f'Q{row_num-1}'),
                        scene=row.get('scene', '默认场景'),
                        description=row.get('description', ''),
                        time=time,
                        channels=channels,
                        track_name=row.get('track_name'),
                        track_time=track_time,
                        notes=row.get('notes', ''),
                        fade_in=fade_in,
                        fade_out=fade_out
                    )
                    cues.append(cue)
                    
                except Exception as e:
                    print(f"警告：解析第 {row_num} 行时出错: {e}")
                    continue
        
        # 按时间排序
        cues.sort(key=lambda x: x.time)
        return cues


class TrackTimelineParser(DataParser):
    """曲目时间轴JSON解析器"""
    
    @classmethod
    def parse(cls, file_path: str) -> List[TrackMarker]:
        """解析曲目时间轴JSON文件"""
        file_path = Path(file_path)
        
        if not file_path.exists():
            raise FileNotFoundError(f"曲目时间轴文件不存在: {file_path}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        tracks = []
        
        # 支持多种格式
        if 'tracks' in data:
            track_list = data['tracks']
        elif isinstance(data, list):
            track_list = data
        else:
            # 尝试直接解析单个曲目
            track_list = [data]
        
        for track_data in track_list:
            try:
                track = TrackMarker(
                    name=track_data.get('name', '未命名曲目'),
                    start_time=float(track_data.get('start_time', 0.0)),
                    end_time=float(track_data.get('end_time', 0.0)),
                    duration=float(track_data.get('duration', 0.0)),
                    cue_points=[float(p) for p in track_data.get('cue_points', [])],
                    description=track_data.get('description', '')
                )
                
                # 如果duration为0但有start和end时间，自动计算
                if track.duration == 0 and track.end_time > track.start_time:
                    track.duration = track.end_time - track.start_time
                
                tracks.append(track)
                
            except Exception as e:
                print(f"警告：解析曲目数据时出错: {e}")
                continue
        
        # 按开始时间排序
        tracks.sort(key=lambda x: x.start_time)
        return tracks


class DeviceChannelsParser(DataParser):
    """设备通道YAML解析器"""
    
    @classmethod
    def parse(cls, file_path: str) -> List[DeviceChannel]:
        """解析设备通道YAML文件"""
        file_path = Path(file_path)
        
        if not file_path.exists():
            raise FileNotFoundError(f"设备通道文件不存在: {file_path}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        channels = []
        
        # 支持多种格式
        if 'scenes' in data:
            # 按场景组织的格式
            for scene in data['scenes']:
                scene_name = scene.get('name', '默认场景')
                devices = scene.get('devices', [])
                
                for device_data in devices:
                    try:
                        channel = DeviceChannel(
                            channel_number=int(device_data.get('channel', 0)),
                            device_name=device_data.get('name', '未命名设备'),
                            device_type=device_data.get('type', 'unknown'),
                            scene=scene_name,
                            description=device_data.get('description', ''),
                            patch=device_data.get('patch')
                        )
                        channels.append(channel)
                    except Exception as e:
                        print(f"警告：解析设备数据时出错: {e}")
                        continue
        
        elif 'devices' in data or isinstance(data, list):
            # 直接设备列表格式
            device_list = data.get('devices', data) if isinstance(data, dict) else data
            
            for device_data in device_list:
                try:
                    channel = DeviceChannel(
                        channel_number=int(device_data.get('channel', 0)),
                        device_name=device_data.get('name', '未命名设备'),
                        device_type=device_data.get('type', 'unknown'),
                        scene=device_data.get('scene', '默认场景'),
                        description=device_data.get('description', ''),
                        patch=device_data.get('patch')
                    )
                    channels.append(channel)
                except Exception as e:
                    print(f"警告：解析设备数据时出错: {e}")
                    continue
        
        # 按通道号排序
        channels.sort(key=lambda x: x.channel_number)
        return channels


class ProjectLoader:
    """项目加载器，用于加载完整的复核项目"""
    
    @classmethod
    def load(
        cls,
        project_name: str,
        cues_file: Optional[str] = None,
        timeline_file: Optional[str] = None,
        channels_file: Optional[str] = None
    ) -> ReviewProject:
        """加载完整的复核项目"""
        
        project = ReviewProject(name=project_name)
        
        # 加载灯光CUE
        if cues_file:
            try:
                project.lighting_cues = LightingCuesParser.parse(cues_file)
                print(f"成功加载 {len(project.lighting_cues)} 个灯光CUE")
            except Exception as e:
                print(f"加载灯光CUE失败: {e}")
        
        # 加载曲目时间轴
        if timeline_file:
            try:
                project.track_markers = TrackTimelineParser.parse(timeline_file)
                print(f"成功加载 {len(project.track_markers)} 个曲目标记")
            except Exception as e:
                print(f"加载曲目时间轴失败: {e}")
        
        # 加载设备通道
        if channels_file:
            try:
                project.device_channels = DeviceChannelsParser.parse(channels_file)
                print(f"成功加载 {len(project.device_channels)} 个设备通道配置")
            except Exception as e:
                print(f"加载设备通道失败: {e}")
        
        return project
    
    @classmethod
    def from_directory(cls, directory: str, project_name: Optional[str] = None) -> ReviewProject:
        """从目录自动检测并加载项目文件"""
        dir_path = Path(directory)
        
        if not dir_path.exists():
            raise FileNotFoundError(f"目录不存在: {directory}")
        
        # 自动查找文件
        cues_file = None
        timeline_file = None
        channels_file = None
        
        # 查找CSV文件
        csv_files = list(dir_path.glob('*.csv'))
        for f in csv_files:
            if 'cue' in f.name.lower() or 'lighting' in f.name.lower():
                cues_file = str(f)
                break
        
        # 查找JSON文件
        json_files = list(dir_path.glob('*.json'))
        for f in json_files:
            if 'track' in f.name.lower() or 'timeline' in f.name.lower():
                timeline_file = str(f)
                break
        
        # 查找YAML文件
        yaml_files = list(dir_path.glob('*.yaml')) + list(dir_path.glob('*.yml'))
        for f in yaml_files:
            if 'device' in f.name.lower() or 'channel' in f.name.lower():
                channels_file = str(f)
                break
        
        # 如果没有找到特定文件，尝试使用第一个匹配的文件
        if not cues_file and csv_files:
            cues_file = str(csv_files[0])
        if not timeline_file and json_files:
            timeline_file = str(json_files[0])
        if not channels_file and yaml_files:
            channels_file = str(yaml_files[0])
        
        # 确定项目名称
        if not project_name:
            project_name = dir_path.name
        
        return cls.load(
            project_name=project_name,
            cues_file=cues_file,
            timeline_file=timeline_file,
            channels_file=channels_file
        )