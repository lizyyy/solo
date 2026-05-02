import uuid
from datetime import datetime
from typing import List, Dict, Optional, Set, Tuple
from collections import defaultdict

from .models import (
    Asset, License, Risk, RiskType, RiskLevel,
    AssetType
)
from .matcher import AssetLicenseMatcher


class RiskChecker:
    def __init__(self, 
                 current_date: Optional[datetime] = None,
                 required_usage: Optional[List[str]] = None,
                 min_required_seats: int = 1):
        self.current_date = current_date or datetime.now()
        self.required_usage = required_usage or []
        self.min_required_seats = min_required_seats

    def check_all(self, 
                  assets: List[Asset],
                  licenses: List[License],
                  matches: List[Dict]) -> List[Risk]:
        risks: List[Risk] = []

        risks.extend(self._check_missing_licenses(assets))

        risks.extend(self._check_expired_licenses(assets, licenses))

        risks.extend(self._check_usage_mismatch(assets, licenses))

        risks.extend(self._check_insufficient_seats(licenses))

        risks.extend(self._check_name_hash_mismatches(assets))

        risks.extend(self._check_duplicate_assets(assets))

        risks.extend(self._check_renamed_assets(assets, licenses))

        return risks

    def _check_missing_licenses(self, assets: List[Asset]) -> List[Risk]:
        risks: List[Risk] = []
        
        for asset in assets:
            if len(asset.matched_licenses) == 0:
                if asset.asset_type in [AssetType.DOCUMENT]:
                    level = RiskLevel.LOW
                else:
                    level = RiskLevel.CRITICAL
                
                risks.append(Risk(
                    risk_id=f"RISK-{uuid.uuid4().hex[:8]}",
                    risk_type=RiskType.MISSING_LICENSE,
                    risk_level=level,
                    asset=asset,
                    message=f"素材 '{asset.file_name}' 缺少授权文件",
                    details={
                        "asset_type": asset.asset_type.value,
                        "file_size": asset.file_size,
                        "file_hash": asset.file_hash
                    }
                ))
        
        return risks

    def _check_expired_licenses(self, assets: List[Asset], licenses: List[License]) -> List[Risk]:
        risks: List[Risk] = []
        checked_license_ids: Set[str] = set()

        for asset in assets:
            for lic in asset.matched_licenses:
                if lic.license_id in checked_license_ids:
                    continue
                
                if lic.expiry_date:
                    days_until_expiry = (lic.expiry_date - self.current_date).days
                    
                    if days_until_expiry < 0:
                        risks.append(Risk(
                            risk_id=f"RISK-{uuid.uuid4().hex[:8]}",
                            risk_type=RiskType.EXPIRED,
                            risk_level=RiskLevel.CRITICAL,
                            asset=asset,
                            license=lic,
                            message=f"授权 '{lic.asset_name}' 已过期 {abs(days_until_expiry)} 天",
                            details={
                                "expiry_date": lic.expiry_date.isoformat(),
                                "days_expired": abs(days_until_expiry),
                                "license_id": lic.license_id
                            }
                        ))
                    elif days_until_expiry <= 30:
                        risks.append(Risk(
                            risk_id=f"RISK-{uuid.uuid4().hex[:8]}",
                            risk_type=RiskType.EXPIRED,
                            risk_level=RiskLevel.MEDIUM,
                            asset=asset,
                            license=lic,
                            message=f"授权 '{lic.asset_name}' 将在 {days_until_expiry} 天后过期",
                            details={
                                "expiry_date": lic.expiry_date.isoformat(),
                                "days_remaining": days_until_expiry,
                                "license_id": lic.license_id
                            }
                        ))
                
                checked_license_ids.add(lic.license_id)
        
        return risks

    def _check_usage_mismatch(self, assets: List[Asset], licenses: List[License]) -> List[Risk]:
        risks: List[Risk] = []
        
        if not self.required_usage:
            return risks

        for asset in assets:
            for lic in asset.matched_licenses:
                allowed = set(lic.allowed_usage)
                required = set(self.required_usage)
                
                missing = required - allowed
                
                if missing:
                    risks.append(Risk(
                        risk_id=f"RISK-{uuid.uuid4().hex[:8]}",
                        risk_type=RiskType.USAGE_MISMATCH,
                        risk_level=RiskLevel.HIGH,
                        asset=asset,
                        license=lic,
                        message=f"授权 '{lic.asset_name}' 不允许以下用途: {', '.join(missing)}",
                        details={
                            "allowed_usage": lic.allowed_usage,
                            "required_usage": self.required_usage,
                            "missing_usage": list(missing),
                            "license_id": lic.license_id
                        }
                    ))
        
        return risks

    def _check_insufficient_seats(self, licenses: List[License]) -> List[Risk]:
        risks: List[Risk] = []
        checked_license_ids: Set[str] = set()

        for lic in licenses:
            if lic.license_id in checked_license_ids:
                continue
            
            if lic.seats is not None and lic.seats < self.min_required_seats:
                risks.append(Risk(
                    risk_id=f"RISK-{uuid.uuid4().hex[:8]}",
                    risk_type=RiskType.INSUFFICIENT_SEATS,
                    risk_level=RiskLevel.HIGH,
                    license=lic,
                    message=f"授权 '{lic.asset_name}' 授权人数不足: 需要 {self.min_required_seats} 人, 实际 {lic.seats} 人",
                    details={
                        "required_seats": self.min_required_seats,
                        "actual_seats": lic.seats,
                        "license_id": lic.license_id
                    }
                ))
            
            checked_license_ids.add(lic.license_id)
        
        return risks

    def _check_name_hash_mismatches(self, assets: List[Asset]) -> List[Risk]:
        risks: List[Risk] = []
        
        name_groups: Dict[str, List[Asset]] = defaultdict(list)
        for asset in assets:
            name_key = asset.file_name.lower()
            name_groups[name_key].append(asset)

        for name, group in name_groups.items():
            if len(group) > 1:
                hashes = {a.file_hash for a in group}
                if len(hashes) > 1:
                    for i, asset in enumerate(group):
                        other_assets = [a for a in group if a != asset]
                        for other in other_assets:
                            risks.append(Risk(
                                risk_id=f"RISK-{uuid.uuid4().hex[:8]}",
                                risk_type=RiskType.NAME_HASH_MISMATCH,
                                risk_level=RiskLevel.HIGH,
                                asset=asset,
                                message=f"同名文件 '{asset.file_name}' 存在不同版本 (与 '{other.file_path}' 哈希不同)",
                                details={
                                    "this_hash": asset.file_hash,
                                    "other_hash": other.file_hash,
                                    "this_path": asset.file_path,
                                    "other_path": other.file_path
                                }
                            ))
        
        return risks

    def _check_duplicate_assets(self, assets: List[Asset]) -> List[Risk]:
        risks: List[Risk] = []
        
        matcher = AssetLicenseMatcher()
        duplicates = matcher.find_duplicates(assets)

        for file_hash, group in duplicates.items():
            if len(group) > 1:
                main_asset = group[0]
                other_assets = group[1:]
                
                risks.append(Risk(
                    risk_id=f"RISK-{uuid.uuid4().hex[:8]}",
                    risk_type=RiskType.DUPLICATE_ASSET,
                    risk_level=RiskLevel.MEDIUM,
                    asset=main_asset,
                    message=f"检测到 {len(group)} 个重复素材 (哈希: {file_hash[:12]}...)",
                    details={
                        "file_hash": file_hash,
                        "duplicate_count": len(group),
                        "duplicate_paths": [a.file_path for a in group]
                    }
                ))
        
        return risks

    def _check_renamed_assets(self, assets: List[Asset], licenses: List[License]) -> List[Risk]:
        risks: List[Risk] = []
        
        hash_to_assets: Dict[str, List[Asset]] = defaultdict(list)
        for asset in assets:
            hash_to_assets[asset.file_hash].append(asset)

        for lic in licenses:
            if lic.asset_hash:
                matched_assets = hash_to_assets.get(lic.asset_hash, [])
                for asset in matched_assets:
                    lic_name_lower = lic.asset_name.lower()
                    asset_name_lower = asset.file_name.lower()
                    
                    if lic_name_lower != asset_name_lower:
                        from .matcher import normalize_name_without_ext
                        lic_norm = normalize_name_without_ext(lic.asset_name)
                        asset_norm = normalize_name_without_ext(asset.file_name)
                        
                        if lic_norm != asset_norm:
                            risks.append(Risk(
                                risk_id=f"RISK-{uuid.uuid4().hex[:8]}",
                                risk_type=RiskType.RENAMED_ASSET,
                                risk_level=RiskLevel.LOW,
                                asset=asset,
                                license=lic,
                                message=f"素材可能被重命名: 授权中为 '{lic.asset_name}', 实际文件名为 '{asset.file_name}'",
                                details={
                                    "license_name": lic.asset_name,
                                    "actual_name": asset.file_name,
                                    "matched_hash": True,
                                    "license_id": lic.license_id
                                }
                            ))
        
        return risks

    def check_single(self, 
                     asset: Asset, 
                     licenses: List[License]) -> List[Risk]:
        return self.check_all([asset], licenses, [])


