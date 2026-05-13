import click
import json
import sys
from datetime import datetime
from dateutil import parser as date_parser
from tabulate import tabulate

from .models import AdjustmentTarget, Message, ConsumerInfo, ConsumerRecord
from .offset_manager import OffsetManager
from .message_store import MessageStore
from .consumer_registry import ConsumerRegistry
from .adjustment_plan import AdjustmentPlan
from .verifier import Verifier
from .reporter import Reporter


class CLIController:
    def __init__(self):
        self.offset_manager = OffsetManager()
        self.message_store = MessageStore()
        self.consumer_registry = ConsumerRegistry()
        self.adjustment_plan = AdjustmentPlan()
        self.verifier = Verifier()
        self.reporter = Reporter()
        self._loaded = False
        
    def load_data(self, topic_partitions, current_offsets, messages, consumers, records):
        for topic, partitions in topic_partitions.items():
            self.message_store.add_topic(topic, partitions)
            
        for (topic, partition), offset in current_offsets.items():
            self.offset_manager.set_current_offset(topic, partition, offset)
            
        for msg in messages:
            self.message_store.add_message(msg)
            
        for consumer in consumers:
            self.consumer_registry.register_consumer(consumer)
            
        for record in records:
            self.consumer_registry.add_processed_record(record)
            
        self._loaded = True


controller = CLIController()


@click.group()
@click.option('--topic', '-t', multiple=True, help='指定主题（可多次指定）')
@click.option('--partition', '-p', multiple=True, type=int, help='指定分区（可多次指定）')
@click.option('--json', 'output_json', is_flag=True, help='输出 JSON 格式')
@click.pass_context
def main(ctx, topic, partition, output_json):
    ctx.obj = {
        'topics': list(topic),
        'partitions': list(partition),
        'output_json': output_json
    }
    if not controller._loaded:
        _load_sample_data()


def _load_sample_data():
    topic_partitions = {
        'order-events': 3,
        'user-events': 2
    }
    
    current_offsets = {
        ('order-events', 0): 150,
        ('order-events', 1): 200,
        ('order-events', 2): 50,
        ('user-events', 0): 80,
        ('user-events', 1): 120
    }
    
    messages = []
    base_time = datetime(2024, 1, 15, 10, 0, 0)
    
    for offset in range(100, 180):
        messages.append(Message(
            offset=offset,
            partition=0,
            topic='order-events',
            timestamp=base_time,
            content=f'order-{offset}'
        ))
        
    for offset in range(100, 150):
        messages.append(Message(
            offset=offset,
            partition=1,
            topic='order-events',
            timestamp=base_time,
            content=f'order-{offset}'
        ))
        
    for offset in range(10, 60):
        messages.append(Message(
            offset=offset,
            partition=2,
            topic='order-events',
            timestamp=base_time,
            content=f'order-{offset}'
        ))
        
    for offset in range(50, 100):
        messages.append(Message(
            offset=offset,
            partition=0,
            topic='user-events',
            timestamp=base_time,
            content=f'user-{offset}'
        ))
        
    for offset in range(100, 130):
        messages.append(Message(
            offset=offset,
            partition=1,
            topic='user-events',
            timestamp=base_time,
            content=f'user-{offset}'
        ))
        
    consumers = [
        ConsumerInfo(
            consumer_id='consumer-1',
            group_id='order-group',
            is_online=False,
            topics=['order-events']
        ),
        ConsumerInfo(
            consumer_id='consumer-2',
            group_id='order-group',
            is_online=True,
            last_heartbeat=datetime.now(),
            topics=['order-events']
        ),
        ConsumerInfo(
            consumer_id='consumer-3',
            group_id='user-group',
            is_online=False,
            topics=['user-events']
        )
    ]
    
    records = []
    for offset in range(100, 150):
        records.append(ConsumerRecord(
            consumer_id='consumer-1',
            topic='order-events',
            partition=0,
            processed_offset=offset,
            processed_at=datetime.now(),
            status='success'
        ))
        
    controller.load_data(topic_partitions, current_offsets, messages, consumers, records)


