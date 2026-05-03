import hashlib
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from collections import Counter, defaultdict

from fuzzywuzzy import fuzz
import numpy as np

from claim_risk_scanner.data_parser import InvoiceData, ClaimData, RiskSample


@dataclass
class InvoiceFeatures:
    invoice_number: str
    amount_anomaly_score: float = 0.0
    date_anomaly_score: float = 0.0
    ocr_confidence_score: float = 0.0
    item_amount_mismatch_score: float = 0.0
    tax_ratio_anomaly_score: float = 0.0
    amount_roundness_score: float = 0.0
    
    def to_dict(self) -> Dict[str, float]:
        return {
            'amount_anomaly_score': self.amount_anomaly_score,
            'date_anomaly_score': self.date_anomaly_score,
            'ocr_confidence_score': self.ocr_confidence_score,
            'item_amount_mismatch_score': self.item_amount_mismatch_score,
            'tax_ratio_anomaly_score': self.tax_ratio_anomaly_score,
            'amount_roundness_score': self.amount_roundness_score,
        }


@dataclass
class VendorFeatures:
    vendor_name: str
    risk_sample_match_score: float = 0.0
    vendor_appearance_frequency: int = 1
    vendor_risk_level: str = 'unknown'
    name_variation_count: int = 1
    tax_id_mismatch_score: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        level_map = {'low': 0.0, 'medium': 0.5, 'high': 1.0, 'unknown': 0.0}
        return {
            'risk_sample_match_score': self.risk_sample_match_score,
            'vendor_appearance_frequency': self.vendor_appearance_frequency,
            'vendor_risk_level_num': level_map.get(self.vendor_risk_level, 0.0),
            'name_variation_count': self.name_variation_count,
            'tax_id_mismatch_score': self.tax_id_mismatch_score,
        }


@dataclass
class DuplicateFeatures:
    invoice_number: str
    exact_duplicate_count: int = 1
    partial_duplicate_count: int = 0
    amount_variation_score: float = 0.0
    date_variation_score: float = 0.0
    duplicate_claim_count: int = 0
    
    def to_dict(self) -> Dict[str, float]:
        return {
            'exact_duplicate_count': self.exact_duplicate_count,
            'partial_duplicate_count': self.partial_duplicate_count,
            'amount_variation_score': self.amount_variation_score,
            'date_variation_score': self.date_variation_score,
            'duplicate_claim_count': self.duplicate_claim_count,
        }


@dataclass
class FeatureSet:
    invoice_features: InvoiceFeatures
    vendor_features: VendorFeatures
    duplicate_features: DuplicateFeatures
    invoice_data: InvoiceData
    claim_data: Optional[ClaimData] = None
    
    def to_feature_vector(self) -> Dict[str, float]:
        features = {}
        features.update(self.invoice_features.to_dict())
        features.update(self.vendor_features.to_dict())
        features.update(self.duplicate_features.to_dict())
        return features
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'invoice_number': self.invoice_data.invoice_number,
            'vendor_name': self.invoice_data.vendor_name,
            'total_amount': self.invoice_data.total_amount,
            'invoice_date': self.invoice_data.invoice_date,
            'claim_id': self.claim_data.claim_id if self.claim_data else None,
            'features': self.to_feature_vector(),
        }


