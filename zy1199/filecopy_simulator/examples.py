"""内置样例用例"""

from .models import (
    CaseDefinition,
    HardwareConfig,
    TransferConfig,
    TransferMethod,
)


def get_builtin_examples() -> list:
    """获取所有内置样例"""
    return [
        get_bad_example_traditional(),
        get_bad_example_with_tls_compression(),
        get_good_example_sendfile(),
        get_good_example_sendfile_with_dma(),
        get_comparison_mmap(),
    ]


def get_bad_example_traditional() -> CaseDefinition:
    """坏例子：传统 read + write，无任何优化"""
    return CaseDefinition(
        name="bad_traditional_read_write",
        description="坏例子：传统 read + write 方式，无任何优化，拷贝次数最多",
        category="bad_practice",
        tags=["bad", "traditional", "baseline"],
        config=TransferConfig(
            file_size_mb=100.0,
            method=TransferMethod.READ_WRITE,
            page_cache_hit=False,
            use_mmap=False,
            use_sendfile=False,
            use_dma_sg=False,
            use_tls=False,
            use_compression=False,
            chunk_size_kb=64,
            hardware=HardwareConfig(
                disk_bandwidth_mbps=100.0,
                network_bandwidth_mbps=100.0
            )
        )
    )


def get_bad_example_with_tls_compression() -> CaseDefinition:
    """坏例子：传统方式 + TLS + 压缩，CPU 瓶颈"""
    return CaseDefinition(
        name="bad_tls_compression_traditional",
        description="坏例子：传统 read + write + 用户态 TLS + 压缩，CPU 密集型操作",
        category="bad_practice",
        tags=["bad", "cpu-bound", "tls", "compression"],
        config=TransferConfig(
            file_size_mb=100.0,
            method=TransferMethod.READ_WRITE,
            page_cache_hit=False,
            use_mmap=False,
            use_sendfile=False,
            use_dma_sg=False,
            use_tls=True,
            use_compression=True,
            compression_ratio=2.0,
            chunk_size_kb=64,
            hardware=HardwareConfig(
                disk_bandwidth_mbps=500.0,
                network_bandwidth_mbps=500.0
            )
        )
    )


def get_good_example_sendfile() -> CaseDefinition:
    """好例子：sendfile 零拷贝"""
    return CaseDefinition(
        name="good_sendfile_basic",
        description="好例子：sendfile 零拷贝方式，减少用户态拷贝",
        category="good_practice",
        tags=["good", "zero-copy", "sendfile"],
        config=TransferConfig(
            file_size_mb=100.0,
            method=TransferMethod.SENDFILE,
            page_cache_hit=False,
            use_mmap=False,
            use_sendfile=True,
            use_dma_sg=False,
            use_tls=False,
            use_compression=False,
            chunk_size_kb=64,
            hardware=HardwareConfig(
                disk_bandwidth_mbps=100.0,
                network_bandwidth_mbps=100.0
            )
        )
    )


def get_good_example_sendfile_with_dma() -> CaseDefinition:
    """好例子：sendfile + DMA SG，真正的零拷贝"""
    return CaseDefinition(
        name="good_sendfile_dma_sg",
        description="好例子：sendfile + DMA Scatter-Gather，真正的零拷贝（仅描述符传递）",
        category="good_practice",
        tags=["good", "zero-copy", "sendfile", "dma-sg", "optimized"],
        config=TransferConfig(
            file_size_mb=100.0,
            method=TransferMethod.SENDFILE,
            page_cache_hit=False,
            use_mmap=False,
            use_sendfile=True,
            use_dma_sg=True,
            use_tls=False,
            use_compression=False,
            chunk_size_kb=64,
            hardware=HardwareConfig(
                disk_bandwidth_mbps=100.0,
                network_bandwidth_mbps=100.0
            )
        )
    )


def get_comparison_mmap() -> CaseDefinition:
    """对比用例：mmap + write"""
    return CaseDefinition(
        name="comparison_mmap_write",
        description="对比用例：mmap + write 方式，比传统方式少一次拷贝",
        category="comparison",
        tags=["comparison", "mmap"],
        config=TransferConfig(
            file_size_mb=100.0,
            method=TransferMethod.MMAP_WRITE,
            page_cache_hit=False,
            use_mmap=True,
            use_sendfile=False,
            use_dma_sg=False,
            use_tls=False,
            use_compression=False,
            chunk_size_kb=64,
            hardware=HardwareConfig(
                disk_bandwidth_mbps=100.0,
                network_bandwidth_mbps=100.0
            )
        )
    )


def get_page_cache_example() -> CaseDefinition:
    """页缓存命中示例"""
    return CaseDefinition(
        name="example_page_cache_hit",
        description="示例：页缓存命中场景，跳过磁盘读取",
        category="optimization",
        tags=["optimization", "page-cache"],
        config=TransferConfig(
            file_size_mb=100.0,
            method=TransferMethod.SENDFILE,
            page_cache_hit=True,
            use_mmap=False,
            use_sendfile=True,
            use_dma_sg=True,
            use_tls=False,
            use_compression=False,
            chunk_size_kb=64,
            hardware=HardwareConfig(
                disk_bandwidth_mbps=100.0,
                network_bandwidth_mbps=100.0
            )
        )
    )
