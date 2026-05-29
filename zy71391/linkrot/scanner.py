from __future__ import annotations

import logging
from typing import Optional
from urllib.parse import urlparse

from .models import (
    CheckResult,
    CheckStatus,
    LinkKind,
    LinkRef,
    MarkdownDoc,
    Severity,
    SEVERITY_MAP,
)

logger = logging.getLogger(__name__)

_MAX_REDIRECTS = 10
_REQUEST_TIMEOUT = 15


def _build_result(
    link_ref=None,
    source_doc=None,
    status=None,
    detail: str = "",
    suggestion: str = "",
    redirect_chain=None,
    final_url: Optional[str] = None,
    http_status: Optional[int] = None,
) -> CheckResult:
    return CheckResult(
        link_ref=link_ref,
        source_doc=source_doc,
        status=status,
        severity=SEVERITY_MAP[status],
        detail=detail,
        suggestion=suggestion,
        redirect_chain=redirect_chain or [],
        final_url=final_url,
        http_status=http_status,
    )


def _check_with_urllib(url: str) -> CheckResult | None:
    import http.client
    import urllib.request
    import urllib.error
    import socket

    chain: list[str] = [url]
    current = url
    visited: set[str] = {url}

    for _ in range(_MAX_REDIRECTS):
        parsed = urlparse(current)
        if parsed.scheme not in ("http", "https"):
            return None

        try:
            req = urllib.request.Request(
                current, method="HEAD", headers={"User-Agent": "LinkRotScanner/1.0"}
            )
            resp = urllib.request.urlopen(req, timeout=_REQUEST_TIMEOUT)
            return _build_result(
                link_ref=None,
                source_doc=None,
                status=CheckStatus.OK if current == url else CheckStatus.REDIRECT,
                detail=f"HTTP {resp.status}",
                redirect_chain=chain,
                final_url=current,
                http_status=resp.status,
            )
        except urllib.error.HTTPError as e:
            if e.code in (301, 302, 303, 307, 308):
                location = e.headers.get("Location", "")
                if not location:
                    return _build_result(
                        link_ref=None,
                        source_doc=None,
                        status=CheckStatus.REDIRECT,
                        detail=f"重定向但缺少Location头 (HTTP {e.code})",
                        redirect_chain=chain,
                        http_status=e.code,
                    )
                from urllib.parse import urljoin

                next_url = urljoin(current, location)
                if next_url in visited:
                    return _build_result(
                        link_ref=None,
                        source_doc=None,
                        status=CheckStatus.REDIRECT_LOOP,
                        detail=f"重定向循环: {' -> '.join(chain)} -> {next_url}",
                        suggestion="修复重定向链，消除循环",
                        redirect_chain=chain + [next_url],
                        http_status=e.code,
                    )
                visited.add(next_url)
                chain.append(next_url)
                current = next_url
                continue
            if e.code == 403:
                return _build_result(
                    link_ref=None,
                    source_doc=None,
                    status=CheckStatus.PENDING_REVIEW,
                    detail=f"HTTP 403 Forbidden — 可能需要认证，暂时无法确认是否有效",
                    suggestion="手动在浏览器中验证该链接是否可访问",
                    http_status=e.code,
                )
            if e.code >= 400:
                return _build_result(
                    link_ref=None,
                    source_doc=None,
                    status=CheckStatus.BROKEN,
                    detail=f"HTTP {e.code}",
                    suggestion="确认链接地址是否正确，或替换为有效地址",
                    http_status=e.code,
                )
            return None
        except urllib.error.URLError as e:
            reason = str(e.reason) if hasattr(e, "reason") else str(e)
            if "timed out" in reason.lower():
                return _build_result(
                    link_ref=None,
                    source_doc=None,
                    status=CheckStatus.TIMEOUT,
                    detail=f"请求超时 ({_REQUEST_TIMEOUT}s)",
                    suggestion="稍后重试或确认目标站点是否可达",
                )
            return _build_result(
                link_ref=None,
                source_doc=None,
                status=CheckStatus.BROKEN,
                detail=f"无法连接: {reason}",
                suggestion="检查域名是否正确，确认网络可达",
            )
        except socket.timeout:
            return _build_result(
                link_ref=None,
                source_doc=None,
                status=CheckStatus.TIMEOUT,
                detail=f"请求超时 ({_REQUEST_TIMEOUT}s)",
                suggestion="稍后重试或确认目标站点是否可达",
            )
        except Exception as e:
            return _build_result(
                link_ref=None,
                source_doc=None,
                status=CheckStatus.PENDING_REVIEW,
                detail=f"意外错误: {type(e).__name__}: {e}",
                suggestion="手动验证该链接",
            )

    return _build_result(
        link_ref=None,
        source_doc=None,
        status=CheckStatus.REDIRECT_LOOP,
        detail=f"重定向次数超过{_MAX_REDIRECTS}次: {' -> '.join(chain)}",
        suggestion="重定向链过长，检查是否存在循环或中间跳转过多",
        redirect_chain=chain,
    )


