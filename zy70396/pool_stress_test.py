#!/usr/bin/env python3
"""
数据库连接池压测 CLI 工具

功能：
- run: 运行压测
- compare: 比较两次压测结果
- explain-timeout: 分析超时原因
- export: 导出报告

支持：
- 模拟连接池耗尽
- 慢查询比例配置
- 中断后保存部分结果
- 报告不覆盖历史
"""

import argparse
import json
import os
import signal
import sys
import time
import threading
import queue
import random
import statistics
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import List, Dict, Optional, Any
from pathlib import Path


REPORTS_DIR = Path("./pool_stress_reports")


@dataclass
class PoolConfig:
    max_connections: int = 10
    queue_timeout: float = 30.0
    connection_timeout: float = 5.0


@dataclass
class StressConfig:
    concurrency: int = 50
    slow_query_ratio: float = 0.0
    slow_query_ms: int = 2000
    normal_query_ms: int = 50
    duration: int = 60
    requests_per_sec: int = 100
    pool_config: PoolConfig = field(default_factory=PoolConfig)


@dataclass
class Connection:
    id: int
    in_use: bool = False
    used_by: Optional[int] = None
    acquired_at: Optional[float] = None


class MockConnectionPool:
    def __init__(self, config: PoolConfig):
        self.config = config
        self.connections: List[Connection] = []
        self.lock = threading.Lock()
        self.wait_queue: List[Dict] = []
        self._pool_snapshots: List[Dict] = []
        self._snapshot_lock = threading.Lock()
        
        for i in range(config.max_connections):
            self.connections.append(Connection(id=i))
        
        self._start_snapshot_thread()
    
    def _start_snapshot_thread(self):
        self._snapshot_stop = threading.Event()
        self._snapshot_thread = threading.Thread(target=self._snapshot_worker, daemon=True)
        self._snapshot_thread.start()
    
    def _snapshot_worker(self):
        while not self._snapshot_stop.is_set():
            with self._snapshot_lock:
                active = sum(1 for c in self.connections if c.in_use)
                waiting = len(self.wait_queue)
                self._pool_snapshots.append({
                    "timestamp": time.time(),
                    "active_connections": active,
                    "waiting_requests": waiting,
                    "free_connections": self.config.max_connections - active
                })
            time.sleep(0.1)
    
    def stop_snapshot(self):
        self._snapshot_stop.set()
        self._snapshot_thread.join(timeout=1.0)
    
    def get_pool_snapshots(self) -> List[Dict]:
        with self._snapshot_lock:
            return list(self._pool_snapshots)
    
    def acquire(self, request_id: int) -> Optional[Connection]:
        start_time = time.time()
        queued = False
        
        while True:
            elapsed = time.time() - start_time
            if elapsed >= self.config.queue_timeout:
                if queued:
                    with self.lock:
                        try:
                            self.wait_queue.remove({"id": request_id, "time": start_time})
                        except ValueError:
                            pass
                return None
            
            with self.lock:
                for conn in self.connections:
                    if not conn.in_use:
                        conn.in_use = True
                        conn.used_by = request_id
                        conn.acquired_at = time.time()
                        if queued:
                            try:
                                self.wait_queue.remove({"id": request_id, "time": start_time})
                            except ValueError:
                                pass
                        return conn
                
                if not queued:
                    self.wait_queue.append({"id": request_id, "time": start_time})
                    queued = True
            
            time.sleep(0.01)
    
    def release(self, conn: Connection):
        with self.lock:
            conn.in_use = False
            conn.used_by = None
            conn.acquired_at = None


@dataclass
class RequestResult:
    request_id: int
    success: bool
    wait_time_ms: float
    query_time_ms: float
    is_slow: bool
    timeout: bool
    error: Optional[str] = None
    timestamp: float = field(default_factory=time.time)


