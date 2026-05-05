from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import re

from perf_trainer.incident_parser import IncidentParser
from perf_trainer.storage import Database
from perf_trainer.exceptions import InvalidStageError, SampleNotFoundError
from perf_trainer.config import Config


@dataclass
class CommandRecommendation:
    """命令推荐数据结构"""
    command: str
    description: str
    sample_file: Optional[str]
    why: str
    what_to_look_for: str
    anomaly_signs: List[str]
    stage: str


@dataclass
class AnalysisResult:
    """分析结果数据结构"""
    stage: str
    command_used: str
    sample_viewed: Optional[str]
    is_correct: bool
    feedback: str
    identified_issues: List[str]
    next_recommendations: List[CommandRecommendation]


class TroubleshootingEngine:
    """核心排障引擎"""
    
    # 各阶段的默认命令和分析逻辑
    STAGE_COMMANDS = {
        'cpu': [
            {
                'name': 'top',
                'description': '实时显示进程活动和系统资源使用情况',
                'why': '最基本的 CPU 使用情况查看工具，可以快速定位高 CPU 进程',
                'what_to_look_for': '查看 %CPU 列，寻找持续占用高 CPU 的进程',
                'anomaly_signs': [
                    '单个进程 CPU 使用率 > 80%',
                    '整体 CPU 使用率（us+sy）> 90%',
                    'wa (iowait) 持续 > 30% 可能是 IO 问题伪装',
                    'st (steal) > 10% 表示虚拟化环境中宿主机资源不足'
                ]
            },
            {
                'name': 'htop',
                'description': 'top 的增强版，交互式更好',
                'why': '更直观的进程树显示，支持鼠标操作，颜色编码更友好',
                'what_to_look_for': '按 CPU 排序，看哪些进程在顶部',
                'anomaly_signs': [
                    '进程状态持续为 R（运行中）',
                    '多线程应用的线程数异常增加',
                    'LOAD AVERAGE 持续高于 CPU 核心数'
                ]
            },
            {
                'name': 'vmstat',
                'description': '虚拟内存统计，每秒采样',
                'why': '可以看到系统整体的 CPU 状态趋势，包括上下文切换和中断',
                'what_to_look_for': 'us/sy/id/wa/st 列的变化趋势',
                'anomaly_signs': [
                    'us (用户态 CPU) > 80% 持续一段时间',
                    'sy (系统态 CPU) > 60% 可能是系统调用过多',
                    'in (中断) > 10000 每秒可能是硬件问题',
                    'cs (上下文切换) > 100000 每秒可能是进程过多'
                ]
            },
            {
                'name': 'mpstat',
                'description': '多处理器统计，显示每个 CPU 核心的使用情况',
                'why': '可以发现是否是某个特定 CPU 核心被打满，或者是整体问题',
                'what_to_look_for': '每个 CPU 核心的 %usr/%sys/%idle',
                'anomaly_signs': [
                    '某个 CPU 核心使用率持续 100%，其他正常 → 单线程应用瓶颈',
                    '所有 CPU 都高 → 真正的 CPU 密集型负载',
                    '%irq 高 → 中断风暴'
                ]
            },
            {
                'name': 'pidstat',
                'description': '按进程统计 CPU 使用情况（历史和实时）',
                'why': '可以查看某个进程的 CPU 使用历史，或实时监控特定进程',
                'what_to_look_for': '%usr/%system/%guest 的变化',
                'anomaly_signs': [
                    '某个进程 %usr 持续 > 90% → 应用层问题',
                    '%system 高 → 频繁系统调用',
                    '%wait 高 → 进程在等待 IO'
                ]
            }
        ],
        'io': [
            {
                'name': 'iostat',
                'description': '输入输出设备统计',
                'why': '查看磁盘和其他 IO 设备的使用情况、延迟、吞吐量',
                'what_to_look_for': '%util, await, svctm, r/s, w/s',
                'anomaly_signs': [
                    '%util > 90% → 磁盘饱和',
                    'await > 100ms → 磁盘响应延迟高',
                    'svctm 接近 await → 设备本身慢',
                    'r/s 或 w/s 持续在高位 → 高 IOPS 场景'
                ]
            },
            {
                'name': 'vmstat (wa)',
                'description': '通过 vmstat 看 iowait',
                'why': 'wa (iowait) 是 CPU 在等待 IO 完成的时间占比',
                'what_to_look_for': 'wa 列持续高企',
                'anomaly_signs': [
                    'wa > 30% → 系统被 IO 阻塞',
                    'us 低但 id 也低，wa 高 → 典型 IO 瓶颈'
                ]
            },
            {
                'name': 'iotop',
                'description': '实时显示进程的 IO 使用情况',
                'why': '可以定位到底是哪个进程在产生大量 IO',
                'what_to_look_for': 'DISK READ 和 DISK WRITE 列',
                'anomaly_signs': [
                    '某个进程持续读写 > 10MB/s',
                    'IO 优先级为 be/0 的进程占用大量 IO',
                    'SWAPIN 列有值 → 正在发生交换'
                ]
            },
            {
                'name': 'dstat',
                'description': '多功能系统资源统计工具',
                'why': '可以同时看 CPU、磁盘、网络、分页等多种指标',
                'what_to_look_for': 'dsk/total 和 io/total 列',
                'anomaly_signs': [
                    'dsk/read 或 dsk/writ 持续高位',
                    'io/read 或 io/writ 与磁盘活动不匹配'
                ]
            },
            {
                'name': 'lsblk / fdisk',
                'description': '查看块设备和分区信息',
                'why': '确认磁盘配置、RAID 级别、分区大小等',
                'what_to_look_for': '设备挂载点和类型',
                'anomaly_signs': [
                    '重要数据在慢介质上（如 USB 磁盘）',
                    'RAID 降级状态',
                    '分区空间不足'
                ]
            }
        ],
        'network': [
            {
                'name': 'netstat',
                'description': '网络连接、路由表、接口统计',
                'why': '查看网络连接状态、监听端口、路由配置',
                'what_to_look_for': '连接状态、Recv-Q/Send-Q',
                'anomaly_signs': [
                    'TIME_WAIT 连接数 > 10000 → 端口可能耗尽',
                    'ESTABLISHED 连接数异常波动',
                    'Recv-Q 或 Send-Q > 0 持续堆积 → 应用处理慢',
                    '大量 SYN_RECV → 可能遭受 SYN 洪水攻击'
                ]
            },
            {
                'name': 'ss',
                'description': 'socket 统计（netstat 替代）',
                'why': '更快速、更详细的 socket 信息展示',
                'what_to_look_for': '连接状态、定时器、内存使用',
                'anomaly_signs': [
                    'skmem:(r...) 接收缓冲区持续满',
                    'timer:(...) 中有很多 timewait 定时器',
                    '大量 CLOSING 状态 → 可能是 RST 包问题'
                ]
            },
            {
                'name': 'sar -n DEV',
                'description': '网络设备历史统计',
                'why': '查看网卡流量历史数据，发现峰值时段',
                'what_to_look_for': 'rxkB/s, txkB/s, %util',
                'anomaly_signs': [
                    'rxkB/s + txkB/s 接近网卡带宽上限',
                    '%util > 80% → 网络饱和',
                    'rxcmp/s 或 txcmp/s 异常 → 可能有压缩问题'
                ]
            },
            {
                'name': 'iftop',
                'description': '实时网络带宽监控',
                'why': '看到哪些连接在占用带宽',
                'what_to_look_for': '每个连接的发送/接收速率',
                'anomaly_signs': [
                    '某个连接持续打满带宽',
                    '大量小数据包但总流量很高 → 可能是攻击',
                    'TX 远大于 RX 或反之 → 单向流量异常'
                ]
            },
            {
                'name': 'tcpdump',
                'description': '网络数据包捕获分析',
                'why': '深入分析网络协议层面的问题',
                'what_to_look_for': '重传、丢包、异常标志位',
                'anomaly_signs': [
                    '大量 TCP 重传 (retransmission)',
                    'SYN 没有 ACK 响应',
                    'RST 包异常多 → 连接被重置',
                    'ICMP 不可达 → 路由或防火墙问题'
                ]
            },
            {
                'name': 'ping / mtr',
                'description': '网络连通性和延迟测试',
                'why': '检查到目标主机的网络是否通畅，定位丢包节点',
                'what_to_look_for': '丢包率、延迟变化',
                'anomaly_signs': [
                    '丢包率 > 1% → 网络质量差',
                    '延迟波动大 (jitter 高) → 网络不稳定',
                    '某个中间节点丢包 → 该节点问题'
                ]
            }
        ],
        'syscall': [
            {
                'name': 'strace',
                'description': '跟踪系统调用和信号',
                'why': '看到进程到底在做什么系统调用，耗时多少',
                'what_to_look_for': '调用频率、返回值、耗时',
                'anomaly_signs': [
                    '大量相同的系统调用循环调用',
                    '返回 -1 (错误) 但没有错误处理',
                    '某个调用耗时异常长 (> 1s)',
                    '密集的 read/write 但数据量小 → 小块 IO 低效'
                ]
            },
            {
                'name': 'ltrace',
                'description': '跟踪库函数调用',
                'why': '比 strace 更高层，看到应用层的库函数调用',
                'what_to_look_for': '库函数调用模式',
                'anomaly_signs': [
                    '相同函数被无意义地重复调用',
                    '内存分配函数 (malloc/free) 不匹配',
                    '字符串处理函数大量被调用 → 可能是解析问题'
                ]
            },
            {
                'name': 'sysctl',
                'description': '查看内核参数',
                'why': '检查系统调用相关的内核配置',
                'what_to_look_for': '各种 kernel 调优参数',
                'anomaly_signs': [
                    'file-max 太小导致打开文件数限制',
                    'pid_max 太小导致无法创建新进程',
                    'tcp_tw_recycle 在 NAT 环境下开启 → 连接问题'
                ]
            },
            {
                'name': 'lsof',
                'description': '列出打开的文件',
                'why': '看到进程打开了哪些文件、socket、管道',
                'what_to_look_for': '文件描述符数量、类型',
                'anomaly_signs': [
                    '单个进程打开 > 1000 个文件描述符',
                    '大量 deleted 状态的文件 → 文件未关闭',
                    'socket 连接数量异常'
                ]
            }
        ],
        'hot_function': [
            {
                'name': 'perf top',
                'description': '实时性能分析（类似 top 但看函数）',
                'why': '快速看到哪些函数在占用 CPU',
                'what_to_look_for': 'Overhead 高的函数',
                'anomaly_signs': [
                    '单个函数 Overhead > 30% → 热点函数',
                    '同一个函数的多个实例都在列表中',
                    '内核函数 (k) 占比过高 → 系统层问题',
                    '用户函数 (u) 占比过高 → 应用层问题'
                ]
            },
            {
                'name': 'perf record / perf report',
                'description': '记录性能数据并生成报告',
                'why': '可以记录一段时间的性能数据，事后分析',
                'what_to_look_for': '报告中的热点函数和调用链',
                'anomaly_signs': [
                    '热点函数调用路径深 → 可能是递归问题',
                    '同一个函数被多个调用路径调用',
                    'Sample 数异常集中在少数函数'
                ]
            },
            {
                'name': 'perf flamegraph',
                'description': '火焰图可视化',
                'why': '最直观的调用栈可视化方式，快速定位热点',
                'what_to_look_for': '火焰图中最宽的部分',
                'anomaly_signs': [
                    '某个函数塔很宽 → CPU 时间都花在这里',
                    '塔的高度很高 → 调用链深',
                    '相同宽度的塔反复出现 → 循环中的热点'
                ]
            },
            {
                'name': 'gdb',
                'description': 'GNU 调试器',
                'why': '可以附加到运行中的进程，查看调用栈',
                'what_to_look_for': 'backtrace 中的函数调用',
                'anomaly_signs': [
                    '程序停在某个函数不动 → 死循环',
                    'backtrace 中有意外的调用路径',
                    '很多线程在同一个函数等待'
                ]
            }
        ]
    }
    
    def __init__(self, incident_path: Path, db: Optional[Database] = None):
        self.incident_parser = IncidentParser(incident_path)
        self.incident_data = self.incident_parser.load()
        self.db = db or Database()
        self.current_session_id: Optional[int] = None
        self.current_stage_index = 0
        self.completed_stages: List[str] = []
    
    def start_session(self) -> int:
        """开始新的排障会话"""
        self.current_session_id = self.db.create_session(
            incident_path=str(self.incident_parser.incident_path),
            incident_name=self.incident_data.get('name')
        )
        self.current_stage_index = 0
        self.completed_stages = []
        return self.current_session_id
    
    def resume_session(self, session_id: int):
        """恢复已有的排障会话"""
        session = self.db.get_session(session_id)
        if not session:
            raise SampleNotFoundError(f"Session {session_id} not found")
        
        self.current_session_id = session_id
        
        # 恢复进度
        steps = self.db.get_session_steps(session_id)
        if steps:
            last_stage = steps[-1].get('stage')
            stages_order = self.get_stages_order()
            if last_stage in stages_order:
                self.current_stage_index = stages_order.index(last_stage) + 1
            
            self.completed_stages = list(set(s['stage'] for s in steps if s['is_correct']))
    
    def get_stages_order(self) -> List[str]:
        """获取阶段顺序"""
        if self.incident_data and 'stages' in self.incident_data:
            return [s['name'] for s in self.incident_data['stages']]
        return Config.TROUBLESHOOTING_STAGES
    
    def get_current_stage(self) -> Optional[str]:
        """获取当前阶段"""
        stages = self.get_stages_order()
        if self.current_stage_index < len(stages):
            return stages[self.current_stage_index]
        return None
    
    def get_command_recommendations(self, stage: str) -> List[CommandRecommendation]:
        """获取指定阶段的命令推荐"""
        if stage not in Config.TROUBLESHOOTING_STAGES:
            raise InvalidStageError(stage, Config.TROUBLESHOOTING_STAGES)
        
        # 优先使用 incident 中定义的命令
        stage_config = self.incident_parser.get_stage(stage)
        
        if stage_config and 'commands' in stage_config:
            recommendations = []
            for cmd in stage_config['commands']:
                # 从默认命令中补充信息
                default_info = {}
                for default_cmd in self.STAGE_COMMANDS.get(stage, []):
                    if default_cmd['name'] == cmd.get('name'):
                        default_info = default_cmd
                        break
                
                recommendations.append(CommandRecommendation(
                    command=cmd.get('name', ''),
                    description=cmd.get('description', default_info.get('description', '')),
                    sample_file=cmd.get('sample'),
                    why=cmd.get('why', default_info.get('why', '')),
                    what_to_look_for=cmd.get('what_to_look_for', default_info.get('what_to_look_for', '')),
                    anomaly_signs=cmd.get('anomaly_signs', default_info.get('anomaly_signs', [])),
                    stage=stage
                ))
            return recommendations
        
        # 使用默认命令
        return [
            CommandRecommendation(
                command=cmd['name'],
                description=cmd['description'],
                sample_file=None,
                why=cmd['why'],
                what_to_look_for=cmd['what_to_look_for'],
                anomaly_signs=cmd['anomaly_signs'],
                stage=stage
            )
            for cmd in self.STAGE_COMMANDS.get(stage, [])
        ]
    
    def execute_command(self, command_name: str, stage: str) -> Tuple[Optional[str], str]:
        """执行命令（实际是返回预定义的样本内容）"""
        # 查找命令对应的样本文件
        stage_config = self.incident_parser.get_stage(stage)
        sample_file = None
        
        if stage_config and 'commands' in stage_config:
            for cmd in stage_config['commands']:
                if cmd.get('name') == command_name and 'sample' in cmd:
                    sample_file = cmd['sample']
                    break
        
        # 如果没有找到样本，检查是否有默认样本
        if not sample_file:
            # 尝试查找以命令名为基准的样本
            samples = self.incident_data.get('samples', [])
            for sample in samples:
                if sample.get('type') == stage and sample.get('name') == command_name:
                    sample_file = sample.get('file')
                    break
        
        # 读取样本内容
        if sample_file:
            try:
                content = self.incident_parser.read_sample_file(sample_file)
                return sample_file, content
            except SampleNotFoundError:
                return None, f"警告: 样本文件 '{sample_file}' 不存在，显示模拟输出。\n\n" + \
                    self._generate_mock_output(command_name, stage)
        
        return None, self._generate_mock_output(command_name, stage)
    
    def _generate_mock_output(self, command_name: str, stage: str) -> str:
        """生成模拟输出"""
        # 这里可以根据命令和阶段生成更真实的模拟输出
        mock_outputs = {
            'top': """
top - 10:30:00 up 1 day,  2:30,  1 user,  load average: 4.50, 4.20, 3.80
Tasks: 120 total,   3 running, 117 sleeping,   0 stopped,   0 zombie
%Cpu(s): 75.2 us, 10.5 sy,  0.0 ni, 12.3 id,  1.5 wa,  0.3 hi,  0.2 si,  0.0 st
MiB Mem :   7859.3 total,   1234.5 free,   5234.6 used,   1390.2 buff/cache
MiB Swap:   8192.0 total,   7800.0 free,    392.0 used.   2100.3 avail Mem

  PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND
 1234 appuser   20   0  254320 156780   5678 R  85.2  19.9  12:34.56 rogue_app.py
  567 mysql     20   0 1256780 456780  34567 S  15.3   5.8  45:12.34 mysqld
  789 nginx     20   0   56780  12345   8765 S   2.1   0.2   1:23.45 nginx
""",
            'vmstat': """
procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----
 r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st
 3  1 392000 1234500  45678 1345678    0    0   123   456 1234 5678 75 10 12  1  0
 4  0 392000 1230000  45678 1349876    0    0     0     0 1567 8901 80 12  5  1  0
 3  1 392000 1225600  45680 1354321    0    0   234   789 1890 12345 78 13  7  1  0
""",
            'iostat': """
Linux 5.15.0-56-generic (server01) 	05/05/2026 	_x86_64_	(4 CPU)

avg-cpu:  %user   %nice %system %iowait  %steal   %idle
          75.20    0.00   10.50    1.50    0.00   12.30

Device            tps    kB_read/s    kB_wrtn/s    kB_dscd/s    kB_read    kB_wrtn
sda             123.45      5678.90     12345.67          0.00    9876543   23456789
sdb               2.34        12.34        56.78          0.00      12345      56789
""",
            'netstat': """
Active Internet connections (servers and established)
Proto Recv-Q Send-Q Local Address           Foreign Address         State
tcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN
tcp        0      0 0.0.0.0:80              0.0.0.0:*               LISTEN
tcp    12345      0 192.168.1.100:80       10.0.0.1:12345         ESTABLISHED
tcp        0      0 192.168.1.100:80       10.0.0.2:23456         TIME_WAIT
tcp        0      0 192.168.1.100:80       10.0.0.3:34567         TIME_WAIT
... (更多 TIME_WAIT 连接)
""",
            'strace': """
strace: Process 1234 attached
read(3, "HTTP/1.1 200 OK\\r\\n", 8192) = 18
read(3, "Content-Length: 1024\\r\\n", 8192) = 21
read(3, "\\r\\n", 8192) = 2
read(3, "<html><body>...", 8192) = 1024
write(1, "Received 1024 bytes\\n", 21) = 21
poll([{fd=3, events=POLLIN}], 1, 5000) = 1 ([{fd=3, revents=POLLIN}])
read(3, "HTTP/1.1 200 OK\\r\\n", 8192) = 18
... (循环重复)
""",
            'perf': """
Samples: 10K of event 'cycles', Event count (approx.): 5000000000
  Overhead  Command          Shared Object                  Symbol
   45.23%  rogue_app.py     python3.10                     [.] PyEval_EvalFrameEx
   23.45%  rogue_app.py     python3.10                     [.] _PyEval_EvalCodeWithName
   12.34%  rogue_app.py     libc-2.31.so                   [.] __strcmp_sse2_unaligned
    8.76%  rogue_app.py     python3.10                     [.] PyDict_GetItem
    5.67%  rogue_app.py     python3.10                     [.] PyObject_GetAttr
    4.55%  [kernel]         [k] entry_SYSCALL_64_after_hwframe
"""
        }
        
        return mock_outputs.get(command_name, f"""
# 模拟 {command_name} 输出
# (未找到实际样本文件)

# 提示: 在真实环境中运行: {command_name}
# 请根据当前阶段分析可能的问题。
""")
    
    def analyze_choice(self, stage: str, command_used: str, 
                        sample_viewed: Optional[str], 
                        user_analysis: str) -> AnalysisResult:
        """分析用户的选择并给出反馈"""
        stage_config = self.incident_parser.get_stage(stage)
        
        # 从 incident 配置中获取期望的分析
        expected_analysis = stage_config.get('expected_analysis', '') if stage_config else ''
        success_criteria = stage_config.get('success_criteria', '') if stage_config else ''
        
        # 简单的启发式分析
        is_correct = False
        feedback = []
        identified_issues = []
        
        # 检查用户是否使用了推荐的命令
        recommended_commands = self.get_command_recommendations(stage)
        recommended_names = [cmd.command for cmd in recommended_commands]
        
        if command_used in recommended_names:
            feedback.append(f"✓ 选择了合适的命令: {command_used}")
        else:
            feedback.append(f"⚠ 命令 '{command_used}' 不是此阶段的推荐命令")
            feedback.append(f"  推荐使用: {', '.join(recommended_names[:3])}...")
        
        # 简单的关键词匹配来判断分析质量
        expected_keywords = self._extract_keywords(expected_analysis)
        user_keywords = set(user_analysis.lower().split())
        
        matched = len(expected_keywords & user_keywords)
        total = len(expected_keywords)
        
        if total > 0:
            match_ratio = matched / total
            if match_ratio >= 0.5:
                is_correct = True
                feedback.append("✓ 分析方向正确，涵盖了关键点")
            elif match_ratio >= 0.25:
                feedback.append("⚠ 分析部分正确，但缺少一些关键点")
            else:
                feedback.append("✗ 分析没有命中关键点")
        else:
            # 没有配置期望分析，使用启发式
            is_correct = len(user_analysis) > 50
            if is_correct:
                feedback.append("✓ 分析内容充实")
            else:
                feedback.append("⚠ 分析过于简短，建议详细描述发现")
        
        # 添加成功标准提示
        if success_criteria:
            feedback.append(f"\n💡 此阶段成功标准: {success_criteria}")
        
        # 生成下一步推荐
        next_recommendations = []
        next_stage_index = self.get_stages_order().index(stage) + 1
        stages_order = self.get_stages_order()
        
        if next_stage_index < len(stages_order):
            next_stage = stages_order[next_stage_index]
            next_recommendations = self.get_command_recommendations(next_stage)
        
        # 记录步骤到数据库
        if self.current_session_id:
            self.db.add_step(
                session_id=self.current_session_id,
                stage=stage,
                command=command_used,
                user_choice=user_analysis[:1000] if user_analysis else None,
                is_correct=is_correct,
                feedback='\n'.join(feedback),
                sample_viewed=sample_viewed
            )
        
        return AnalysisResult(
            stage=stage,
            command_used=command_used,
            sample_viewed=sample_viewed,
            is_correct=is_correct,
            feedback='\n'.join(feedback),
            identified_issues=identified_issues,
            next_recommendations=next_recommendations
        )
    
    def _extract_keywords(self, text: str) -> set:
        """从文本中提取关键词"""
        # 简单的关键词提取，可以用更复杂的 NLP 方法
        stopwords = {'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
                     'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'but', 'with',
                     '可以', '应该', '可能', '的', '是', '在', '有', '和', '或', '但',
                     '中', '上', '下', '高', '低', '多', '少', '大', '小', '使用', '查看'}
        
        words = set(text.lower().replace(',', ' ').replace('.', ' ').replace(';', ' ').split())
        return words - stopwords
    
    def complete_session(self, notes: str = None):
        """完成排障会话"""
        if self.current_session_id:
            self.db.update_session_status(
                self.current_session_id,
                status='completed',
                notes=notes
            )
