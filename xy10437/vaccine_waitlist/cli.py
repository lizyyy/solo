import click
import json
import os
from .data_io import DataStore
from .engine import WaitingListEngine
from .models import WaitingListStatus, AppointmentStatus


@click.group()
@click.version_option(package_name="vaccine_waitlist")
def cli():
    """社区疫苗预约候补管理系统"""
    pass


@cli.command()
@click.option('--input', '-i', required=True, type=click.Path(exists=True),
              help='输入数据文件路径 (JSON格式)')
@click.option('--output', '-o', required=False, type=click.Path(),
              help='输出文件路径，用于保存处理后的数据')
@click.pass_context
def import_data(ctx, input, output):
    """导入接种人、疫苗批次、预约和候补名单数据"""
    store = DataStore()

    click.echo(f"正在导入数据: {input}")
    store.import_from_json(input)

    click.echo(f"  - 接种人: {len(store.persons)} 人")
    click.echo(f"  - 疫苗批次: {len(store.vaccine_batches)} 个")
    click.echo(f"  - 预约记录: {len(store.appointments)} 条")
    click.echo(f"  - 候补名单: {len(store.waiting_list)} 条")

    ctx.obj = store

    if output:
        store.export_to_json(output)
        click.echo(f"\n数据已保存到: {output}")

    return store


@cli.command()
@click.option('--input', '-i', required=True, type=click.Path(exists=True),
              help='数据文件路径')
@click.option('--appointment-id', '-a', required=True, help='要取消的预约ID')
@click.option('--cancellation-id', '-c', required=False, help='取消记录ID（防止重复处理）')
@click.option('--skip-notified/--no-skip-notified', default=True,
              help='是否跳过已通知但未确认的候补人 (默认: 跳过)')
@click.option('--output', '-o', required=False, help='处理后保存的文件路径')
def cancel(input, appointment_id, cancellation_id, skip_notified, output):
    """处理预约取消，自动释放名额并通知候补转正"""
    store = DataStore()
    store.import_from_json(input)

    engine = WaitingListEngine(store, skip_notified_unconfirmed=skip_notified)

    click.echo(f"\n处理预约取消: {appointment_id}")
    if cancellation_id:
        click.echo(f"取消记录ID: {cancellation_id}")

    result = engine.process_cancellation(appointment_id, cancellation_id)

    if not result['success']:
        click.echo(f"\n错误: {result['error']}")
        return 1

    click.echo(f"\n取消成功: {result['cancellation_id']}")
    click.echo(f"释放名额: {result['available_slots']} 个")

    if result['notified']:
        click.echo(f"\n通知顺序:")
        for n in result['notified']:
            entry = store.waiting_list[n['entry_id']]
            person = store.persons.get(entry.person_id)
            name = person.name if person else '未知'
            click.echo(f"  [{n['order']}] {n['entry_id']} - {name}")

    if result['promoted']:
        click.echo(f"\n转正成功:")
        for p in result['promoted']:
            entry = store.waiting_list[p['entry_id']]
            person = store.persons.get(entry.person_id)
            batch = store.vaccine_batches.get(entry.vaccine_batch_id)
            name = person.name if person else '未知'
            vaccine = batch.vaccine_name if batch else '未知'
            click.echo(f"  - {p['entry_id']}: {name} ({vaccine} 第{entry.dose_number}剂)")
            click.echo(f"    新预约ID: {p['new_appointment_id']}")

    if result['rejected']:
        click.echo(f"\n不符合条件:")
        for r in result['rejected']:
            entry = store.waiting_list[r['entry_id']]
            person = store.persons.get(entry.person_id)
            name = person.name if person else '未知'
            click.echo(f"  - {r['entry_id']}: {name}")
            click.echo(f"    原因: {r['reason']}")

    if output:
        store.export_to_json(output)
        click.echo(f"\n处理结果已保存到: {output}")

    return 0


@cli.command()
@click.option('--input', '-i', required=True, type=click.Path(exists=True),
              help='数据文件路径')
@click.option('--vaccination-list', '-v', required=False,
              help='导出接种名单的CSV路径')
@click.option('--rejection-reasons', '-r', required=False,
              help='导出未转正原因的CSV路径')
@click.option('--notification-log', '-n', required=False,
              help='导出通知顺序的CSV路径')
@click.option('--json-output', '-j', required=False,
              help='导出完整JSON数据的路径')
