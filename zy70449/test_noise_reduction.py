import pytest
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base
from models import Batch, InquiryForm, RuleVersion
from schemas import InquiryFormCreate, BatchCreate, QueryFilter
from noise_reduction import NoiseReductionEngine, RiskType, RiskLevel
from api import process_batch, query_records

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_noise_reduction.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture
def db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

def test_rule_initialization(db):
    """测试规则初始化"""
    engine = NoiseReductionEngine(db)
    engine.initialize_default_rules()
    
    rules = db.query(RuleVersion).all()
    assert len(rules) == 2
    
    v1 = db.query(RuleVersion).filter(RuleVersion.version == "v1.0").first()
    assert v1 is not None
    assert v1.is_active == True
    
    v2 = db.query(RuleVersion).filter(RuleVersion.version == "v2.0").first()
    assert v2 is not None
    assert v2.is_active == False
    
    print("✓ 规则初始化测试通过")

def test_price_validation(db):
    """测试价格校验"""
    engine = NoiseReductionEngine(db)
    
    form_valid = InquiryFormCreate(
        form_no="XJ-TEST-001",
        supplier_name="测试供应商",
        material_code="MAT-001",
        material_name="测试物料",
        specification="测试规格",
        quantity=100,
        unit="个",
        quoted_price=100.0,
        currency="CNY",
        delivery_period="10天",
        contact_person="张三",
        contact_phone="13800138000",
        department="采购部",
        applicant="测试员",
        application_date=datetime.now()
    )
    
    result = engine.process_form(form_valid)
    assert result["is_valid"] == True
    assert result["is_swallowed"] == False
    
    form_invalid = form_valid.copy(update={"quoted_price": -10.0})
    result = engine.process_form(form_invalid)
    assert result["is_valid"] == False
    assert result["primary_risk_type"] == RiskType.PRICE_ABNORMAL
    
    print("✓ 价格校验测试通过")

def test_quantity_validation(db):
    """测试数量校验"""
    engine = NoiseReductionEngine(db)
    
    form_invalid = InquiryFormCreate(
        form_no="XJ-TEST-002",
        supplier_name="测试供应商",
        material_code="MAT-001",
        material_name="测试物料",
        quantity=-5,
        unit="个",
        quoted_price=100.0,
        contact_phone="13800138000",
        department="采购部",
        applicant="测试员",
        application_date=datetime.now()
    )
    
    result = engine.process_form(form_invalid)
    assert result["is_valid"] == False
    assert result["primary_risk_type"] == RiskType.QUANTITY_ABNORMAL
    
    print("✓ 数量校验测试通过")

def test_swallowed_record(db):
    """测试脏行被吞功能"""
    engine = NoiseReductionEngine(db)
    
    form_swallow = InquiryFormCreate(
        form_no="XJ-TEST-003",
        supplier_name="测试供应商",
        material_code="SWALLOW-MAT-001",
        material_name="测试物料",
        quantity=100,
        unit="个",
        quoted_price=100.0,
        contact_phone="13800138000",
        department="采购部",
        applicant="测试员",
        application_date=datetime.now()
    )
    
    result = engine.process_form(form_swallow)
    assert result["is_swallowed"] == True
    assert result["is_valid"] == False
    assert result["primary_risk_type"] == RiskType.SWALLOWED_RECORD
    assert result["primary_risk_level"] == RiskLevel.CRITICAL
    
    print("✓ 脏行被吞功能测试通过")

def test_supplier_validation(db):
    """测试供应商校验"""
    engine = NoiseReductionEngine(db)
    
    form_invalid = InquiryFormCreate(
        form_no="XJ-TEST-004",
        supplier_name="",
        material_code="MAT-001",
        material_name="测试物料",
        quantity=100,
        unit="个",
        quoted_price=100.0,
        contact_phone="13800138000",
        department="采购部",
        applicant="测试员",
        application_date=datetime.now()
    )
    
    result = engine.process_form(form_invalid)
    assert result["is_valid"] == False
    assert result["primary_risk_type"] == RiskType.SUPPLIER_MISSING
    
    print("✓ 供应商校验测试通过")

def test_material_code_validation(db):
    """测试物料编码校验"""
    engine = NoiseReductionEngine(db)
    
    form_invalid = InquiryFormCreate(
        form_no="XJ-TEST-005",
        supplier_name="测试供应商",
        material_code="INVALID-CODE",
        material_name="测试物料",
        quantity=100,
        unit="个",
        quoted_price=100.0,
        contact_phone="13800138000",
        department="采购部",
        applicant="测试员",
        application_date=datetime.now()
    )
    
    result = engine.process_form(form_invalid)
    assert result["is_valid"] == False
    assert result["primary_risk_type"] == RiskType.MATERIAL_INVALID
    
    print("✓ 物料编码校验测试通过")