def check_risks(assets: List[Asset],
                licenses: List[License],
                matches: List[Dict],
                current_date: Optional[datetime] = None,
                required_usage: Optional[List[str]] = None,
                min_required_seats: int = 1) -> List[Risk]:
    checker = RiskChecker(
        current_date=current_date,
        required_usage=required_usage,
        min_required_seats=min_required_seats
    )
    return checker.check_all(assets, licenses, matches)


def group_risks_by_type(risks: List[Risk]) -> Dict[RiskType, List[Risk]]:
    grouped: Dict[RiskType, List[Risk]] = defaultdict(list)
    for risk in risks:
        grouped[risk.risk_type].append(risk)
    return dict(grouped)


def group_risks_by_level(risks: List[Risk]) -> Dict[RiskLevel, List[Risk]]:
    grouped: Dict[RiskLevel, List[Risk]] = defaultdict(list)
    for risk in risks:
        grouped[risk.risk_level].append(risk)
    return dict(grouped)


def get_risk_summary(risks: List[Risk]) -> Dict[str, Dict[str, int]]:
    by_type: Dict[str, int] = defaultdict(int)
    by_level: Dict[str, int] = defaultdict(int)
    
    for risk in risks:
        by_type[risk.risk_type.value] += 1
        by_level[risk.risk_level.value] += 1
    
    return {
        "by_type": dict(by_type),
        "by_level": dict(by_level),
        "total": len(risks)
    }
