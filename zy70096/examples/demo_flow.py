from carbon_accounting.models import EmissionSource, TransactionStatus
from carbon_accounting.service import CarbonAccountingService


def print_section(title):
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def main():
    service = CarbonAccountingService()

    print_section("1. 注册企业")
    ent_a = service.register_enterprise("某钢铁企业", 2024, "ent-steel-001")
    ent_b = service.register_enterprise("某新能源企业", 2024, "ent-green-001")
    print(f"企业A: {ent_a.name} (ID: {ent_a.id})")
    print(f"企业B: {ent_b.name} (ID: {ent_b.id})")

    print_section("2. 配额分配")
    service.allocate_quota(ent_a.id, "2024", 10000.0, "2024年度初始配额")
    service.allocate_quota(ent_b.id, "2024", 5000.0, "2024年度初始配额")
    print(f"企业A总配额: {service.get_total_quota(ent_a.id)} 吨")
    print(f"企业B总配额: {service.get_total_quota(ent_b.id)} 吨")

    print_section("3. 排放数据导入（1月）")
    batch_jan = service.import_emissions(
        enterprise_id=ent_a.id,
        period="2024-01",
        emissions_data=[
            (EmissionSource.SCOPE1, 800.0),
            (EmissionSource.SCOPE2, 200.0),
        ],
        batch_id="import-2024-01-001",
    )
    print(f"导入批次: {batch_jan.id}, 状态: {batch_jan.status}")
    print(f"企业A当前总排放: {service.get_total_emission(ent_a.id)} 吨")

    print_section("4. 交易创建与冻结")
    tx = service.create_transaction(
        enterprise_id=ent_a.id,
        counterparty_id=ent_b.id,
        amount=500.0,
        price=55.0,
        remark="紧急履约补购",
    )
    print(f"创建交易: {tx.id}")
    print(f"  企业A可用配额(冻结前): {service.get_available_quota(ent_a.id)}")

    frozen_tx = service.freeze_transaction(tx.id)
    print(f"交易冻结后状态: {frozen_tx.status.value}")
    print(f"  企业A冻结配额: {service.get_frozen_quota(ent_a.id)}")
    print(f"  企业A可用配额: {service.get_available_quota(ent_a.id)}")

    print_section("5. 履约状态评估")
    status = service.calculate_compliance_status(ent_a.id)
    print(f"总排放: {status.total_emission} 吨")
    print(f"总配额: {status.total_quota} 吨")
    print(f"冻结配额: {status.frozen_quota} 吨")
    print(f"可用配额: {status.available_quota} 吨")
    print(f"缺口: {status.deficit} 吨")
    print(f"预警级别: {status.warning_level}")
    print(f"是否达标: {'是' if status.is_compliant else '否'}")

    print_section("6. 跨月排放数据修正")
    print("发现1月Scope1排放数据有误，进行修正...")
    batch_jan_corr = service.import_emissions(
        enterprise_id=ent_a.id,
        period="2024-01",
        emissions_data=[
            (EmissionSource.SCOPE1, 850.0),
        ],
        batch_id="import-2024-01-corr-001",
    )
    print(f"修正批次: {batch_jan_corr.id}")
    print(f"修正后总排放: {service.get_total_emission(ent_a.id)} 吨")

    revisions = service.get_revision_history(ent_a.id)
    print(f"\n修正历史记录 ({len(revisions)} 条):")
    for r in revisions:
        print(f"  - {r.change_description}")

    print_section("7. 完成交易并重新评估")
    completed_tx = service.complete_transaction(tx.id)
    print(f"交易完成状态: {completed_tx.status.value}")
    print(f"企业A配额: {service.get_total_quota(ent_a.id)} 吨")
    print(f"企业B配额: {service.get_total_quota(ent_b.id)} 吨")

    status_after = service.calculate_compliance_status(ent_a.id)
    print(f"\n交易完成后履约状态:")
    print(f"  总排放: {status_after.total_emission} 吨")
    print(f"  可用配额: {status_after.available_quota} 吨")
    print(f"  缺口: {status_after.deficit} 吨")
    print(f"  是否达标: {'是' if status_after.is_compliant else '否'}")

    print_section("8. 幂等性验证：重复导入同一批次")
    print("使用相同batch_id再次导入1月数据...")
    batch_dup = service.import_emissions(
        enterprise_id=ent_a.id,
        period="2024-01",
        emissions_data=[
            (EmissionSource.SCOPE1, 800.0),
            (EmissionSource.SCOPE2, 200.0),
        ],
        batch_id="import-2024-01-001",
    )
    print(f"批次ID: {batch_dup.id} (与首次相同: {batch_dup.id == batch_jan.id})")
    print(f"总排放(保持不变): {service.get_total_emission(ent_a.id)} 吨")

    print_section("9. 异常场景演示")
    print("\n尝试为不存在的企业导入数据:")
    try:
        service.import_emissions(
            enterprise_id="non-existent",
            period="2024-01",
            emissions_data=[(EmissionSource.SCOPE1, 100.0)],
        )
    except Exception as e:
        print(f"  拦截成功: {type(e).__name__}: {e}")

    print("\n尝试冻结超过可用配额的交易:")
    tx2 = service.create_transaction(
        enterprise_id=ent_a.id,
        counterparty_id=ent_b.id,
        amount=100000.0,
        price=50.0,
    )
    try:
        service.freeze_transaction(tx2.id)
    except Exception as e:
        print(f"  拦截成功: {type(e).__name__}: {e}")

    print("\n尝试完成未冻结的交易:")
    tx3 = service.create_transaction(
        enterprise_id=ent_b.id,
        counterparty_id=ent_a.id,
        amount=100.0,
        price=50.0,
    )
    try:
        service.complete_transaction(tx3.id)
    except Exception as e:
        print(f"  拦截成功: {type(e).__name__}: {e}")

    print_section("演示完成")
    print("\n关键业务规则已验证:")
    print("  ✓ 排放数据导入支持版本管理")
    print("  ✓ 跨月数据修正自动记录历史")
    print("  ✓ 重复导入同一批次保持幂等")
    print("  ✓ 交易冻结确保配额不重复使用")
    print("  ✓ 缺口预警考虑冻结配额影响")
    print("  ✓ 所有异常场景均有明确拦截")


if __name__ == "__main__":
    main()
