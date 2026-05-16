import hashlib
import hmac
import time
import uuid
import random
from datetime import datetime
from typing import Dict, Any, List, Tuple
import logging

from config import settings
from models import BatchItem, BatchResultItem, PreviewItem

logger = logging.getLogger(__name__)


class SignatureError(Exception):
    def __init__(self, error_code: str, message: str):
        self.error_code = error_code
        self.message = message
        super().__init__(message)


class SignatureService:
    def __init__(self):
        self.secret_key = settings.SECRET_KEY.encode()
        self.algorithm = settings.ALGORITHM
        self.gray_threshold = settings.GRAY_SEARCH_THRESHOLD

    def _normalize_params(self, params: Dict[str, Any]) -> str:
        sorted_keys = sorted(params.keys())
        normalized = []
        for key in sorted_keys:
            value = params[key]
            if value is not None:
                normalized.append(f"{key}={value}")
        return "&".join(normalized)

    def _sign(self, normalized_str: str, client_id: str) -> str:
        timestamp = str(int(time.time()))
        message = f"{client_id}|{timestamp}|{normalized_str}"
        signature = hmac.new(
            self.secret_key,
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        return f"{timestamp}.{signature}"

    def _verify_gray_search_word(self, params: Dict[str, Any]) -> Tuple[bool, float, str]:
        search_word = params.get("search_word", "")
        keyword = params.get("keyword", "")
        query = params.get("q", "")
        
        text = search_word or keyword or query or ""
        if not text:
            return True, 1.0, ""
        
        gray_score = self._calculate_gray_score(text)
        
        if gray_score > self.gray_threshold:
            return False, gray_score, f"GRAY_SEARCH_WORD: score={gray_score:.3f}"
        
        return True, gray_score, ""

    def _calculate_gray_score(self, text: str) -> float:
        gray_patterns = ["test", "hack", "illegal", "forbidden", "违禁", "测试", "灰色"]
        score = 0.0
        for pattern in gray_patterns:
            if pattern.lower() in text.lower():
                score += 0.4
        return min(score, 1.0)

    def _compensate_params(self, params: Dict[str, Any]) -> Dict[str, Any]:
        compensated = params.copy()
        compensated["_compensated"] = True
        compensated["_compensation_time"] = datetime.now().isoformat()
        if "timestamp" not in compensated:
            compensated["timestamp"] = str(int(time.time()))
        return compensated

    def sign(
        self,
        params: Dict[str, Any],
        client_id: str,
        compensate_enabled: bool = True
    ) -> Dict[str, Any]:
        start_time = time.time()
        timestamp = datetime.now().isoformat()
        
        try:
            is_gray, gray_score, gray_reason = self._verify_gray_search_word(params)
            
            if not is_gray:
                if compensate_enabled:
                    compensated_params = self._compensate_params(params)
                    normalized_str = self._normalize_params(compensated_params)
                    signature = self._sign(normalized_str, client_id)
                    return {
                        "success": True,
                        "signature": signature,
                        "timestamp": timestamp,
                        "compensated": True,
                        "gray_score": gray_score,
                        "original_params": params,
                        "compensated_params": compensated_params,
                        "execution_time_ms": (time.time() - start_time) * 1000
                    }
                else:
                    raise SignatureError(
                        "GRAY_SEARCH_WORD_DETECTED",
                        f"灰度搜索词检测失败: {gray_reason}, 补偿机制未启用"
                    )
            
            normalized_str = self._normalize_params(params)
            signature = self._sign(normalized_str, client_id)
            
            return {
                "success": True,
                "signature": signature,
                "timestamp": timestamp,
                "compensated": False,
                "gray_score": gray_score,
                "original_params": params,
                "execution_time_ms": (time.time() - start_time) * 1000
            }
            
        except SignatureError:
            raise
        except Exception as e:
            logger.error(f"签名失败: {e}", exc_info=True)
            raise SignatureError("SIGN_FAILED", f"签名失败: {str(e)}")

    def verify(self, params: Dict[str, Any], signature: str, client_id: str) -> bool:
        try:
            if "." not in signature:
                return False
            
            timestamp_part, sig_part = signature.split(".", 1)
            
            normalized_str = self._normalize_params(params)
            message = f"{client_id}|{timestamp_part}|{normalized_str}"
            expected_sig = hmac.new(
                self.secret_key,
                message.encode(),
                hashlib.sha256
            ).hexdigest()
            
            return hmac.compare_digest(expected_sig, sig_part)
        except Exception as e:
            logger.error(f"验证失败: {e}", exc_info=True)
            return False

    def preview_batch(self, items: List[BatchItem]) -> Dict[str, Any]:
        preview_items = []
        will_success = 0
        will_fail = 0
        
        for item in items:
            is_gray, gray_score, gray_reason = self._verify_gray_search_word(item.params)
            
            gray_score = item.gray_score if item.gray_score is not None else gray_score
            
            if not is_gray:
                will_fail += 1
                preview_items.append(PreviewItem(
                    id=item.id,
                    will_success=False,
                    expected_error=f"灰度搜索词检测: {gray_reason}",
                    gray_score=gray_score
                ))
            else:
                will_success += 1
                preview_items.append(PreviewItem(
                    id=item.id,
                    will_success=True,
                    gray_score=gray_score
                ))
        
        return {
            "total_count": len(items),
            "will_success_count": will_success,
            "will_fail_count": will_fail,
            "estimated_duration_ms": len(items) * 50,
            "items": preview_items
        }

    def batch_sign(
        self,
        items: List[BatchItem],
        compensate_enabled: bool = True
    ) -> Dict[str, Any]:
        batch_id = str(uuid.uuid4())
        result_items = []
        success_count = 0
        fail_count = 0
        
        for item in items:
            start_time = time.time()
            try:
                result = self.sign(item.params, item.client_id, compensate_enabled)
                result_items.append(BatchResultItem(
                    id=item.id,
                    success=True,
                    signature=result["signature"],
                    compensated=result.get("compensated", False),
                    execution_time_ms=result["execution_time_ms"]
                ))
                success_count += 1
            except SignatureError as e:
                result_items.append(BatchResultItem(
                    id=item.id,
                    success=False,
                    error_code=e.error_code,
                    error_message=e.message,
                    compensated=False,
                    execution_time_ms=(time.time() - start_time) * 1000
                ))
                fail_count += 1
            except Exception as e:
                result_items.append(BatchResultItem(
                    id=item.id,
                    success=False,
                    error_code="UNKNOWN_ERROR",
                    error_message=str(e),
                    compensated=False,
                    execution_time_ms=(time.time() - start_time) * 1000
                ))
                fail_count += 1
        
        partial_success = 0 < success_count < len(items)
        
        return {
            "batch_id": batch_id,
            "total_count": len(items),
            "success_count": success_count,
            "fail_count": fail_count,
            "partial_success": partial_success,
            "items": result_items
        }

    def self_check(self) -> List[Dict[str, Any]]:
        results = []
        
        test_cases = [
            ("正常参数签名", self._test_normal_sign, True),
            ("灰度搜索词补偿", self._test_gray_compensation, True),
            ("灰度搜索词无补偿", self._test_gray_no_compensation, True),
            ("签名验证", self._test_verify, True),
            ("批量预览", self._test_batch_preview, True),
            ("批量部分成功", self._test_batch_partial, True),
            ("空参数处理", self._test_empty_params, True),
            ("特殊字符参数", self._test_special_chars, True),
        ]
        
        for name, test_func, should_pass in test_cases:
            try:
                start = time.time()
                test_func()
                results.append({
                    "name": name,
                    "passed": True,
                    "expected": should_pass,
                    "execution_time_ms": (time.time() - start) * 1000
                })
            except Exception as e:
                results.append({
                    "name": name,
                    "passed": False,
                    "expected": should_pass,
                    "error": str(e),
                    "execution_time_ms": (time.time() - start) * 1000
                })
        
        return results

    def _test_normal_sign(self):
        params = {"user_id": "123", "action": "search", "keyword": "正常关键词"}
        result = self.sign(params, "client_001", False)
        assert result["success"] == True
        assert result["compensated"] == False

    def _test_gray_compensation(self):
        params = {"user_id": "123", "action": "search", "keyword": "灰色测试搜索词"}
        result = self.sign(params, "client_001", True)
        assert result["success"] == True
        assert result["compensated"] == True

    def _test_gray_no_compensation(self):
        params = {"user_id": "123", "action": "search", "keyword": "测试违禁词"}
        try:
            self.sign(params, "client_001", False)
            assert False, "Should have raised an error"
        except SignatureError as e:
            assert e.error_code == "GRAY_SEARCH_WORD_DETECTED"

    def _test_verify(self):
        params = {"user_id": "123", "action": "verify"}
        result = self.sign(params, "client_001", False)
        is_valid = self.verify(params, result["signature"], "client_001")
        assert is_valid == True

    def _test_batch_preview(self):
        items = [
            BatchItem(id="1", params={"keyword": "正常"}, client_id="c1"),
            BatchItem(id="2", params={"keyword": "灰色"}, client_id="c1"),
        ]
        preview = self.preview_batch(items)
        assert preview["total_count"] == 2

    def _test_batch_partial(self):
        items = [
            BatchItem(id="1", params={"keyword": "正常"}, client_id="c1"),
            BatchItem(id="2", params={"keyword": "测试违禁"}, client_id="c1"),
        ]
        result = self.batch_sign(items, compensate_enabled=False)
        assert result["partial_success"] == True
        assert result["success_count"] == 1
        assert result["fail_count"] == 1

    def _test_empty_params(self):
        result = self.sign({}, "client_001", False)
        assert result["success"] == True

    def _test_special_chars(self):
        params = {"special": "!@#$%^&*()_+-=[]{}|;':\",./<>?"}
        result = self.sign(params, "client_001", False)
        assert result["success"] == True