class StressTestEngine:
    def __init__(self, config: StressConfig):
        self.config = config
        self.pool = MockConnectionPool(config.pool_config)
        self.results: List[RequestResult] = []
        self.results_lock = threading.Lock()
        self.stop_flag = threading.Event()
        self.request_counter = 0
        self.counter_lock = threading.Lock()
    
    def _execute_request(self, request_id: int):
        is_slow = random.random() < self.config.slow_query_ratio
        query_ms = self.config.slow_query_ms if is_slow else self.config.normal_query_ms
        
        acquire_start = time.time()
        conn = self.pool.acquire(request_id)
        wait_time_ms = (time.time() - acquire_start) * 1000
        
        if conn is None:
            result = RequestResult(
                request_id=request_id,
                success=False,
                wait_time_ms=wait_time_ms,
                query_time_ms=0,
                is_slow=is_slow,
                timeout=True,
                error="Connection queue timeout"
            )
        else:
            try:
                time.sleep(query_ms / 1000.0)
                result = RequestResult(
                    request_id=request_id,
                    success=True,
                    wait_time_ms=wait_time_ms,
                    query_time_ms=query_ms,
                    is_slow=is_slow,
                    timeout=False
                )
            finally:
                self.pool.release(conn)
        
        with self.results_lock:
            self.results.append(result)
    
    def _request_generator(self):
        interval = 1.0 / self.config.requests_per_sec
        while not self.stop_flag.is_set():
            with self.counter_lock:
                request_id = self.request_counter
                self.request_counter += 1
            
            t = threading.Thread(target=self._execute_request, args=(request_id,), daemon=True)
            t.start()
            time.sleep(interval)
    
    def run(self) -> Dict[str, Any]:
        start_time = time.time()
        end_time = start_time + self.config.duration
        
        gen_thread = threading.Thread(target=self._request_generator, daemon=True)
        gen_thread.start()
        
        print(f"开始压测... 时长: {self.config.duration}秒")
        
        while time.time() < end_time and not self.stop_flag.is_set():
            time.sleep(0.5)
        
        self.stop_flag.set()
        self.pool.stop_snapshot()
        
        time.sleep(0.5)
        
        return self._generate_report(start_time, time.time())
    
    def stop(self):
        self.stop_flag.set()
    
    def _generate_report(self, start_time: float, end_time: float) -> Dict[str, Any]:
        snapshots = self.pool.get_pool_snapshots()
        
        successful = [r for r in self.results if r.success]
        failed = [r for r in self.results if not r.success]
        timeouts = [r for r in self.results if r.timeout]
        
        wait_times = [r.wait_time_ms for r in self.results]
        query_times = [r.query_time_ms for r in successful]
        
        report = {
            "config": {
                "max_connections": self.config.pool_config.max_connections,
                "queue_timeout_sec": self.config.pool_config.queue_timeout,
                "connection_timeout_sec": self.config.pool_config.connection_timeout,
                "concurrency_simulated": self.config.requests_per_sec,
                "slow_query_ratio": self.config.slow_query_ratio,
                "slow_query_ms": self.config.slow_query_ms,
                "normal_query_ms": self.config.normal_query_ms,
                "duration_sec": self.config.duration,
                "actual_duration_sec": end_time - start_time
            },
            "summary": {
                "total_requests": len(self.results),
                "successful": len(successful),
                "failed": len(failed),
                "timeouts": len(timeouts),
                "success_rate": len(successful) / len(self.results) * 100 if self.results else 0.0,
                "slow_queries_executed": sum(1 for r in successful if r.is_slow),
                "interrupted": self.stop_flag.is_set() and (end_time - start_time < self.config.duration)
            },
            "wait_time_stats": {
                "min_ms": min(wait_times) if wait_times else 0,
                "max_ms": max(wait_times) if wait_times else 0,
                "avg_ms": statistics.mean(wait_times) if wait_times else 0,
                "median_ms": statistics.median(wait_times) if wait_times else 0,
                "p95_ms": self._percentile(wait_times, 95) if wait_times else 0,
                "p99_ms": self._percentile(wait_times, 99) if wait_times else 0
            },
            "pool_snapshots": snapshots[-100:],
            "timeout_analysis": self._analyze_timeouts(timeouts, snapshots)
        }
        
        return report
    
    def _percentile(self, data: List[float], p: int) -> float:
        if not data:
            return 0.0
        sorted_data = sorted(data)
        k = (len(sorted_data) - 1) * (p / 100.0)
        f = int(k)
        c = f + 1 if f + 1 < len(sorted_data) else f
        return sorted_data[f] + (sorted_data[c] - sorted_data[f]) * (k - f)
    
    def _analyze_timeouts(self, timeouts: List[RequestResult], snapshots: List[Dict]) -> Dict[str, Any]:
        if not timeouts:
            return {"has_timeouts": False}
        
        active_during_timeout = []
        waiting_during_timeout = []
        
        for t in timeouts:
            for snap in snapshots:
                if abs(snap["timestamp"] - t.timestamp) < 0.5:
                    active_during_timeout.append(snap["active_connections"])
                    waiting_during_timeout.append(snap["waiting_requests"])
                    break
        
        return {
            "has_timeouts": True,
            "timeout_count": len(timeouts),
            "avg_active_connections_when_timeout": statistics.mean(active_during_timeout) if active_during_timeout else 0,
            "avg_waiting_when_timeout": statistics.mean(waiting_during_timeout) if waiting_during_timeout else 0,
            "likely_cause": self._determine_cause(timeouts, snapshots)
        }
    
    def _determine_cause(self, timeouts: List[RequestResult], snapshots: List[Dict]) -> str:
        if not snapshots:
            return "无法确定"
        
        max_active = max(s["active_connections"] for s in snapshots)
        max_waiting = max(s["waiting_requests"] for s in snapshots)
        
        if self.config.slow_query_ratio > 0.1:
            if max_active >= self.config.pool_config.max_connections * 0.9:
                return "慢查询占用连接导致连接池耗尽，请求排队超时"
            return "慢查询导致连接释放缓慢"
        
        if max_active >= self.config.pool_config.max_connections:
            return "高并发导致连接池耗尽，需要增加最大连接数"
        
        if max_waiting > 0:
            return "请求到达速度超过连接处理能力，队列积压"
        
        return "连接获取超时，建议检查队列超时配置"


