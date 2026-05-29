import pandas as pd
import hashlib
import hmac
import base64
from typing import Dict, List, Any
import logging
import time

from .config import Config

logger = logging.getLogger(__name__)


class CallbackValidator:
    def __init__(self, config: Config):
        self.config = config
        self.timeout = config.get("api_key_rotation.callback_validation.timeout", 10)
        self.max_retries = config.get("api_key_rotation.callback_validation.max_retries", 3)
        self.verify_ssl = config.get("api_key_rotation.callback_validation.verify_ssl", True)

    def validate_callbacks(self, callback_urls_df: pd.DataFrame, key_versions_df: pd.DataFrame) -> Dict[str, Any]:
        results = {
            "total_callbacks": 0,
            "signature_failures": [],
            "unreachable_urls": [],
            "url_format_errors": [],
            "callback_details": {}
        }

        if callback_urls_df is None or callback_urls_df.empty:
            logger.warning("回调地址数据为空")
            return results

        results["total_callbacks"] = len(callback_urls_df)

        key_map = self._build_key_map(key_versions_df)

        for _, row in callback_urls_df.iterrows():
            callback_info = self._extract_callback_info(row)
            callback_id = callback_info["callback_id"]

            format_check = self._check_url_format(callback_info)
            if not format_check["valid"]:
                results["url_format_errors"].append(format_check)

            signature_check = self._verify_signature(callback_info, key_map)
            if not signature_check["valid"]:
                results["signature_failures"].append(signature_check)

            results["callback_details"][callback_id] = {
                "basic": callback_info,
                "format": format_check,
                "signature": signature_check,
                "manual_note": row.get("备注", "")
            }

        return results

    def _extract_callback_info(self, row: pd.Series) -> Dict[str, Any]:
        return {
            "callback_id": str(row.get("回调ID", row.get("callback_id", row.get("id", "")))),
            "service_name": str(row.get("服务名称", row.get("service_name", ""))),
            "url": str(row.get("回调地址", row.get("callback_url", row.get("url", "")))),
            "sign_method": str(row.get("签名方式", row.get("sign_method", "hmac-sha256"))),
            "secret_key": str(row.get("签名密钥", row.get("secret_key", ""))),
            "status": str(row.get("状态", row.get("status", "启用"))),
            "last_success": str(row.get("最后成功时间", row.get("last_success", "")))
        }

    def _build_key_map(self, key_versions_df: pd.DataFrame) -> Dict[str, List[str]]:
        key_map = {}
        if key_versions_df is None or key_versions_df.empty:
            return key_map

        for _, row in key_versions_df.iterrows():
            service_name = str(row.get("服务名称", row.get("service_name", "")))
            key = str(row.get("密钥值", row.get("key_value", row.get("secret", ""))))
            if service_name and key:
                if service_name not in key_map:
                    key_map[service_name] = []
                key_map[service_name].append(key)
        return key_map

    def _check_url_format(self, callback_info: Dict[str, Any]) -> Dict[str, Any]:
        url = callback_info["url"]
        callback_id = callback_info["callback_id"]
        service_name = callback_info["service_name"]

        errors = []
        valid = True

        if not url or url in ["", "nan"]:
            valid = False
            errors.append("回调地址为空")
        elif not url.startswith("http://") and not url.startswith("https://"):
            valid = False
            errors.append("回调地址缺少http/https协议")

        return {
            "callback_id": callback_id,
            "service_name": service_name,
            "url": url,
            "valid": valid,
            "errors": errors,
            "explanation": "; ".join(errors) if not valid else "",
            "manual_note": ""
        }

    def _verify_signature(self, callback_info: Dict[str, Any], key_map: Dict[str, List[str]]) -> Dict[str, Any]:
        callback_id = callback_info["callback_id"]
        service_name = callback_info["service_name"]
        url = callback_info["url"]
        sign_method = callback_info["sign_method"]
        configured_secret = callback_info["secret_key"]

        service_keys = key_map.get(service_name, [])

        test_payload = f"test_payload_{int(time.time())}"
        signature_valid = False
        explanation = ""

        if configured_secret and configured_secret not in ["", "nan"]:
            expected_signature = self._generate_signature(test_payload, configured_secret, sign_method)
            signature_valid = True
            explanation = "签名配置存在"
        elif service_keys:
            signature_valid = True
            explanation = f"使用服务密钥可用于签名验证"
        else:
            signature_valid = False
            explanation = "该回调缺少配置或服务密钥，无法进行签名验证"

        return {
            "callback_id": callback_id,
            "service_name": service_name,
            "url": url,
            "sign_method": sign_method,
            "has_configured_secret": bool(configured_secret and configured_secret not in ["", "nan"]),
            "has_service_keys": len(service_keys) > 0,
            "valid": signature_valid,
            "explanation": explanation
        }

    def _generate_signature(self, payload: str, secret: str, method: str) -> str:
        method = method.lower().replace("-", "")
        if "sha256" in method or method == "hmacsha256":
            return hmac.new(
                secret.encode('utf-8'),
                payload.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()
        elif "sha1" in method:
            return hmac.new(
                secret.encode('utf-8'),
                payload.encode('utf-8'),
                hashlib.sha1
            ).hexdigest()
        else:
            return hmac.new(
                secret.encode('utf-8'),
                payload.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()

    def get_signature_failures_report(self, validation_results: Dict[str, Any]) -> pd.DataFrame:
        if not validation_results.get("signature_failures"):
            return pd.DataFrame()

        return pd.DataFrame(validation_results["signature_failures"])

    def get_url_format_errors_report(self, validation_results: Dict[str, Any]) -> pd.DataFrame:
        if not validation_results.get("url_format_errors"):
            return pd.DataFrame()

        return pd.DataFrame(validation_results["url_format_errors"])
