"""
结果分析器 - 分析模拟结果并生成报告
"""
from typing import Dict, List, Any
from .models import (
    SimulationResult, AnalysisResult, IOSelectorType, TriggerMode
)


class ResultAnalyzer:
    """
    结果分析器
    
    分析模拟结果，包括：
    - CPU 效率分析（空转、扫描成本）
    - 漏读风险分析
    - 惊群效应分析
    - 对比分析
    """
    
    def analyze(self, result: SimulationResult) -> AnalysisResult:
        """
        分析模拟结果
        
        Args:
            result: 模拟结果
            
        Returns:
            AnalysisResult: 分析结果
        """
        # CPU 效率分析
        cpu_score = self._calculate_cpu_score(result)
        cpu_spin_analysis = self._analyze_cpu_spins(result)
        wakeup_analysis = self._analyze_wakeups(result)
        
        # 漏读风险分析
        missed_risk, missed_suggestions = self._analyze_missed_reads(result)
        
        # 惊群分析
        herd_analysis, herd_suggestions = self._analyze_thundering_herd(result)
        
        # 对比分析
        comparison_notes = self._generate_comparison_notes(result)
        
        # 总体评价
        overall_rating = self._determine_rating(result)
        summary = self._generate_summary(result, overall_rating)
        
        return AnalysisResult(
            case_name=result.case_name,
            selector_type=result.selector_type.value,
            trigger_mode=result.trigger_mode.value,
            cpu_efficiency_score=cpu_score,
            cpu_spin_analysis=cpu_spin_analysis,
            unnecessary_wakeup_analysis=wakeup_analysis,
            missed_read_risk=missed_risk,
            missed_read_suggestions=missed_suggestions,
            thundering_herd_analysis=herd_analysis,
            thundering_herd_suggestions=herd_suggestions,
            comparison_notes=comparison_notes,
            overall_rating=overall_rating,
            summary=summary
        )
    
    def _calculate_cpu_score(self, result: SimulationResult) -> float:
        """
        计算 CPU 效率分数 (0-100)
        """
        score = 100.0
        
        # 扣除 fd 扫描成本
        if result.fd_scan_count > 0:
            scan_penalty = min(result.fd_scan_count * 0.01, 30.0)
            score -= scan_penalty
        
        # 扣除不必要的唤醒（惊群）
        if result.total_wakeups > 0:
            unnecessary_ratio = result.unnecessary_wakeups / result.total_wakeups
            wakeup_penalty = unnecessary_ratio * 40.0
            score -= wakeup_penalty
        
        # 扣除 CPU 空转
        spin_penalty = min(result.cpu_spins * 0.5, 20.0)
        score -= spin_penalty
        
        return max(0.0, score)
    
    def _analyze_cpu_spins(self, result: SimulationResult) -> str:
        """
        分析 CPU 空转情况
        """
        if result.cpu_spins == 0 and result.fd_scan_count == 0:
            return "✅ 无 CPU 空转，效率优秀"
        
        analysis_parts = []
        
        if result.selector_type in [IOSelectorType.SELECT, IOSelectorType.POLL]:
            analysis_parts.append(
                f"⚠️ {result.selector_type.value.upper()} 需要每次扫描所有注册的 fd"
            )
            analysis_parts.append(
                f"   总扫描次数: {result.fd_scan_count} 次"
            )
            analysis_parts.append(
                "   💡 原因: select/poll 采用 '每次全量扫描' 模式，没有内核就绪列表"
            )
        else:
            if result.fd_scan_count > 0:
                analysis_parts.append(
                    f"⚠️ epoll 本应无扫描成本，但本次有 {result.fd_scan_count} 次扫描"
                )
        
        if result.cpu_spins > 0:
            analysis_parts.append(
                f"⚠️ CPU 空转次数: {result.cpu_spins} 次"
            )
            analysis_parts.append(
                "   💡 空转通常是因为 select/poll 返回后应用程序需要再次扫描所有 fd"
            )
        
        return "\n".join(analysis_parts) if analysis_parts else "✅ CPU 效率良好"
    
    def _analyze_wakeups(self, result: SimulationResult) -> str:
        """
        分析唤醒情况
        """
        if result.total_wakeups == 0:
            return "ℹ️ 无唤醒事件"
        
        analysis_parts = [
            f"总唤醒次数: {result.total_wakeups}",
            f"有效唤醒: {result.total_wakeups - result.unnecessary_wakeups}",
            f"无效唤醒: {result.unnecessary_wakeups}"
        ]
        
        if result.unnecessary_wakeups > 0:
            ratio = (result.unnecessary_wakeups / result.total_wakeups) * 100
            analysis_parts.append(
                f"⚠️ 无效唤醒比例: {ratio:.1f}%"
            )
            analysis_parts.append(
                "   💡 无效唤醒通常由惊群效应导致：多个 worker 被唤醒，但只有一个能抢到数据"
            )
        
        return "\n".join(analysis_parts)
    
    def _analyze_missed_reads(self, result: SimulationResult) -> tuple:
        """
        分析漏读风险
        
        Returns:
            (风险描述, 建议列表)
        """
        suggestions = []
        
        if result.missed_reads > 0:
            risk = f"❌ 严重: 检测到 {result.missed_reads} 次漏读"
            
            if result.trigger_mode == TriggerMode.EDGE_TRIGGERED:
                suggestions.extend([
                    "边缘触发(ET)要求一次性读完所有数据，否则可能导致漏读",
                    "建议: 使用非阻塞 IO + 循环读取直到 EAGAIN",
                    "建议: 或使用水平触发(LT)模式，更安全但效率略低"
                ])
            else:
                suggestions.append(
                    "水平触发模式下的漏读通常是因为缓冲区满或处理延迟过高"
                )
        
        elif result.trigger_mode == TriggerMode.EDGE_TRIGGERED:
            risk = "⚠️ 中等风险: 边缘触发(ET)模式存在漏读隐患"
            suggestions.extend([
                "边缘触发只在状态变化时通知一次",
                "必须确保每次 read 都读完所有可用数据",
                "建议配合非阻塞 IO 使用"
            ])
        
        else:
            risk = "✅ 低风险: 水平触发(LT)模式较安全"
            suggestions.append(
                "水平触发会持续通知直到数据被读取，不容易漏读"
            )
        
        return risk, suggestions
    
    def _analyze_thundering_herd(self, result: SimulationResult) -> tuple:
        """
        分析惊群效应
        
        Returns:
            (分析描述, 建议列表)
        """
        suggestions = []
        
        if result.thundering_herd_count > 0:
            analysis = (
                f"❌ 检测到 {result.thundering_herd_count} 次惊群事件\n"
                f"   无效唤醒: {result.unnecessary_wakeups} 次"
            )
            
            if result.selector_type != IOSelectorType.EPOLL:
                suggestions.extend([
                    f"当前使用 {result.selector_type.value}，惊群问题更严重",
                    "建议: 切换到 epoll"
                ])
            
            if not result.fd_stats or not any(
                stats.get('thundering_herd_count', 0) == 0 
                for stats in result.fd_stats.values()
            ):
                suggestions.extend([
                    "建议: 使用 EPOLLEXCLUSIVE 标志",
                    "EPOLLEXCLUSIVE 会让内核只唤醒一个 worker，避免惊群"
                ])
        
        elif len(result.worker_stats) > 1:
            analysis = "✅ 无惊群事件（可能使用了 EPOLLEXCLUSIVE）"
            suggestions.append(
                "多 worker 场景下，建议始终使用 EPOLLEXCLUSIVE"
            )
        
        else:
            analysis = "ℹ️ 单 worker 场景，无惊群问题"
            suggestions = []
        
        return analysis, suggestions
    
    def _generate_comparison_notes(self, result: SimulationResult) -> str:
        """
        生成对比分析笔记
        """
        notes = []
        
        selector = result.selector_type
        trigger = result.trigger_mode
        
        # Select vs Poll vs Epoll 对比
        if selector == IOSelectorType.SELECT:
            notes.extend([
                "【select】特点:",
                "  - 有 1024 个 fd 的限制",
                "  - 每次调用都需要从用户态拷贝 fd_set 到内核",
                "  - 内核需要扫描所有 fd",
                "  - 返回后应用程序需要再次扫描才能知道哪个 fd 就绪",
                "  - 复杂度: O(n)"
            ])
        elif selector == IOSelectorType.POLL:
            notes.extend([
                "【poll】特点:",
                "  - 没有 1024 限制",
                "  - 但仍需要每次拷贝 pollfd 数组",
                "  - 内核和应用程序都需要扫描所有 fd",
                "  - 复杂度: O(n)"
            ])
        else:
            notes.extend([
                "【epoll】特点:",
                "  - 使用红黑树 + 就绪链表",
                "  - 只需要一次注册，不需要每次拷贝",
                "  - 内核只返回就绪的 fd（就绪链表）",
                "  - 复杂度: O(1) 就绪 fd 数量相关",
                "  - 支持水平触发(LT)和边缘触发(ET)"
            ])
        
        # 触发模式对比
        if trigger == TriggerMode.EDGE_TRIGGERED:
            notes.extend([
                "",
                "【边缘触发(ET)】:",
                "  - 只在状态变化时通知一次",
                "  - 必须一次性读完所有数据",
                "  - 效率高，但容易漏读",
                "  - 必须配合非阻塞 IO 使用"
            ])
        else:
            notes.extend([
                "",
                "【水平触发(LT)】:",
                "  - 只要有数据就持续通知",
                "  - 可以分次读取",
                "  - 安全，不容易漏读",
                "  - 是默认模式，也是大多数场景的推荐选择"
            ])
        
        return "\n".join(notes)
    
    def _determine_rating(self, result: SimulationResult) -> str:
        """
        确定总体评级
        """
        # 漏读是严重问题
        if result.missed_reads > 0:
            return "danger"
        
        # 惊群或高 CPU 成本是警告
        if (result.thundering_herd_count > 2 or 
            result.unnecessary_wakeups > result.total_wakeups * 0.3 or
            result.fd_scan_count > 1000):
            return "warning"
        
        return "good"
    
    def _generate_summary(self, result: SimulationResult, rating: str) -> str:
        """
        生成总体摘要
        """
        selector = result.selector_type.value.upper()
        trigger = "边缘触发(ET)" if result.trigger_mode == TriggerMode.EDGE_TRIGGERED else "水平触发(LT)"
        
        summary_parts = [
            f"配置: {selector} + {trigger}",
            f"连接数: {len(result.fd_stats)}",
            f"Worker 数: {len(result.worker_stats)}"
        ]
        
        if rating == "good":
            summary_parts.append("")
            summary_parts.append("✅ 整体表现良好")
            if result.thundering_herd_count == 0 and len(result.worker_stats) > 1:
                summary_parts.append("   - 无惊群效应（可能使用了 EPOLLEXCLUSIVE）")
            if result.missed_reads == 0:
                summary_parts.append("   - 无漏读风险")
        
        elif rating == "warning":
            summary_parts.append("")
            summary_parts.append("⚠️ 存在性能问题")
            if result.thundering_herd_count > 0:
                summary_parts.append(f"   - 惊群事件: {result.thundering_herd_count} 次")
            if result.fd_scan_count > 1000:
                summary_parts.append(f"   - 高 fd 扫描成本: {result.fd_scan_count} 次")
        
        else:
            summary_parts.append("")
            summary_parts.append("❌ 存在严重问题")
            summary_parts.append(f"   - 漏读次数: {result.missed_reads}")
            summary_parts.append("   - 这可能导致数据丢失或服务异常")
        
        return "\n".join(summary_parts)
    
    def generate_detailed_stats(self, result: SimulationResult) -> Dict[str, Any]:
        """
        生成详细统计数据
        """
        return {
            "summary": {
                "case_name": result.case_name,
                "selector_type": result.selector_type.value,
                "trigger_mode": result.trigger_mode.value,
                "total_wakeups": result.total_wakeups,
                "unnecessary_wakeups": result.unnecessary_wakeups,
                "cpu_spins": result.cpu_spins,
                "fd_scan_count": result.fd_scan_count,
                "missed_reads": result.missed_reads,
                "thundering_herd_count": result.thundering_herd_count
            },
            "worker_stats": result.worker_stats,
            "fd_stats": result.fd_stats,
            "events_count": len(result.events),
            "duration_ms": result.duration_ms
        }
