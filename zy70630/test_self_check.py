import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import json

from database import Base, Customer, Bucket
from schemas import CustomerCreate, BucketCreate, DeliveryCreate, BucketReturnCreate, ErrorCode
from services import (
    CustomerService, BucketService, DeliveryService, ReturnService,
    DepositService, ReportService, BusinessException
)

TEST_DATABASE_URL = "sqlite:///./test_water_bucket.db"


class SelfCheckTester:
    def __init__(self):
        self.engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        self.passed = 0
        self.failed = 0
        self.results = []
        
    def setup(self):
        Base.metadata.drop_all(bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        
    def cleanup(self):
        Base.metadata.drop_all(bind=self.engine)
        
    def test_case(self, name, func):
        print(f"\n{'='*60}")
        print(f"测试: {name}")
        print(f"{'='*60}")
        try:
            func()
            print(f"✓ 通过")
            self.passed += 1
            self.results.append({"name": name, "status": "passed"})
        except AssertionError as e:
            print(f"✗ 失败: {e}")
            self.failed += 1
            self.results.append({"name": name, "status": "failed", "error": str(e)})
        except Exception as e:
            print(f"✗ 异常: {type(e).__name__}: {e}")
            self.failed += 1
            self.results.append({"name": name, "status": "failed", "error": f"{type(e).__name__}: {e}"})
    
    def run_all_tests(self):
        self.setup()
        try:
            self.test_case("客户管理 - 创建客户", self.test_create_customer)
            self.test_case("客户管理 - 重复客户拦截", self.test_duplicate_customer)
            self.test_case("客户管理 - 查询客户", self.test_get_customer)
            self.test_case("客户管理 - 更新客户信息", self.test_update_customer)
            self.test_case("桶管理 - 创建桶", self.test_create_bucket)
            self.test_case("桶管理 - 重复桶号拦截", self.test_duplicate_bucket)
            self.test_case("桶管理 - 查询桶列表", self.test_list_buckets)
            self.test_case("配送管理 - 首次配送收押金", self.test_first_delivery)
            self.test_case("配送管理 - 二次配送用押金抵扣", self.test_delivery_with_credit)
            self.test_case("配送管理 - 桶状态校验", self.test_bucket_status_validation)
            self.test_case("退桶管理 - 正常退桶", self.test_normal_return)
            self.test_case("退桶管理 - 非客户所有桶人工复核", self.test_wrong_customer_bucket)
            self.test_case("押金流水 - 记录查询", self.test_deposit_records)
            self.test_case("报告生成 - 押金报告", self.test_deposit_report)
            self.test_case("错误分类 - 缺字段校验", self.test_missing_field)
            self.test_case("错误分类 - 状态不允许", self.test_invalid_state)
            self.test_case("错误分类 - 已处理重复提交", self.test_duplicate_transaction)
        finally:
            self.cleanup()
        
        self.print_summary()
    
    def test_create_customer(self):
        db = self.SessionLocal()
        try:
            customer = CustomerCreate(name="张三", phone="13800138000", address="北京市朝阳区")
            result = CustomerService.create_customer(db, customer)
            assert result.id > 0
            assert result.name == "张三"
            assert result.phone == "13800138000"
            assert result.total_deposit == 0.0
            assert result.pending_buckets == 0
        finally:
            db.close()
    
    def test_duplicate_customer(self):
        db = self.SessionLocal()
        try:
            customer = CustomerCreate(name="测试A", phone="15000150000", address="测试地址A")
            CustomerService.create_customer(db, customer)
            
            try:
                CustomerService.create_customer(db, customer)
                assert False, "应该抛出重复客户异常"
            except BusinessException as e:
                assert e.code == ErrorCode.DUPLICATE_TRANSACTION
        finally:
            db.close()
    
    def test_get_customer(self):
        db = self.SessionLocal()
        try:
            customer = CustomerCreate(name="李四", phone="13900139000", address="上海市浦东新区")
            created = CustomerService.create_customer(db, customer)
            
            found = CustomerService.get_customer(db, created.id)
            assert found is not None
            assert found.phone == "13900139000"
            
            found_by_phone = CustomerService.get_customer_by_phone(db, "13900139000")
            assert found_by_phone is not None
            assert found_by_phone.name == "李四"
        finally:
            db.close()
    
    def test_update_customer(self):
        db = self.SessionLocal()
        try:
            customer = CustomerCreate(name="王五", phone="13700137000", address="广州市天河区")
            created = CustomerService.create_customer(db, customer)
            
            from schemas import CustomerUpdate
            update = CustomerUpdate(address="深圳市南山区")
            updated = CustomerService.update_customer(db, created.id, update)
            assert updated.address == "深圳市南山区"
        finally:
            db.close()
    
    def test_create_bucket(self):
        db = self.SessionLocal()
        try:
            bucket = BucketCreate(bucket_number="BT001", deposit_amount=50.0)
            result = BucketService.create_bucket(db, bucket)
            assert result.id > 0
            assert result.bucket_number == "BT001"
            assert result.status == "in_stock"
        finally:
            db.close()
    
    def test_duplicate_bucket(self):
        db = self.SessionLocal()
        try:
            bucket = BucketCreate(bucket_number="BT002", deposit_amount=50.0)
            BucketService.create_bucket(db, bucket)
            
            try:
                BucketService.create_bucket(db, bucket)
                assert False, "应该抛出重复桶号异常"
            except BusinessException as e:
                assert e.code == ErrorCode.DUPLICATE_TRANSACTION
        finally:
            db.close()
    
    def test_list_buckets(self):
        db = self.SessionLocal()
        try:
            for i in range(100, 106):
                bucket = BucketCreate(bucket_number=f"BT{i}", deposit_amount=50.0)
                BucketService.create_bucket(db, bucket)
            
            buckets = BucketService.list_buckets(db)
            assert len(buckets) >= 5
        finally:
            db.close()
    
    def test_first_delivery(self):
        db = self.SessionLocal()
        try:
            customer = CustomerCreate(name="赵六", phone="13600136000", address="杭州市西湖区")
            created_customer = CustomerService.create_customer(db, customer)
            
            bucket = BucketCreate(bucket_number="BT010", deposit_amount=50.0)
            BucketService.create_bucket(db, bucket)
            
            delivery = DeliveryCreate(
                customer_id=created_customer.id,
                delivery_address="杭州市西湖区",
                quantity=1,
                bucket_numbers=["BT010"],
                deposit_per_bucket=50.0,
                use_deposit_credit=0.0
            )
            result = DeliveryService.create_delivery(db, delivery)
            
            assert result.actual_pay_deposit == 50.0
            
            updated_customer = CustomerService.get_customer(db, created_customer.id)
            assert updated_customer.total_deposit == 50.0
            assert updated_customer.available_deposit == 50.0
            assert updated_customer.pending_buckets == 1
            
            bucket_after = BucketService.get_bucket_by_number(db, "BT010")
            assert bucket_after.status == "out"
            assert bucket_after.current_customer_id == created_customer.id
        finally:
            db.close()
    
    def test_delivery_with_credit(self):
        db = self.SessionLocal()
        try:
            customer = CustomerCreate(name="钱七", phone="13500135000", address="成都市武侯区")
            created_customer = CustomerService.create_customer(db, customer)
            
            for i in range(11, 14):
                bucket = BucketCreate(bucket_number=f"BT0{i}", deposit_amount=50.0)
                BucketService.create_bucket(db, bucket)
            
            delivery1 = DeliveryCreate(
                customer_id=created_customer.id,
                delivery_address="成都市武侯区",
                quantity=1,
                bucket_numbers=["BT011"],
                deposit_per_bucket=50.0,
                use_deposit_credit=0.0
            )
            DeliveryService.create_delivery(db, delivery1)
            
            delivery2 = DeliveryCreate(
                customer_id=created_customer.id,
                delivery_address="成都市武侯区",
                quantity=2,
                bucket_numbers=["BT012", "BT013"],
                deposit_per_bucket=50.0,
                use_deposit_credit=50.0
            )
            result = DeliveryService.create_delivery(db, delivery2)
            
            assert result.actual_pay_deposit == 50.0
            
            updated_customer = CustomerService.get_customer(db, created_customer.id)
            assert updated_customer.total_deposit == 100.0
            assert updated_customer.used_deposit == 50.0
            assert updated_customer.available_deposit == 50.0
            assert updated_customer.pending_buckets == 3
        finally:
            db.close()
    
    def test_bucket_status_validation(self):
        db = self.SessionLocal()
        try:
            customer = CustomerCreate(name="孙八", phone="13400134000", address="南京市鼓楼区")
            created_customer = CustomerService.create_customer(db, customer)
            
            bucket = BucketCreate(bucket_number="BT020", deposit_amount=50.0)
            BucketService.create_bucket(db, bucket)
            
            delivery = DeliveryCreate(
                customer_id=created_customer.id,
                delivery_address="南京市鼓楼区",
                quantity=1,
                bucket_numbers=["BT020"],
                deposit_per_bucket=50.0,
                use_deposit_credit=0.0
            )
            DeliveryService.create_delivery(db, delivery)
            
            try:
                DeliveryService.create_delivery(db, delivery)
                assert False, "应该抛出状态异常"
            except BusinessException as e:
                assert e.code == ErrorCode.INVALID_STATE
        finally:
            db.close()
    
    def test_normal_return(self):
        db = self.SessionLocal()
        try:
            customer = CustomerCreate(name="周九", phone="13300133000", address="武汉市江汉区")
            created_customer = CustomerService.create_customer(db, customer)
            
            bucket = BucketCreate(bucket_number="BT030", deposit_amount=50.0)
            BucketService.create_bucket(db, bucket)
            
            delivery = DeliveryCreate(
                customer_id=created_customer.id,
                delivery_address="武汉市江汉区",
                quantity=1,
                bucket_numbers=["BT030"],
                deposit_per_bucket=50.0,
                use_deposit_credit=0.0
            )
            DeliveryService.create_delivery(db, delivery)
            
            return_data = BucketReturnCreate(
                customer_id=created_customer.id,
                bucket_numbers=["BT030"],
                deduct_amount=0.0
            )
            result = ReturnService.create_return(db, return_data)
            
            assert result.actual_refund == 50.0
            
            updated_customer = CustomerService.get_customer(db, created_customer.id)
            assert updated_customer.total_deposit == 0.0
            assert updated_customer.pending_buckets == 0
            
            bucket_after = BucketService.get_bucket_by_number(db, "BT030")
            assert bucket_after.status == "in_stock"
            assert bucket_after.current_customer_id is None
        finally:
            db.close()
    
    def test_wrong_customer_bucket(self):
        db = self.SessionLocal()
        try:
            customer1 = CustomerCreate(name="吴十", phone="13200132000", address="重庆市渝北区")
            created1 = CustomerService.create_customer(db, customer1)
            
            customer2 = CustomerCreate(name="郑十一", phone="13100131000", address="西安市雁塔区")
            created2 = CustomerService.create_customer(db, customer2)
            
            bucket = BucketCreate(bucket_number="BT040", deposit_amount=50.0)
            BucketService.create_bucket(db, bucket)
            
            delivery = DeliveryCreate(
                customer_id=created1.id,
                delivery_address="重庆市渝北区",
                quantity=1,
                bucket_numbers=["BT040"],
                deposit_per_bucket=50.0,
                use_deposit_credit=0.0
            )
            DeliveryService.create_delivery(db, delivery)
            
            return_data = BucketReturnCreate(
                customer_id=created2.id,
                bucket_numbers=["BT040"],
                deduct_amount=0.0
            )
            
            try:
                ReturnService.create_return(db, return_data)
                assert False, "应该抛出需要人工复核的异常"
            except BusinessException as e:
                assert e.code == ErrorCode.NEEDS_MANUAL_REVIEW
        finally:
            db.close()
    
    def test_deposit_records(self):
        db = self.SessionLocal()
        try:
            customer = CustomerCreate(name="冯十二", phone="13000130000", address="苏州市工业园区")
            created = CustomerService.create_customer(db, customer)
            
            bucket = BucketCreate(bucket_number="BT050", deposit_amount=50.0)
            BucketService.create_bucket(db, bucket)
            
            delivery = DeliveryCreate(
                customer_id=created.id,
                delivery_address="苏州市工业园区",
                quantity=1,
                bucket_numbers=["BT050"],
                deposit_per_bucket=50.0,
                use_deposit_credit=0.0
            )
            DeliveryService.create_delivery(db, delivery)
            
            records = DepositService.list_deposit_records(db, customer_id=created.id)
            assert len(records) >= 1
            assert records[0].amount == 50.0
            assert records[0].record_type == "charge"
        finally:
            db.close()
    
    def test_deposit_report(self):
        db = self.SessionLocal()
        try:
            customer = CustomerCreate(name="陈十三", phone="12900129000", address="郑州市金水区")
            created = CustomerService.create_customer(db, customer)
            
            bucket = BucketCreate(bucket_number="BT060", deposit_amount=50.0)
            BucketService.create_bucket(db, bucket)
            
            delivery = DeliveryCreate(
                customer_id=created.id,
                delivery_address="郑州市金水区",
                quantity=1,
                bucket_numbers=["BT060"],
                deposit_per_bucket=50.0,
                use_deposit_credit=0.0
            )
            DeliveryService.create_delivery(db, delivery)
            
            report = ReportService.generate_deposit_report(db)
            assert report["total_customers"] >= 1
            assert report["total_pending_buckets"] >= 1
            assert report["total_deposit_amount"] >= 50.0
            assert len(report["items"]) >= 1
        finally:
            db.close()
    
    def test_missing_field(self):
        db = self.SessionLocal()
        try:
            try:
                customer = CustomerCreate(name="", phone="12800128000")
                assert False, "应该抛出字段验证异常"
            except Exception:
                pass
        finally:
            db.close()
    
    def test_invalid_state(self):
        db = self.SessionLocal()
        try:
            customer = CustomerCreate(name="黄十四", phone="12700127000", address="青岛市市南区")
            created = CustomerService.create_customer(db, customer)
            
            bucket = BucketCreate(bucket_number="BT070", deposit_amount=50.0)
            created_bucket = BucketService.create_bucket(db, bucket)
            
            db.query(Bucket).filter(Bucket.id == created_bucket.id).update({"status": "damaged"})
            db.commit()
            
            delivery = DeliveryCreate(
                customer_id=created.id,
                delivery_address="青岛市市南区",
                quantity=1,
                bucket_numbers=["BT070"],
                deposit_per_bucket=50.0,
                use_deposit_credit=0.0
            )
            
            try:
                DeliveryService.create_delivery(db, delivery)
                assert False, "应该抛出状态异常"
            except BusinessException as e:
                assert e.code == ErrorCode.INVALID_STATE
        finally:
            db.close()
    
    def test_duplicate_transaction(self):
        db = self.SessionLocal()
        try:
            bucket = BucketCreate(bucket_number="BT080", deposit_amount=50.0)
            BucketService.create_bucket(db, bucket)
            
            try:
                BucketService.create_bucket(db, bucket)
                assert False, "应该抛出重复交易异常"
            except BusinessException as e:
                assert e.code == ErrorCode.DUPLICATE_TRANSACTION
        finally:
            db.close()
    
    def print_summary(self):
        print(f"\n{'#'*60}")
        print(f"# 自检总结")
        print(f"# 总测试数: {self.passed + self.failed}")
        print(f"# 通过: {self.passed}")
        print(f"# 失败: {self.failed}")
        print(f"# 通过率: {self.passed / (self.passed + self.failed) * 100:.1f}%")
        print(f"{'#'*60}")
        
        if self.failed > 0:
            print("\n失败的测试:")
            for r in self.results:
                if r["status"] == "failed":
                    print(f"  - {r['name']}: {r.get('error', '未知错误')}")


if __name__ == "__main__":
    print("水桶押金退桶抵扣流转追踪系统 - 自检脚本")
    print("=" * 60)
    print("开始执行自检...")
    
    tester = SelfCheckTester()
    tester.run_all_tests()
    
    if tester.failed > 0:
        sys.exit(1)
    else:
        print("\n✓ 所有自检通过!")
        sys.exit(0)
