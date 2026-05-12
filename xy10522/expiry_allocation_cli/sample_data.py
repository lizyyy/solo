"""示例数据生成器"""
from datetime import date, timedelta

from .database import Database
from .models import Store, Medicine, Batch, Inventory
from .config import STORAGE_TYPE_NORMAL, STORAGE_TYPE_COLD, STORAGE_TYPE_FROZEN


class SampleDataGenerator:
    def __init__(self, db: Database):
        self.db = db
    
    def generate_all(self):
        self.generate_stores()
        self.generate_medicines()
        self.generate_batches()
        self.generate_inventory()
    
    def generate_stores(self):
        stores = [
            {"code": "S001", "name": "北京朝阳店", "region": "beijing", "address": "北京市朝阳区建国路88号", "phone": "010-12345678"},
            {"code": "S002", "name": "北京海淀店", "region": "beijing", "address": "北京市海淀区中关村大街1号", "phone": "010-12345679"},
            {"code": "S003", "name": "北京西城店", "region": "beijing", "address": "北京市西城区西直门内大街", "phone": "010-12345680"},
            {"code": "S004", "name": "上海浦东店", "region": "shanghai", "address": "上海市浦东新区陆家嘴环路1000号", "phone": "021-87654321"},
            {"code": "S005", "name": "上海徐汇店", "region": "shanghai", "address": "上海市徐汇区漕溪北路8号", "phone": "021-87654322"},
        ]
        
        for s in stores:
            existing = Store.get_by_code(self.db, s["code"])
            if not existing:
                Store.create(
                    self.db,
                    store_code=s["code"],
                    store_name=s["name"],
                    region=s["region"],
                    address=s["address"],
                    phone=s["phone"],
                )
    
    def generate_medicines(self):
        medicines = [
            {
                "code": "MED001",
                "name": "阿莫西林胶囊",
                "storage_type": STORAGE_TYPE_NORMAL,
                "unit": "box",
                "price": 25.80,
                "desc": "常温药 - 抗生素类"
            },
            {
                "code": "MED002",
                "name": "布洛芬缓释胶囊",
                "storage_type": STORAGE_TYPE_NORMAL,
                "unit": "box",
                "price": 32.50,
                "desc": "常温药 - 解热镇痛"
            },
            {
                "code": "MED003",
                "name": "胰岛素注射液",
                "storage_type": STORAGE_TYPE_COLD,
                "unit": "box",
                "price": 198.00,
                "desc": "冷链药 - 需2-8℃冷藏"
            },
            {
                "code": "MED004",
                "name": "双歧杆菌三联活菌",
                "storage_type": STORAGE_TYPE_COLD,
                "unit": "box",
                "price": 45.60,
                "desc": "冷链药 - 益生菌类"
            },
            {
                "code": "MED005",
                "name": "复方氨酚烷胺片",
                "storage_type": STORAGE_TYPE_NORMAL,
                "unit": "box",
                "price": 12.80,
                "desc": "高周转药 - 感冒药"
            },
            {
                "code": "MED006",
                "name": "蒙脱石散",
                "storage_type": STORAGE_TYPE_NORMAL,
                "unit": "box",
                "price": 8.50,
                "desc": "高周转药 - 肠胃用药"
            },
            {
                "code": "MED007",
                "name": "重组人干扰素",
                "storage_type": STORAGE_TYPE_FROZEN,
                "unit": "box",
                "price": 580.00,
                "desc": "冷冻药 - 需-20℃保存"
            },
        ]
        
        for m in medicines:
            existing = Medicine.get_by_code(self.db, m["code"])
            if not existing:
                Medicine.create(
                    self.db,
                    medicine_code=m["code"],
                    medicine_name=m["name"],
                    storage_type=m["storage_type"],
                    unit=m["unit"],
                    price=m["price"],
                )
    
    def generate_batches(self):
        today = date.today()
        
        batches = [
            {
                "medicine_code": "MED001",
                "batch_no": "B202601001",
                "expiry_date": (today + timedelta(days=25)).isoformat(),
                "supplier": "华北制药"
            },
            {
                "medicine_code": "MED001",
                "batch_no": "B202601002",
                "expiry_date": (today + timedelta(days=180)).isoformat(),
                "supplier": "华北制药"
            },
            {
                "medicine_code": "MED002",
                "batch_no": "B202602001",
                "expiry_date": (today + timedelta(days=45)).isoformat(),
                "supplier": "中美史克"
            },
            {
                "medicine_code": "MED002",
                "batch_no": "B202602002",
                "expiry_date": (today + timedelta(days=365)).isoformat(),
                "supplier": "中美史克"
            },
            {
                "medicine_code": "MED003",
                "batch_no": "B202603001",
                "expiry_date": (today + timedelta(days=60)).isoformat(),
                "supplier": "诺和诺德"
            },
            {
                "medicine_code": "MED003",
                "batch_no": "B202603002",
                "expiry_date": (today + timedelta(days=200)).isoformat(),
                "supplier": "诺和诺德"
            },
            {
                "medicine_code": "MED004",
                "batch_no": "B202604001",
                "expiry_date": (today + timedelta(days=15)).isoformat(),
                "supplier": "培菲康"
            },
            {
                "medicine_code": "MED004",
                "batch_no": "B202604002",
                "expiry_date": (today + timedelta(days=150)).isoformat(),
                "supplier": "培菲康"
            },
            {
                "medicine_code": "MED005",
                "batch_no": "B202605001",
                "expiry_date": (today + timedelta(days=75)).isoformat(),
                "supplier": "感康药业"
            },
            {
                "medicine_code": "MED005",
                "batch_no": "B202605002",
                "expiry_date": (today + timedelta(days=300)).isoformat(),
                "supplier": "感康药业"
            },
            {
                "medicine_code": "MED006",
                "batch_no": "B202606001",
                "expiry_date": (today + timedelta(days=50)).isoformat(),
                "supplier": "思密达"
            },
            {
                "medicine_code": "MED006",
                "batch_no": "B202606002",
                "expiry_date": (today + timedelta(days=270)).isoformat(),
                "supplier": "思密达"
            },
            {
                "medicine_code": "MED007",
                "batch_no": "B202607001",
                "expiry_date": (today + timedelta(days=90)).isoformat(),
                "supplier": "罗氏制药"
            },
            {
                "medicine_code": "MED007",
                "batch_no": "B202607002",
                "expiry_date": (today + timedelta(days=240)).isoformat(),
                "supplier": "罗氏制药"
            },
        ]
        
        for b in batches:
            medicine = Medicine.get_by_code(self.db, b["medicine_code"])
            if medicine:
                existing = Batch.get_by_medicine_and_batch(self.db, medicine.id, b["batch_no"])
                if not existing:
                    Batch.create(
                        self.db,
                        medicine_id=medicine.id,
                        batch_no=b["batch_no"],
                        expiry_date=b["expiry_date"],
                        supplier=b["supplier"],
                    )
    
    def generate_inventory(self):
        store_codes = ["S001", "S002", "S003", "S004", "S005"]
        
        inventory_configs = [
            {
                "store_code": "S001",
                "medicine_code": "MED001",
                "batch_no": "B202601001",
                "quantity": 100,
                "daily_sales_rate": 0.5,
            },
            {
                "store_code": "S001",
                "medicine_code": "MED003",
                "batch_no": "B202603001",
                "quantity": 50,
                "daily_sales_rate": 0.3,
            },
            {
                "store_code": "S001",
                "medicine_code": "MED004",
                "batch_no": "B202604001",
                "quantity": 80,
                "daily_sales_rate": 0.2,
            },
            {
                "store_code": "S001",
                "medicine_code": "MED005",
                "batch_no": "B202605001",
                "quantity": 200,
                "daily_sales_rate": 1.0,
            },
            {
                "store_code": "S001",
                "medicine_code": "MED007",
                "batch_no": "B202607001",
                "quantity": 30,
                "daily_sales_rate": 0.1,
            },
            {
                "store_code": "S002",
                "medicine_code": "MED001",
                "batch_no": "B202601001",
                "quantity": 10,
                "daily_sales_rate": 2.5,
            },
            {
                "store_code": "S002",
                "medicine_code": "MED002",
                "batch_no": "B202602001",
                "quantity": 20,
                "daily_sales_rate": 1.5,
            },
            {
                "store_code": "S002",
                "medicine_code": "MED003",
                "batch_no": "B202603001",
                "quantity": 5,
                "daily_sales_rate": 1.2,
            },
            {
                "store_code": "S002",
                "medicine_code": "MED005",
                "batch_no": "B202605001",
                "quantity": 30,
                "daily_sales_rate": 8.0,
            },
            {
                "store_code": "S002",
                "medicine_code": "MED006",
                "batch_no": "B202606001",
                "quantity": 15,
                "daily_sales_rate": 3.0,
            },
            {
                "store_code": "S003",
                "medicine_code": "MED001",
                "batch_no": "B202601002",
                "quantity": 200,
                "daily_sales_rate": 0.8,
            },
            {
                "store_code": "S003",
                "medicine_code": "MED002",
                "batch_no": "B202602001",
                "quantity": 5,
                "daily_sales_rate": 2.0,
            },
            {
                "store_code": "S003",
                "medicine_code": "MED004",
                "batch_no": "B202604001",
                "quantity": 10,
                "daily_sales_rate": 1.5,
            },
            {
                "store_code": "S003",
                "medicine_code": "MED006",
                "batch_no": "B202606001",
                "quantity": 8,
                "daily_sales_rate": 4.0,
            },
            {
                "store_code": "S004",
                "medicine_code": "MED001",
                "batch_no": "B202601001",
                "quantity": 60,
                "daily_sales_rate": 0.4,
            },
            {
                "store_code": "S004",
                "medicine_code": "MED003",
                "batch_no": "B202603001",
                "quantity": 40,
                "daily_sales_rate": 0.5,
            },
            {
                "store_code": "S004",
                "medicine_code": "MED005",
                "batch_no": "B202605002",
                "quantity": 500,
                "daily_sales_rate": 5.0,
            },
            {
                "store_code": "S004",
                "medicine_code": "MED007",
                "batch_no": "B202607001",
                "quantity": 25,
                "daily_sales_rate": 0.2,
            },
            {
                "store_code": "S005",
                "medicine_code": "MED002",
                "batch_no": "B202602001",
                "quantity": 8,
                "daily_sales_rate": 3.0,
            },
            {
                "store_code": "S005",
                "medicine_code": "MED003",
                "batch_no": "B202603002",
                "quantity": 100,
                "daily_sales_rate": 0.8,
            },
            {
                "store_code": "S005",
                "medicine_code": "MED004",
                "batch_no": "B202604001",
                "quantity": 12,
                "daily_sales_rate": 2.0,
            },
            {
                "store_code": "S005",
                "medicine_code": "MED006",
                "batch_no": "B202606001",
                "quantity": 5,
                "daily_sales_rate": 5.0,
            },
        ]
        
        for inv in inventory_configs:
            store = Store.get_by_code(self.db, inv["store_code"])
            medicine = Medicine.get_by_code(self.db, inv["medicine_code"])
            
            if store and medicine:
                batch = Batch.get_by_medicine_and_batch(self.db, medicine.id, inv["batch_no"])
                if batch:
                    Inventory.update_upsert(
                        self.db,
                        store_id=store.id,
                        batch_id=batch.id,
                        quantity=inv["quantity"],
                        daily_sales_rate=inv["daily_sales_rate"],
                    )
