import click
import sys
from pathlib import Path
from datetime import datetime
from .parser import TopologyParser
from .validator import TopologyValidator
from .reporter import Reporter
from . import __version__


@click.group()
@click.version_option(version=__version__, prog_name="rabbitmq-topology")
def main():
    pass


@main.command()
@click.argument('input_path', type=click.Path(exists=True))
@click.option('-o', '--output-dir', type=click.Path(), default='./reports',
              help='报告输出目录 (默认: ./reports)')
@click.option('-n', '--name', type=str, default=None,
              help='报告名称前缀 (默认: 根据时间生成)')
@click.option('--no-summary', is_flag=True, help='不显示终端摘要')
@click.option('--machine-readable', is_flag=True, help='仅输出机器可读格式')
@click.option('--strict', is_flag=True, help='严格模式：发现问题时返回非0退出码')
def analyze(input_path, output_dir, name, no_summary, machine_readable, strict):
    input_path = Path(input_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    report_name = name or f"topology_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    parser = TopologyParser()
    
    if input_path.is_file():
        topology = parser.parse_file(str(input_path))
    else:
        topology = parser.parse_directory(str(input_path))
    
    validator = TopologyValidator(topology)
    validation_result = validator.validate()
    
    reporter = Reporter(topology, validation_result, output_dir, report_name)
    
    if machine_readable:
        print(reporter.generate_machine_readable())
    else:
        if not no_summary:
            reporter.print_console_summary()
        
        report_paths = reporter.generate_all_reports()
        
        if not no_summary:
            click.echo(f"\n📄 报告已生成:")
            for report_type, path in report_paths.items():
                click.echo(f"   - {report_type}: {path}")
    
    if strict:
        has_errors = len(topology.errors) > 0
        has_validation_issues = (
            len(validation_result.invalid_bindings) > 0 or
            len(validation_result.orphan_queues) > 0 or
            len(validation_result.orphan_exchanges) > 0 or
            len(validation_result.duplicate_bindings) > 0
        )
        if has_errors or has_validation_issues:
            sys.exit(1)


@main.command()
@click.argument('input_path', type=click.Path(exists=True))
@click.option('--json', 'output_json', is_flag=True, help='以JSON格式输出')
@click.option('--no-exit-code', is_flag=True, help='不设置非0退出码，即使发现问题')
def validate(input_path, output_json, no_exit_code):
    input_path = Path(input_path)
    
    parser = TopologyParser()
    
    if input_path.is_file():
        topology = parser.parse_file(str(input_path))
    else:
        topology = parser.parse_directory(str(input_path))
    
    validator = TopologyValidator(topology)
    validation_result = validator.validate()
    
    if output_json:
        import json
        print(json.dumps(validation_result.model_dump(), ensure_ascii=False, indent=2))
    else:
        reporter = Reporter(topology, validation_result, Path('/tmp'), 'validate')
        reporter.print_validation_only()
    
    if not no_exit_code:
        has_errors = len(topology.errors) > 0
        has_validation_issues = (
            len(validation_result.invalid_bindings) > 0 or
            len(validation_result.orphan_queues) > 0 or
            len(validation_result.orphan_exchanges) > 0 or
            len(validation_result.duplicate_bindings) > 0
        )
        if has_errors or has_validation_issues:
            sys.exit(1)


@main.command(name="list")
@click.argument('input_path', type=click.Path(exists=True))
@click.option('-t', '--type', 'item_type', type=click.Choice(['exchanges', 'queues', 'bindings', 'all']),
              default='all', help='列出的项目类型')
@click.option('-v', '--vhost', type=str, default=None, help='按vhost过滤')
def list_items(input_path, item_type, vhost):
    input_path = Path(input_path)
    
    parser = TopologyParser()
    
    if input_path.is_file():
        topology = parser.parse_file(str(input_path))
    else:
        topology = parser.parse_directory(str(input_path))
    
    reporter = Reporter(topology, None, Path('/tmp'), 'list')
    reporter.print_list(item_type, vhost)


@main.command()
def sample():
    sample_data = {
        "exchanges": [
            {
                "name": "order.exchange",
                "vhost": "/",
                "type": "topic",
                "durable": True
            },
            {
                "name": "notification.exchange",
                "vhost": "/",
                "type": "fanout",
                "durable": True
            }
        ],
        "queues": [
            {
                "name": "order.create.queue",
                "vhost": "/",
                "durable": True
            },
            {
                "name": "order.cancel.queue",
                "vhost": "/",
                "durable": True
            },
            {
                "name": "notification.queue",
                "vhost": "/",
                "durable": True
            }
        ],
        "bindings": [
            {
                "source": "order.exchange",
                "destination": "order.create.queue",
                "destination_type": "queue",
                "routing_key": "order.create",
                "vhost": "/"
            },
            {
                "source": "order.exchange",
                "destination": "order.cancel.queue",
                "destination_type": "queue",
                "routing_key": "order.cancel",
                "vhost": "/"
            },
            {
                "source": "notification.exchange",
                "destination": "notification.queue",
                "destination_type": "queue",
                "routing_key": "",
                "vhost": "/"
            }
        ],
        "policies": [
            {
                "name": "ha-all",
                "vhost": "/",
                "pattern": ".*",
                "definition": {
                    "ha-mode": "all",
                    "ha-sync-mode": "automatic"
                },
                "priority": 0,
                "apply_to": "all"
            }
        ]
    }
    
    import json
    print(json.dumps(sample_data, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
