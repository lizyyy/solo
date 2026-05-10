import click
import json

class Context:
    def __init__(self):
        self.current_user = None

pass_context = click.make_pass_decorator(Context, ensure=True)

def print_table(headers, rows):
    if not rows:
        click.echo('没有数据')
        return
    
    widths = [len(h) for h in headers]
    for row in rows:
        for i, cell in enumerate(row):
            widths[i] = max(widths[i], len(str(cell) if cell is not None else ''))
    
    header_line = '  '.join(f'{h:<{w}}' for h, w in zip(headers, widths))
    click.echo(header_line)
    click.echo('-' * len(header_line))
    
    for row in rows:
        line = '  '.join(f'{str(c) if c is not None else "":<{w}}' for c, w in zip(row, widths))
        click.echo(line)

def print_json(data):
    click.echo(json.dumps(data, ensure_ascii=False, indent=2, default=str))