def export(input, vaccination_list, rejection_reasons, notification_log, json_output):
    """导出接种名单、未转正原因和通知记录"""
    store = DataStore()
    store.import_from_json(input)

    if vaccination_list:
        store.export_vaccination_list(vaccination_list)
        click.echo(f"接种名单已导出: {vaccination_list}")
        click.echo(f"  共 {len(store.promoted_entries)} 条转正记录")

    if rejection_reasons:
        store.export_rejection_reasons(rejection_reasons)
        click.echo(f"未转正原因已导出: {rejection_reasons}")
        click.echo(f"  共 {len(store.rejection_reasons)} 条拒绝记录")

    if notification_log:
        store.export_notification_log(notification_log)
        click.echo(f"通知记录已导出: {notification_log}")
        click.echo(f"  共 {len(store.notification_records)} 条通知记录")

    if json_output:
        store.export_to_json(json_output)
        click.echo(f"完整数据已导出: {json_output}")


@cli.command()
@click.option('--input', '-i', required=True, type=click.Path(exists=True),
              help='数据文件路径')
@click.option('--entry-id', '-e', required=False, help='指定候补记录ID检查')
def check(input, entry_id):
    """检查候补人的资格条件"""
    store = DataStore()
    store.import_from_json(input)
    engine = WaitingListEngine(store)

    if entry_id:
        entry = store.waiting_list.get(entry_id)
        if not entry:
            click.echo(f"候补记录 {entry_id} 不存在")
            return 1
        _display_entry_check(store, engine, entry)
    else:
        for entry_id, entry in store.waiting_list.items():
            click.echo(f"\n{'='*60}")
            _display_entry_check(store, engine, entry)

    return 0


def _display_entry_check(store, engine, entry):
    person = store.persons.get(entry.person_id)
    batch = store.vaccine_batches.get(entry.vaccine_batch_id)
    name = person.name if person else '未知'
    vaccine = batch.vaccine_name if batch else '未知'

    click.echo(f"候补记录: {entry.id}")
    click.echo(f"接种人: {name} (身份证: {person.id_card if person else '未知'})")
    click.echo(f"疫苗: {vaccine} 第{entry.dose_number}剂")
    click.echo(f"状态: {entry.status.value}")

    results = engine.check_all_qualifications(entry)
    click.echo("\n资格检查:")
    for check_name, ok, reason in results:
        status = "✓ 通过" if ok else "✗ 不通过"
        click.echo(f"  [{status}] {check_name}: {reason}")

    all_ok, _ = engine.is_fully_qualified(entry)
    click.echo(f"\n总体评估: {'符合条件' if all_ok else '不符合条件'}")


@cli.command()
@click.option('--input', '-i', required=True, type=click.Path(exists=True),
              help='数据文件路径')
def status(input):
    """显示当前数据状态摘要"""
    store = DataStore()
    store.import_from_json(input)

    click.echo("\n=== 数据状态摘要 ===")
    click.echo(f"\n接种人: {len(store.persons)} 人")

    click.echo(f"\n疫苗批次:")
    for batch_id, batch in store.vaccine_batches.items():
        click.echo(f"  - {batch_id}: {batch.vaccine_name} ({batch.vaccine_type})")
        click.echo(f"    可用名额: {batch.available_slots}")

    click.echo(f"\n预约记录:")
    booked = sum(1 for a in store.appointments.values()
                 if a.status == AppointmentStatus.BOOKED)
    cancelled = sum(1 for a in store.appointments.values()
                    if a.status == AppointmentStatus.CANCELLED)
    click.echo(f"  - 已预约: {booked}")
    click.echo(f"  - 已取消: {cancelled}")

    click.echo(f"\n候补名单:")
    pending = sum(1 for w in store.waiting_list.values()
                  if w.status == WaitingListStatus.PENDING)
    notified = sum(1 for w in store.waiting_list.values()
                   if w.status == WaitingListStatus.NOTIFIED)
    confirmed = sum(1 for w in store.waiting_list.values()
                    if w.status == WaitingListStatus.CONFIRMED)
    rejected = sum(1 for w in store.waiting_list.values()
                   if w.status == WaitingListStatus.REJECTED)
    click.echo(f"  - 待处理: {pending}")
    click.echo(f"  - 已通知: {notified}")
    click.echo(f"  - 已转正: {confirmed}")
    click.echo(f"  - 已拒绝: {rejected}")

    click.echo(f"\n转正记录: {len(store.promoted_entries)} 条")
    click.echo(f"通知记录: {len(store.notification_records)} 条")


@cli.command()
@click.option('--output', '-o', default='sample_data.json',
              help='样例数据输出路径')
