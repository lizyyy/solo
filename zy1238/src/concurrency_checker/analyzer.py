"""并发方案分析器"""

import re
import json
import yaml
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum


class ConcurrencyType(Enum):
    """并发类型枚举"""
    THREADING = "threading"
    MULTIPROCESSING = "multiprocessing"
    ASYNCIO = "asyncio"
    MIXED = "mixed"
    UNKNOWN = "unknown"


class RiskLevel(Enum):
    """风险等级"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class Risk:
    """风险项"""
    category: str
    level: RiskLevel
    message: str
    suggestion: str


class CodeAnalyzer:
    """代码分析器"""

    # 多进程相关模式
    MULTIPROCESSING_PATTERNS = [
        r'\bmultiprocessing\b',
        r'\bProcess\(',
        r'\bPool\(',
        r'\bManager\(',
        r'\bQueue\(\)',
        r'\bPipe\(',
        r'\bLock\(\)',
        r'\bValue\(',
        r'\bArray\(',
    ]

    # 多线程相关模式
    THREADING_PATTERNS = [
        r'\bthreading\b',
        r'\bThread\(',
        r'\bThreadPoolExecutor\b',
        r'\bRLock\(',
        r'\bEvent\(',
        r'\bCondition\(',
        r'\bSemaphore\(',
        r'\bBarrier\(',
    ]

    # asyncio 相关模式
    ASYNCIO_PATTERNS = [
        r'\basyncio\b',
        r'\bawait\b',
        r'\basync def\b',
        r'\basync for\b',
        r'\basync with\b',
        r'\bgather\(',
        r'\bcreate_task\(',
        r'\bensure_future\(',
        r'\bas_completed\(',
        r'\bwait\(',
        r'\bwait_for\(',
    ]

    # 阻塞调用模式（在 async 中需要关注）
    BLOCKING_CALLS = [
        r'\btime\.sleep\(',
        r'\brequests\.(get|post|put|delete)',
        r'\burllib\.request\.',
        r'\bsocket\.(connect|send|recv)',
        r'\bopen\(',
        r'\bread\(\)',
        r'\bwrite\(\)',
        r'\bsubprocess\.(run|Popen|call|check_output)',
    ]

    # 共享状态相关
    SHARED_STATE_PATTERNS = [
        r'\bglobal\b',
        r'\bnonlocal\b',
        r'\bManager\(\)',
        r'\bValue\(',
        r'\bArray\(',
        r'\bLock\(',
        r'\bRLock\(',
        r'\bSemaphore\(',
        r'\bCondition\(',
        r'\bthreading\.local\b',
    ]

    # I/O 操作模式
    IO_PATTERNS = [
        r'\bopen\(',
        r'\bread\(\)',
        r'\bwrite\(\)',
        r'\brequests\.',
        r'\baiohttp\.',
        r'\bhttpx\.',
        r'\bsocket\.',
        r'\bselect\.',
        r'\bselectors\.',
        r'\basyncio\.open_connection',
        r'\basyncio\.start_server',
        r'\bDatabase\(',
        r'\bconnect\(',
        r'\bcursor\(',
        r'\bexecute\(',
    ]

    # CPU 密集操作模式
    CPU_INTENSIVE_PATTERNS = [
        r'\bfor\s+\w+\s+in\s+range',
        r'\bwhile\s+',
        r'\bmap\(',
        r'\breduce\(',
        r'\bfilter\(',
        r'\bzip\(',
        r'\b\[.+\s+for\s+.+\s+in\s+.+\]',  # 列表推导式
        r'\b(?:numpy|pandas|scipy|torch|tensorflow|keras)\.',
        r'\bmath\.(sin|cos|tan|exp|log|sqrt|pow)',
        r'\bhashlib\.',
        r'\bcryptography\.',
        r'\bjson\.loads|json\.dumps',
        r'\bre\.search|re\.match|re\.findall',
    ]

    # 进程池相关
    PROCESS_POOL_PATTERNS = [
        r'\bPool\(\)',
        r'\bProcessPoolExecutor\b',
        r'\.map\(',
        r'\.imap\(',
        r'\.starmap\(',
        r'\.apply\(',
        r'\.apply_async\(',
    ]

    # 队列和背压相关
    QUEUE_PATTERNS = [
        r'\bQueue\(',
        r'\bSimpleQueue\(',
        r'\bPriorityQueue\(',
        r'\bLifoQueue\(',
        r'\bJoinableQueue\(',
        r'\basyncio\.Queue\(',
        r'\.put\(',
        r'\.get\(',
        r'\.task_done\(',
        r'\.join\(',
    ]

    # 取消和超时相关
    CANCEL_TIMEOUT_PATTERNS = [
        r'\bcancel\(\)',
        r'\btimeout\b',
        r'\bwait_for\(',
        r'\bCancelledError\b',
        r'\bTimeoutError\b',
        r'\b.shutdown\(',
        r'\bterminate\(\)',
    ]

    def __init__(self):
        self.risks: List[Risk] = []
        self.stats: Dict[str, Any] = {
            "threading_count": 0,
            "multiprocessing_count": 0,
            "asyncio_count": 0,
            "io_patterns_count": 0,
            "cpu_patterns_count": 0,
            "shared_state_count": 0,
            "blocking_calls_count": 0,
            "process_pool_count": 0,
            "queue_count": 0,
            "cancel_timeout_count": 0,
        }

    def analyze_code(self, code: str, file_name: str = "unknown") -> Dict[str, Any]:
        """分析代码片段"""
        lines = code.split('\n')
        
        result = {
            "file_name": file_name,
            "concurrency_type": self._detect_concurrency_type(code),
            "io_intensity": 0,
            "cpu_intensity": 0,
            "risks": [],
            "patterns": [],
        }

        # 检测各类模式
        io_matches = self._count_patterns(code, self.IO_PATTERNS)
        cpu_matches = self._count_patterns(code, self.CPU_INTENSIVE_PATTERNS)
        
        self.stats["io_patterns_count"] += io_matches
        self.stats["cpu_patterns_count"] += cpu_matches

        total = io_matches + cpu_matches
        if total > 0:
            result["io_intensity"] = io_matches / total
            result["cpu_intensity"] = cpu_matches / total

        # 检测共享状态
        shared_matches = self._count_patterns(code, self.SHARED_STATE_PATTERNS)
        self.stats["shared_state_count"] += shared_matches
        if shared_matches > 0:
            result["patterns"].append("shared_state")
            self._check_shared_state_risks(code, file_name)

        # 检测进程池使用
        process_pool_matches = self._count_patterns(code, self.PROCESS_POOL_PATTERNS)
        self.stats["process_pool_count"] += process_pool_matches
        if process_pool_matches > 0:
            result["patterns"].append("process_pool")
            self._check_process_pool_risks(code, file_name)

        # 检测队列和背压
        queue_matches = self._count_patterns(code, self.QUEUE_PATTERNS)
        self.stats["queue_count"] += queue_matches
        if queue_matches > 0:
            result["patterns"].append("queue")
            self._check_queue_risks(code, file_name)

        # 检测取消和超时
        cancel_matches = self._count_patterns(code, self.CANCEL_TIMEOUT_PATTERNS)
        self.stats["cancel_timeout_count"] += cancel_matches
        if cancel_matches > 0:
            result["patterns"].append("cancel_timeout")
        else:
            # 检查是否缺少取消/超时处理
            if self._detect_concurrency_type(code) == ConcurrencyType.ASYNCIO:
                self._check_missing_cancellation(code, file_name)

        # 对于 asyncio 代码，检查阻塞调用
        if self._detect_concurrency_type(code) == ConcurrencyType.ASYNCIO:
            blocking_matches = self._count_patterns(code, self.BLOCKING_CALLS)
            self.stats["blocking_calls_count"] += blocking_matches
            if blocking_matches > 0:
                result["patterns"].append("blocking_calls")
                self._check_blocking_calls(code, file_name)

        # 统计并发类型
        concurrency_type = self._detect_concurrency_type(code)
        if concurrency_type == ConcurrencyType.THREADING:
            self.stats["threading_count"] += 1
        elif concurrency_type == ConcurrencyType.MULTIPROCESSING:
            self.stats["multiprocessing_count"] += 1
        elif concurrency_type == ConcurrencyType.ASYNCIO:
            self.stats["asyncio_count"] += 1

        result["risks"] = [r for r in self.risks if f"'{file_name}'" in r.message or file_name in r.message]
        return result

    def _detect_concurrency_type(self, code: str) -> ConcurrencyType:
        """检测代码使用的并发类型"""
        has_multiprocessing = any(re.search(p, code) for p in self.MULTIPROCESSING_PATTERNS)
        has_threading = any(re.search(p, code) for p in self.THREADING_PATTERNS)
        has_asyncio = any(re.search(p, code) for p in self.ASYNCIO_PATTERNS)

        detected = []
        if has_multiprocessing:
            detected.append(ConcurrencyType.MULTIPROCESSING)
        if has_threading:
            detected.append(ConcurrencyType.THREADING)
        if has_asyncio:
            detected.append(ConcurrencyType.ASYNCIO)

        if len(detected) > 1:
            return ConcurrencyType.MIXED
        elif len(detected) == 1:
            return detected[0]
        return ConcurrencyType.UNKNOWN

    def _count_patterns(self, code: str, patterns: List[str]) -> int:
        """统计匹配的模式数量"""
        count = 0
        for pattern in patterns:
            matches = re.findall(pattern, code)
            count += len(matches)
        return count

    def _check_shared_state_risks(self, code: str, file_name: str):
        """检查共享状态相关风险"""
        # 检查是否在多进程中使用非 Manager 的共享对象
        if re.search(r'\bmultiprocessing\b', code) and not re.search(r'\bManager\(\)', code):
            if re.search(r'\b(global|nonlocal)\b', code):
                self.risks.append(Risk(
                    category="shared_state",
                    level=RiskLevel.HIGH,
                    message=f"在多进程代码 '{file_name}' 中使用了 global/nonlocal 共享变量，进程间无法直接共享内存",
                    suggestion="使用 multiprocessing.Manager() 创建共享对象，或使用 Value/Array 等进程安全的共享类型"
                ))

        # 检查锁的使用
        if re.search(r'\bLock\(|\bRLock\(', code):
            if not re.search(r'\.release\(\)', code):
                self.risks.append(Risk(
                    category="lock_competition",
                    level=RiskLevel.CRITICAL,
                    message=f"在 '{file_name}' 中使用了锁但未看到 release() 调用，可能导致死锁",
                    suggestion="使用 context manager (with lock:) 或确保在 finally 块中调用 release()"
                ))

        # 检查过多的锁竞争
        lock_count = len(re.findall(r'\bLock\(|\bRLock\(', code))
        if lock_count >= 3:
            self.risks.append(Risk(
                category="lock_competition",
                level=RiskLevel.MEDIUM,
                message=f"在 '{file_name}' 中检测到 {lock_count} 处锁创建，可能存在锁竞争问题",
                suggestion="考虑减少锁的粒度，或使用更细粒度的同步机制"
            ))

    def _check_process_pool_risks(self, code: str, file_name: str):
        """检查进程池相关风险"""
        # 检查 pickle 问题
        if re.search(r'\bPool\(|\bProcessPoolExecutor\b', code):
            # 检查是否有无法 pickle 的对象
            if re.search(r'\blambda\s*:', code):
                self.risks.append(Risk(
                    category="pickle_ipc",
                    level=RiskLevel.HIGH,
                    message=f"在 '{file_name}' 中使用 lambda 函数，无法被 pickle 序列化，进程池会失败",
                    suggestion="定义顶层函数代替 lambda，或使用 concurrent.futures.ThreadPoolExecutor"
                ))

            # 检查是否有不可序列化的对象
            if re.search(r'\bclass\s+\w+', code) and re.search(r'\bPool\(|\bProcessPoolExecutor\b', code):
                # 简单检查：是否有实例方法传递给进程池
                if re.search(r'\.apply_async|\.map|\.submit', code):
                    self.risks.append(Risk(
                        category="pickle_ipc",
                        level=RiskLevel.MEDIUM,
                        message=f"在 '{file_name}' 中可能将实例方法传递给进程池，需要确保对象可序列化",
                        suggestion="将实例方法改为模块级函数，或使用 dill 等第三方 pickle 库"
                    ))

        # 检查 chunksize 设置
        if re.search(r'\.map\(|\.imap\(', code):
            if not re.search(r'chunksize\s*=', code):
                self.risks.append(Risk(
                    category="process_pool_chunk",
                    level=RiskLevel.LOW,
                    message=f"在 '{file_name}' 中使用 map/imap 但未设置 chunksize，默认值可能不是最优的",
                    suggestion="根据任务大小调整 chunksize：小任务使用大 chunksize，大任务使用小 chunksize"
                ))

    def _check_blocking_calls(self, code: str, file_name: str):
        """检查 asyncio 中的阻塞调用"""
        # 检查 time.sleep
        if re.search(r'\btime\.sleep\(', code):
            self.risks.append(Risk(
                category="async_blocking",
                level=RiskLevel.HIGH,
                message=f"在 asyncio 代码 '{file_name}' 中使用了 time.sleep()，会阻塞事件循环",
                suggestion="使用 asyncio.sleep() 代替 time.sleep()"
            ))

        # 检查 requests
        if re.search(r'\brequests\.(get|post|put|delete)', code):
            self.risks.append(Risk(
                category="async_blocking",
                level=RiskLevel.HIGH,
                message=f"在 asyncio 代码 '{file_name}' 中使用了 requests 库，这是阻塞的",
                suggestion="使用 aiohttp 或 httpx(AsyncClient) 等异步 HTTP 库"
            ))

        # 检查阻塞的 I/O
        if re.search(r'\bopen\(', code) and not re.search(r'\bwith\s+open\(', code):
            self.risks.append(Risk(
                category="async_blocking",
                level=RiskLevel.MEDIUM,
                message=f"在 asyncio 代码 '{file_name}' 中检测到阻塞的文件操作",
                suggestion="使用 aiofiles 库进行异步文件操作，或使用 loop.run_in_executor()"
            ))

    def _check_queue_risks(self, code: str, file_name: str):
        """检查队列和背压相关风险"""
        # 检查是否有无界队列
        if re.search(r'\bQueue\(\)', code):
            # 检查是否设置 maxsize
            if not re.search(r'Queue\(\s*maxsize\s*=', code):
                self.risks.append(Risk(
                    category="queue_backpressure",
                    level=RiskLevel.MEDIUM,
                    message=f"在 '{file_name}' 中创建了无界队列，可能导致内存耗尽",
                    suggestion="为队列设置合理的 maxsize，实现背压控制"
                ))

        # 检查是否缺少消费者
        if re.search(r'\.put\(', code) and not re.search(r'\.get\(', code):
            self.risks.append(Risk(
                category="queue_backpressure",
                level=RiskLevel.HIGH,
                message=f"在 '{file_name}' 中检测到 put() 但未检测到 get()，队列可能无限增长",
                suggestion="确保有消费者在处理队列中的消息"
            ))

    def _check_missing_cancellation(self, code: str, file_name: str):
        """检查是否缺少取消/超时处理"""
        # 检查是否有长期运行的任务但没有超时
        if re.search(r'\basyncio\.gather\(', code) or re.search(r'\bcreate_task\(', code):
            if not re.search(r'\bwait_for\(|timeout\s*=', code):
                self.risks.append(Risk(
                    category="cancel_timeout",
                    level=RiskLevel.LOW,
                    message=f"在 asyncio 代码 '{file_name}' 中创建任务但未设置超时",
                    suggestion="考虑使用 asyncio.wait_for() 设置超时，或在任务中处理 CancelledError"
                ))


class PlanAnalyzer:
    """配置计划分析器"""

    def __init__(self):
        self.code_analyzer = CodeAnalyzer()

    def analyze_plan(self, plan_file: Path, runs_file: Optional[Path] = None, 
                    snippets_dir: Optional[Path] = None) -> Dict[str, Any]:
        """分析完整的并发方案"""
        result = {
            "plan_file": str(plan_file),
            "runs_file": str(runs_file) if runs_file else None,
            "snippets_dir": str(snippets_dir) if snippets_dir else None,
            "run_count": 0,
            "snippet_count": 0,
            "concurrency_type": "unknown",
            "cpu_percent": 0.0,
            "io_percent": 0.0,
            "risk_score": 0,
            "summary": "",
            "risks": [],
            "metrics": [],
            "snippets_analysis": [],
            "runs_analysis": [],
        }

        # 读取计划文件
        with open(plan_file, 'r', encoding='utf-8') as f:
            plan = yaml.safe_load(f) or {}

        # 分析计划配置
        plan_analysis = self._analyze_plan_config(plan)
        result.update(plan_analysis)

        # 分析运行记录
        if runs_file and runs_file.exists():
            runs_analysis = self._analyze_runs_file(runs_file)
            result["runs_analysis"] = runs_analysis
            result["run_count"] = len(runs_analysis)
            
            # 从运行记录推断 CPU/I/O 占比
            if runs_analysis:
                avg_cpu = sum(r.get("cpu_usage", 0) for r in runs_analysis) / len(runs_analysis)
                avg_io = sum(r.get("io_usage", 0) for r in runs_analysis) / len(runs_analysis)
                total = avg_cpu + avg_io
                if total > 0:
                    result["cpu_percent"] = avg_cpu / total
                    result["io_percent"] = avg_io / total

        # 分析代码片段
        if snippets_dir and snippets_dir.exists():
            python_files = list(snippets_dir.glob("*.py"))
            result["snippet_count"] = len(python_files)
            
            for py_file in python_files:
                with open(py_file, 'r', encoding='utf-8') as f:
                    code = f.read()
                snippet_analysis = self.code_analyzer.analyze_code(code, py_file.name)
                result["snippets_analysis"].append(snippet_analysis)

            # 从代码分析推断 CPU/I/O 占比
            if result["snippets_analysis"]:
                total_cpu = sum(s.get("cpu_intensity", 0) for s in result["snippets_analysis"])
                total_io = sum(s.get("io_intensity", 0) for s in result["snippets_analysis"])
                total = total_cpu + total_io
                if total > 0 and result["cpu_percent"] == 0:
                    result["cpu_percent"] = total_cpu / total
                    result["io_percent"] = total_io / total

        # 收集所有风险
        result["risks"] = self.code_analyzer.risks

        # 计算风险分数
        result["risk_score"] = self._calculate_risk_score(result["risks"])

        # 生成摘要
        result["summary"] = self._generate_summary(result)

        # 生成指标
        result["metrics"] = self._generate_metrics(result, self.code_analyzer.stats)

        # 确定主要并发类型
        result["concurrency_type"] = self._determine_main_concurrency_type(
            result["snippets_analysis"],
            plan.get("concurrency_type")
        )

        return result

    def _analyze_plan_config(self, plan: Dict) -> Dict:
        """分析计划配置"""
        result = {}
        
        # 检查并发类型配置
        concurrency_type = plan.get("concurrency_type", "unknown")
        if concurrency_type not in ["threading", "multiprocessing", "asyncio", "mixed"]:
            self.code_analyzer.risks.append(Risk(
                category="configuration",
                level=RiskLevel.LOW,
                message=f"未知的并发类型配置: {concurrency_type}",
                suggestion="使用 threading, multiprocessing, asyncio 或 mixed"
            ))

        # 检查工作进程/线程数量配置
        workers = plan.get("workers")
        if workers is not None:
            if isinstance(workers, int) and workers < 1:
                self.code_analyzer.risks.append(Risk(
                    category="configuration",
                    level=RiskLevel.HIGH,
                    message=f"工作进程数量配置无效: {workers}",
                    suggestion="workers 必须大于 0"
                ))

        # 检查任务类型
        task_type = plan.get("task_type", "unknown")
        if task_type == "cpu_bound" and concurrency_type == "threading":
            self.code_analyzer.risks.append(Risk(
                category="configuration",
                level=RiskLevel.MEDIUM,
                message="CPU 密集型任务使用多线程，受 GIL 限制无法充分利用多核",
                suggestion="对于 CPU 密集型任务，建议使用 multiprocessing"
            ))

        if task_type == "io_bound" and concurrency_type == "multiprocessing":
            self.code_analyzer.risks.append(Risk(
                category="configuration",
                level=RiskLevel.LOW,
                message="I/O 密集型任务使用多进程，进程启动和 IPC 成本较高",
                suggestion="对于 I/O 密集型任务，建议使用 threading 或 asyncio"
            ))

        return result

    def _analyze_runs_file(self, runs_file: Path) -> List[Dict]:
        """分析 runs.jsonl 文件"""
        runs = []
        with open(runs_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        run = json.loads(line)
                        runs.append(run)
                        
                        # 检查运行记录中的异常
                        if run.get("error"):
                            self.code_analyzer.risks.append(Risk(
                                category="runtime",
                                level=RiskLevel.HIGH,
                                message=f"运行记录中检测到错误: {run.get('error')}",
                                suggestion="检查错误发生的上下文，修复相关代码"
                            ))
                        
                        # 检查异常高的 CPU 或内存使用
                        if run.get("cpu_usage", 0) > 90:
                            self.code_analyzer.risks.append(Risk(
                                category="performance",
                                level=RiskLevel.MEDIUM,
                                message=f"运行记录中 CPU 使用率过高: {run.get('cpu_usage')}%",
                                suggestion="考虑优化算法或增加并行度"
                            ))
                        
                        if run.get("memory_usage", 0) > 80:
                            self.code_analyzer.risks.append(Risk(
                                category="performance",
                                level=RiskLevel.MEDIUM,
                                message=f"运行记录中内存使用率过高: {run.get('memory_usage')}%",
                                suggestion="检查是否存在内存泄漏，或增加系统内存"
                            ))
                            
                    except json.JSONDecodeError:
                        self.code_analyzer.risks.append(Risk(
                            category="configuration",
                            level=RiskLevel.MEDIUM,
                            message=f"runs.jsonl 中存在无效的 JSON 行",
                            suggestion="确保每行都是有效的 JSON 对象"
                        ))
        return runs

    def _calculate_risk_score(self, risks: List[Risk]) -> int:
        """计算风险分数"""
        score = 0
        for risk in risks:
            if risk.level == RiskLevel.CRITICAL:
                score += 100
            elif risk.level == RiskLevel.HIGH:
                score += 50
            elif risk.level == RiskLevel.MEDIUM:
                score += 20
            elif risk.level == RiskLevel.LOW:
                score += 5
        return score

    def _generate_summary(self, result: Dict) -> str:
        """生成分析摘要"""
        summary_parts = []
        
        # 并发类型
        summary_parts.append(f"并发类型: {result['concurrency_type']}")
        
        # CPU/I/O 占比
        cpu_pct = round(result['cpu_percent'] * 100, 1)
        io_pct = round(result['io_percent'] * 100, 1)
        summary_parts.append(f"任务特性: CPU {cpu_pct}% / I/O {io_pct}%")
        
        # 风险评估
        risk_score = result['risk_score']
        if risk_score == 0:
            risk_level = "无风险"
        elif risk_score < 50:
            risk_level = "低风险"
        elif risk_score < 100:
            risk_level = "中等风险"
        else:
            risk_level = "高风险"
        summary_parts.append(f"风险等级: {risk_level} ({risk_score} 分)")
        
        # 统计信息
        summary_parts.append(f"运行记录: {result['run_count']} 条")
        summary_parts.append(f"代码片段: {result['snippet_count']} 个")
        
        return " | ".join(summary_parts)

    def _generate_metrics(self, result: Dict, stats: Dict) -> List[Dict]:
        """生成指标列表"""
        metrics = []
        
        # CPU/I/O 占比
        metrics.append({
            "name": "cpu_intensity",
            "value": round(result['cpu_percent'] * 100, 2),
            "unit": "%"
        })
        metrics.append({
            "name": "io_intensity",
            "value": round(result['io_percent'] * 100, 2),
            "unit": "%"
        })
        
        # 风险分数
        metrics.append({
            "name": "risk_score",
            "value": result['risk_score'],
            "unit": "points"
        })
        
        # 统计数据
        metrics.append({
            "name": "threading_count",
            "value": stats["threading_count"],
            "unit": "files"
        })
        metrics.append({
            "name": "multiprocessing_count",
            "value": stats["multiprocessing_count"],
            "unit": "files"
        })
        metrics.append({
            "name": "asyncio_count",
            "value": stats["asyncio_count"],
            "unit": "files"
        })
        metrics.append({
            "name": "shared_state_count",
            "value": stats["shared_state_count"],
            "unit": "occurrences"
        })
        metrics.append({
            "name": "blocking_calls_count",
            "value": stats["blocking_calls_count"],
            "unit": "occurrences"
        })
        metrics.append({
            "name": "process_pool_count",
            "value": stats["process_pool_count"],
            "unit": "occurrences"
        })
        metrics.append({
            "name": "queue_count",
            "value": stats["queue_count"],
            "unit": "occurrences"
        })
        
        return metrics

    def _determine_main_concurrency_type(self, snippets: List[Dict], 
                                        plan_type: Optional[str]) -> str:
        """确定主要并发类型"""
        counts = {
            "threading": 0,
            "multiprocessing": 0,
            "asyncio": 0,
            "mixed": 0,
            "unknown": 0
        }
        
        for snippet in snippets:
            ctype = snippet.get("concurrency_type", "unknown")
            if hasattr(ctype, "value"):
                ctype = ctype.value
            counts[ctype] += 1
        
        # 找到出现最多的类型
        max_count = max(counts.values())
        if max_count == 0:
            return plan_type or "unknown"
        
        main_types = [k for k, v in counts.items() if v == max_count]
        
        if len(main_types) > 1:
            return "mixed"
        return main_types[0]


def compare_analyses(analysis1: Dict, analysis2: Dict) -> Dict:
    """比较两次分析结果"""
    comparison = {
        "analysis1_id": analysis1.get("id"),
        "analysis2_id": analysis2.get("id"),
        "analysis1_timestamp": analysis1.get("timestamp"),
        "analysis2_timestamp": analysis2.get("timestamp"),
        "differences": [],
        "improvements": [],
        "regressions": [],
        "recommendation": ""
    }

    # 比较 CPU/I/O 占比
    cpu1 = analysis1.get("cpu_percent", 0)
    cpu2 = analysis2.get("cpu_percent", 0)
    io1 = analysis1.get("io_percent", 0)
    io2 = analysis2.get("io_percent", 0)
    
    if abs(cpu1 - cpu2) > 0.1:
        comparison["differences"].append({
            "metric": "cpu_percent",
            "value1": cpu1,
            "value2": cpu2,
            "change": cpu2 - cpu1
        })

    if abs(io1 - io2) > 0.1:
        comparison["differences"].append({
            "metric": "io_percent",
            "value1": io1,
            "value2": io2,
            "change": io2 - io1
        })

    # 比较风险分数
    score1 = analysis1.get("risk_score", 0)
    score2 = analysis2.get("risk_score", 0)
    
    if score2 < score1:
        comparison["improvements"].append({
            "metric": "risk_score",
            "from": score1,
            "to": score2,
            "improvement": score1 - score2
        })
    elif score2 > score1:
        comparison["regressions"].append({
            "metric": "risk_score",
            "from": score1,
            "to": score2,
            "regression": score2 - score1
        })

    # 比较并发类型
    type1 = analysis1.get("concurrency_type", "unknown")
    type2 = analysis2.get("concurrency_type", "unknown")
    if type1 != type2:
        comparison["differences"].append({
            "metric": "concurrency_type",
            "value1": type1,
            "value2": type2
        })

    # 生成推荐
    if comparison["improvements"] and not comparison["regressions"]:
        comparison["recommendation"] = "方案 2 相对于方案 1 有明显改进，建议采用方案 2"
    elif comparison["regressions"] and not comparison["improvements"]:
        comparison["recommendation"] = "方案 2 相对于方案 1 有退步，建议保持方案 1"
    elif comparison["improvements"] and comparison["regressions"]:
        comparison["recommendation"] = "两个方案各有优劣，需要根据具体场景权衡选择"
    else:
        comparison["recommendation"] = "两个方案差异不大，可以根据团队熟悉程度选择"

    return comparison