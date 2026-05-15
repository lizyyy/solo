import uuid
from datetime import datetime, timedelta
from app.models.schemas import LakePartition, DetectionRule, InvoiceRed冲Record, RuleType
from app.models.store import store


def generate_sample_partitions():
    partitions = [
        LakePartition(
            id=str(uuid.uuid4()),
            source_system="ERP",
            environment="prod",
            database_name="finance",
            table_name="invoices",
            partition_column="dt",
            partition_value="2024-01-15",
            data_date="2024-01-15",
            record_count=15000,
            file_size=256.5,
            creation_time=datetime.now() - timedelta(days=2),
            update_time=datetime.now() - timedelta(days=1),
            original_input={
                "source": "ERP_finance_invoices",
                "load_time": "2024-01-16 03:00:00",
                "etl_job": "job_001",
                "source_count": 15000
            }
        ),
        LakePartition(
            id=str(uuid.uuid4()),
            source_system="CRM",
            environment="prod",
            database_name="customer",
            table_name="orders",
            partition_column="dt",
            partition_value="2024-01-15",
            data_date="2024-01-15",
            record_count=8500,
            file_size=128.3,
            creation_time=datetime.now() - timedelta(days=2),
            update_time=datetime.now() - timedelta(days=1),
            original_input={
                "source": "CRM_customer_orders",
                "load_time": "2024-01-16 04:00:00",
                "etl_job": "job_002",
                "source_count": 8500
            }
        ),
        LakePartition(
            id=str(uuid.uuid4()),
            source_system="HRS",
            environment="test",
            database_name="employee",
            table_name="attendance",
            partition_column="dt",
            partition_value="2024-01-15",
            data_date="2024-01-15",
            record_count=0,
            file_size=0.1,
            creation_time=datetime.now() - timedelta(days=2),
            update_time=datetime.now() - timedelta(days=1),
            original_input={
                "source": "HRS_employee_attendance",
                "load_time": "2024-01-16 05:00:00",
                "etl_job": "job_003",
                "source_count": 0,
                "note": "测试环境数据"
            }
        ),
        LakePartition(
            id=str(uuid.uuid4()),
            source_system="OMS",
            environment="prod",
            database_name="order",
            table_name="order_detail",
            partition_column="dt",
            partition_value="2023-12-01",
            data_date="2023-12-01",
            record_count=50000,
            file_size=512.8,
            creation_time=datetime.now() - timedelta(days=45),
            update_time=datetime.now() - timedelta(days=44),
            original_input={
                "source": "OMS_order_order_detail",
                "load_time": "2023-12-02 03:00:00",
                "etl_job": "job_004",
                "source_count": 50000
            }
        ),
        LakePartition(
            id=str(uuid.uuid4()),
            source_system="WMS",
            environment="uat",
            database_name="inventory",
            table_name="stock",
            partition_column="dt",
            partition_value="2024-01-10",
            data_date="2024-01-10",
            record_count=3200,
            file_size=45.2,
            creation_time=datetime.now() - timedelta(days=6),
            update_time=datetime.now() - timedelta(days=5),
            original_input={
                "source": "WMS_inventory_stock",
                "load_time": "2024-01-11 06:00:00",
                "etl_job": "job_005",
                "source_count": 3200,
                "uat_tester": "zhang_san"
            }
        ),
    ]
    
    for p in partitions:
        store.save_partition(p)
    
    print(f"已生成 {len(partitions)} 条样例分区数据")
    return partitions


def generate_sample_rules():
    normal_rule = DetectionRule(
        rule_id="rule_001",
        rule_name="标准检测规则",
        rule_type=RuleType.NORMAL,
        version="1.0.0",
        description="标准严格版本的检测规则",
        conditions={
            "min_record_count": 100,
            "max_record_count": 100000,
            "min_file_size_mb": 1.0,
            "max_file_size_mb": 1000,
            "date_tolerance_days": 7
        },
        created_at=datetime.now(),
        is_active=True
    )
    
    wide_rule = DetectionRule(
        rule_id="rule_002",
        rule_name="宽松检测规则",
        rule_type=RuleType.WIDE,
        version="1.0.0-wide",
        description="检测规则过宽的变体版本，用于对比测试",
        conditions={
            "min_record_count": 1,
            "max_record_count": 1000000,
            "min_file_size_mb": 0.01,
            "max_file_size_mb": 10000,
            "date_tolerance_days": 90
        },
        created_at=datetime.now(),
        is_active=True
    )
    
    store.save_rule(normal_rule)
    store.save_rule(wide_rule)
    
    print("已生成 2 条样例检测规则（标准版 + 宽松版）")
    return [normal_rule, wide_rule]


def generate_sample_invoices():
    invoices = [
        InvoiceRed冲Record(
            id=str(uuid.uuid4()),
            environment="prod",
            invoice_no="INV-2024-001234",
            red冲_date="2024-01-15",
            amount=12500.50,
            status="completed",
            original_input={
                "original_invoice_no": "INV-2024-001001",
                "reason": "客户退货",
                "operator": "wang_wu",
                "approval_time": "2024-01-15 14:30:00"
            },
            source_partition_id=None
        ),
        InvoiceRed冲Record(
            id=str(uuid.uuid4()),
            environment="test",
            invoice_no="INV-TEST-000567",
            red冲_date="2024-01-10",
            amount=3200.00,
            status="pending",
            original_input={
                "original_invoice_no": "INV-TEST-000456",
                "reason": "测试红冲",
                "operator": "test_user",
                "approval_time": None
            },
            source_partition_id=None
        ),
        InvoiceRed冲Record(
            id=str(uuid.uuid4()),
            environment="prod",
            invoice_no="INV-2024-001235",
            red冲_date="2024-01-14",
            amount=8900.00,
            status="completed",
            original_input={
                "original_invoice_no": "INV-2024-001005",
                "reason": "金额调整",
                "operator": "li_liu",
                "approval_time": "2024-01-14 10:15:00"
            },
            source_partition_id=None
        ),
    ]
    
    for i in invoices:
        store.save_invoice(i)
    
    print(f"已生成 {len(invoices)} 条样例发票红冲记录")
    return invoices


def init_all_sample_data():
    print("开始初始化样例数据...")
    generate_sample_partitions()
    generate_sample_rules()
    generate_sample_invoices()
    print("样例数据初始化完成！")


if __name__ == "__main__":
    init_all_sample_data()
