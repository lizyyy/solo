"""
回放器模块 - 用于指定时间窗口回放
"""
from typing import Dict, List, Any, Optional, Callable, Tuple
from dataclasses import dataclass, field
from enum import Enum
import heapq


class PlaybackState(Enum):
    """回放状态"""
    STOPPED = "stopped"
    PLAYING = "playing"
    PAUSED = "paused"
    FAST_FORWARD = "fast_forward"
    FAST_REWIND = "fast_rewind"


@dataclass
class TimelineEvent:
    """时间线事件"""
    timestamp: float
    event_type: str  # "can_frame", "sensor_data", "control_command", "state_transition"
    source: str
    data: Any
    index: int = 0
    
    def __lt__(self, other):
        """用于堆排序"""
        return self.timestamp < other.timestamp


@dataclass
class PlaybackWindow:
    """回放窗口"""
    start_time: float
    end_time: float
    current_time: float = 0.0
    speed: float = 1.0  # 播放速度，1.0为正常速度
    
    @property
    def duration(self) -> float:
        """窗口持续时间"""
        return self.end_time - self.start_time


class ReplayPlayer:
    """回放器"""
    
    def __init__(self):
        """初始化回放器"""
        self.can_frames: List[Any] = []
        self.sensor_data: List[Any] = []
        self.control_commands: List[Any] = []
        
        # 事件回调
        self.on_can_frame: Optional[Callable[[Any], None]] = None
        self.on_sensor_data: Optional[Callable[[Any], None]] = None
        self.on_control_command: Optional[Callable[[Any], None]] = None
        self.on_time_update: Optional[Callable[[float], None]] = None
        
        # 回放状态
        self.state: PlaybackState = PlaybackState.STOPPED
        self.playback_window: Optional[PlaybackWindow] = None
        self.current_time: float = 0.0
        self.speed: float = 1.0
        
        # 事件堆
        self.event_heap: List[TimelineEvent] = []
        self.next_event_index: int = 0
        
    def load_data(self, can_frames: List[Any] = None, 
                  sensor_data: List[Any] = None,
                  control_commands: List[Any] = None):
        """
        加载回放数据
        
        Args:
            can_frames: CAN帧列表
            sensor_data: 传感器数据列表
            control_commands: 控制指令列表
        """
        if can_frames:
            self.can_frames = sorted(can_frames, key=lambda x: x.timestamp)
        
        if sensor_data:
            self.sensor_data = sorted(sensor_data, key=lambda x: x.timestamp)
        
        if control_commands:
            self.control_commands = sorted(control_commands, key=lambda x: x.timestamp)
        
        # 重置回放状态
        self.state = PlaybackState.STOPPED
        self.current_time = self.get_time_range()[0] if self.can_frames else 0.0
        
    def get_time_range(self) -> Tuple[float, float]:
        """
        获取数据的时间范围
        
        Returns:
            (开始时间, 结束时间)
        """
        all_times = []
        
        if self.can_frames:
            all_times.append(self.can_frames[0].timestamp)
            all_times.append(self.can_frames[-1].timestamp)
        
        if self.sensor_data:
            all_times.append(self.sensor_data[0].timestamp)
            all_times.append(self.sensor_data[-1].timestamp)
        
        if self.control_commands:
            all_times.append(self.control_commands[0].timestamp)
            all_times.append(self.control_commands[-1].timestamp)
        
        if not all_times:
            return (0.0, 0.0)
        
        return (min(all_times), max(all_times))
    
    def set_playback_window(self, start_time: float, end_time: float):
        """
        设置回放窗口
        
        Args:
            start_time: 开始时间
            end_time: 结束时间
        """
        if start_time >= end_time:
            raise ValueError("开始时间必须小于结束时间")
        
        # 检查时间范围是否有效
        data_start, data_end = self.get_time_range()
        if start_time < data_start or end_time > data_end:
            raise ValueError(f"回放窗口超出数据范围 ({data_start} - {data_end})")
        
        self.playback_window = PlaybackWindow(
            start_time=start_time,
            end_time=end_time,
            current_time=start_time,
            speed=self.speed
        )
        self.current_time = start_time
    
    def clear_playback_window(self):
        """清除回放窗口，使用完整数据范围"""
        self.playback_window = None
        
    def set_speed(self, speed: float):
        """
        设置播放速度
        
        Args:
            speed: 播放速度，1.0为正常速度
        """
        if speed <= 0:
            raise ValueError("播放速度必须大于0")
        
        self.speed = speed
        if self.playback_window:
            self.playback_window.speed = speed
    
    def _build_event_heap(self):
        """构建事件堆"""
        self.event_heap = []
        
        # 确定时间范围
        if self.playback_window:
            start_time = self.playback_window.start_time
            end_time = self.playback_window.end_time
        else:
            start_time, end_time = self.get_time_range()
        
        # 添加CAN帧事件
        for i, frame in enumerate(self.can_frames):
            if start_time <= frame.timestamp <= end_time:
                event = TimelineEvent(
                    timestamp=frame.timestamp,
                    event_type="can_frame",
                    source=f"CAN_ID_{frame.can_id}",
                    data=frame,
                    index=i
                )
                heapq.heappush(self.event_heap, event)
        
        # 添加传感器数据事件
        for i, sensor in enumerate(self.sensor_data):
            if start_time <= sensor.timestamp <= end_time:
                event = TimelineEvent(
                    timestamp=sensor.timestamp,
                    event_type="sensor_data",
                    source=sensor.sensor_id,
                    data=sensor,
                    index=i
                )
                heapq.heappush(self.event_heap, event)
        
        # 添加控制指令事件
        for i, command in enumerate(self.control_commands):
            if start_time <= command.timestamp <= end_time:
                event = TimelineEvent(
                    timestamp=command.timestamp,
                    event_type="control_command",
                    source=command.command_id,
                    data=command,
                    index=i
                )
                heapq.heappush(self.event_heap, event)
        
        self.next_event_index = 0
    
    def play(self):
        """开始播放"""
        if self.state == PlaybackState.PLAYING:
            return
        
        # 如果是停止状态，重新构建事件堆
        if self.state == PlaybackState.STOPPED:
            self._build_event_heap()
            
            # 设置当前时间
            if self.playback_window:
                self.current_time = self.playback_window.start_time
            else:
                self.current_time = self.get_time_range()[0]
        
        self.state = PlaybackState.PLAYING
        
    def pause(self):
        """暂停播放"""
        if self.state == PlaybackState.PLAYING:
            self.state = PlaybackState.PAUSED
    
    def stop(self):
        """停止播放"""
        self.state = PlaybackState.STOPPED
        self.event_heap = []
        self.next_event_index = 0
        
        # 重置当前时间
        if self.playback_window:
            self.current_time = self.playback_window.start_time
        else:
            self.current_time = self.get_time_range()[0]
    
    def step_forward(self, steps: int = 1) -> List[TimelineEvent]:
        """
        步进播放（向前）
        
        Args:
            steps: 步数
            
        Returns:
            处理的事件列表
        """
        if self.state == PlaybackState.STOPPED:
            self._build_event_heap()
        
        processed_events = []
        
        for _ in range(steps):
            if not self.event_heap:
                break
            
            # 弹出最早的事件
            event = heapq.heappop(self.event_heap)
            
            # 更新当前时间
            self.current_time = event.timestamp
            
            # 处理事件
            self._process_event(event)
            processed_events.append(event)
        
        if not self.event_heap:
            self.state = PlaybackState.STOPPED
        
        return processed_events
    
    def step_backward(self, steps: int = 1) -> List[TimelineEvent]:
        """
        步进播放（向后）
        
        Args:
            steps: 步数
            
        Returns:
            处理的事件列表（按时间倒序）
        """
        # 向后步进需要重新构建事件堆并找到当前位置之前的事件
        # 这是一个简化实现，实际项目中可能需要更复杂的处理
        
        # 保存当前状态
        current_time = self.current_time
        
        # 重新构建事件堆
        self._build_event_heap()
        
        # 找到当前时间之前的事件
        events_before = []
        temp_heap = []
        
        while self.event_heap:
            event = heapq.heappop(self.event_heap)
            if event.timestamp < current_time:
                events_before.append(event)
            else:
                heapq.heappush(temp_heap, event)
        
        # 恢复事件堆（只保留当前时间之后的事件）
        self.event_heap = temp_heap
        
        # 获取指定步数的事件
        start_index = max(0, len(events_before) - steps)
        selected_events = events_before[start_index:]
        
        # 更新当前时间
        if selected_events:
            self.current_time = selected_events[0].timestamp
        
        # 处理事件（倒序）
        processed_events = []
        for event in reversed(selected_events):
            self._process_event(event)
            processed_events.append(event)
        
        return processed_events
    
    def seek_to(self, timestamp: float):
        """
        跳转到指定时间点
        
        Args:
            timestamp: 目标时间戳
        """
        # 检查时间戳是否有效
        if self.playback_window:
            if timestamp < self.playback_window.start_time or timestamp > self.playback_window.end_time:
                raise ValueError(f"时间戳超出回放窗口范围 ({self.playback_window.start_time} - {self.playback_window.end_time})")
        else:
            start_time, end_time = self.get_time_range()
            if timestamp < start_time or timestamp > end_time:
                raise ValueError(f"时间戳超出数据范围 ({start_time} - {end_time})")
        
        # 重新构建事件堆
        self._build_event_heap()
        
        # 跳过目标时间之前的事件
        temp_heap = []
        while self.event_heap:
            event = heapq.heappop(self.event_heap)
            if event.timestamp >= timestamp:
                heapq.heappush(temp_heap, event)
        
        self.event_heap = temp_heap
        self.current_time = timestamp
        
        # 通知时间更新
        if self.on_time_update:
            self.on_time_update(self.current_time)
    
    def _process_event(self, event: TimelineEvent):
        """
        处理单个事件
        
        Args:
            event: 时间线事件
        """
        # 通知时间更新
        if self.on_time_update:
            self.on_time_update(event.timestamp)
        
        # 根据事件类型调用相应的回调
        if event.event_type == "can_frame" and self.on_can_frame:
            self.on_can_frame(event.data)
        
        elif event.event_type == "sensor_data" and self.on_sensor_data:
            self.on_sensor_data(event.data)
        
        elif event.event_type == "control_command" and self.on_control_command:
            self.on_control_command(event.data)
    
    def get_events_in_range(self, start_time: float, end_time: float) -> List[TimelineEvent]:
        """
        获取指定时间范围内的所有事件
        
        Args:
            start_time: 开始时间
            end_time: 结束时间
            
        Returns:
            事件列表（按时间排序）
        """
        events = []
        
        # 添加CAN帧事件
        for frame in self.can_frames:
            if start_time <= frame.timestamp <= end_time:
                events.append(TimelineEvent(
                    timestamp=frame.timestamp,
                    event_type="can_frame",
                    source=f"CAN_ID_{frame.can_id}",
                    data=frame
                ))
        
        # 添加传感器数据事件
        for sensor in self.sensor_data:
            if start_time <= sensor.timestamp <= end_time:
                events.append(TimelineEvent(
                    timestamp=sensor.timestamp,
                    event_type="sensor_data",
                    source=sensor.sensor_id,
                    data=sensor
                ))
        
        # 添加控制指令事件
        for command in self.control_commands:
            if start_time <= command.timestamp <= end_time:
                events.append(TimelineEvent(
                    timestamp=command.timestamp,
                    event_type="control_command",
                    source=command.command_id,
                    data=command
                ))
        
        # 按时间排序
        events.sort(key=lambda x: x.timestamp)
        
        return events
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        获取回放统计信息
        
        Returns:
            统计信息字典
        """
        time_range = self.get_time_range()
        
        return {
            "playback_state": self.state.value,
            "current_time": self.current_time,
            "speed": self.speed,
            "playback_window": {
                "start": self.playback_window.start_time if self.playback_window else None,
                "end": self.playback_window.end_time if self.playback_window else None
            },
            "data_statistics": {
                "total_can_frames": len(self.can_frames),
                "total_sensor_data": len(self.sensor_data),
                "total_control_commands": len(self.control_commands),
                "time_range": {
                    "start": time_range[0],
                    "end": time_range[1],
                    "duration": time_range[1] - time_range[0]
                }
            },
            "remaining_events": len(self.event_heap)
        }


class InteractiveReplayController:
    """交互式回放控制器"""
    
    def __init__(self, player: ReplayPlayer):
        """
        初始化交互式控制器
        
        Args:
            player: 回放器实例
        """
        self.player = player
        self.running = False
        
        # 默认回调
        self.player.on_can_frame = self._on_can_frame
        self.player.on_sensor_data = self._on_sensor_data
        self.player.on_control_command = self._on_control_command
        self.player.on_time_update = self._on_time_update
    
    def _on_can_frame(self, frame: Any):
        """处理CAN帧回调"""
        print(f"[CAN] t={frame.timestamp:.6f}s, ID=0x{frame.can_id:X}, "
              f"DLC={frame.dlc}, Data={frame.data}")
    
    def _on_sensor_data(self, sensor: Any):
        """处理传感器数据回调"""
        print(f"[SENSOR] t={sensor.timestamp:.6f}s, ID={sensor.sensor_id}, "
              f"Type={sensor.sensor_type}, Data={sensor.raw_data}")
    
    def _on_control_command(self, command: Any):
        """处理控制指令回调"""
        print(f"[COMMAND] t={command.timestamp:.6f}s, ID={command.command_id}, "
              f"Type={command.command_type}, Params={command.parameters}")
    
    def _on_time_update(self, timestamp: float):
        """处理时间更新回调"""
        # 可以在这里更新进度显示
        pass
    
    def start_interactive_mode(self):
        """启动交互式模式"""
        self.running = True
        
        print("\n=== 总线回放诊断台 - 交互式回放模式 ===")
        print("可用命令:")
        print("  play/p     - 开始/继续播放")
        print("  pause      - 暂停播放")
        print("  stop/s     - 停止播放")
        print("  step/n     - 步进播放（向前）")
        print("  back/b     - 步进播放（向后）")
        print("  seek <t>   - 跳转到指定时间（秒）")
        print("  speed <x>  - 设置播放速度（1.0为正常）")
        print("  window <s> <e> - 设置回放窗口")
        print("  status/st  - 显示当前状态")
        print("  events/e   - 显示剩余事件数量")
        print("  help/h     - 显示帮助信息")
        print("  quit/q     - 退出交互式模式")
        print("=" * 50)
        
        while self.running:
            try:
                user_input = input("\n回放控制> ").strip().lower()
                
                if not user_input:
                    continue
                
                parts = user_input.split()
                command = parts[0]
                
                if command in ["play", "p"]:
                    self.player.play()
                    print("开始播放...")
                    # 播放所有事件
                    while self.player.state == PlaybackState.PLAYING and self.player.event_heap:
                        self.player.step_forward(1)
                
                elif command == "pause":
                    self.player.pause()
                    print("已暂停")
                
                elif command in ["stop", "s"]:
                    self.player.stop()
                    print("已停止")
                
                elif command in ["step", "n"]:
                    steps = int(parts[1]) if len(parts) > 1 else 1
                    events = self.player.step_forward(steps)
                    print(f"步进播放 {len(events)} 个事件")
                
                elif command in ["back", "b"]:
                    steps = int(parts[1]) if len(parts) > 1 else 1
                    events = self.player.step_backward(steps)
                    print(f"向后步进 {len(events)} 个事件")
                
                elif command == "seek":
                    if len(parts) < 2:
                        print("用法: seek <时间戳>")
                        continue
                    try:
                        timestamp = float(parts[1])
                        self.player.seek_to(timestamp)
                        print(f"跳转到时间: {timestamp}秒")
                    except ValueError as e:
                        print(f"错误: {e}")
                
                elif command == "speed":
                    if len(parts) < 2:
                        print(f"当前播放速度: {self.player.speed}x")
                        continue
                    try:
                        speed = float(parts[1])
                        self.player.set_speed(speed)
                        print(f"设置播放速度: {speed}x")
                    except ValueError as e:
                        print(f"错误: {e}")
                
                elif command == "window":
                    if len(parts) < 3:
                        if self.player.playback_window:
                            print(f"当前回放窗口: {self.player.playback_window.start_time} - {self.player.playback_window.end_time}")
                        else:
                            print("当前无回放窗口（使用完整数据范围）")
                        continue
                    try:
                        start = float(parts[1])
                        end = float(parts[2])
                        self.player.set_playback_window(start, end)
                        print(f"设置回放窗口: {start} - {end} 秒")
                    except ValueError as e:
                        print(f"错误: {e}")
                
                elif command in ["status", "st"]:
                    stats = self.player.get_statistics()
                    print(f"\n=== 回放状态 ===")
                    print(f"状态: {stats['playback_state']}")
                    print(f"当前时间: {stats['current_time']:.6f}秒")
                    print(f"播放速度: {stats['speed']}x")
                    if stats['playback_window']['start'] is not None:
                        print(f"回放窗口: {stats['playback_window']['start']} - {stats['playback_window']['end']}")
                    print(f"剩余事件: {stats['remaining_events']}")
                    print(f"\n=== 数据统计 ===")
                    data_stats = stats['data_statistics']
                    print(f"CAN帧数量: {data_stats['total_can_frames']}")
                    print(f"传感器数据数量: {data_stats['total_sensor_data']}")
                    print(f"控制指令数量: {data_stats['total_control_commands']}")
                    print(f"数据时间范围: {data_stats['time_range']['start']:.6f} - {data_stats['time_range']['end']:.6f}")
                    print(f"数据持续时间: {data_stats['time_range']['duration']:.6f}秒")
                
                elif command in ["events", "e"]:
                    print(f"剩余事件数量: {len(self.player.event_heap)}")
                
                elif command in ["help", "h"]:
                    print("\n可用命令:")
                    print("  play/p     - 开始/继续播放")
                    print("  pause      - 暂停播放")
                    print("  stop/s     - 停止播放")
                    print("  step/n     - 步进播放（向前）")
                    print("  back/b     - 步进播放（向后）")
                    print("  seek <t>   - 跳转到指定时间（秒）")
                    print("  speed <x>  - 设置播放速度（1.0为正常）")
                    print("  window <s> <e> - 设置回放窗口")
                    print("  status/st  - 显示当前状态")
                    print("  events/e   - 显示剩余事件数量")
                    print("  help/h     - 显示帮助信息")
                    print("  quit/q     - 退出交互式模式")
                
                elif command in ["quit", "q"]:
                    self.running = False
                    print("退出交互式模式")
                
                else:
                    print(f"未知命令: {command}，输入 'help' 查看帮助")
            
            except KeyboardInterrupt:
                print("\n检测到中断，退出交互式模式")
                self.running = False
            except Exception as e:
                print(f"错误: {e}")