def ensure_reports_dir():
    REPORTS_DIR.mkdir(exist_ok=True)


def save_report(report: Dict[str, Any], label: Optional[str] = None) -> str:
    ensure_reports_dir()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename_parts = ["pool_stress", timestamp]
    if label:
        filename_parts.append(label)
    if report.get("summary", {}).get("interrupted", False):
        filename_parts.append("INCOMPLETE")
    filename = "_".join(filename_parts) + ".json"
    filepath = REPORTS_DIR / filename
    
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    
    return str(filepath)


def load_report(filepath: str) -> Dict[str, Any]:
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def list_reports() -> List[Path]:
    ensure_reports_dir()
    return sorted(REPORTS_DIR.glob("pool_stress_*.json"))


def print_report(report: Dict[str, Any], show_timeouts: bool = False):
    config = report["config"]
    summary = report["summary"]
    wait_stats = report["wait_time_stats"]
    
    print("\n" + "=" * 60)
    print("数据库连接池压测报告")
    print("=" * 60)
    
    if summary.get("interrupted", False):
        print("\n⚠️  警告：本次压测被中断，结果为部分数据，不适合作为正式结论")
    
    print("\n【配置参数】")
    print(f"  最大连接数: {config['max_connections']}")
    print(f"  队列超时: {config['queue_timeout_sec']}秒")
    print(f"  请求频率: {config['concurrency_simulated']}/秒")
    print(f"  慢查询比例: {config['slow_query_ratio']*100:.1f}%")
    print(f"  慢查询耗时: {config['slow_query_ms']}ms")
    print(f"  普通查询耗时: {config['normal_query_ms']}ms")
    print(f"  测试时长: {config['duration_sec']}秒")
    
    print("\n【执行摘要】")
    print(f"  总请求数: {summary['total_requests']}")
    print(f"  成功: {summary['successful']}")
    print(f"  失败: {summary['failed']}")
    print(f"  超时: {summary['timeouts']}")
    print(f"  成功率: {summary['success_rate']:.2f}%")
    
    print("\n【等待时间统计】")
    print(f"  最小: {wait_stats['min_ms']:.2f}ms")
    print(f"  最大: {wait_stats['max_ms']:.2f}ms")
    print(f"  平均: {wait_stats['avg_ms']:.2f}ms")
    print(f"  中位: {wait_stats['median_ms']:.2f}ms")
    print(f"  P95: {wait_stats['p95_ms']:.2f}ms")
    print(f"  P99: {wait_stats['p99_ms']:.2f}ms")
    
    if show_timeouts and report.get("timeout_analysis", {}).get("has_timeouts", False):
        ta = report["timeout_analysis"]
        print("\n【超时分析】")
        print(f"  超时数量: {ta['timeout_count']}")
        print(f"  超时时平均活跃连接: {ta['avg_active_connections_when_timeout']:.1f}")
        print(f"  超时时平均等待请求: {ta['avg_waiting_when_timeout']:.1f}")
        print(f"  可能原因: {ta['likely_cause']}")
    
    print("\n" + "=" * 60)


