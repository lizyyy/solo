import httpx
from typing import Tuple
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class LinkChecker:
    def __init__(self, timeout: int = 10):
        self.timeout = timeout

    def check_link(self, url: str) -> Tuple[bool, int, str]:
        if not url or not url.startswith(("http://", "https://")):
            return False, 0, "invalid_url"

        try:
            with httpx.Client(timeout=self.timeout, follow_redirects=True) as client:
                response = client.head(url)
                status_code = response.status_code
                if status_code == 405:
                    response = client.get(url)
                    status_code = response.status_code
                is_valid = 200 <= status_code < 400
                reason = "ok" if is_valid else f"status_{status_code}"
                return is_valid, status_code, reason
        except httpx.TimeoutException:
            return False, 0, "timeout"
        except httpx.ConnectError:
            return False, 0, "connection_error"
        except Exception as e:
            logger.warning(f"Link check failed for {url}: {e}")
            return False, 0, str(e)

    def check_links_batch(self, urls: list) -> dict:
        results = {}
        for url in urls:
            is_valid, status_code, reason = self.check_link(url)
            results[url] = {
                "is_valid": is_valid,
                "status_code": status_code,
                "reason": reason,
            }
        return results
