"""文件传输拷贝链路模拟器"""

from dataclasses import asdict
from typing import Dict, Tuple

from .models import (
    TransferConfig,
    TransferMethod,
    SimulationResult,
    BottleneckType,
)


class TransferSimulator:
    """传输链路模拟器"""
    
    def simulate(self, config: TransferConfig, case_name: str = "default") -> SimulationResult:
        """执行模拟并返回结果"""
        
        if config.method == TransferMethod.READ_WRITE:
            return self._simulate_read_write(config, case_name)
        elif config.method == TransferMethod.MMAP_WRITE:
            return self._simulate_mmap_write(config, case_name)
        elif config.method == TransferMethod.SENDFILE:
            return self._simulate_sendfile(config, case_name)
        else:
            raise ValueError(f"Unknown transfer method: {config.method}")
    
    def _simulate_read_write(self, config: TransferConfig, case_name: str) -> SimulationResult:
        """模拟 read + write 传统方式"""
        
        chunk_size_bytes = config.chunk_size_kb * 1024
        file_size_bytes = config.file_size_mb * 1024 * 1024
        num_chunks = max(1, int(file_size_bytes / chunk_size_bytes))
        
        user_copies = 2
        kernel_copies = 2
        total_copies = 4
        
        if config.use_dma_sg:
            kernel_copies -= 1
            total_copies -= 1
        
        if config.page_cache_hit:
            kernel_copies -= 1
            total_copies -= 1
        
        context_switches = num_chunks * 2 + 2
        system_calls = num_chunks * 2 + 2
        
        cpu_usage, time_ms, throughput, bottleneck, bottleneck_reason = self._calculate_metrics(
            config,
            total_copies,
            context_switches,
            has_user_copy=True
        )
        
        copy_details = self._build_read_write_details(config)
        
        return SimulationResult(
            case_name=case_name,
            file_size_mb=config.file_size_mb,
            method=TransferMethod.READ_WRITE,
            user_space_copies=user_copies,
            kernel_space_copies=kernel_copies,
            total_copies=total_copies,
            context_switches=context_switches,
            system_calls=system_calls,
            estimated_cpu_usage_pct=cpu_usage,
            estimated_time_ms=time_ms,
            estimated_throughput_mbps=throughput,
            bottleneck=bottleneck,
            bottleneck_reason=bottleneck_reason,
            copy_details=copy_details,
            config_snapshot=asdict(config)
        )
    
    def _simulate_mmap_write(self, config: TransferConfig, case_name: str) -> SimulationResult:
        """模拟 mmap + write 方式"""
        
        chunk_size_bytes = config.chunk_size_kb * 1024
        file_size_bytes = config.file_size_mb * 1024 * 1024
        num_chunks = max(1, int(file_size_bytes / chunk_size_bytes))
        
        user_copies = 1
        kernel_copies = 2
        total_copies = 3
        
        if config.use_dma_sg:
            kernel_copies -= 1
            total_copies -= 1
        
        if config.page_cache_hit:
            kernel_copies -= 0
            total_copies -= 0
        
        context_switches = num_chunks * 1 + 3
        system_calls = num_chunks * 1 + 3
        
        cpu_usage, time_ms, throughput, bottleneck, bottleneck_reason = self._calculate_metrics(
            config,
            total_copies,
            context_switches,
            has_user_copy=True
        )
        
        copy_details = self._build_mmap_write_details(config)
        
        return SimulationResult(
            case_name=case_name,
            file_size_mb=config.file_size_mb,
            method=TransferMethod.MMAP_WRITE,
            user_space_copies=user_copies,
            kernel_space_copies=kernel_copies,
            total_copies=total_copies,
            context_switches=context_switches,
            system_calls=system_calls,
            estimated_cpu_usage_pct=cpu_usage,
            estimated_time_ms=time_ms,
            estimated_throughput_mbps=throughput,
            bottleneck=bottleneck,
            bottleneck_reason=bottleneck_reason,
            copy_details=copy_details,
            config_snapshot=asdict(config)
        )
    
    def _simulate_sendfile(self, config: TransferConfig, case_name: str) -> SimulationResult:
        """模拟 sendfile 零拷贝方式"""
        
        chunk_size_bytes = config.chunk_size_kb * 1024
        file_size_bytes = config.file_size_mb * 1024 * 1024
        num_chunks = max(1, int(file_size_bytes / chunk_size_bytes))
        
        user_copies = 0
        kernel_copies = 2
        total_copies = 2
        
        if config.use_dma_sg:
            kernel_copies -= 1
            total_copies -= 1
        
        if config.page_cache_hit:
            kernel_copies -= 1
            total_copies -= 1
        
        context_switches = 2 + (num_chunks if config.use_tls else 0)
        system_calls = 3
        
        cpu_usage, time_ms, throughput, bottleneck, bottleneck_reason = self._calculate_metrics(
            config,
            total_copies,
            context_switches,
            has_user_copy=False
        )
        
        copy_details = self._build_sendfile_details(config)
        
        return SimulationResult(
            case_name=case_name,
            file_size_mb=config.file_size_mb,
            method=TransferMethod.SENDFILE,
            user_space_copies=user_copies,
            kernel_space_copies=kernel_copies,
            total_copies=total_copies,
            context_switches=context_switches,
            system_calls=system_calls,
            estimated_cpu_usage_pct=cpu_usage,
            estimated_time_ms=time_ms,
            estimated_throughput_mbps=throughput,
            bottleneck=bottleneck,
            bottleneck_reason=bottleneck_reason,
            copy_details=copy_details,
            config_snapshot=asdict(config)
        )
    
    def _calculate_metrics(
        self,
        config: TransferConfig,
        total_copies: int,
        context_switches: int,
        has_user_copy: bool
    ) -> Tuple[float, float, float, BottleneckType, str]:
        """计算性能指标和瓶颈"""
        
        effective_size_mb = config.file_size_mb
        if config.use_compression:
            effective_size_mb = config.file_size_mb / config.compression_ratio
        
        disk_time_ms = (config.file_size_mb / config.hardware.disk_bandwidth_mbps) * 1000
        network_time_ms = (effective_size_mb / config.hardware.network_bandwidth_mbps) * 1000
        
        copy_overhead_ms = total_copies * 0.5
        context_overhead_ms = context_switches * 0.1
        
        cpu_factor = 1.0
        if config.use_tls:
            cpu_factor += 0.5
        if config.use_compression:
            cpu_factor += 0.3
        if has_user_copy:
            cpu_factor += 0.2
        
        total_time_ms = max(disk_time_ms, network_time_ms) + copy_overhead_ms + context_overhead_ms
        total_time_ms *= cpu_factor
        
        throughput = config.file_size_mb / (total_time_ms / 1000)
        
        cpu_usage = min(100.0, (
            (total_copies * 5) +
            (context_switches * 2) +
            (15 if config.use_tls else 0) +
            (10 if config.use_compression else 0) +
            (10 if has_user_copy else 0)
        ))
        
        bottleneck = BottleneckType.NONE
        bottleneck_reason = "无明显瓶颈"
        
        disk_saturation = disk_time_ms / total_time_ms
        network_saturation = network_time_ms / total_time_ms
        
        if network_saturation > 0.8:
            bottleneck = BottleneckType.NETWORK
            bottleneck_reason = f"网络带宽饱和 ({config.hardware.network_bandwidth_mbps} Mbps)，传输 {effective_size_mb:.1f} MB 需要约 {network_time_ms:.0f} ms"
        elif disk_saturation > 0.7:
            bottleneck = BottleneckType.IO
            bottleneck_reason = f"磁盘 I/O 饱和 ({config.hardware.disk_bandwidth_mbps} Mbps)，读取 {config.file_size_mb} MB 需要约 {disk_time_ms:.0f} ms"
        elif cpu_usage > 80:
            bottleneck = BottleneckType.CPU
            reasons = []
            if config.use_tls:
                reasons.append("TLS 加密/解密")
            if config.use_compression:
                reasons.append("数据压缩/解压")
            if has_user_copy:
                reasons.append("用户态数据拷贝")
            bottleneck_reason = f"CPU 密集型操作: {', '.join(reasons)}"
        elif total_copies > 2:
            bottleneck = BottleneckType.MEMORY
            bottleneck_reason = f"内存拷贝次数过多 ({total_copies} 次)，考虑使用零拷贝技术"
        
        return cpu_usage, total_time_ms, throughput, bottleneck, bottleneck_reason
    
    def _build_read_write_details(self, config: TransferConfig) -> Dict:
        """构建 read + write 拷贝链路详情"""
        steps = []
        
        if config.page_cache_hit:
            steps.append({
                "step": "1",
                "description": "read() 系统调用",
                "from": "页缓存 (Page Cache)",
                "to": "用户态缓冲区",
                "type": "内核态 -> 用户态 拷贝",
                "optimization": "页缓存命中，跳过磁盘读取"
            })
        else:
            steps.append({
                "step": "1",
                "description": "read() 系统调用",
                "from": "磁盘",
                "to": "内核页缓存",
                "type": "DMA 拷贝" if config.use_dma_sg else "内核态拷贝",
                "optimization": "DMA Scatter-Gather" if config.use_dma_sg else None
            })
            steps.append({
                "step": "2",
                "description": "内核 -> 用户态",
                "from": "内核页缓存",
                "to": "用户态缓冲区",
                "type": "内核态 -> 用户态 拷贝",
                "optimization": None
            })
        
        steps.append({
            "step": "3",
            "description": "write() 系统调用",
            "from": "用户态缓冲区",
            "to": "内核 Socket 缓冲区",
            "type": "用户态 -> 内核态 拷贝",
            "optimization": None
        })
        
        steps.append({
            "step": "4",
            "description": "协议栈发送",
            "from": "Socket 缓冲区",
            "to": "网卡",
            "type": "DMA 拷贝" if config.use_dma_sg else "内核态拷贝",
            "optimization": "DMA Scatter-Gather" if config.use_dma_sg else None
        })
        
        if config.use_tls:
            steps.insert(3, {
                "step": "3.5",
                "description": "TLS 加密",
                "from": "用户态明文",
                "to": "用户态密文",
                "type": "用户态 CPU 计算",
                "optimization": None
            })
        
        if config.use_compression:
            steps.insert(2, {
                "step": "2.5",
                "description": "数据压缩",
                "from": "原始数据",
                "to": "压缩数据",
                "type": "用户态 CPU 计算",
                "optimization": f"压缩比 {config.compression_ratio}:1"
            })
        
        return {
            "method": "read + write",
            "description": "传统方式：数据在内核态和用户态之间多次拷贝",
            "steps": steps,
            "key_points": [
                "需要 2 次用户态拷贝（read 时从内核到用户，write 时从用户到内核）",
                "需要 2 次内核态拷贝（磁盘到页缓存，Socket 缓冲区到网卡）",
                "上下文切换次数多（每次 read/write 都需要切换）",
                "适合小文件或需要在用户态处理数据的场景"
            ]
        }
    
    def _build_mmap_write_details(self, config: TransferConfig) -> Dict:
        """构建 mmap + write 拷贝链路详情"""
        steps = []
        
        steps.append({
            "step": "1",
            "description": "mmap() 系统调用",
            "from": "文件",
            "to": "用户态虚拟地址空间",
            "type": "地址映射（无拷贝）",
            "optimization": "内存映射，建立页表映射"
        })
        
        if not config.page_cache_hit:
            steps.append({
                "step": "2",
                "description": "缺页异常触发读取",
                "from": "磁盘",
                "to": "内核页缓存",
                "type": "DMA 拷贝",
                "optimization": "DMA Scatter-Gather" if config.use_dma_sg else None
            })
        
        steps.append({
            "step": "3",
            "description": "用户态直接访问",
            "from": "页缓存（通过 mmap 映射）",
            "to": "用户态处理",
            "type": "直接访问（无拷贝）",
            "optimization": "通过虚拟地址直接访问物理页"
        })
        
        steps.append({
            "step": "4",
            "description": "write() 系统调用",
            "from": "用户态缓冲区",
            "to": "内核 Socket 缓冲区",
            "type": "用户态 -> 内核态 拷贝",
            "optimization": None
        })
        
        steps.append({
            "step": "5",
            "description": "协议栈发送",
            "from": "Socket 缓冲区",
            "to": "网卡",
            "type": "DMA 拷贝" if config.use_dma_sg else "内核态拷贝",
            "optimization": "DMA Scatter-Gather" if config.use_dma_sg else None
        })
        
        if config.use_tls:
            steps.insert(4, {
                "step": "4.5",
                "description": "TLS 加密",
                "from": "用户态明文",
                "to": "用户态密文",
                "type": "用户态 CPU 计算",
                "optimization": None
            })
        
        return {
            "method": "mmap + write",
            "description": "内存映射方式：减少一次内核到用户的拷贝",
            "steps": steps,
            "key_points": [
                "mmap 将文件映射到用户态虚拟地址空间",
                "访问时通过缺页异常将数据读入页缓存",
                "用户态可以直接访问页缓存（无需拷贝）",
                "write 时仍需要一次用户态到内核态的拷贝",
                "比 read+write 少一次拷贝，但需要管理 mmap 生命周期"
            ]
        }
    
    def _build_sendfile_details(self, config: TransferConfig) -> Dict:
        """构建 sendfile 拷贝链路详情"""
        steps = []
        
        steps.append({
            "step": "1",
            "description": "sendfile() 系统调用",
            "from": "文件描述符",
            "to": "Socket 描述符",
            "type": "内核态完成所有操作",
            "optimization": "零拷贝系统调用"
        })
        
        if not config.page_cache_hit:
            steps.append({
                "step": "2",
                "description": "内核读取文件",
                "from": "磁盘",
                "to": "内核页缓存",
                "type": "DMA 拷贝",
                "optimization": "DMA Scatter-Gather" if config.use_dma_sg else None
            })
        
        if config.use_dma_sg:
            steps.append({
                "step": "3",
                "description": "DMA SG 直接发送",
                "from": "页缓存",
                "to": "网卡",
                "type": "无拷贝（仅描述符传递）",
                "optimization": "DMA Scatter-Gather + TCP 分片卸载"
            })
        else:
            steps.append({
                "step": "3",
                "description": "内核拷贝到 Socket 缓冲区",
                "from": "页缓存",
                "to": "Socket 缓冲区",
                "type": "内核态拷贝",
                "optimization": None
            })
            steps.append({
                "step": "4",
                "description": "协议栈发送",
                "from": "Socket 缓冲区",
                "to": "网卡",
                "type": "DMA 拷贝",
                "optimization": None
            })
        
        if config.use_tls:
            steps.append({
                "step": "5",
                "description": "TLS 记录层处理",
                "from": "明文数据",
                "to": "TLS 记录",
                "type": "内核态或网卡卸载",
                "optimization": "KTLS (Kernel TLS) 或网卡 TLS 卸载"
            })
        
        return {
            "method": "sendfile (零拷贝)",
            "description": "真正的零拷贝：数据在内核态完成传输，无需用户态参与",
            "steps": steps,
            "key_points": [
                "sendfile 在内核态完成从文件到 Socket 的传输",
                "完全避免用户态和内核态之间的数据拷贝",
                "配合 DMA SG 可以实现真正的零拷贝（仅描述符传递）",
                "上下文切换次数最少（仅 2 次系统调用）",
                "适合大文件静态资源传输（如 CDN、文件下载）",
                "限制：无法在用户态处理数据（如修改、加密）"
            ]
        }
