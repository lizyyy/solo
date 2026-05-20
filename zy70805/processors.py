from typing import List, Dict, Tuple, Optional, Union
from models import (
    CustomsDeclaration, TariffRule, ReturnReceipt,
    ProcessingResult, NormalItem, PendingItem, FailedItem
)
from datetime import datetime


class CurrencyConverter:
    def __init__(self):
        self.exchange_rates = {
            "USD": 7.24,
            "EUR": 7.86,
            "GBP": 9.18,
            "JPY": 0.048,
            "HKD": 0.93,
            "CNY": 1.0
        }
        self.conversion_notes = []
    
    def convert_to_cny(self, amount: float, currency: str, order_id: str) -> Tuple[float, Optional[str]]:
        if currency not in self.exchange_rates:
            note = f"订单{order_id}: 不支持的币种{currency}，无法自动换算"
            self.conversion_notes.append(note)
            return 0.0, note
        
        if amount <= 0:
            note = f"订单{order_id}: 金额{amount}异常，需人工确认"
            self.conversion_notes.append(note)
            return amount, note
        
        rate = self.exchange_rates[currency]
        cny_amount = round(amount * rate, 2)
        
        if rate < 1 or rate > 15:
            note = f"订单{order_id}: {currency}汇率{rate}处于边界值，换算后金额{cny_amount}请复核"
            self.conversion_notes.append(note)
        elif currency != "CNY":
            note = f"订单{order_id}: {currency}->{currency} 汇率{rate}，{amount}{currency}={cny_amount}CNY"
            self.conversion_notes.append(note)
        
        return cny_amount, None
    
    def get_all_rates(self) -> Dict[str, float]:
        return self.exchange_rates
    
    def clear_notes(self):
        self.conversion_notes = []
    
    def get_notes(self) -> List[str]:
        return list(set(self.conversion_notes))


class CategoryMerger:
    def __init__(self):
        self.category_mapping = {
            "3C数码": ["85171210", "85171220", "85258013", "85287222"],
            "服装鞋帽": ["61091000", "62052000", "64039900", "61102000"],
            "家居用品": ["94036099", "94016190", "73239300"],
            "美妆护肤": ["33049900", "33041000", "33072000"],
            "食品保健品": ["21069090", "16023210", "19053100"],
            "其他品类": ["default"]
        }
        self.category_tariff_defaults = {
            "3C数码": 0.13,
            "服装鞋帽": 0.20,
            "家居用品": 0.15,
            "美妆护肤": 0.50,
            "食品保健品": 0.13,
            "其他品类": 0.20
        }
        self.merger_notes = []
    
    def merge_category(self, category_code: str, product_name: str, order_id: str) -> Tuple[str, float, Optional[str]]:
        matched_category = "其他品类"
        for category, codes in self.category_mapping.items():
            if category_code in codes:
                matched_category = category
                break
        
        if matched_category == "其他品类":
            note = f"订单{order_id}: 品类编码{category_code}未匹配到标准品类，归为'其他品类'，建议人工复核商品'{product_name}'"
            self.merger_notes.append(note)
        else:
            note = f"订单{order_id}: 品类编码{category_code}归并到'{matched_category}'"
            self.merger_notes.append(note)
        
        tariff_rate = self.category_tariff_defaults[matched_category]
        
        return matched_category, tariff_rate, None
    
    def get_all_categories(self) -> Dict[str, List[str]]:
        return self.category_mapping
    
    def clear_notes(self):
        self.merger_notes = []
    
    def get_notes(self) -> List[str]:
        return list(set(self.merger_notes))


class DuplicateTaxDetector:
    def __init__(self):
        self.processed_orders = set()
        self.duplicate_notes = []
    
    def check_duplicate(self, order_id: str, amount: float) -> Tuple[bool, Optional[str]]:
        order_key = f"{order_id}_{amount}"
        
        if order_key in self.processed_orders:
            note = f"订单{order_id}: 金额{amount}疑似重复补税，该订单同一金额已在本批次处理过"
            self.duplicate_notes.append(note)
            return True, note
        
        self.processed_orders.add(order_key)
        return False, None
    
    def check_within_batch(self, declarations: List[CustomsDeclaration]) -> Dict[str, List[str]]:
        order_amount_counts = {}
        
        for dec in declarations:
            key = f"{dec.order_id}_{dec.amount}"
            if key not in order_amount_counts:
                order_amount_counts[key] = []
            order_amount_counts[key].append(dec.sku_code)
        
        duplicates = {}
        for key, skus in order_amount_counts.items():
            if len(skus) > 1:
                order_id = key.split('_')[0]
                duplicates[order_id] = skus
                note = f"订单{order_id}: 本批次内发现{len(skus)}条相同金额记录，SKU：{', '.join(skus)}，需确认是否重复申报"
                self.duplicate_notes.append(note)
        
        return duplicates
    
    def clear_notes(self):
        self.duplicate_notes = []
        self.processed_orders = set()
    
    def get_notes(self) -> List[str]:
        return list(set(self.duplicate_notes))


