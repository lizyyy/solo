from datetime import datetime
from .models import (
    RawMaterial, Formula, FormulaVersion, FormulaItem,
    QCConstraint, SystemConfig
)
from .database import db_session


def seed_all():
    with db_session() as db:
        existing = db.query(RawMaterial).first()
        if existing:
            return "数据已存在，跳过初始化"
        
        seed_raw_materials(db)
        seed_formulas(db)
        seed_qc_constraints(db)
        seed_system_configs(db)
        return "种子数据初始化完成"


def seed_raw_materials(db):
    materials = [
        RawMaterial(code="RM-001", name="大豆油A", unit="kg", unit_price=12.5, category="食用油", specification="一级", stock_quantity=0),
        RawMaterial(code="RM-002", name="大豆油B", unit="kg", unit_price=13.8, category="食用油", specification="二级", stock_quantity=5000),
        RawMaterial(code="RM-003", name="面粉X", unit="kg", unit_price=3.2, category="谷物", specification="高筋", stock_quantity=0),
        RawMaterial(code="RM-004", name="面粉Y", unit="kg", unit_price=3.5, category="谷物", specification="中筋", stock_quantity=2000),
        RawMaterial(code="RM-005", name="白砂糖", unit="kg", unit_price=5.8, category="糖类", specification="精制", stock_quantity=800),
        RawMaterial(code="RM-006", name="鸡蛋", unit="kg", unit_price=8.5, category="蛋类", specification="鲜鸡蛋", stock_quantity=300),
        RawMaterial(code="RM-007", name="奶粉", unit="kg", unit_price=35.0, category="乳制品", specification="全脂", stock_quantity=150),
        RawMaterial(code="RM-008", name="黄油", unit="kg", unit_price=42.0, category="乳制品", specification="无盐", stock_quantity=0),
        RawMaterial(code="RM-009", name="人造黄油", unit="kg", unit_price=28.0, category="油脂", specification="食用级", stock_quantity=600),
        RawMaterial(code="RM-010", name="酵母", unit="kg", unit_price=15.0, category="添加剂", specification="高活性", stock_quantity=100),
    ]
    db.add_all(materials)
    db.flush()


def seed_formulas(db):
    formulas_data = [
        {
            "code": "F-001",
            "name": "经典面包配方",
            "product_code": "P-001",
            "product_name": "经典面包",
            "items": [
                ("RM-003", 500, "高筋面粉主要原料"),
                ("RM-005", 80, "白砂糖调味"),
                ("RM-006", 60, "鸡蛋增加营养"),
                ("RM-007", 30, "奶粉增香"),
                ("RM-008", 50, "黄油起酥"),
                ("RM-010", 8, "酵母发酵"),
            ]
        },
        {
            "code": "F-002",
            "name": "松饼配方",
            "product_code": "P-002",
            "product_name": "原味松饼",
            "items": [
                ("RM-004", 400, "中筋面粉"),
                ("RM-005", 100, "白砂糖"),
                ("RM-006", 80, "鸡蛋"),
                ("RM-008", 30, "黄油"),
                ("RM-001", 50, "大豆油A"),
            ]
        },
        {
            "code": "F-003",
            "name": "蛋糕胚配方",
            "product_code": "P-003",
            "product_name": "海绵蛋糕胚",
            "items": [
                ("RM-004", 350, "中筋面粉"),
                ("RM-006", 200, "鸡蛋"),
                ("RM-005", 150, "白砂糖"),
                ("RM-001", 40, "大豆油A"),
                ("RM-007", 20, "奶粉"),
            ]
        },
    ]
    
    for fd in formulas_data:
        formula = Formula(
            code=fd["code"],
            name=fd["name"],
            product_code=fd["product_code"],
            product_name=fd["product_name"],
            current_version=1,
            status="active",
            description=f"标准配方：{fd['name']}"
        )
        db.add(formula)
        db.flush()
        
        version = FormulaVersion(
            formula_id=formula.id,
            version_number=1,
            is_effective=True,
            effective_from=datetime.now(),
            created_by="system",
            reason="初始版本"
        )
        db.add(version)
        db.flush()
        
        for mat_code, qty, note in fd["items"]:
            mat = db.query(RawMaterial).filter(RawMaterial.code == mat_code).first()
            if mat:
                item = FormulaItem(
                    version_id=version.id,
                    raw_material_id=mat.id,
                    raw_material_code=mat.code,
                    raw_material_name=mat.name,
                    quantity=qty,
                    unit=mat.unit,
                    unit_price=mat.unit_price,
                    is_substituted=False,
                    substitution_note=note
                )
                db.add(item)


def seed_qc_constraints(db):
    constraints = [
        QCConstraint(
            raw_material_code="RM-001",
            raw_material_name="大豆油A",
            constraint_type="替代类别匹配",
            constraint_value="食用油",
            description="替代原料必须属于食用油类别"
        ),
        QCConstraint(
            raw_material_code="RM-008",
            raw_material_name="黄油",
            constraint_type="替代类别匹配",
            constraint_value="乳制品|油脂",
            description="黄油的替代原料可以是乳制品或油脂类"
        ),
        QCConstraint(
            raw_material_code="RM-003",
            raw_material_name="面粉X",
            constraint_type="替代类别匹配",
            constraint_value="谷物",
            description="面粉的替代原料必须属于谷物类别"
        ),
        QCConstraint(
            raw_material_code="RM-001",
            raw_material_name="大豆油A",
            constraint_type="成本差异阈值",
            constraint_value="15%",
            description="大豆油A替代的成本差异不能超过15%"
        ),
    ]
    db.add_all(constraints)


def seed_system_configs(db):
    configs = [
        SystemConfig(
            config_key="approval_threshold_percent",
            config_value="10",
            description="成本差异审批阈值百分比，超过则需要更高审批级"
        ),
        SystemConfig(
            config_key="max_retry_times",
            config_value="3",
            description="执行失败后的最大重试次数"
        ),
        SystemConfig(
            config_key="auto_freeze_on_high_cost",
            config_value="true",
            description="成本差异超过阈值时是否自动冻结"
        ),
    ]
    db.add_all(configs)


def get_seed_summary():
    return {
        "原料数据": "10种原料，含缺货原料（大豆油A库存0、黄油库存0）",
        "配方数据": "3个标准配方（经典面包、松饼、蛋糕胚）",
        "质检约束": "4条替代规则",
        "系统配置": "3项系统参数"
    }