class FeatureExtractor:
    def __init__(self, risk_samples: Optional[List[RiskSample]] = None):
        self.risk_samples = risk_samples or []
        self.risk_sample_map = self._build_risk_sample_map()
        
    def _build_risk_sample_map(self) -> Dict[str, RiskSample]:
        sample_map = {}
        for sample in self.risk_samples:
            key = self._normalize_vendor_name(sample.vendor_name)
            sample_map[key] = sample
            if sample.vendor_tax_id:
                sample_map[sample.vendor_tax_id] = sample
        return sample_map
    
    def _normalize_vendor_name(self, name: str) -> str:
        if not name:
            return ''
        name = re.sub(r'[（(][^)）]*[)）]', '', name)
        name = re.sub(r'[^\u4e00-\u9fa5a-zA-Z0-9]', '', name)
        name = re.sub(r'(有限公司|有限责任公司|股份有限公司|公司)$', '', name)
        return name.lower().strip()
    
    def extract_invoice_features(
        self, 
        invoice: InvoiceData, 
        all_invoices: Optional[List[InvoiceData]] = None
    ) -> InvoiceFeatures:
        features = InvoiceFeatures(invoice_number=invoice.invoice_number)
        
        all_invoices = all_invoices or [invoice]
        amounts = [inv.total_amount for inv in all_invoices if inv.total_amount > 0]
        
        if amounts:
            mean_amount = np.mean(amounts)
            std_amount = np.std(amounts) if len(amounts) > 1 else mean_amount * 0.5
            if std_amount > 0:
                z_score = (invoice.total_amount - mean_amount) / std_amount
                features.amount_anomaly_score = min(1.0, abs(z_score) / 3.0)
        
        features.amount_roundness_score = self._calculate_roundness_score(invoice.total_amount)
        
        if invoice.items:
            items_total = sum(item.amount for item in invoice.items)
            if items_total > 0 and abs(invoice.total_amount - items_total) > 0.01:
                mismatch_ratio = abs(invoice.total_amount - items_total) / items_total
                features.item_amount_mismatch_score = min(1.0, mismatch_ratio)
        
        if invoice.total_amount > 0:
            expected_tax_ratios = [0.0, 0.06, 0.09, 0.13]
            actual_ratio = invoice.tax_amount / invoice.total_amount
            min_diff = min(abs(actual_ratio - r) for r in expected_tax_ratios)
            features.tax_ratio_anomaly_score = min(1.0, min_diff * 5)
        
        if invoice.ocr_confidence is not None:
            features.ocr_confidence_score = 1.0 - (invoice.ocr_confidence / 100.0)
        
        if invoice.invoice_date:
            try:
                inv_date = datetime.strptime(invoice.invoice_date, '%Y-%m-%d')
                today = datetime.now()
                days_old = (today - inv_date).days
                if days_old < 0:
                    features.date_anomaly_score = 1.0
                elif days_old > 365 * 2:
                    features.date_anomaly_score = min(1.0, days_old / (365 * 5))
            except ValueError:
                features.date_anomaly_score = 0.5
        
        return features
    
    def _calculate_roundness_score(self, amount: float) -> float:
        if amount <= 0:
            return 0.0
        
        int_part = int(amount)
        dec_part = amount - int_part
        
        roundness_score = 0.0
        
        if dec_part in [0.0, 0.5]:
            roundness_score += 0.3
        
        amount_str = f"{amount:.2f}"
        clean_str = amount_str.replace('.', '').lstrip('0')
        
        if len(clean_str) >= 2:
            trailing_zeros = len(clean_str) - len(clean_str.rstrip('0'))
            roundness_score += min(0.5, trailing_zeros * 0.15)
        
        if all(c == clean_str[0] for c in clean_str):
            roundness_score += 0.2
        
        repeated_patterns = ['111', '222', '333', '444', '555', '666', '777', '888', '999', '000']
        for pattern in repeated_patterns:
            if pattern in clean_str:
                roundness_score += 0.15
                break
        
        sequential_up = ''.join(str(i) for i in range(10))
        sequential_down = ''.join(str(i) for i in reversed(range(10)))
        for i in range(len(clean_str) - 2):
            if clean_str[i:i+3] in sequential_up or clean_str[i:i+3] in sequential_down:
                roundness_score += 0.1
                break
        
        special_numbers = [100, 200, 500, 1000, 2000, 5000, 10000]
        if int_part in special_numbers and dec_part == 0.0:
            roundness_score += 0.3
        
        return min(1.0, roundness_score)
    
    def extract_vendor_features(
        self,
        invoice: InvoiceData,
        all_invoices: Optional[List[InvoiceData]] = None
    ) -> VendorFeatures:
        features = VendorFeatures(vendor_name=invoice.vendor_name)
        
        all_invoices = all_invoices or [invoice]
        
        vendor_counts = Counter()
        vendor_tax_ids = defaultdict(set)
        vendor_name_variations = defaultdict(set)
        
        for inv in all_invoices:
            norm_name = self._normalize_vendor_name(inv.vendor_name)
            vendor_counts[norm_name] += 1
            vendor_name_variations[norm_name].add(inv.vendor_name)
            if inv.vendor_tax_id:
                vendor_tax_ids[norm_name].add(inv.vendor_tax_id)
        
        current_norm_name = self._normalize_vendor_name(invoice.vendor_name)
        features.vendor_appearance_frequency = vendor_counts.get(current_norm_name, 1)
        features.name_variation_count = len(vendor_name_variations.get(current_norm_name, {invoice.vendor_name}))
        
        tax_ids = vendor_tax_ids.get(current_norm_name, set())
        if len(tax_ids) > 1:
            features.tax_id_mismatch_score = 1.0
        elif invoice.vendor_tax_id and len(tax_ids) == 1 and invoice.vendor_tax_id not in tax_ids:
            features.tax_id_mismatch_score = 0.8
        
        for key, sample in self.risk_sample_map.items():
            if self._normalize_vendor_name(invoice.vendor_name) == key:
                features.risk_sample_match_score = 1.0
                features.vendor_risk_level = sample.risk_level
                break
            elif invoice.vendor_tax_id and key == invoice.vendor_tax_id:
                features.risk_sample_match_score = 1.0
                features.vendor_risk_level = sample.risk_level
                break
        
        if features.risk_sample_match_score == 0.0:
            for sample in self.risk_samples:
                similarity = fuzz.ratio(invoice.vendor_name, sample.vendor_name)
                if similarity >= 85:
                    features.risk_sample_match_score = similarity / 100.0
                    features.vendor_risk_level = sample.risk_level
                    break
        
        return features
    
    def extract_duplicate_features(
        self,
        invoice: InvoiceData,
        all_invoices: List[InvoiceData],
        claims: Optional[List[ClaimData]] = None
    ) -> DuplicateFeatures:
        features = DuplicateFeatures(invoice_number=invoice.invoice_number)
        
        claims = claims or []
        
        exact_duplicates = [
            inv for inv in all_invoices 
            if inv.invoice_number == invoice.invoice_number and inv.invoice_number
        ]
        features.exact_duplicate_count = len(exact_duplicates)
        
        same_claim_invoices = defaultdict(list)
        for inv in all_invoices:
            for claim in claims:
                if claim.invoice_number == inv.invoice_number:
                    same_claim_invoices[claim.claim_id].append(inv)
        
        duplicate_claim_count = 0
        for claim_id, inv_list in same_claim_invoices.items():
            for inv in inv_list:
                if inv.invoice_number == invoice.invoice_number:
                    duplicate_claim_count += 1
        
        if features.exact_duplicate_count > 1:
            amounts = [inv.total_amount for inv in exact_duplicates]
            if len(set(amounts)) > 1:
                max_amount = max(amounts)
                min_amount = min(amounts)
                if max_amount > 0:
                    features.amount_variation_score = (max_amount - min_amount) / max_amount
            
            dates = [inv.invoice_date for inv in exact_duplicates if inv.invoice_date]
            if len(set(dates)) > 1:
                features.date_variation_score = 1.0
        
        partial_matches = []
        for inv in all_invoices:
            if inv is invoice:
                continue
            
            match_score = 0.0
            
            if inv.vendor_name == invoice.vendor_name:
                match_score += 0.3
            
            if abs(inv.total_amount - invoice.total_amount) < 0.01:
                match_score += 0.4
            
            if inv.invoice_date == invoice.invoice_date and inv.invoice_date:
                match_score += 0.2
            
            items1 = {item.item_name for item in invoice.items}
            items2 = {item.item_name for item in inv.items}
            if items1 and items2 and len(items1 & items2) > 0:
                match_score += 0.1 * (len(items1 & items2) / max(len(items1), len(items2)))
            
            if match_score >= 0.6:
                partial_matches.append((inv, match_score))
        
        features.partial_duplicate_count = len(partial_matches)
        
        claim_duplicates = [
            c for c in claims 
            if c.invoice_number == invoice.invoice_number and c.invoice_number
        ]
        features.duplicate_claim_count = len(claim_duplicates) or duplicate_claim_count
        
        return features
    
    def extract_all_features(
        self,
        invoice: InvoiceData,
        all_invoices: List[InvoiceData],
        claims: Optional[List[ClaimData]] = None
    ) -> FeatureSet:
        return FeatureSet(
            invoice_features=self.extract_invoice_features(invoice, all_invoices),
            vendor_features=self.extract_vendor_features(invoice, all_invoices),
            duplicate_features=self.extract_duplicate_features(invoice, all_invoices, claims),
            invoice_data=invoice,
            claim_data=self._find_matching_claim(invoice, claims)
        )
    
    def _find_matching_claim(
        self, 
        invoice: InvoiceData, 
        claims: Optional[List[ClaimData]]
    ) -> Optional[ClaimData]:
        if not claims:
            return None
        
        for claim in claims:
            if claim.invoice_number == invoice.invoice_number and claim.invoice_number:
                return claim
        
        for claim in claims:
            if abs(claim.claim_amount - invoice.total_amount) < 0.01:
                return claim
        
        return None
    
    def extract_batch(
        self,
        invoices: List[InvoiceData],
        claims: Optional[List[ClaimData]] = None
    ) -> List[FeatureSet]:
        return [
            self.extract_all_features(invoice, invoices, claims)
            for invoice in invoices
        ]