class DeclarationProcessor:
    def __init__(
        self,
        currency_converter: CurrencyConverter,
        category_merger: CategoryMerger,
        duplicate_tax_detector: DuplicateTaxDetector,
        tariff_rules: List[TariffRule],
        return_receipts: List[ReturnReceipt]
    ):
        self.currency_converter = currency_converter
        self.category_merger = category_merger
        self.duplicate_tax_detector = duplicate_tax_detector
        self.tariff_rules = tariff_rules
        self.return_receipts = return_receipts
        self.return_receipt_map = {r.order_id: r for r in return_receipts}
        self.tariff_rule_map = {r.hs_code: r for r in tariff_rules}
    
    def _match_tariff_rule(self, hs_code: str) -> Optional[TariffRule]:
        return self.tariff_rule_map.get(hs_code)
    
    def process_declarations(self, declarations: List[CustomsDeclaration], batch_id: str) -> ProcessingResult:
        self.currency_converter.clear_notes()
        self.category_merger.clear_notes()
        self.duplicate_tax_detector.clear_notes()
        
        self.duplicate_tax_detector.check_within_batch(declarations)
        
        normal_items: List[NormalItem] = []
        pending_items: List[PendingItem] = []
        failed_items: List[FailedItem] = []
        
        for dec in declarations:
            result = self._process_single_declaration(dec)
            if isinstance(result, NormalItem):
                normal_items.append(result)
            elif isinstance(result, PendingItem):
                pending_items.append(result)
            elif isinstance(result, FailedItem):
                failed_items.append(result)
        
        return ProcessingResult(
            total_count=len(declarations),
            normal_count=len(normal_items),
            pending_count=len(pending_items),
            failed_count=len(failed_items),
            normal_items=normal_items,
            pending_items=pending_items,
            failed_items=failed_items,
            currency_notes=self.currency_converter.get_notes(),
            category_notes=self.category_merger.get_notes(),
            duplicate_notes=self.duplicate_tax_detector.get_notes()
        )
    
    def _process_single_declaration(self, dec: CustomsDeclaration) -> Optional[Union[NormalItem, PendingItem, FailedItem]]:
        original_data = dec.model_dump()
        
        if dec.order_id in self.return_receipt_map:
            receipt = self.return_receipt_map[dec.order_id]
            return FailedItem(
                order_id=dec.order_id,
                original_data=original_data,
                failure_type="海关退单",
                failure_reason=f"海关退单代码{receipt.return_code}：{receipt.return_reason}",
                suggestion=receipt.suggestion,
                boundary_note=None
            )
        
        if not dec.order_id or not dec.sku_code:
            return FailedItem(
                order_id=dec.order_id,
                original_data=original_data,
                failure_type="必填项缺失",
                failure_reason="订单ID或SKU编码为空",
                suggestion="请补充完整订单信息后重新提交",
                boundary_note="必填字段校验：order_id、sku_code为必填，为空直接判定失败"
            )
        
        cny_amount, currency_error = self.currency_converter.convert_to_cny(
            dec.amount, dec.currency, dec.order_id
        )
        
        if currency_error and "不支持的币种" in currency_error:
            return FailedItem(
                order_id=dec.order_id,
                original_data=original_data,
                failure_type="币种异常",
                failure_reason=currency_error,
                suggestion=f"请确认币种{dec.currency}是否正确，或联系管理员添加汇率",
                boundary_note=f"当前支持币种：{', '.join(self.currency_converter.get_all_rates().keys())}"
            )
        
        is_duplicate, duplicate_note = self.duplicate_tax_detector.check_duplicate(dec.order_id, dec.amount)
        if is_duplicate:
            return FailedItem(
                order_id=dec.order_id,
                original_data=original_data,
                failure_type="重复补税",
                failure_reason=duplicate_note,
                suggestion="请核对是否为同一订单重复申报，如确需补税请走特殊申报流程",
                boundary_note="重复校验规则：同一批次内相同订单ID+相同金额视为重复"
            )
        
        matched_tariff = self._match_tariff_rule(dec.category_code)
        if matched_tariff:
            category = matched_tariff.category_name
            tariff_rate = matched_tariff.tariff_rate
            self.category_merger.merger_notes.append(
                f"订单{dec.order_id}: 税则JSON匹配 - HS编码{dec.category_code} -> {category}，税率{tariff_rate*100}%"
            )
        else:
            category, tariff_rate, category_note = self.category_merger.merge_category(
                dec.category_code, dec.product_name, dec.order_id
            )
        
        if category == "其他品类":
            return PendingItem(
                order_id=dec.order_id,
                original_data=original_data,
                pending_reason=f"品类编码{dec.category_code}未匹配到税则JSON及内置品类规则",
                suggestion=f"请人工确认商品'{dec.product_name}'的正确品类编码，或在税则JSON中添加该HS编码"
            )
        
        if abs(dec.declared_tariff_rate - tariff_rate) > 0.05:
            rate_source = "税则JSON" if matched_tariff else "内置默认"
            return PendingItem(
                order_id=dec.order_id,
                original_data=original_data,
                pending_reason=f"税率差异过大：申报税率{dec.declared_tariff_rate*100}%，{rate_source}税率{tariff_rate*100}%",
                suggestion=f"请确认申报税率是否正确，或更新税则JSON中的税率"
            )
        
        tariff_amount = round(cny_amount * tariff_rate, 2)
        
        notes = []
        if dec.amount < 50:
            notes.append(f"小额订单提醒：单笔金额{dec.amount}{dec.currency}，请注意关税免征额度")
        if dec.quantity > 100:
            notes.append(f"大数量提醒：数量{dec.quantity}，建议分拆申报")
        
        return NormalItem(
            order_id=dec.order_id,
            sku_code=dec.sku_code,
            product_name=dec.product_name,
            final_amount_cny=cny_amount,
            tariff_rate=tariff_rate,
            tariff_amount=tariff_amount,
            category=category,
            notes=notes
        )
