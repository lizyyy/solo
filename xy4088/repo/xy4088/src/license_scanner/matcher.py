import re
import unicodedata
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import List, Dict, Optional, Tuple, Set

from .models import Asset, License, AssetType


class MatchStrength(Enum):
    EXACT_HASH = "exact_hash"
    EXACT_NAME = "exact_name"
    STRONG_NAME = "strong_name"
    FUZZY_NAME = "fuzzy_name"
    TYPE_BASED = "type_based"


MATCH_STRENGTH_ORDER = {
    MatchStrength.EXACT_HASH: 100,
    MatchStrength.EXACT_NAME: 90,
    MatchStrength.STRONG_NAME: 70,
    MatchStrength.FUZZY_NAME: 50,
    MatchStrength.TYPE_BASED: 30,
}


@dataclass
class MatchResult:
    asset: Asset
    license: License
    strength: MatchStrength
    confidence: float
    matched_by: str
    details: Dict[str, str]

    def to_dict(self) -> Dict:
        return {
            "asset_file": self.asset.file_path,
            "asset_hash": self.asset.file_hash,
            "license_id": self.license.license_id,
            "license_asset_name": self.license.asset_name,
            "strength": self.strength.value,
            "confidence": self.confidence,
            "matched_by": self.matched_by,
            "details": self.details
        }


def normalize_name(name: str) -> str:
    name = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode('ascii')
    name = name.lower()
    name = re.sub(r'[_\-\s\.]+', ' ', name)
    name = re.sub(r'\s+', ' ', name)
    name = name.strip()
    return name


def normalize_name_without_ext(name: str) -> str:
    path = Path(name)
    base = path.stem if path.suffix else name
    return normalize_name(base)


def levenshtein_distance(s1: str, s2: str) -> int:
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    
    if len(s2) == 0:
        return len(s1)
    
    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
    
    return previous_row[-1]


def fuzzy_match_score(s1: str, s2: str) -> float:
    if not s1 or not s2:
        return 0.0
    
    s1_norm = normalize_name(s1)
    s2_norm = normalize_name(s2)
    
    if s1_norm == s2_norm:
        return 1.0
    
    s1_no_ext = normalize_name_without_ext(s1)
    s2_no_ext = normalize_name_without_ext(s2)
    
    if s1_no_ext == s2_no_ext:
        return 0.95
    
    max_len = max(len(s1_no_ext), len(s2_no_ext))
    if max_len == 0:
        return 0.0
    
    distance = levenshtein_distance(s1_no_ext, s2_no_ext)
    score = 1.0 - (distance / max_len)
    
    if s1_no_ext in s2_no_ext or s2_no_ext in s1_no_ext:
        score = max(score, 0.7)
    
    words1 = set(s1_no_ext.split())
    words2 = set(s2_no_ext.split())
    common_words = words1 & words2
    all_words = words1 | words2
    
    if all_words:
        word_score = len(common_words) / len(all_words)
        score = max(score, word_score * 0.8)
    
    return max(0.0, min(1.0, score))