def compare_reports(report1: Dict[str, Any], report2: Dict[str, Any]):
    print("\n" + "=" * 80)
    print("压测报告对比分析")
    print("=" * 80)
    
    c1, c2 = report1["config"], report2["config"]
    s1, s2 = report1["summary"], report2["summary"]
    w1, w2 = report1["wait_time_stats"], report2["wait_time_stats"]
    
    print("\n【配置差异】")
    config_diff = []
    for key in ["max_connections", "queue_timeout_sec", "concurrency_simulated", 
                "slow_query_ratio", "slow_query_ms", "normal_query_ms", "duration_sec"]:
        v1, v2 = c1[key], c2[key]
        if v1 != v2:
            config_diff.append(f"  {key}: {v1} -> {v2}")
    
    if config_diff:
        for d in config_diff:
            print(d)
    else:
        print("  配置完全相同")
    
    print("\n【关键指标对比】")
    
    def fmt_diff(old: float, new: float, is_better_when_lower: bool = True, suffix: str = ""):
        if old == 0:
            return f"{new:.2f}{suffix}"
        diff_pct = (new - old) / old * 100
        arrow = "↓" if (diff_pct < 0 and is_better_when_lower) or (diff_pct > 0 and not is_better_when_lower) else "↑"
        return f"{new:.2f}{suffix} ({arrow}{abs(diff_pct):.1f}%)"
    
    print(f"  成功率: {s1['success_rate']:.2f}% -> {fmt_diff(s1['success_rate'], s2['success_rate'], False, '%')}")
    print(f"  超时数: {s1['timeouts']} -> {fmt_diff(s1['timeouts'], s2['timeouts'], True)}")
    print(f"  平均等待: {w1['avg_ms']:.2f}ms -> {fmt_diff(w1['avg_ms'], w2['avg_ms'], True, 'ms')}")
    print(f"  P95等待: {w1['p95_ms']:.2f}ms -> {fmt_diff(w1['p95_ms'], w2['p95_ms'], True, 'ms')}")
    print(f"  P99等待: {w1['p99_ms']:.2f}ms -> {fmt_diff(w1['p99_ms'], w2['p99_ms'], True, 'ms')}")
    
    interrupted1 = s1.get("interrupted", False)
    interrupted2 = s2.get("interrupted", False)
    if interrupted1 or interrupted2:
        print("\n⚠️  注意：以下报告为部分结果，不适合正式结论:")
        if interrupted1:
            print("   - 报告1（被中断）")
        if interrupted2:
            print("   - 报告2（被中断）")
    
    print("\n【建议】")
    if c2["max_connections"] > c1["max_connections"]:
        if w2["avg_ms"] < w1["avg_ms"] and s2["success_rate"] > s1["success_rate"]:
            print("  ✓ 增加连接数后，等待时间下降，成功率提升，效果显著！")
        elif w2["avg_ms"] < w1["avg_ms"]:
            print("  ✓ 增加连接数后，等待时间有所改善")
        else:
            print("  ? 增加连接数后效果不明显，可能瓶颈不在连接池")
    elif c1["slow_query_ratio"] != c2["slow_query_ratio"]:
        if c2["slow_query_ratio"] < c1["slow_query_ratio"]:
            print("  ✓ 降低慢查询比例后，系统表现改善")
    
    print("\n" + "=" * 80)


