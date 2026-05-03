import json
import random
import csv
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any


class SampleGenerator:
    def __init__(self, seed: int = 42):
        random.seed(seed)
        
        self.normal_vendors = [
            ("北京康泰医药有限公司", "91110106MA007Y7K8T"),
            ("上海康复医疗器械有限公司", "91310115MA1G8H7Y9K"),
            ("广州市天河区人民医院", "12440106455385573P"),
            ("深圳市龙华区中心医院", "12440309455751708G"),
            ("杭州百草堂大药房有限公司", "91330106MA2H1L7Y6K"),
            ("南京健康医疗科技有限公司", "91320100MA1N2H7K8Y"),
            ("成都华西药业有限公司", "91510100MA61TH7L9K"),
            ("武汉仁心医院管理有限公司", "91420100MA4K2H7Y8L"),
            ("西安康健医疗设备有限公司", "91610100MA6U3H7K9M"),
            ("重庆医科大学附属第一医院", "12500000450402155F"),
            ("天津仁安大药房连锁有限公司", "91120102MA05Y7K8L1"),
            ("苏州大学附属第一医院", "12320500466951106G"),
            ("郑州大学第一附属医院", "12410100415800318J"),
            ("山东大学齐鲁医院", "12370000495570276H"),
        ]
        
        self.risk_vendors = [
            ("北京诚信医药经营部", "91110105MA008X9Y1T", "high", "虚假发票", "历史违规记录"),
            ("上海汇通商贸有限公司", "91310114MA1G7H8Z2K", "high", "重复报销", "多次被举报"),
            ("广州市天河区康源药房", "91440106MA59H7Y3K", "medium", "金额异常", "金额凑整特征明显"),
            ("深圳市福田区盛达医疗器械", "91440300MA5D8H7K4L", "medium", "商户异常", "名称与税号不匹配"),
            ("杭州益康保健品商行", "91330103MA28H7Y5K", "high", "历史违规", "曾因虚假宣传被处罚"),
            ("南京华康医疗器械经营部", "91320104MA1MT7K8L2", "medium", "金额篡改", "金额与明细不符"),
            ("成都康健医药有限公司", "91510107MA61TH7L9M", "high", "多单重复", "同一发票多次报销"),
            ("武汉利民大药房", "91420106MA4K2H7Y8M", "medium", "OCR低置信", "发票图片质量差"),
        ]
        
        self.items = [
            {"item_name": "阿莫西林胶囊", "unit_price": 25.5, "typical_qty": (1, 5)},
            {"item_name": "布洛芬缓释胶囊", "unit_price": 18.0, "typical_qty": (1, 3)},
            {"item_name": "感冒灵颗粒", "unit_price": 15.0, "typical_qty": (2, 6)},
            {"item_name": "头孢克肟分散片", "unit_price": 45.0, "typical_qty": (1, 3)},
            {"item_name": "奥美拉唑肠溶胶囊", "unit_price": 35.0, "typical_qty": (1, 4)},
            {"item_name": "氯雷他定片", "unit_price": 22.0, "typical_qty": (1, 2)},
            {"item_name": "蒙脱石散", "unit_price": 12.0, "typical_qty": (1, 3)},
            {"item_name": "盐酸左氧氟沙星片", "unit_price": 38.0, "typical_qty": (1, 2)},
            {"item_name": "复方甘草片", "unit_price": 8.5, "typical_qty": (2, 5)},
            {"item_name": "维生素C片", "unit_price": 5.0, "typical_qty": (1, 3)},
        ]
        
        self.examinations = [
            {"item_name": "血常规检查", "unit_price": 80.0},
            {"item_name": "胸部CT扫描", "unit_price": 350.0},
            {"item_name": "心电图检查", "unit_price": 60.0},
            {"item_name": "彩色超声检查", "unit_price": 200.0},
            {"item_name": "核磁共振检查", "unit_price": 800.0},
            {"item_name": "尿常规检查", "unit_price": 25.0},
            {"item_name": "肝功能检查", "unit_price": 120.0},
            {"item_name": "肾功能检查", "unit_price": 95.0},
        ]
        
        self.diagnoses = [
            "上呼吸道感染", "急性肠胃炎", "高血压病", "2型糖尿病", 
            "支气管炎", "胃炎", "腰椎间盘突出", "颈椎病",
            "过敏性鼻炎", "尿路感染", "胆囊结石", "甲状腺结节",
            "体检", "普通感冒", "腹泻", "发热待查"
        ]
        
        self.hospitals = [
            "广州市天河区人民医院", "深圳市龙华区中心医院", 
            "杭州市第一人民医院", "南京市鼓楼医院",
            "成都市华西医院", "武汉市同济医院",
            "北京协和医院", "上海瑞金医院",
            "社区卫生服务中心", "乡镇卫生院"
        ]
    
    def _generate_items(self, is_risky: bool = False) -> List[Dict[str, Any]]:
        if is_risky and random.random() < 0.3:
            return []
        
        items = []
        num_items = random.randint(1, 4)
        
        for _ in range(num_items):
            if random.random() < 0.6:
                item = random.choice(self.items)
                qty = random.randint(*item['typical_qty'])
                items.append({
                    "item_name": item['item_name'],
                    "quantity": qty,
                    "unit_price": item['unit_price'],
                    "amount": item['unit_price'] * qty
                })
            else:
                exam = random.choice(self.examinations)
                items.append({
                    "item_name": exam['item_name'],
                    "quantity": 1,
                    "unit_price": exam['unit_price'],
                    "amount": exam['unit_price']
                })
        
        return items
    
    def _generate_round_amount(self) -> float:
        patterns = [
            (lambda: random.choice([100, 200, 500, 1000, 2000, 5000, 10000])),
            (lambda: random.choice([99, 199, 299, 499, 999, 1999])),
            (lambda: random.choice([88, 188, 288, 588, 888, 1888])),
            (lambda: random.choice([66, 166, 666, 1666])),
            (lambda: random.choice([111, 222, 333, 555, 777, 999])),
            (lambda: random.choice([1234, 12345, 2345, 23456])),
        ]
        return float(random.choice(patterns)())
    
    def generate_invoice(self, invoice_number: str, is_risky: bool = False) -> Dict[str, Any]:
        if is_risky:
            vendor = random.choice(self.risk_vendors)
            vendor_name, vendor_tax_id, risk_level, risk_type, risk_desc = vendor
            ocr_confidence = random.randint(60, 85)
            
            if random.random() < 0.4:
                total_amount = self._generate_round_amount()
                items = self._generate_items(is_risky=True)
                if items:
                    items_total = sum(i['amount'] for i in items)
                    if abs(items_total - total_amount) > 1:
                        if random.random() < 0.5:
                            pass
                        else:
                            items = []
            else:
                items = self._generate_items(is_risky=True)
                if items:
                    total_amount = sum(i['amount'] for i in items)
                else:
                    total_amount = self._generate_round_amount()
        else:
            vendor_name, vendor_tax_id = random.choice(self.normal_vendors)
            items = self._generate_items(is_risky=False)
            total_amount = sum(i['amount'] for i in items) if items else random.uniform(50, 500)
            ocr_confidence = random.randint(85, 99)
        
        invoice_date = (datetime.now() - timedelta(days=random.randint(1, 365))).strftime("%Y-%m-%d")
        tax_amount = total_amount * 0.06
        
        return {
            "invoice_number": invoice_number,
            "invoice_date": invoice_date,
            "vendor_name": vendor_name,
            "vendor_tax_id": vendor_tax_id,
            "total_amount": round(total_amount, 2),
            "tax_amount": round(tax_amount, 2),
            "items": items,
            "ocr_confidence": ocr_confidence,
            "buyer_name": f"{'张李王刘陈杨赵黄'[random.randint(0,7)]}{'明杰芳敏强勇伟丽'[random.randint(0,7)]}",
            "buyer_tax_id": "",
        }
    
    def generate_invoices(self, count: int, risky_ratio: float = 0.15) -> List[Dict[str, Any]]:
        invoices = []
        invoice_numbers = set()
        
        risky_count = int(count * risky_ratio)
        normal_count = count - risky_count
        
        for i in range(normal_count):
            while True:
                inv_num = f"INV{202400000 + i:08d}"
                if inv_num not in invoice_numbers:
                    invoice_numbers.add(inv_num)
                    break
            
            invoices.append(self.generate_invoice(inv_num, is_risky=False))
        
        for i in range(risky_count):
            base_idx = normal_count + i
            
            if random.random() < 0.3 and invoices:
                dup_source = random.choice(invoices)
                inv_num = dup_source['invoice_number']
                
                new_invoice = dup_source.copy()
                if random.random() < 0.5:
                    new_invoice['total_amount'] = round(dup_source['total_amount'] * (1 + random.uniform(0.1, 0.5)), 2)
                    new_invoice['tax_amount'] = round(new_invoice['total_amount'] * 0.06, 2)
                
                invoices.append(new_invoice)
            else:
                while True:
                    inv_num = f"INV{202400000 + base_idx:08d}"
                    if inv_num not in invoice_numbers:
                        invoice_numbers.add(inv_num)
                        break
                
                invoices.append(self.generate_invoice(inv_num, is_risky=True))
        
        random.shuffle(invoices)
        return invoices
    
    def generate_claim(self, claim_id: str, invoice: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if invoice:
            invoice_number = invoice['invoice_number']
            claim_amount = invoice['total_amount']
        else:
            invoice_number = f"INV{202400000 + random.randint(0, 99999):08d}"
            claim_amount = random.uniform(50, 2000)
        
        claim_date = (datetime.now() - timedelta(days=random.randint(1, 30))).strftime("%Y-%m-%d")
        
        return {
            "claim_id": claim_id,
            "policy_number": f"POL{random.randint(100000, 999999)}",
            "claimant_name": f"{'张李王刘陈杨赵黄'[random.randint(0,7)]}{'明杰芳敏强勇伟丽'[random.randint(0,7)]}",
            "claim_date": claim_date,
            "claim_amount": round(claim_amount, 2),
            "invoice_number": invoice_number,
            "diagnosis": random.choice(self.diagnoses),
            "hospital_name": random.choice(self.hospitals),
        }
    
    def generate_claims(self, count: int, invoices: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
        claims = []
        
        for i in range(count):
            claim_id = f"CLM{2024000 + i:07d}"
            
            if invoices and random.random() < 0.8:
                invoice = random.choice(invoices)
                claims.append(self.generate_claim(claim_id, invoice))
            else:
                claims.append(self.generate_claim(claim_id))
        
        if invoices and random.random() < 0.2:
            dup_invoice = random.choice(invoices)
            for _ in range(random.randint(1, 2)):
                claim_id = f"CLM{2024000 + count:07d}"
                count += 1
                claims.append(self.generate_claim(claim_id, dup_invoice))
        
        return claims
    
    def generate_risk_sample(self) -> Dict[str, Any]:
        vendor = random.choice(self.risk_vendors)
        vendor_name, vendor_tax_id, risk_level, risk_type, risk_desc = vendor
        
        return {
            "vendor_name": vendor_name,
            "vendor_tax_id": vendor_tax_id,
            "risk_level": risk_level,
            "risk_type": risk_type,
            "risk_description": risk_desc,
            "sample_count": random.randint(2, 15),
            "last_occurrence": (datetime.now() - timedelta(days=random.randint(30, 730))).strftime("%Y-%m-%d"),
        }
    
    def generate_risk_samples(self, count: int) -> List[Dict[str, Any]]:
        samples = []
        seen_vendors = set()
        
        for _ in range(count):
            sample = self.generate_risk_sample()
            if sample['vendor_name'] not in seen_vendors:
                seen_vendors.add(sample['vendor_name'])
                samples.append(sample)
            
            if len(samples) >= len(self.risk_vendors):
                break
        
        while len(samples) < count:
            vendor = random.choice(self.risk_vendors)
            vendor_name, vendor_tax_id, risk_level, risk_type, risk_desc = vendor
            
            suffix = random.choice(["一分店", "二分店", "分店", "(分店)", "经营部", "经营二部"])
            new_name = vendor_name.replace("有限公司", suffix).replace("经营部", suffix)
            
            sample = {
                "vendor_name": new_name,
                "vendor_tax_id": vendor_tax_id[:-3] + str(random.randint(100, 999)),
                "risk_level": risk_level,
                "risk_type": risk_type,
                "risk_description": risk_desc,
                "sample_count": random.randint(1, 5),
                "last_occurrence": (datetime.now() - timedelta(days=random.randint(30, 730))).strftime("%Y-%m-%d"),
            }
            samples.append(sample)
        
        return samples[:count]
    
    def generate(
        self,
        output_dir: Path,
        invoice_count: int = 20,
        claim_count: int = 15,
        risk_sample_count: int = 10
    ) -> Dict[str, Path]:
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        invoices = self.generate_invoices(invoice_count)
        claims = self.generate_claims(claim_count, invoices)
        risk_samples = self.generate_risk_samples(risk_sample_count)
        
        invoice_path = output_dir / "invoices.json"
        with open(invoice_path, 'w', encoding='utf-8') as f:
            json.dump(invoices, f, ensure_ascii=False, indent=2)
        
        claim_path = output_dir / "claims.csv"
        with open(claim_path, 'w', encoding='utf-8-sig', newline='') as f:
            if claims:
                writer = csv.DictWriter(f, fieldnames=claims[0].keys())
                writer.writeheader()
                writer.writerows(claims)
        
        risk_path = output_dir / "risk_samples.csv"
        with open(risk_path, 'w', encoding='utf-8-sig', newline='') as f:
            if risk_samples:
                writer = csv.DictWriter(f, fieldnames=risk_samples[0].keys())
                writer.writeheader()
                writer.writerows(risk_samples)
        
        return {
            "invoices": invoice_path,
            "claims": claim_path,
            "risk_samples": risk_path
        }