class ExternalLinkScanner:
    def __init__(self, timeout: int = _REQUEST_TIMEOUT, max_redirects: int = _MAX_REDIRECTS):
        self.timeout = timeout
        self.max_redirects = max_redirects
        self._cache: dict[str, CheckResult] = {}

    def check(self, link_ref: LinkRef, source_doc: MarkdownDoc) -> CheckResult:
        url = link_ref.raw_href

        if url in self._cache:
            cached = self._cache[url]
            return CheckResult(
                link_ref=link_ref,
                source_doc=source_doc,
                status=cached.status,
                severity=cached.severity,
                detail=cached.detail,
                suggestion=cached.suggestion,
                redirect_chain=list(cached.redirect_chain),
                final_url=cached.final_url,
                http_status=cached.http_status,
            )

        result = self._check_url(url)
        self._cache[url] = result

        return CheckResult(
            link_ref=link_ref,
            source_doc=source_doc,
            status=result.status,
            severity=result.severity,
            detail=result.detail,
            suggestion=result.suggestion,
            redirect_chain=list(result.redirect_chain),
            final_url=result.final_url,
            http_status=result.http_status,
        )

    def _check_url(self, url: str) -> CheckResult:
        if url.startswith("mailto:"):
            return _build_result(
                status=CheckStatus.OK,
                detail="mailto链接，跳过HTTP检测",
            )
        if url.startswith("tel:"):
            return _build_result(
                status=CheckStatus.OK,
                detail="tel链接，跳过HTTP检测",
            )

        try:
            import requests

            return self._check_with_requests(url)
        except ImportError:
            return self._check_with_urllib_fallback(url)

    def _check_with_requests(self, url: str) -> CheckResult:
        import requests as rq

        chain: list[str] = [url]
        visited: set[str] = {url}
        current = url

        session = rq.Session()
        session.max_redirects = self.max_redirects

        try:
            resp = session.head(
                url,
                timeout=self.timeout,
                allow_redirects=True,
                headers={"User-Agent": "LinkRotScanner/1.0"},
            )

            redirect_chain = [r.headers.get("Location", "") for r in resp.history]
            final_url = resp.url

            if resp.history:
                chain = [url] + [r.headers.get("Location", "") for r in resp.history if r.headers.get("Location")]
                if final_url not in chain:
                    chain.append(final_url)

                for r in resp.history:
                    loc = r.headers.get("Location", "")
                    if loc:
                        abs_loc = loc
                        if not abs_loc.startswith("http"):
                            from urllib.parse import urljoin

                            abs_loc = urljoin(r.url, loc)
                        if abs_loc in visited and abs_loc != url:
                            return _build_result(
                                status=CheckStatus.REDIRECT_LOOP,
                                detail=f"重定向循环检测: {' -> '.join(chain)}",
                                suggestion="修复重定向链，消除循环",
                                redirect_chain=chain,
                                final_url=final_url,
                                http_status=r.status_code,
                            )
                        visited.add(abs_loc)

            if resp.status_code >= 400:
                if resp.status_code == 403:
                    return _build_result(
                        status=CheckStatus.PENDING_REVIEW,
                        detail=f"HTTP 403 Forbidden — 可能需要认证，暂时无法确认是否有效",
                        suggestion="手动在浏览器中验证该链接是否可访问",
                        redirect_chain=chain,
                        final_url=final_url,
                        http_status=resp.status_code,
                    )
                return _build_result(
                    status=CheckStatus.BROKEN,
                    detail=f"HTTP {resp.status_code}",
                    suggestion="确认链接地址是否正确，或替换为有效地址",
                    redirect_chain=chain,
                    final_url=final_url,
                    http_status=resp.status_code,
                )

            status = CheckStatus.REDIRECT if len(resp.history) > 0 else CheckStatus.OK
            detail = f"HTTP {resp.status_code}"
            if status == CheckStatus.REDIRECT:
                detail += f" (经过 {len(resp.history)} 次重定向)"

            return _build_result(
                status=status,
                detail=detail,
                redirect_chain=chain,
                final_url=final_url,
                http_status=resp.status_code,
            )

        except rq.TooManyRedirects:
            return _build_result(
                status=CheckStatus.REDIRECT_LOOP,
                detail=f"重定向次数超过{self.max_redirects}次",
                suggestion="重定向链过长，检查是否存在循环或中间跳转过多",
                redirect_chain=chain,
            )
        except rq.exceptions.Timeout:
            return _build_result(
                status=CheckStatus.TIMEOUT,
                detail=f"请求超时 ({self.timeout}s)",
                suggestion="稍后重试或确认目标站点是否可达",
            )
        except rq.exceptions.ConnectionError as e:
            err_msg = str(e)
            hostname = self._extract_hostname(url)

            if self._is_definitely_invalid_hostname(hostname):
                return _build_result(
                    status=CheckStatus.BROKEN,
                    detail=f"域名无效: {hostname}",
                    suggestion="确认域名拼写是否正确，或替换为有效地址",
                )

            if self._is_dns_failure(err_msg):
                return _build_result(
                    status=CheckStatus.BROKEN,
                    detail=f"DNS 解析失败: {hostname} — {err_msg[:100]}",
                    suggestion="确认域名是否正确注册，检查 DNS 配置",
                )

            if "SSLError" in err_msg or "CERTIFICATE" in err_msg.upper():
                return _build_result(
                    status=CheckStatus.PENDING_REVIEW,
                    detail=f"SSL证书错误 — 链接可能有效但证书有问题: {err_msg[:200]}",
                    suggestion="手动验证该链接是否在浏览器中可正常访问",
                )
            return _build_result(
                status=CheckStatus.BROKEN,
                detail=f"连接失败: {err_msg[:200]}",
                suggestion="检查域名是否正确，确认网络可达",
            )
        except Exception as e:
            return _build_result(
                status=CheckStatus.PENDING_REVIEW,
                detail=f"意外错误: {type(e).__name__}: {e}",
                suggestion="手动验证该链接",
            )

    @staticmethod
    def _extract_hostname(url: str) -> str:
        try:
            parsed = urlparse(url)
            return parsed.hostname or ""
        except Exception:
            return ""

    @staticmethod
    def _is_definitely_invalid_hostname(hostname: str) -> bool:
        if not hostname:
            return False
        if hostname == "localhost" or hostname == "127.0.0.1":
            return False
        invalid_tlds = (".invalid", ".example", ".test", ".localhost")
        if any(hostname.endswith(tld) for tld in invalid_tlds):
            return True
        invalid_domains = {"example.invalid", "example.com", "example.org", "example.net"}
        if hostname in invalid_domains or hostname.endswith((".example.com", ".example.org", ".example.net")):
            if hostname not in ("www.example.com", "example.com"):
                return True
        return False

    @staticmethod
    def _is_dns_failure(err_msg: str) -> bool:
        dns_keywords = [
            "Name or service not known",
            "getaddrinfo failed",
            "nodename nor servname provided",
            "DNS",
            "Could not resolve",
            "resolve",
            "gaierror",
        ]
        return any(k.lower() in err_msg.lower() for k in dns_keywords)

    def _check_with_urllib_fallback(self, url: str) -> CheckResult:
        result = _check_with_urllib(url)
        if result is not None:
            return result
        return _build_result(
            status=CheckStatus.PENDING_REVIEW,
            detail=f"不支持的链接协议: {url}",
            suggestion="手动验证该链接",
        )
