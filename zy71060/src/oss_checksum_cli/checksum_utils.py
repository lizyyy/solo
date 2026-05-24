import hashlib
import base64
import zlib
from typing import Optional
from .models import ChecksumAlgorithm, ChecksumFormat


class ChecksumConverter:
    @staticmethod
    def hex_to_base64(hex_str: str) -> str:
        return base64.b64encode(bytes.fromhex(hex_str)).decode('ascii')

    @staticmethod
    def base64_to_hex(b64_str: str) -> str:
        return base64.b64decode(b64_str).hex()

    @staticmethod
    def normalize_hex(hex_str: str) -> str:
        return hex_str.lower().strip()

    @staticmethod
    def normalize_base64(b64_str: str) -> str:
        return b64_str.strip()

    @staticmethod
    def detect_format(value: str) -> ChecksumFormat:
        value = value.strip()
        
        common_hex_lengths = {32, 40, 64, 128}
        if len(value) in common_hex_lengths:
            hex_chars = set('0123456789abcdefABCDEF')
            if all(c in hex_chars for c in value):
                return ChecksumFormat.HEX
        
        hex_chars = set('0123456789abcdefABCDEF')
        if all(c in hex_chars for c in value):
            return ChecksumFormat.HEX
        
        if len(value) % 4 == 0:
            try:
                decoded = base64.b64decode(value, validate=True)
                if len(decoded) in [16, 20, 32, 64]:
                    return ChecksumFormat.BASE64
            except Exception:
                pass
        
        return ChecksumFormat.HEX

    def convert(
        self,
        value: str,
        from_format: ChecksumFormat,
        to_format: ChecksumFormat
    ) -> str:
        if from_format == to_format:
            return value

        if from_format == ChecksumFormat.HEX:
            if to_format == ChecksumFormat.BASE64:
                return self.hex_to_base64(value)
        elif from_format == ChecksumFormat.BASE64:
            if to_format == ChecksumFormat.HEX:
                return self.base64_to_hex(value)

        return value

    def are_equal(
        self,
        value1: str,
        value2: str,
        format1: Optional[ChecksumFormat] = None,
        format2: Optional[ChecksumFormat] = None
    ) -> bool:
        if format1 is None:
            format1 = self.detect_format(value1)
        if format2 is None:
            format2 = self.detect_format(value2)

        if format1 == format2:
            if format1 == ChecksumFormat.HEX:
                return self.normalize_hex(value1) == self.normalize_hex(value2)
            else:
                return self.normalize_base64(value1) == self.normalize_base64(value2)

        try:
            normalized1 = self.convert(value1, format1, ChecksumFormat.HEX)
            normalized2 = self.convert(value2, format2, ChecksumFormat.HEX)
            return self.normalize_hex(normalized1) == self.normalize_hex(normalized2)
        except Exception:
            return value1.strip() == value2.strip()

    def normalize_to_hex(
        self,
        value: str,
        format: Optional[ChecksumFormat] = None
    ) -> Optional[str]:
        if format is None:
            format = self.detect_format(value)
        
        try:
            if format == ChecksumFormat.HEX:
                return self.normalize_hex(value)
            else:
                return self.base64_to_hex(value)
        except Exception:
            return None


class ChecksumCalculator:
    def __init__(self):
        self.hash_functions = {
            ChecksumAlgorithm.MD5: hashlib.md5,
            ChecksumAlgorithm.SHA1: hashlib.sha1,
            ChecksumAlgorithm.SHA256: hashlib.sha256,
            ChecksumAlgorithm.SHA512: hashlib.sha512,
        }

    def calculate(
        self,
        data: bytes,
        algorithm: ChecksumAlgorithm,
        output_format: ChecksumFormat = ChecksumFormat.HEX
    ) -> str:
        if algorithm in [ChecksumAlgorithm.CRC32, ChecksumAlgorithm.CRC64]:
            return self._calculate_crc(data, algorithm, output_format)

        hash_func = self.hash_functions.get(algorithm)
        if not hash_func:
            raise ValueError(f"Unsupported checksum algorithm: {algorithm}")

        digest = hash_func(data).digest()
        return self._format_digest(digest, output_format)

    def _calculate_crc(
        self,
        data: bytes,
        algorithm: ChecksumAlgorithm,
        output_format: ChecksumFormat
    ) -> str:
        if algorithm == ChecksumAlgorithm.CRC32:
            crc_value = zlib.crc32(data) & 0xffffffff
            digest = crc_value.to_bytes(4, byteorder='big')
        else:
            raise ValueError(f"CRC64 not implemented yet")

        return self._format_digest(digest, output_format)

    def _format_digest(self, digest: bytes, output_format: ChecksumFormat) -> str:
        if output_format == ChecksumFormat.HEX:
            return digest.hex()
        elif output_format == ChecksumFormat.BASE64:
            return base64.b64encode(digest).decode('ascii')
        return digest.hex()

    def verify(
        self,
        data: bytes,
        expected: str,
        algorithm: ChecksumAlgorithm,
        expected_format: ChecksumFormat
    ) -> tuple[bool, str]:
        actual = self.calculate(data, algorithm, expected_format)
        converter = ChecksumConverter()
        return converter.are_equal(actual, expected, expected_format), actual