@main.command()
@click.pass_context
def inspect(ctx):
    topics = ctx.obj['topics'] or controller.message_store.get_topics()
    inspections = []
    
    for topic in topics:
        partitions = ctx.obj['partitions'] or controller.message_store.get_partitions(topic)
        for partition in partitions:
            current_offset = controller.offset_manager.get_current_offset(topic, partition)
            partition_info = controller.message_store.get_partition_info(topic, partition, current_offset or 0)
            
            if partition_info:
                result = controller.offset_manager.inspect(topic, partition, partition_info)
                inspections.append(result)
            else:
                inspections.append({
                    'topic': topic,
                    'partition': partition,
                    'status': 'partition_not_found',
                    'message': f'分区 {topic}-{partition} 不存在'
                })
    
    report = controller.reporter.generate_inspection_report(inspections)
    
    if ctx.obj['output_json']:
        click.echo(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        _print_inspection_report(report)


def _print_inspection_report(report):
    click.echo(click.style("=" * 60, fg='cyan'))
    click.echo(click.style("位点检查报告", fg='cyan', bold=True))
    click.echo(click.style("=" * 60, fg='cyan'))
    
    summary = report['summary']
    click.echo(f"\n总分区数: {summary['total']}")
    click.echo(f"  正常: {summary['normal']}")
    click.echo(f"  未来位点: {summary['future']}")
    click.echo(f"  需要回退: {summary['needs_rollback']}")
    click.echo(f"  不存在: {summary['not_found']}")
    
    details = report['details']
    
    if details['normal_partitions']:
        click.echo(click.style("\n--- 正常分区 ---", fg='green'))
        table = []
        for p in details['normal_partitions']:
            table.append([
                f"{p['topic']}-{p['partition']}",
                p['current_offset'],
                f"[{p['earliest_offset']}, {p['latest_offset']}]",
                'NORMAL'
            ])
        click.echo(tabulate(table, headers=['分区', '当前位点', '范围', '状态'], tablefmt='simple'))
        
    if details['future_partitions']:
        click.echo(click.style("\n--- 未来位点（需回退） ---", fg='yellow'))
        table = []
        for p in details['future_partitions']:
            gap = p['current_offset'] - p['latest_offset']
            table.append([
                f"{p['topic']}-{p['partition']}",
                p['current_offset'],
                f"[{p['earliest_offset']}, {p['latest_offset']}]",
                f"FUTURE (+{gap})"
            ])
        click.echo(tabulate(table, headers=['分区', '当前位点', '范围', '状态'], tablefmt='simple'))
        
    if details['needs_rollback_partitions']:
        click.echo(click.style("\n--- 位点落后（需前移） ---", fg='yellow'))
        table = []
        for p in details['needs_rollback_partitions']:
            table.append([
                f"{p['topic']}-{p['partition']}",
                p['current_offset'],
                f"[{p['earliest_offset']}, {p['latest_offset']}]",
                'NEEDS_ROLLBACK'
            ])
        click.echo(tabulate(table, headers=['分区', '当前位点', '范围', '状态'], tablefmt='simple'))
        
    if details['not_found_partitions']:
        click.echo(click.style("\n--- 不存在的分区 ---", fg='red'))
        for p in details['not_found_partitions']:
            click.echo(f"  {p['topic']}-{p['partition']}: {p['message']}")
    
    click.echo(click.style("\n--- 建议 ---", fg='cyan'))
    for rec in report['recommendations']:
        click.echo(f"  • {rec}")


@main.command()
@click.option('--target', '-o', type=str, required=True, 
              help='目标位点，格式: topic:partition:offset')
@click.option('--reason', '-r', default='手动调整', help='调整原因')
@click.pass_context
def plan(ctx, target, reason):
    try:
        parts = target.split(':')
        if len(parts) != 3:
            raise ValueError("目标格式应为 topic:partition:offset")
        topic = parts[0]
        partition = int(parts[1])
        target_offset = int(parts[2])
    except (ValueError, IndexError) as e:
        click.echo(click.style(f"错误: 无效的目标格式 - {e}", fg='red'))
        sys.exit(1)
    
    current_offset = controller.offset_manager.get_current_offset(topic, partition)
    if current_offset is None:
        click.echo(click.style(f"错误: 分区 {topic}-{partition} 不存在", fg='red'))
        sys.exit(1)
    
    partition_info = controller.message_store.get_partition_info(topic, partition, current_offset)
    consumer_online = controller.consumer_registry.is_consumer_online_for_partition(topic, partition)
    consumers_need_check = controller.consumer_registry.get_consumers_needing_idempotent_check(
        topic, partition, target_offset
    )
    
    adjustment_target = AdjustmentTarget(
        topic=topic,
        partition=partition,
        target_offset=target_offset,
        reason=reason
    )
    
    plan_result = controller.adjustment_plan.create_plan(
        adjustment_target, partition_info, current_offset,
        consumer_online, consumers_need_check
    )
    
    if ctx.obj['output_json']:
        click.echo(json.dumps(plan_result, indent=2, ensure_ascii=False))
    else:
        _print_plan_result(plan_result)


def _print_plan_result(plan):
    click.echo(click.style("=" * 60, fg='cyan'))
    click.echo(click.style("调整计划", fg='cyan', bold=True))
    click.echo(click.style("=" * 60, fg='cyan'))
    
    click.echo(f"\n分区: {plan['topic']}-{plan['partition']}")
    
    if not plan['can_execute']:
        click.echo(click.style(f"\n❌ 无法执行: {plan['reason']}", fg='red'))
        return
    
    click.echo(f"当前位点: {plan['current_offset']}")
    click.echo(f"请求目标: {plan['requested_target']}")
    click.echo(f"有效目标: {plan['valid_target']}")
    
    if plan['is_idempotent']:
        click.echo(click.style("幂等操作: 位点已在目标位置", fg='green'))
    
    risk = plan['risk_assessment']
    click.echo(f"\n风险评估:")
    click.echo(f"  风险等级: {_get_risk_color(risk['risk_level'])}")
    click.echo(f"  重复消费消息数: {risk['duplicate_count']}")
    click.echo(f"  跳过消息数: {risk['missing_count']}")
    click.echo(f"  详情: {risk['details']}")
    
    if plan['consumers_needing_idempotent_check']:
        click.echo(click.style("\n⚠️ 需要幂等确认的消费者:", fg='yellow'))
        for c in plan['consumers_needing_idempotent_check']:
            click.echo(f"  - {c['consumer_id']} (group: {c['group_id']})")


def _get_risk_color(level):
    colors = {
        'low': click.style('LOW', fg='green'),
        'medium': click.style('MEDIUM', fg='yellow'),
        'high': click.style('HIGH', fg='red', bold=True)
    }
    return colors.get(level, level)


@main.command()
@click.option('--target', '-o', type=str, required=True,
              help='目标位点，格式: topic:partition:offset')
@click.option('--reason', '-r', default='手动调整', help='调整原因')
@click.option('--operator', '-u', required=True, help='操作者')
@click.option('--yes', '-y', is_flag=True, help='跳过确认直接执行')
@click.pass_context
def adjust(ctx, target, reason, operator, yes):
    try:
        parts = target.split(':')
        if len(parts) != 3:
            raise ValueError("目标格式应为 topic:partition:offset")
        topic = parts[0]
        partition = int(parts[1])
        target_offset = int(parts[2])
    except (ValueError, IndexError) as e:
        click.echo(click.style(f"错误: 无效的目标格式 - {e}", fg='red'))
        sys.exit(1)
    
    current_offset = controller.offset_manager.get_current_offset(topic, partition)
    if current_offset is None:
        click.echo(click.style(f"错误: 分区 {topic}-{partition} 不存在", fg='red'))
        sys.exit(1)
    
    partition_info = controller.message_store.get_partition_info(topic, partition, current_offset)
    consumer_online = controller.consumer_registry.is_consumer_online_for_partition(topic, partition)
    
    adjustment_target = AdjustmentTarget(
        topic=topic,
        partition=partition,
        target_offset=target_offset,
        reason=reason
    )
    
    plan_result = controller.offset_manager.plan_adjustment(
        adjustment_target, partition_info, consumer_online
    )
    
    if not plan_result['success']:
        click.echo(click.style(f"错误: {plan_result['error']}", fg='red'))
        sys.exit(1)
    
    if plan_result['is_idempotent']:
        click.echo(click.style("幂等操作: 位点已在目标位置，无需调整", fg='green'))
        result = controller.offset_manager.execute_adjustment(
            adjustment_target, operator, partition_info, consumer_online
        )
        if ctx.obj['output_json']:
            click.echo(json.dumps(result.to_dict(), indent=2, ensure_ascii=False))
        return
    
    if not yes:
        click.echo(click.style("\n⚠️ 调整计划预览:", fg='yellow'))
        click.echo(f"  分区: {topic}-{partition}")
        click.echo(f"  当前位点: {current_offset}")
        click.echo(f"  目标位点: {target_offset}")
        click.echo(f"  操作: {'回退' if target_offset < current_offset else '前移'}")
        if plan_result['risk']:
            click.echo(f"  风险等级: {plan_result['risk']['risk_level']}")
            click.echo(f"  预估重复消费: {plan_result['risk']['duplicate_count']} 条")
            click.echo(f"  预估漏消费: {plan_result['risk']['missing_count']} 条")
        
        confirm = click.confirm(click.style("\n确认执行此调整？", fg='yellow', bold=True))
        if not confirm:
            click.echo(click.style("操作已取消", fg='red'))
            sys.exit(0)
    
    result = controller.offset_manager.execute_adjustment(
        adjustment_target, operator, partition_info, consumer_online
    )
    
    if ctx.obj['output_json']:
        click.echo(json.dumps(result.to_dict(), indent=2, ensure_ascii=False))
    else:
        if result.success:
            click.echo(click.style("\n✅ 调整成功", fg='green'))
            click.echo(f"  调整前: {result.before_offset}")
            click.echo(f"  调整后: {result.after_offset}")
            click.echo(f"  操作者: {result.operator}")
            click.echo(f"  时间: {result.timestamp}")
        else:
            click.echo(click.style(f"\n❌ 调整失败: {result.message}", fg='red'))


@main.command()
@click.option('--target', '-o', type=str, required=True,
              help='目标位点，格式: topic:partition:offset')
@click.pass_context
def verify(ctx, target):
    try:
        parts = target.split(':')
        if len(parts) != 3:
            raise ValueError("目标格式应为 topic:partition:offset")
        topic = parts[0]
        partition = int(parts[1])
        expected_offset = int(parts[2])
    except (ValueError, IndexError) as e:
        click.echo(click.style(f"错误: 无效的目标格式 - {e}", fg='red'))
        sys.exit(1)
    
    actual_offset = controller.offset_manager.get_current_offset(topic, partition)
    result = controller.verifier.verify_offset(topic, partition, expected_offset, actual_offset)
    
    history = controller.offset_manager.get_history(topic, partition)
    
    if ctx.obj['output_json']:
        report = controller.reporter.generate_verification_report(
            [result.to_dict()], history
        )
        click.echo(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        click.echo(click.style("=" * 60, fg='cyan'))
        click.echo(click.style("位点验证", fg='cyan', bold=True))
        click.echo(click.style("=" * 60, fg='cyan'))
        
        click.echo(f"\n分区: {topic}-{partition}")
        click.echo(f"预期位点: {expected_offset}")
        click.echo(f"实际位点: {actual_offset if actual_offset is not None else 'N/A'}")
        
        if result.is_correct:
            click.echo(click.style("✅ 验证通过", fg='green'))
        else:
            click.echo(click.style(f"❌ 验证失败: {result.message}", fg='red'))
        
        if history:
            click.echo(click.style("\n调整历史:", fg='cyan'))
            for h in history:
                click.echo(f"  [{h['timestamp']}] {h['operator']}: {h['before']} → {h['after']} ({h['reason']})")


@main.command()
@click.option('--type', '-t', 'report_type', 
              type=click.Choice(['inspection', 'plan', 'verification', 'full']),
              default='full', help='报告类型')
@click.pass_context
def report(ctx, report_type):
    if report_type == 'inspection' or report_type == 'full':
        topics = ctx.obj['topics'] or controller.message_store.get_topics()
        inspections = []
        for topic in topics:
            partitions = ctx.obj['partitions'] or controller.message_store.get_partitions(topic)
            for partition in partitions:
                current_offset = controller.offset_manager.get_current_offset(topic, partition)
                partition_info = controller.message_store.get_partition_info(topic, partition, current_offset or 0)
                if partition_info:
                    result = controller.offset_manager.inspect(topic, partition, partition_info)
                    inspections.append(result)
        inspection_report = controller.reporter.generate_inspection_report(inspections)
    else:
        inspection_report = None
    
    plan_report = None
    if report_type == 'plan' or report_type == 'full':
        plans = controller.adjustment_plan.get_all_plans()
        if plans:
            plan_report = controller.reporter.generate_plan_report(plans)
    
    verification_report = None
    if report_type == 'verification' or report_type == 'full':
        verifications = [v.to_dict() for v in controller.verifier.get_verification_history()]
        history = controller.offset_manager.get_history()
        if verifications:
            verification_report = controller.reporter.generate_verification_report(verifications, history)
    
    if report_type == 'full':
        report = controller.reporter.generate_full_report(
            inspection_report or {},
            plan_report or {},
            verification_report or {}
        )
    else:
        report = {
            'inspection': inspection_report,
            'plan': plan_report,
            'verification': verification_report
        }.get(report_type)
    
    if report:
        if ctx.obj['output_json']:
            click.echo(json.dumps(report, indent=2, ensure_ascii=False))
        else:
            if report_type == 'inspection':
                _print_inspection_report(report)
            elif report_type == 'plan' and plan_report:
                _print_plan_report(plan_report)
            elif report_type == 'verification' and verification_report:
                _print_verification_report(verification_report)
            else:
                click.echo(json.dumps(report, indent=2, ensure_ascii=False))


def _print_plan_report(report):
    click.echo(click.style("=" * 60, fg='cyan'))
    click.echo(click.style("调整计划报告", fg='cyan', bold=True))
    click.echo(click.style("=" * 60, fg='cyan'))
    
    summary = report['summary']
    click.echo(f"\n总计划数: {summary['total_plans']}")
    click.echo(f"  可执行: {summary['executable']}")
    click.echo(f"  被阻断: {summary['blocked']}")
    click.echo(f"  高风险: {summary['high_risk']}")
    click.echo(f"  预估重复消费: {summary['estimated_duplicate_messages']} 条")
    click.echo(f"  预估漏消费: {summary['estimated_missing_messages']} 条")
    
    if report['consumers_needing_idempotent_check']:
        click.echo(click.style("\n⚠️ 需要幂等确认的消费者:", fg='yellow'))
        for c in report['consumers_needing_idempotent_check']:
            click.echo(f"  - {c['consumer_id']} (group: {c['group_id']})")
    
    if report['recommendations']:
        click.echo(click.style("\n建议:", fg='cyan'))
        for rec in report['recommendations']:
            click.echo(f"  • {rec}")


def _print_verification_report(report):
    click.echo(click.style("=" * 60, fg='cyan'))
    click.echo(click.style("验证报告", fg='cyan', bold=True))
    click.echo(click.style("=" * 60, fg='cyan'))
    
    summary = report['summary']
    click.echo(f"\n总验证数: {summary['total']}")
    click.echo(f"  通过: {summary['passed']}")
    click.echo(f"  失败: {summary['failed']}")
    click.echo(f"  成功率: {summary['success_rate']:.1f}%")
    
    if report['recommendations']:
        click.echo(click.style("\n建议:", fg='cyan'))
        for rec in report['recommendations']:
            click.echo(f"  • {rec}")


if __name__ == '__main__':
    main()