def test_rule_version_switch(db):
    """测试规则版本切换"""
    engine = NoiseReductionEngine(db)
    engine.initialize_default_rules()
    
    form_v1 = InquiryFormCreate(
        form_no="XJ-TEST-006",
        supplier_name="测试供应商",
        material_code="MAT-001",
        material_name="测试物料",
        specification="",
        quantity=100,
        unit="个",
        quoted_price=100.0,
        delivery_period="90天",
        contact_phone="13800138000",
        department="采购部",
        applicant="测试员",
        application_date=datetime.now()
    )
    
    result_v1 = engine.process_form(form_v1)
    assert result_v1["is_valid"] == True
    
    success = engine.set_active_rule_version("v2.0")
    assert success == True
    
    result_v2 = engine.process_form(form_v1)
    assert result_v2["is_valid"] == False
    
    risk_types = [r["type"] for r in result_v2["risks"]]
    assert RiskType.SPEC_INCOMPLETE in risk_types
    assert RiskType.DELIVERY_TOO_LONG in risk_types
    
    print("✓ 规则版本切换测试通过")

def test_batch_processing(db):
    """测试批量处理功能"""
    engine = NoiseReductionEngine(db)
    engine.initialize_default_rules()
    
    batch_data = BatchCreate(
        batch_no="PC-TEST-001",
        operator="审核员_A",
        department="采购部"
    )
    
    forms = [
        InquiryFormCreate(
            form_no=f"XJ-TEST-{i:03d}",
            supplier_name="测试供应商",
            material_code="MAT-001",
            material_name="测试物料",
            quantity=100 + i,
            unit="个",
            quoted_price=100.0 + i,
            contact_phone="13800138000",
            department="采购部",
            applicant="测试员",
            application_date=datetime.now()
        )
        for i in range(5)
    ]
    forms.append(
        InquiryFormCreate(
            form_no="XJ-TEST-SWALLOW",
            supplier_name="测试供应商",
            material_code="SWALLOW-MAT-002",
            material_name="脏行测试",
            quantity=100,
            unit="个",
            quoted_price=100.0,
            contact_phone="13800138000",
            department="采购部",
            applicant="测试员",
            application_date=datetime.now()
        )
    )
    
    result = process_batch(batch_data, forms, db)
    assert result["total_processed"] == 6
    assert result["valid_count"] == 5
    assert result["swallowed_count"] == 1
    
    batch = db.query(Batch).filter(Batch.batch_no == "PC-TEST-001").first()
    assert batch is not None
    assert batch.total_records == 6
    assert batch.swallowed_records == 1
    
    print("✓ 批量处理功能测试通过")

def test_query_filters(db):
    """测试查询过滤功能"""
    engine = NoiseReductionEngine(db)
    engine.initialize_default_rules()
    
    batch1 = Batch(
        batch_no="PC-QUERY-001",
        operator="审核员_A",
        department="采购部",
        total_records=3,
        valid_records=2,
        invalid_records=1,
        status="completed",
        created_at=datetime.now()
    )
    db.add(batch1)
    db.flush()
    
    for i in range(2):
        form = InquiryForm(
            batch_id=batch1.id,
            form_no=f"XJ-QA-{i:03d}",
            supplier_name="正常供应商",
            material_code="MAT-001",
            material_name="正常物料",
            quantity=100,
            unit="个",
            quoted_price=100.0,
            contact_phone="13800138000",
            department="采购部",
            applicant="测试员",
            application_date=datetime.now(),
            is_valid=True,
            processing_result="通过",
            processing_message="校验通过",
            processed_at=datetime.now()
        )
        db.add(form)
    
    form_invalid = InquiryForm(
        batch_id=batch1.id,
        form_no="XJ-QA-INVALID",
        supplier_name="",
        material_code="MAT-002",
        material_name="异常物料",
        quantity=100,
        unit="个",
        quoted_price=-50.0,
        contact_phone="13800138000",
        department="设备维修部",
        applicant="测试员",
        application_date=datetime.now(),
        is_valid=False,
        risk_type=RiskType.SUPPLIER_MISSING,
        risk_level=RiskLevel.HIGH,
        processing_result="异常",
        processing_message="供应商缺失",
        processed_at=datetime.now()
    )
    db.add(form_invalid)
    db.commit()
    
    filters = QueryFilter(operator="审核员_A")
    result = query_records(filters, db)
    assert result["total"] == 3
    
    filters = QueryFilter(is_valid=False)
    result = query_records(filters, db)
    assert result["total"] == 1
    assert result["items"][0].risk_type == RiskType.SUPPLIER_MISSING
    
    filters = QueryFilter(department="设备维修部")
    result = query_records(filters, db)
    assert result["total"] == 1
    
    filters = QueryFilter(risk_type=RiskType.SUPPLIER_MISSING)
    result = query_records(filters, db)
    assert result["total"] == 1
    
    print("✓ 查询过滤功能测试通过")

def run_all_tests():
    """运行所有测试"""
    print("\n" + "="*60)
    print("器降噪网关 - 自检脚本开始运行")
    print("="*60 + "\n")
    
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    try:
        test_rule_initialization(db)
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        
        test_price_validation(db)
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        
        test_quantity_validation(db)
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        
        test_swallowed_record(db)
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        
        test_supplier_validation(db)
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        
        test_material_code_validation(db)
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        
        test_rule_version_switch(db)
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        
        test_batch_processing(db)
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        
        test_query_filters(db)
        
        print("\n" + "="*60)
        print("✓ 所有自检测试全部通过！")
        print("="*60 + "\n")
        
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

if __name__ == "__main__":
    run_all_tests()
