"""
IO 多路复用模拟器 - 核心模拟逻辑
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Set, Tuple
from collections import defaultdict

from .models import (
    CaseConfig, Connection, Worker, IOSelectorType, TriggerMode,
    EventType, EventTimeline, SimulationResult, SimulationError
)


@dataclass
class FDState:
    """文件描述符的运行时状态"""
    fd: int
    connection: Connection
    
    # 读缓冲区状态
    read_buffer_available: int = 0
    read_buffer_total: int = 0
    
    # 边缘触发状态
    et_read_armed: bool = False  # 是否已经触发过读事件（需要新数据才会再次触发）
    
    # 已读取的数据量
    total_read: int = 0
    expected_read: int = 0  # 预期应该读取的总数据量


@dataclass
class WorkerState:
    """Worker 的运行时状态"""
    worker: Worker
    
    # 当前正在处理的 fd
    current_fd: Optional[int] = None
    
    # 处理完成时间（用于模拟处理延迟）
    busy_until_ms: int = 0
    
    # 统计
    wakeup_count: int = 0
    unnecessary_wakeups: int = 0
    actual_read_count: int = 0


class IOSimulator:
    """
    IO 多路复用模拟器
    
    模拟 select/poll/epoll 的行为差异，包括：
    - 水平触发 vs 边缘触发
    - CPU 空转和 fd 扫描成本
    - 漏读风险
    - 惊群效应
    - EPOLLEXCLUSIVE 的作用
    """
    
    def __init__(self, config: CaseConfig):
        """
        初始化模拟器
        
        Args:
            config: 测试用例配置
        """
        self.config = config
        
        # 初始化状态
        self.fd_states: Dict[int, FDState] = {}
        self.worker_states: Dict[int, WorkerState] = {}
        self.current_time_ms: int = 0
        
        # 事件时间线
        self.events: List[EventTimeline] = []
        
        # 统计数据
        self.total_wakeups: int = 0
        self.unnecessary_wakeups: int = 0
        self.cpu_spins: int = 0
        self.fd_scan_count: int = 0
        self.missed_reads: int = 0
        self.duplicate_wakeups: int = 0
        self.thundering_herd_count: int = 0
        
        # 按 fd 统计的惊群事件
        self.thundering_herd_by_fd: Dict[int, int] = defaultdict(int)
        
        # 初始化
        self._init_states()
    
    def _init_states(self):
        """初始化所有状态"""
        # 初始化连接状态
        for conn in self.config.connections:
            fd_state = FDState(
                fd=conn.fd,
                connection=conn,
                read_buffer_total=conn.read_buffer_size
            )
            # 计算预期总读取量
            fd_state.expected_read = len(conn.read_events) * conn.read_data_size
            self.fd_states[conn.fd] = fd_state
        
        # 初始化 worker 状态
        for worker in self.config.workers:
            self.worker_states[worker.id] = WorkerState(worker=worker)
    
    def run(self) -> SimulationResult:
        """
        运行模拟
        
        Returns:
            SimulationResult: 模拟结果
        """
        start_time = datetime.now()
        
        try:
            # 按时间步推进模拟
            for time_ms in range(self.config.simulation_duration_ms):
                self.current_time_ms = time_ms
                
                # 处理该时间点的数据到达
                self._process_data_arrival()
                
                # 处理 worker 完成
                self._process_worker_completion()
                
                # 触发 IO 事件检查
                self._check_io_events()
                
                # 检查是否有数据被遗漏（边缘触发特有问题）
                self._check_missed_reads()
            
            # 最终检查漏读
            self._final_missed_read_check()
            
        except Exception as e:
            raise SimulationError(f"模拟执行失败: {str(e)}") from e
        
        end_time = datetime.now()
        
        # 构建结果
        result = SimulationResult(
            case_name=self.config.name,
            selector_type=self.config.selector_type,
            trigger_mode=self.config.trigger_mode,
            events=self.events.copy(),
            total_wakeups=self.total_wakeups,
            unnecessary_wakeups=self.unnecessary_wakeups,
            cpu_spins=self.cpu_spins,
            fd_scan_count=self.fd_scan_count,
            missed_reads=self.missed_reads,
            duplicate_wakeups=self.duplicate_wakeups,
            thundering_herd_count=self.thundering_herd_count,
            start_time=start_time,
            end_time=end_time,
            duration_ms=int((end_time - start_time).total_seconds() * 1000)
        )
        
        # 填充详细统计
        for worker_id, ws in self.worker_states.items():
            result.worker_stats[worker_id] = {
                "wakeup_count": ws.wakeup_count,
                "unnecessary_wakeups": ws.unnecessary_wakeups,
                "actual_read_count": ws.actual_read_count
            }
        
        for fd, fs in self.fd_states.items():
            result.fd_stats[fd] = {
                "total_read": fs.total_read,
                "expected_read": fs.expected_read,
                "remaining_data": fs.read_buffer_available,
                "thundering_herd_count": self.thundering_herd_by_fd[fd]
            }
        
        return result
    
    def _process_data_arrival(self):
        """处理当前时间点的数据到达"""
        for conn in self.config.connections:
            if self.current_time_ms in conn.read_events:
                fd_state = self.fd_states[conn.fd]
                
                # 数据到达内核缓冲区
                new_data = conn.read_data_size
                available_space = fd_state.read_buffer_total - fd_state.read_buffer_available
                actual_added = min(new_data, available_space)
                
                if actual_added > 0:
                    fd_state.read_buffer_available += actual_added
                    
                    # 边缘触发：标记为可触发
                    if self.config.trigger_mode == TriggerMode.EDGE_TRIGGERED:
                        fd_state.et_read_armed = True
                    
                    self._add_event(
                        event_type=EventType.READ,
                        fd=conn.fd,
                        details=f"数据到达: +{actual_added} bytes, 缓冲区: {fd_state.read_buffer_available}/{fd_state.read_buffer_total}"
                    )
    
    def _process_worker_completion(self):
        """处理 worker 完成当前任务"""
        for worker_id, ws in self.worker_states.items():
            if ws.current_fd is not None and ws.busy_until_ms <= self.current_time_ms:
                fd = ws.current_fd
                ws.current_fd = None
                
                self._add_event(
                    event_type=EventType.READ,
                    fd=fd,
                    worker_id=worker_id,
                    details=f"Worker {worker_id} 完成处理 fd {fd}"
                )
    
    def _check_io_events(self):
        """检查 IO 事件并唤醒 worker"""
        if self.config.selector_type == IOSelectorType.SELECT:
            self._check_select()
        elif self.config.selector_type == IOSelectorType.POLL:
            self._check_poll()
        elif self.config.selector_type == IOSelectorType.EPOLL:
            self._check_epoll()
    
    def _check_select(self):
        """模拟 select 的行为"""
        # select 需要扫描所有 fd
        ready_fds: List[int] = []
        
        for fd, fd_state in self.fd_states.items():
            self.fd_scan_count += 1  # 每次 select 都要扫描所有 fd
            
            # 水平触发：只要有数据就触发
            if fd_state.read_buffer_available > 0:
                ready_fds.append(fd)
        
        if ready_fds:
            # select 会返回所有就绪的 fd，然后应用程序需要再次扫描
            self._wake_workers_for_fds(ready_fds, scan_all=True)
    
    def _check_poll(self):
        """模拟 poll 的行为"""
        # poll 与 select 类似，但没有 1024 限制
        ready_fds: List[int] = []
        
        for fd, fd_state in self.fd_states.items():
            self.fd_scan_count += 1  # poll 也需要扫描所有注册的 fd
            
            if fd_state.read_buffer_available > 0:
                ready_fds.append(fd)
        
        if ready_fds:
            self._wake_workers_for_fds(ready_fds, scan_all=True)
    
    def _check_epoll(self):
        """模拟 epoll 的行为"""
        # epoll 使用就绪列表，不需要扫描所有 fd
        ready_fds: List[int] = []
        
        for fd, fd_state in self.fd_states.items():
            if self.config.trigger_mode == TriggerMode.LEVEL_TRIGGERED:
                # 水平触发：只要有数据就触发
                if fd_state.read_buffer_available > 0:
                    ready_fds.append(fd)
            else:
                # 边缘触发：只有状态变化时才触发
                if fd_state.et_read_armed and fd_state.read_buffer_available > 0:
                    ready_fds.append(fd)
                    fd_state.et_read_armed = False  # 触发后重置，需要新数据才会再次触发
        
        if ready_fds:
            # epoll 只返回就绪的 fd，不需要应用程序再次扫描
            self._wake_workers_for_fds(ready_fds, scan_all=False)
    
    def _wake_workers_for_fds(self, ready_fds: List[int], scan_all: bool):
        """
        为就绪的 fd 唤醒 worker
        
        Args:
            ready_fds: 就绪的 fd 列表
            scan_all: 是否需要 worker 再次扫描所有 fd（select/poll 的特性）
        """
        idle_workers = [w for w in self.worker_states.values() if w.current_fd is None]
        
        if not idle_workers:
            return
        
        # 惊群效应模拟
        for fd in ready_fds:
            fd_state = self.fd_states[fd]
            
            # 检查是否有 worker 使用 EPOLLEXCLUSIVE
            exclusive_workers = [w for w in idle_workers if w.worker.epollexclusive]
            non_exclusive_workers = [w for w in idle_workers if not w.worker.epollexclusive]
            
            # EPOLLEXCLUSIVE：只唤醒一个 worker
            if exclusive_workers and self.config.selector_type == IOSelectorType.EPOLL:
                # 选择第一个 exclusive worker
                chosen_worker = exclusive_workers[0]
                self._wake_worker(chosen_worker, fd, fd_state, scan_all)
                idle_workers.remove(chosen_worker)
            else:
                # 没有 EPOLLEXCLUSIVE：惊群效应 - 唤醒所有 idle worker
                if len(non_exclusive_workers) > 1:
                    self.thundering_herd_count += 1
                    self.thundering_herd_by_fd[fd] += 1
                    
                    self._add_event(
                        event_type=EventType.READ,
                        fd=fd,
                        details=f"⚠️ 惊群效应: 唤醒 {len(non_exclusive_workers)} 个 worker 竞争 fd {fd}"
                    )
                
                # 所有 non-exclusive worker 都会被唤醒
                workers_to_wake = non_exclusive_workers[:]
                for worker_state in workers_to_wake:
                    self._wake_worker(worker_state, fd, fd_state, scan_all)
                    if worker_state in idle_workers:
                        idle_workers.remove(worker_state)
    
    def _wake_worker(self, worker_state: WorkerState, fd: int, fd_state: FDState, scan_all: bool):
        """
        唤醒单个 worker
        
        Args:
            worker_state: worker 状态
            fd: 目标 fd
            fd_state: fd 状态
            scan_all: 是否需要扫描所有 fd
        """
        worker = worker_state.worker
        worker_state.wakeup_count += 1
        self.total_wakeups += 1
        
        # 扫描成本模拟（select/poll 需要扫描所有 fd）
        if scan_all:
            self.fd_scan_count += len(self.fd_states)
            self.cpu_spins += 1
        
        # 检查是否能实际读取到数据
        if fd_state.read_buffer_available <= 0:
            # 不必要的唤醒（惊群中的其他 worker）
            worker_state.unnecessary_wakeups += 1
            self.unnecessary_wakeups += 1
            
            self._add_event(
                event_type=EventType.READ,
                fd=fd,
                worker_id=worker.id,
                details=f"Worker {worker.id} 被唤醒，但 fd {fd} 没有数据（惊群无效唤醒）"
            )
            return
        
        # 实际读取数据
        # worker 只能读取一部分数据（模拟非阻塞读取）
        read_amount = min(worker.read_chunk_size, fd_state.read_buffer_available)
        
        fd_state.read_buffer_available -= read_amount
        fd_state.total_read += read_amount
        worker_state.actual_read_count += 1
        
        # 模拟处理延迟
        if worker.read_delay_ms > 0:
            worker_state.current_fd = fd
            worker_state.busy_until_ms = self.current_time_ms + worker.read_delay_ms
        
        self._add_event(
            event_type=EventType.READ,
            fd=fd,
            worker_id=worker.id,
            details=f"Worker {worker.id} 读取 fd {fd}: {read_amount} bytes, 剩余: {fd_state.read_buffer_available} bytes"
        )
    
    def _check_missed_reads(self):
        """检查漏读情况（边缘触发特有）"""
        if self.config.trigger_mode != TriggerMode.EDGE_TRIGGERED:
            return
        
        for fd, fd_state in self.fd_states.items():
            # 边缘触发的问题：
            # 1. 如果缓冲区有数据，但 et_read_armed 为 False，且没有新数据到达
            # 2. worker 只读取了部分数据，但缓冲区还有剩余
            if (fd_state.read_buffer_available > 0 and 
                not fd_state.et_read_armed and
                self.current_time_ms not in fd_state.connection.read_events):
                # 这种情况可能导致漏读
                pass
    
    def _final_missed_read_check(self):
        """最终漏读检查"""
        for fd, fd_state in self.fd_states.items():
            if fd_state.total_read < fd_state.expected_read:
                missed = fd_state.expected_read - fd_state.total_read
                self.missed_reads += 1
                
                self._add_event(
                    event_type=EventType.ERROR,
                    fd=fd,
                    details=f"❌ 漏读警告: fd {fd} 预期读取 {fd_state.expected_read} bytes, 实际读取 {fd_state.total_read} bytes, 遗漏 {missed} bytes"
                )
    
    def _add_event(self, event_type: EventType, fd: int, 
                   worker_id: Optional[int] = None, details: str = ""):
        """添加事件到时间线"""
        event = EventTimeline(
            timestamp_ms=self.current_time_ms,
            event_type=event_type,
            fd=fd,
            worker_id=worker_id,
            details=details
        )
        self.events.append(event)
