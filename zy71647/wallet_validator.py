import re
from typing import Tuple, Optional
from models import WalletType


class WalletValidator:
    @staticmethod
    def validate_btc_address(address: str) -> Tuple[bool, Optional[str]]:
        if not address:
            return False, "地址不能为空"
        
        address = address.strip()
        
        if len(address) < 26 or len(address) > 62:
            return False, f"地址长度异常: {len(address)}位 (正常26-62位)"
        
        if not re.match(r'^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$', address) and \
           not re.match(r'^bc1[ac-hj-np-z02-9]{8,87}$', address.lower()):
            return False, "地址格式不符合BTC规范(P2PKH/P2SH/Bech32)"
        
        if re.search(r'[IlO0]', address):
            return False, "地址包含易混淆字符(I/l/O/0)"
        
        return True, None

    @staticmethod
    def validate_eth_address(address: str) -> Tuple[bool, Optional[str]]:
        if not address:
            return False, "地址不能为空"
        
        address = address.strip()
        
        if not address.startswith('0x'):
            return False, "ETH地址必须以0x开头"
        
        hex_part = address[2:]
        if len(hex_part) != 40:
            return False, f"地址长度异常: {len(hex_part)}位 (正常40位十六进制)"
        
        if not re.match(r'^[0-9a-fA-F]{40}$', hex_part):
            return False, "地址包含非法十六进制字符"
        
        if address == '0x0000000000000000000000000000000000000000':
            return False, "零地址不能用于收款"
        
        return True, None

    @staticmethod
    def validate_sol_address(address: str) -> Tuple[bool, Optional[str]]:
        if not address:
            return False, "地址不能为空"
        
        address = address.strip()
        
        if len(address) < 32 or len(address) > 44:
            return False, f"地址长度异常: {len(address)}位 (正常32-44位)"
        
        if not re.match(r'^[1-9A-HJ-NP-Za-km-z]{32,44}$', address):
            return False, "地址格式不符合Base58编码规范"
        
        if re.search(r'[0OlI]', address):
            return False, "地址包含易混淆字符(0/O/l/I)"
        
        return True, None

    @classmethod
    def validate_address(cls, address: str, wallet_type: WalletType) -> Tuple[bool, Optional[str]]:
        validators = {
            WalletType.BTC: cls.validate_btc_address,
            WalletType.ETH: cls.validate_eth_address,
            WalletType.SOL: cls.validate_sol_address,
        }
        
        validator = validators.get(wallet_type)
        if not validator:
            return False, f"不支持的钱包类型: {wallet_type}"
        
        return validator(address)

    @classmethod
    def validate_address_simple(cls, address: str, wallet_type: WalletType) -> bool:
        is_valid, _ = cls.validate_address(address, wallet_type)
        return is_valid
