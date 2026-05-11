import csv
import json
from datetime import datetime
from typing import List, Dict, Any
from pathlib import Path
from .models import (
    OldUser, UserMapping, PointRecord, Coupon, PhoneBinding,
    SystemState, CouponStatus
)


def parse_datetime(value: str) -> datetime:
    if not value:
        return None
    formats = [
        '%Y-%m-%d %H:%M:%S',
        '%Y-%m-%dT%H:%M:%S',
        '%Y-%m-%d %H:%M',
        '%Y-%m-%d',
    ]
    for fmt in formats:
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    raise ValueError(f'无法解析日期时间: {value}')


def load_json(file_path: str) -> List[Dict[str, Any]]:
    path = Path(file_path)
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    if isinstance(data, dict):
        if 'data' in data:
            return data['data']
        return [data]
    return data


def load_csv(file_path: str) -> List[Dict[str, Any]]:
    path = Path(file_path)
    with open(path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        return list(reader)


def load_file(file_path: str) -> List[Dict[str, Any]]:
    path = Path(file_path)
    if path.suffix.lower() == '.json':
        return load_json(file_path)
    elif path.suffix.lower() == '.csv':
        return load_csv(file_path)
    else:
        raise ValueError(f'不支持的文件格式: {path.suffix}')


def parse_old_user(row: Dict[str, Any]) -> OldUser:
    return OldUser(
        old_user_id=row.get('old_user_id') or row.get('user_id') or row.get('id'),
        nickname=row.get('nickname', ''),
        phone=row.get('phone') or None,
        points_balance=int(row.get('points_balance') or row.get('points') or 0),
        created_at=parse_datetime(row.get('created_at')) if row.get('created_at') else None,
        last_login_at=parse_datetime(row.get('last_login_at')) if row.get('last_login_at') else None,
        extra={k: v for k, v in row.items() if k not in [
            'old_user_id', 'user_id', 'id', 'nickname', 'phone',
            'points_balance', 'points', 'created_at', 'last_login_at'
        ]}
    )


def parse_user_mapping(row: Dict[str, Any]) -> UserMapping:
    return UserMapping(
        old_user_id=row.get('old_user_id'),
        new_user_id=row.get('new_user_id'),
        phone=row.get('phone') or None,
        mapped_at=parse_datetime(row.get('mapped_at')) if row.get('mapped_at') else None,
    )


def parse_point_record(row: Dict[str, Any]) -> PointRecord:
    return PointRecord(
        record_id=row.get('record_id') or row.get('id'),
        old_user_id=row.get('old_user_id') or row.get('user_id'),
        points=int(row.get('points') or 0),
        type=row.get('type', 'unknown'),
        reason=row.get('reason', ''),
        created_at=parse_datetime(row.get('created_at')),
        balance_after=int(row.get('balance_after')) if row.get('balance_after') else None,
    )


def parse_coupon_status(status: str) -> CouponStatus:
    status_map = {
        'active': CouponStatus.ACTIVE,
        '可用': CouponStatus.ACTIVE,
        'used': CouponStatus.USED,
        '已使用': CouponStatus.USED,
        'expired': CouponStatus.EXPIRED,
        '已过期': CouponStatus.EXPIRED,
        'revoked': CouponStatus.REVOKED,
        '已作废': CouponStatus.REVOKED,
    }
    return status_map.get(status.lower(), CouponStatus.ACTIVE)


def parse_coupon(row: Dict[str, Any]) -> Coupon:
    return Coupon(
        coupon_id=row.get('coupon_id') or row.get('id'),
        old_user_id=row.get('old_user_id') or row.get('user_id'),
        name=row.get('name', ''),
        value=float(row.get('value') or 0),
        value_type=row.get('value_type', 'fixed'),
        status=parse_coupon_status(row.get('status', 'active')),
        issue_date=parse_datetime(row.get('issue_date')) if row.get('issue_date') else None,
        expire_date=parse_datetime(row.get('expire_date')) if row.get('expire_date') else None,
        used_date=parse_datetime(row.get('used_date')) if row.get('used_date') else None,
    )


def parse_phone_binding(row: Dict[str, Any]) -> PhoneBinding:
    return PhoneBinding(
        phone=row.get('phone'),
        old_user_id=row.get('old_user_id') or row.get('user_id'),
        bound_at=parse_datetime(row.get('bound_at') or row.get('created_at')),
    )


class DataLoader:
    def __init__(self, state: SystemState):
        self.state = state

    def load_old_users(self, file_path: str) -> int:
        data = load_file(file_path)
        count = 0
        for row in data:
            user = parse_old_user(row)
            if user.old_user_id:
                self.state.old_users[user.old_user_id] = user
                count += 1
        return count

    def load_user_mappings(self, file_path: str) -> int:
        data = load_file(file_path)
        count = 0
        for row in data:
            mapping = parse_user_mapping(row)
            if mapping.old_user_id and mapping.new_user_id:
                self.state.user_mappings[mapping.old_user_id] = mapping
                count += 1
        return count

    def load_point_records(self, file_path: str) -> int:
        data = load_file(file_path)
        count = 0
        for row in data:
            record = parse_point_record(row)
            if record.old_user_id:
                if record.old_user_id not in self.state.point_records:
                    self.state.point_records[record.old_user_id] = []
                self.state.point_records[record.old_user_id].append(record)
                count += 1
        return count

    def load_coupons(self, file_path: str) -> int:
        data = load_file(file_path)
        count = 0
        for row in data:
            coupon = parse_coupon(row)
            if coupon.old_user_id:
                if coupon.old_user_id not in self.state.coupons:
                    self.state.coupons[coupon.old_user_id] = []
                self.state.coupons[coupon.old_user_id].append(coupon)
                count += 1
        return count

    def load_phone_bindings(self, file_path: str) -> int:
        data = load_file(file_path)
        count = 0
        for row in data:
            binding = parse_phone_binding(row)
            if binding.phone:
                if binding.phone not in self.state.phone_bindings:
                    self.state.phone_bindings[binding.phone] = []
                self.state.phone_bindings[binding.phone].append(binding)
                count += 1
        return count
