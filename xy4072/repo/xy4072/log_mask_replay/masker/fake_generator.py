"""假值生成器模块 - 生成一致化的假值用于脱敏"""

import hashlib
import re
from typing import Dict, Optional

from faker import Faker


class FakeValueGenerator:
    """假值生成器 - 确保同一原始值生成相同的假值"""
    
    def __init__(self, seed: Optional[int] = None):
        """
        初始化假值生成器
        
        Args:
            seed: 随机种子，用于确保一致性
        """
        self.faker = Faker("zh_CN")
        if seed is not None:
            self.faker.seed_instance(seed)
        
        # 用于存储原始值到假值的映射（临时缓存）
        self._cache: Dict[str, Dict[str, str]] = {
            "phone": {},
            "email": {},
            "device_id": {},
            "user_name": {},
            "address": {},
            "id_card": {},
            "bank_card": {},
        }
        
        # 计数器，用于生成唯一的序号
        self._counters: Dict[str, int] = {
            "phone": 0,
            "email": 0,
            "device_id": 0,
            "user_name": 0,
        }
    
    def _get_deterministic_seed(self, original_value: str, field_type: str) -> int:
        """
        根据原始值生成确定性的种子
        
        Args:
            original_value: 原始值
            field_type: 字段类型
            
        Returns:
            确定性的整数种子
        """
        combined = f"{field_type}:{original_value}"
        hash_obj = hashlib.md5(combined.encode("utf-8"))
        return int(hash_obj.hexdigest()[:8], 16)
    
    def generate_phone(self, original: str) -> str:
        """
        生成假手机号
        
        Args:
            original: 原始手机号
            
        Returns:
            假手机号，同一原始值总是返回相同的假值
        """
        if original in self._cache["phone"]:
            return self._cache["phone"][original]
        
        # 使用确定性种子
        seed = self._get_deterministic_seed(original, "phone")
        fake = Faker("zh_CN")
        fake.seed_instance(seed)
        
        # 生成假手机号，保持格式
        fake_phone = fake.phone_number()
        
        # 确保是中国大陆手机号格式
        if not fake_phone.startswith("1"):
            fake_phone = "1" + fake_phone[1:]
        
        # 缓存结果
        self._cache["phone"][original] = fake_phone
        return fake_phone
    
    def generate_email(self, original: str) -> str:
        """
        生成假邮箱
        
        Args:
            original: 原始邮箱
            
        Returns:
            假邮箱，同一原始值总是返回相同的假值
        """
        if original in self._cache["email"]:
            return self._cache["email"][original]
        
        # 解析原始邮箱的域名部分
        match = re.match(r"(.+)@(.+)", original)
        if match:
            original_local = match.group(1)
            original_domain = match.group(2)
        else:
            original_local = original
            original_domain = "example.com"
        
        # 使用确定性种子
        seed = self._get_deterministic_seed(original, "email")
        fake = Faker("zh_CN")
        fake.seed_instance(seed)
        
        # 生成假邮箱
        fake_local = fake.user_name()
        fake_domain = fake.domain_name()
        
        # 可以选择保留原始域名或使用假域名
        # 这里使用假域名以保护隐私
        fake_email = f"{fake_local}@{fake_domain}"
        
        # 缓存结果
        self._cache["email"][original] = fake_email
        return fake_email
    
    def generate_device_id(self, original: str) -> str:
        """
        生成假设备ID
        
        Args:
            original: 原始设备ID
            
        Returns:
            假设备ID，同一原始值总是返回相同的假值
        """
        if original in self._cache["device_id"]:
            return self._cache["device_id"][original]
        
        # 使用确定性种子
        seed = self._get_deterministic_seed(original, "device_id")
        fake = Faker("zh_CN")
        fake.seed_instance(seed)
        
        # 根据原始格式选择生成格式
        # 检测是否是 MAC 地址格式
        if re.match(r"^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$", original):
            fake_id = fake.mac_address()
        # 检测是否是 UUID 格式
        elif re.match(r"^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$", original, re.IGNORECASE):
            fake_id = fake.uuid4()
        # 检测是否是 IMEI 格式（15-16位数字）
        elif re.match(r"^\d{15,16}$", original):
            # 生成 15 位数字
            fake_id = "".join([str(fake.random_digit()) for _ in range(15)])
        else:
            # 默认生成 UUID
            fake_id = fake.uuid4()
        
        # 缓存结果
        self._cache["device_id"][original] = fake_id
        return fake_id
    
    def generate_user_name(self, original: str) -> str:
        """
        生成假用户名/真实姓名
        
        Args:
            original: 原始姓名
            
        Returns:
            假姓名，同一原始值总是返回相同的假值
        """
        if original in self._cache["user_name"]:
            return self._cache["user_name"][original]
        
        # 使用确定性种子
        seed = self._get_deterministic_seed(original, "user_name")
        fake = Faker("zh_CN")
        fake.seed_instance(seed)
        
        # 生成中文姓名
        fake_name = fake.name()
        
        # 缓存结果
        self._cache["user_name"][original] = fake_name
        return fake_name
    
    def generate_partial_mask(self, original: str, field_type: str) -> str:
        """
        生成部分掩码的假值
        
        Args:
            original: 原始值
            field_type: 字段类型
            
        Returns:
            部分掩码后的值
        """
        if not original:
            return original
        
        length = len(original)
        
        if field_type == "id_card":
            # 身份证号：保留前 6 位和后 4 位
            if length >= 14:
                return original[:6] + "*" * (length - 10) + original[-4:]
            else:
                return self._simple_mask(original)
        
        elif field_type == "bank_card":
            # 银行卡号：保留前 4 位和后 4 位
            if length >= 8:
                return original[:4] + "*" * (length - 8) + original[-4:]
            else:
                return self._simple_mask(original)
        
        elif field_type == "phone":
            # 手机号：保留前 3 位和后 4 位
            if length >= 7:
                return original[:3] + "*" * (length - 7) + original[-4:]
            else:
                return self._simple_mask(original)
        
        elif field_type == "email":
            # 邮箱：保留用户名的第一个字符和域名
            match = re.match(r"(.+)@(.+)", original)
            if match:
                local = match.group(1)
                domain = match.group(2)
                if len(local) > 1:
                    return local[0] + "*" * (len(local) - 1) + "@" + domain
                else:
                    return "*@" + domain
            else:
                return self._simple_mask(original)
        
        elif field_type == "address":
            # 地址：保留前 3 个字符和最后一个字符
            if length > 4:
                return original[:3] + "*" * (length - 4) + original[-1]
            else:
                return self._simple_mask(original)
        
        else:
            # 默认掩码策略
            return self._simple_mask(original)
    
    def _simple_mask(self, original: str) -> str:
        """
        简单掩码：保留前后各 1/4 字符
        
        Args:
            original: 原始值
            
        Returns:
            掩码后的值
        """
        length = len(original)
        if length <= 4:
            return "*" * length
        
        keep = max(1, length // 4)
        return original[:keep] + "*" * (length - keep * 2) + original[-keep:]
    
    def generate_hash(self, original: str, algorithm: str = "sha256") -> str:
        """
        生成哈希值
        
        Args:
            original: 原始值
            algorithm: 哈希算法
            
        Returns:
            哈希值
        """
        if algorithm == "md5":
            return hashlib.md5(original.encode("utf-8")).hexdigest()
        elif algorithm == "sha1":
            return hashlib.sha1(original.encode("utf-8")).hexdigest()
        else:  # sha256
            return hashlib.sha256(original.encode("utf-8")).hexdigest()
    
    def get_cache(self) -> Dict[str, Dict[str, str]]:
        """
        获取当前的映射缓存
        
        Returns:
            映射缓存字典
        """
        return self._cache.copy()
    
    def load_cache(self, cache: Dict[str, Dict[str, str]]) -> None:
        """
        加载映射缓存
        
        Args:
            cache: 映射缓存字典
        """
        for field_type, mappings in cache.items():
            if field_type in self._cache:
                self._cache[field_type].update(mappings)
    
    def clear_cache(self) -> None:
        """清空缓存"""
        for field_type in self._cache:
            self._cache[field_type].clear()