def generate_sample(output):
    """生成样例数据用于测试"""
    from datetime import date, timedelta

    today = date.today()

    sample = {
        "persons": [
            {
                "id": "P001",
                "name": "小明",
                "id_card": "110101202001011234",
                "birth_date": "2020-01-01",
                "gender": "男",
                "phone": "13800138001"
            },
            {
                "id": "P002",
                "name": "小红",
                "id_card": "110101201506152345",
                "birth_date": "2015-06-15",
                "gender": "女",
                "phone": "13800138002"
            },
            {
                "id": "P003",
                "name": "小刚",
                "id_card": "110101201903203456",
                "birth_date": "2019-03-20",
                "gender": "男",
                "phone": "13800138003"
            },
            {
                "id": "P004",
                "name": "王女士",
                "id_card": "110101198505104567",
                "birth_date": "1985-05-10",
                "gender": "女",
                "phone": "13900139001"
            },
            {
                "id": "P005",
                "name": "李先生",
                "id_card": "110101198008205678",
                "birth_date": "1980-08-20",
                "gender": "男",
                "phone": "13900139002"
            },
            {
                "id": "P006",
                "name": "张女士",
                "id_card": "110101199003156789",
                "birth_date": "1990-03-15",
                "gender": "女",
                "phone": "13900139003"
            },
            {
                "id": "P007",
                "name": "小宝宝",
                "id_card": "110101202412017890",
                "birth_date": "2024-12-01",
                "gender": "男",
                "phone": "13900139004"
            }
        ],
        "vaccine_batches": [
            {
                "id": "B001",
                "vaccine_name": "麻腮风疫苗",
                "vaccine_type": "儿童疫苗",
                "min_age_months": 96,
                "max_age_months": 144,
                "total_doses": 2,
                "intervals_days": [365],
                "available_slots": 0,
                "date": str(today)
            },
            {
                "id": "B002",
                "vaccine_name": "水痘疫苗",
                "vaccine_type": "儿童疫苗",
                "min_age_months": 12,
                "max_age_months": 144,
                "total_doses": 2,
                "intervals_days": [90],
                "available_slots": 0,
                "date": str(today)
            },
            {
                "id": "B003",
                "vaccine_name": "新冠疫苗",
                "vaccine_type": "成人加强针",
                "min_age_months": 216,
                "max_age_months": 1200,
                "total_doses": 1,
                "intervals_days": [],
                "available_slots": 0,
                "date": str(today)
            }
        ],
        "appointments": [
            {
                "id": "A001",
                "person_id": "P001",
                "vaccine_batch_id": "B001",
                "dose_number": 1,
                "appointment_date": str(today),
                "status": "booked"
            },
            {
                "id": "A002",
                "person_id": "P004",
                "vaccine_batch_id": "B003",
                "dose_number": 1,
                "appointment_date": str(today),
                "status": "booked"
            }
        ],
        "waiting_list": [
            {
                "id": "W001",
                "person_id": "P002",
                "vaccine_batch_id": "B001",
                "dose_number": 1,
                "status": "pending",
                "priority": 1,
                "created_at": str(today - timedelta(days=5))
            },
            {
                "id": "W002",
                "person_id": "P003",
                "vaccine_batch_id": "B001",
                "dose_number": 1,
                "status": "pending",
                "priority": 0,
                "created_at": str(today - timedelta(days=3))
            },
            {
                "id": "W003",
                "person_id": "P005",
                "vaccine_batch_id": "B003",
                "dose_number": 1,
                "status": "pending",
                "priority": 1,
                "created_at": str(today - timedelta(days=7))
            },
            {
                "id": "W004",
                "person_id": "P006",
                "vaccine_batch_id": "B003",
                "dose_number": 1,
                "status": "pending",
                "priority": 0,
                "created_at": str(today - timedelta(days=2))
            },
            {
                "id": "W005",
                "person_id": "P007",
                "vaccine_batch_id": "B001",
                "dose_number": 1,
                "status": "pending",
                "priority": 0,
                "created_at": str(today - timedelta(days=1))
            }
        ]
    }

    with open(output, 'w', encoding='utf-8') as f:
        json.dump(sample, f, ensure_ascii=False, indent=2)

    click.echo(f"样例数据已生成: {output}")
    click.echo("\n样例说明:")
    click.echo("  - 儿童疫苗 (B001): 小明(A001) 已预约，小红(W001)、小刚(W002)、小宝宝(W005)候补")
    click.echo("  - 成人加强针 (B003): 王女士(A002) 已预约，李先生(W003)、张女士(W004)候补")
    click.echo("  - 小宝宝(P007): 年龄过小，不符合麻腮风疫苗年龄要求(8-12岁)")
    click.echo("\n测试命令:")
    click.echo("  1. vaccine-waitlist status -i sample_data.json")
    click.echo("  2. vaccine-waitlist cancel -i sample_data.json -a A001 -o step1.json")
    click.echo("  3. vaccine-waitlist check -i step1.json")
    click.echo("  4. vaccine-waitlist export -i step1.json -v 接种名单.csv -r 未转正原因.csv -n 通知记录.csv")


if __name__ == '__main__':
    cli()
