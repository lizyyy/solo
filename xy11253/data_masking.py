import re
from typing import Any, Dict, List
from schemas import Role


class DataMasking:
    SENSITIVE_FIELDS = {
        "customer_phone": "phone",
        "customer_name": "name",
        "operator_id": "id",
        "operator_name": "name",
        "ip_address": "ip",
    }

    ROLE_PERMISSIONS = {
        Role.ADMIN: ["phone", "name", "id", "ip"],
        Role.FINANCE: ["phone", "name", "id"],
        Role.OPERATOR: ["name"],
        Role.CUSTOMER_SERVICE: ["name", "phone"],
        Role.VIEWER: [],
    }

    @classmethod
    def mask_phone(cls, phone: str) -> str:
        if not phone or len(phone) < 7:
            return phone
        return phone[:3] + "****" + phone[-4:]

    @classmethod
    def mask_name(cls, name: str) -> str:
        if not name or len(name) <= 1:
            return name
        return name[0] + "*" * (len(name) - 1)

    @classmethod
    def mask_id(cls, id_str: str) -> str:
        if not id_str or len(id_str) < 6:
            return id_str
        return id_str[:2] + "****" + id_str[-2:]

    @classmethod
    def mask_ip(cls, ip: str) -> str:
        if not ip:
            return ip
        parts = ip.split(".")
        if len(parts) == 4:
            return f"{parts[0]}.{parts[1]}.*.*"
        return ip

    @classmethod
    def mask_value(cls, field_type: str, value: Any) -> Any:
        if value is None:
            return value
        mask_methods = {
            "phone": cls.mask_phone,
            "name": cls.mask_name,
            "id": cls.mask_id,
            "ip": cls.mask_ip,
        }
        method = mask_methods.get(field_type)
        if method:
            return method(str(value))
        return value

    @classmethod
    def mask_dict(cls, data: Dict[str, Any], role: Role, include_sensitive: bool = False) -> Dict[str, Any]:
        if include_sensitive and role in [Role.ADMIN, Role.FINANCE]:
            return data.copy()

        allowed_fields = cls.ROLE_PERMISSIONS.get(role, [])
        result = {}

        for key, value in data.items():
            field_type = cls.SENSITIVE_FIELDS.get(key)
            if field_type:
                if field_type in allowed_fields:
                    result[key] = value
                else:
                    result[key] = cls.mask_value(field_type, value)
            elif isinstance(value, dict):
                result[key] = cls.mask_dict(value, role, include_sensitive)
            elif isinstance(value, list):
                result[key] = [
                    cls.mask_dict(item, role, include_sensitive) if isinstance(item, dict) else item
                    for item in value
                ]
            else:
                result[key] = value

        return result

    @classmethod
    def mask_log(cls, log_data: str) -> str:
        patterns = [
            (r"1[3-9]\d{9}", cls.mask_phone),
            (r"\d{11}", cls.mask_phone),
            (r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}", cls.mask_ip),
        ]

        result = log_data
        for pattern, mask_func in patterns:
            matches = re.findall(pattern, result)
            for match in matches:
                result = result.replace(match, mask_func(match))
        return result