def export_report(report: Dict[str, Any], output_path: str, format: str = "json"):
    if format == "json":
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        print(f"报告已导出到: {output_path}")
    elif format == "txt":
        lines = []
        lines.append("=" * 60)
        lines.append("数据库连接池压测报告")
        lines.append("=" * 60)
        
        config = report["config"]
        summary = report["summary"]
        wait_stats = report["wait_time_stats"]
        
        if summary.get("interrupted", False):
            lines.append("\n警告: 本次压测被中断，结果为部分数据，不适合作为正式结论")
        
        lines.append("\n【配置参数】")
        lines.append(f"  最大连接数: {config['max_connections']}")
        lines.append(f"  队列超时: {config['queue_timeout_sec']}秒")
        lines.append(f"  请求频率: {config['concurrency_simulated']}/秒")
        lines.append(f"  慢查询比例: {config['slow_query_ratio']*100:.1f}%")
        
        lines.append("\n【执行摘要】")
        lines.append(f"  总请求数: {summary['total_requests']}")
        lines.append(f"  成功: {summary['successful']}")
        lines.append(f"  失败: {summary['failed']}")
        lines.append(f"  超时: {summary['timeouts']}")
        lines.append(f"  成功率: {summary['success_rate']:.2f}%")
        
        lines.append("\n【等待时间统计】")
        lines.append(f"  平均: {wait_stats['avg_ms']:.2f}ms")
        lines.append(f"  P95: {wait_stats['p95_ms']:.2f}ms")
        lines.append(f"  P99: {wait_stats['p99_ms']:.2f}ms")
        
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        print(f"报告已导出到: {output_path}")


def cmd_run(args):
    if args.max_connections < 1:
        print("错误: 最大连接数必须 >= 1")
        return 1
    if args.concurrency < 1:
        print("错误: 并发数必须 >= 1")
        return 1
    if args.slow_ratio < 0 or args.slow_ratio > 1:
        print("错误: 慢查询比例必须在 0-1 之间")
        return 1
    if args.timeout < 1:
        print("错误: 超时时间必须 >= 1秒")
        return 1
    if args.duration < 1:
        print("错误: 测试时长必须 >= 1秒")
        return 1
    
    pool_config = PoolConfig(
        max_connections=args.max_connections,
        queue_timeout=args.timeout
    )
    
    stress_config = StressConfig(
        concurrency=args.concurrency,
        slow_query_ratio=args.slow_ratio,
        slow_query_ms=args.slow_ms,
        normal_query_ms=args.normal_ms,
        duration=args.duration,
        requests_per_sec=args.concurrency,
        pool_config=pool_config
    )
    
    engine = StressTestEngine(stress_config)
    
    def signal_handler(sig, frame):
        print("\n检测到中断信号，正在停止压测并保存部分结果...")
        engine.stop()
    
    signal.signal(signal.SIGINT, signal_handler)
    
    try:
        report = engine.run()
        filepath = save_report(report, args.label)
        print_report(report, show_timeouts=True)
        print(f"\n报告已保存: {filepath}")
        return 0
    except Exception as e:
        print(f"压测出错: {e}")
        return 1


def cmd_compare(args):
    reports = list_reports()
    
    if len(reports) < 2:
        print("错误: 至少需要2份报告才能比较")
        print(f"当前报告数量: {len(reports)}")
        print("请先运行 'run' 命令生成报告")
        return 1
    
    if args.report1 and args.report2:
        r1 = load_report(args.report1)
        r2 = load_report(args.report2)
    else:
        if len(reports) >= 2:
            r1 = load_report(str(reports[-2]))
            r2 = load_report(str(reports[-1]))
            print(f"比较最近两份报告:")
            print(f"  报告1: {reports[-2].name}")
            print(f"  报告2: {reports[-1].name}")
        else:
            return 1
    
    compare_reports(r1, r2)
    return 0


