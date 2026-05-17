import asyncio
import socket
import time
from typing import List, Dict
from .models import HostEntry, ScanResult


class HostScanner:
    def __init__(self, timeout: float = 3.0, max_concurrent: int = 50):
        self.timeout = timeout
        self.max_concurrent = max_concurrent

    def _get_error_category(self, error: Exception) -> str:
        error_str = str(error).lower()
        if "refused" in error_str or "errno 61" in error_str:
            return "连接被拒绝 (端口未开放或防火墙阻止)"
        elif "timeout" in error_str:
            return "连接超时 (主机不可达或网络延迟)"
        elif "name or service not known" in error_str or "nodename nor servname" in error_str:
            return "DNS解析失败 (主机名不存在)"
        elif "network is unreachable" in error_str or "errno 51" in error_str:
            return "网络不可达"
        elif "permission denied" in error_str:
            return "权限不足"
        elif "no route to host" in error_str:
            return "无路由到主机"
        else:
            return f"其他错误: {str(error)}"

    async def scan_host(self, host: HostEntry) -> ScanResult:
        start_time = time.time()
        try:
            _, writer = await asyncio.wait_for(
                asyncio.open_connection(host.hostname, host.port),
                timeout=self.timeout
            )
            latency = (time.time() - start_time) * 1000
            writer.close()
            try:
                await writer.wait_closed()
            except:
                pass
            return ScanResult(
                host=host,
                success=True,
                latency_ms=round(latency, 2)
            )
        except Exception as e:
            latency = (time.time() - start_time) * 1000
            return ScanResult(
                host=host,
                success=False,
                latency_ms=round(latency, 2),
                error_message=self._get_error_category(e)
            )

    async def scan_all(self, hosts: List[HostEntry]) -> List[ScanResult]:
        semaphore = asyncio.Semaphore(self.max_concurrent)

        async def scan_with_semaphore(host: HostEntry) -> ScanResult:
            async with semaphore:
                return await self.scan_host(host)

        tasks = [scan_with_semaphore(host) for host in hosts]
        results = await asyncio.gather(*tasks)
        return list(results)

    def run_scan(self, hosts: List[HostEntry]) -> List[ScanResult]:
        return asyncio.run(self.scan_all(hosts))