class AssetLicenseMatcher:
    def __init__(self, 
                 min_confidence: float = 0.3,
                 prefer_hash_match: bool = True):
        self.min_confidence = min_confidence
        self.prefer_hash_match = prefer_hash_match

    def match_all(self, 
                  assets: List[Asset], 
                  licenses: List[License]) -> Tuple[List[MatchResult], Dict[str, List[Asset]]]:
        hash_to_assets: Dict[str, List[Asset]] = {}
        name_to_assets: Dict[str, List[Asset]] = {}
        norm_name_to_assets: Dict[str, List[Asset]] = {}
        type_to_assets: Dict[AssetType, List[Asset]] = {}

        for asset in assets:
            if asset.file_hash not in hash_to_assets:
                hash_to_assets[asset.file_hash] = []
            hash_to_assets[asset.file_hash].append(asset)
            
            file_name_lower = asset.file_name.lower()
            if file_name_lower not in name_to_assets:
                name_to_assets[file_name_lower] = []
            name_to_assets[file_name_lower].append(asset)
            
            norm_name = normalize_name_without_ext(asset.file_name)
            if norm_name not in norm_name_to_assets:
                norm_name_to_assets[norm_name] = []
            norm_name_to_assets[norm_name].append(asset)
            
            if asset.asset_type not in type_to_assets:
                type_to_assets[asset.asset_type] = []
            type_to_assets[asset.asset_type].append(asset)

        results: List[MatchResult] = []
        matched_assets: Set[str] = set()

        for lic in licenses:
            matches = self._match_license(lic, hash_to_assets, name_to_assets, 
                                          norm_name_to_assets, type_to_assets)
            
            for match in matches:
                if match.asset.file_path not in matched_assets:
                    match.asset.matched_licenses.append(lic)
                    matched_assets.add(match.asset.file_path)
                    results.append(match)

        unmatched_assets: Dict[str, List[Asset]] = {
            "unmatched": [],
            "multiple_matches": []
        }
        
        for asset in assets:
            match_count = len(asset.matched_licenses)
            if match_count == 0:
                unmatched_assets["unmatched"].append(asset)
            elif match_count > 1:
                unmatched_assets["multiple_matches"].append(asset)

        return results, unmatched_assets

    def _match_license(self, 
                       lic: License,
                       hash_to_assets: Dict[str, List[Asset]],
                       name_to_assets: Dict[str, List[Asset]],
                       norm_name_to_assets: Dict[str, List[Asset]],
                       type_to_assets: Dict[AssetType, List[Asset]]) -> List[MatchResult]:
        results: List[MatchResult] = []

        if lic.asset_hash:
            assets = hash_to_assets.get(lic.asset_hash, [])
            for asset in assets:
                results.append(MatchResult(
                    asset=asset,
                    license=lic,
                    strength=MatchStrength.EXACT_HASH,
                    confidence=1.0,
                    matched_by="hash",
                    details={"reason": "Exact hash match"}
                ))

        if results and self.prefer_hash_match:
            return results

        asset_name_lower = lic.asset_name.lower()
        if asset_name_lower in name_to_assets:
            assets = name_to_assets[asset_name_lower]
            for asset in assets:
                if not any(r.asset == asset for r in results):
                    results.append(MatchResult(
                        asset=asset,
                        license=lic,
                        strength=MatchStrength.EXACT_NAME,
                        confidence=0.95,
                        matched_by="exact_name",
                        details={"reason": "Exact filename match"}
                    ))

        lic_norm_name = normalize_name_without_ext(lic.asset_name)
        if lic_norm_name in norm_name_to_assets:
            assets = norm_name_to_assets[lic_norm_name]
            for asset in assets:
                if not any(r.asset == asset for r in results):
                    results.append(MatchResult(
                        asset=asset,
                        license=lic,
                        strength=MatchStrength.STRONG_NAME,
                        confidence=0.85,
                        matched_by="strong_name",
                        details={"reason": "Strong normalized name match"}
                    ))

        if lic.asset_type and lic.asset_type in type_to_assets:
            assets = type_to_assets[lic.asset_type]
            for asset in assets:
                if not any(r.asset == asset for r in results):
                    score = fuzzy_match_score(lic.asset_name, asset.file_name)
                    if score >= self.min_confidence:
                        if score >= 0.7:
                            strength = MatchStrength.FUZZY_NAME
                            matched_by = "fuzzy_name"
                        else:
                            strength = MatchStrength.TYPE_BASED
                            matched_by = "type_based"
                        
                        results.append(MatchResult(
                            asset=asset,
                            license=lic,
                            strength=strength,
                            confidence=score,
                            matched_by=matched_by,
                            details={
                                "reason": f"Fuzzy match (score: {score:.2f})",
                                "license_name": lic.asset_name,
                                "asset_name": asset.file_name
                            }
                        ))

        results.sort(key=lambda x: MATCH_STRENGTH_ORDER.get(x.strength, 0), reverse=True)
        
        if results:
            return [results[0]]
        
        return []

    def find_duplicates(self, assets: List[Asset]) -> Dict[str, List[Asset]]:
        hash_groups: Dict[str, List[Asset]] = {}
        
        for asset in assets:
            if asset.file_hash not in hash_groups:
                hash_groups[asset.file_hash] = []
            hash_groups[asset.file_hash].append(asset)
        
        duplicates = {h: group for h, group in hash_groups.items() if len(group) > 1}
        return duplicates

    def find_name_hash_mismatches(self, assets: List[Asset]) -> List[Tuple[Asset, Asset]]:
        name_groups: Dict[str, List[Asset]] = {}
        
        for asset in assets:
            name_key = asset.file_name.lower()
            if name_key not in name_groups:
                name_groups[name_key] = []
            name_groups[name_key].append(asset)
        
        mismatches: List[Tuple[Asset, Asset]] = []
        
        for name, group in name_groups.items():
            if len(group) > 1:
                hashes = {a.file_hash for a in group}
                if len(hashes) > 1:
                    for i in range(len(group)):
                        for j in range(i + 1, len(group)):
                            if group[i].file_hash != group[j].file_hash:
                                mismatches.append((group[i], group[j]))
        
        return mismatches


def match_assets_and_licenses(assets: List[Asset], 
                               licenses: List[License],
                               min_confidence: float = 0.3) -> Tuple[List[MatchResult], Dict[str, List[Asset]]]:
    matcher = AssetLicenseMatcher(min_confidence=min_confidence)
    return matcher.match_all(assets, licenses)


def find_duplicate_assets(assets: List[Asset]) -> Dict[str, List[Asset]]:
    matcher = AssetLicenseMatcher()
    return matcher.find_duplicates(assets)