def cmd_explain_timeout(args):
    if args.report:
        report = load_report(args.report)
    else:
        reports = list_reports()
        if not reports:
            print("没有找到报告，请先运行压测")
            return 1
        report = load_report(str(reports[-1]))
    
    ta = report.get("timeout_analysis", {})
    
    print("\n" + "=" * 60)
    print("超时原因分析")
    print("=" * 60)
    
    if not ta.get("has_timeouts", False):
        print("\n✓ 本次压测没有超时")
        print("连接池配置看起来足够应对当前负载")
        return 0
    
    config = report["config"]
    
    print(f"\n【基本信息】")
    print(f"  最大连接数: {config['max_connections']}")
    print(f"  队列超时: {config['queue_timeout_sec']}秒")
    print(f"  并发请求: {config['concurrency_simulated']}/秒")
    print(f"  慢查询比例: {config['slow_query_ratio']*100:.1f}%")
    print(f"  超时总数: {ta['timeout_count']}")
    
    print(f"\n【超时时的连接池状态】")
    print(f"  平均活跃连接: {ta['avg_active_connections_when_timeout']:.1f} / {config['max_connections']}")
    print(f"  平均等待队列: {ta['avg_waiting_when_timeout']:.1f}")
    
    print(f"\n【原因分析】")
    cause = ta.get("likely_cause", "未知")
    print(f"  {cause}")
    
    print(f"\n【建议方案】")
    if "慢查询" in cause:
        print("  1. 优化慢查询，减少查询执行时间")
        print("  2. 增加最大连接数以容纳被慢查询占用的连接")
        print("  3. 考虑读写分离，慢查询走从库")
    elif "连接池耗尽" in cause:
        print("  1. 增加最大连接数 (max_connections)")
        print("  2. 检查是否有连接泄漏（应用层未正确释放）")
        print("  3. 考虑增加队列超时时间")
    elif "队列积压" in cause:
        print("  1. 增加应用层限流")
        print("  2. 增加连接数或优化查询")
        print("  3. 增加队列超时时间给请求更多等待机会")
    else:
        print("  1. 检查数据库服务器负载")
        print("  2. 检查网络连接稳定性")
    
    print("\n" + "=" * 60)
    return 0


def cmd_export(args):
    if args.report:
        report = load_report(args.report)
    else:
        reports = list_reports()
        if not reports:
            print("没有找到报告")
            return 1
        report = load_report(str(reports[-1]))
    
    output = args.output
    if not output:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output = f"pool_report_{timestamp}.{args.format}"
    
    export_report(report, output, args.format)
    return 0


def main():
    parser = argparse.ArgumentParser(
        description="数据库连接池压测 CLI 工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 低并发正常场景
  python pool_stress_test.py run --max-connections 20 --concurrency 10 --duration 10 --label low-conn
  
  # 高并发排队场景
  python pool_stress_test.py run --max-connections 5 --concurrency 50 --duration 10 --label high-conn
  
  # 慢查询引发超时
  python pool_stress_test.py run --max-connections 10 --concurrency 30 --slow-ratio 0.3 --slow-ms 3000 --timeout 5 --duration 15 --label slow-query
  
  # 比较最近两次报告
  python pool_stress_test.py compare
  
  # 分析超时原因
  python pool_stress_test.py explain-timeout
  
  # 导出报告
  python pool_stress_test.py export --format txt --output report.txt
        """
    )
    
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    run_parser = subparsers.add_parser("run", help="运行压测")
    run_parser.add_argument("--max-connections", type=int, default=10, help="最大连接数 (默认: 10)")
    run_parser.add_argument("--concurrency", type=int, default=20, help="每秒请求数 (默认: 20)")
    run_parser.add_argument("--slow-ratio", type=float, default=0.0, help="慢查询比例 0-1 (默认: 0)")
    run_parser.add_argument("--slow-ms", type=int, default=2000, help="慢查询耗时ms (默认: 2000)")
    run_parser.add_argument("--normal-ms", type=int, default=50, help="普通查询耗时ms (默认: 50)")
    run_parser.add_argument("--timeout", type=float, default=30.0, help="队列超时秒 (默认: 30)")
    run_parser.add_argument("--duration", type=int, default=60, help="测试时长秒 (默认: 60)")
    run_parser.add_argument("--label", type=str, default=None, help="报告标签")
    
    compare_parser = subparsers.add_parser("compare", help="比较报告")
    compare_parser.add_argument("report1", nargs="?", help="报告1路径")
    compare_parser.add_argument("report2", nargs="?", help="报告2路径")
    
    explain_parser = subparsers.add_parser("explain-timeout", help="分析超时原因")
    explain_parser.add_argument("report", nargs="?", help="报告路径（默认最新）")
    
    export_parser = subparsers.add_parser("export", help="导出报告")
    export_parser.add_argument("report", nargs="?", help="报告路径（默认最新）")
    export_parser.add_argument("--format", choices=["json", "txt"], default="json", help="导出格式")
    export_parser.add_argument("--output", "-o", help="输出文件路径")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 0
    
    if args.command == "run":
        return cmd_run(args)
    elif args.command == "compare":
        return cmd_compare(args)
    elif args.command == "explain-timeout":
        return cmd_explain_timeout(args)
    elif args.command == "export":
        return cmd_export(args)


if __name__ == "__main__":
    sys.exit(main())
