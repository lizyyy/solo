#!/usr/bin/env python3
import os

# Create output directory
os.makedirs('src/logfmt_cli', exist_ok=True)

# Build parser.py
parser_content = '''import re
import json
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from datetime import datetime

LOGFMT_PATTERN = re.compile(r'([a-zA-Z_][a-zA-Z0-9_]*)=([^\\s]+)')

@dataclass
class ParsedLine:
    line_number: int
    raw: str
    fields: Dict[str, Any] = field(default_factory=dict)
    is_bad: bool = False
    error_reason: Optional[str] = None
    timestamp: Optional[datetime] = None
    logfmt_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            'line_number': self.line_number,
            'raw': self.raw,
            'fields': self.fields,
            'is_bad': self.is_bad,
            'error_reason': self.error_reason,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'logfmt_count': self.logfmt_count
        }

def parse_logfmt_line(line, line_number):
    result = ParsedLine(
        line_number=line_number,
        raw=line.rstrip('\\n')
    )
    
    if not line.strip():
        result.is_bad = True
        result.error_reason = 'empty_line'
        return result
    
    matches = list(LOGFMT_PATTERN.finditer(line))
    
    if not matches:
        result.is_bad = True
        result.error_reason = 'no_logfmt_fields'
        return result
    
    fields = {}
    for match in matches:
        key = match.group(1)
        value = match.group(2)
        
        if value.startswith('"') and value.endswith('"'):
            value = value[1:-1]
        elif value.startswith("'") and value.endswith("'"):
            value = value[1:-1]
        
        if value.lower() == 'true':
            fields[key] = True
        elif value.lower() == 'false':
            fields[key] = False
        elif value.lower() in ('null', 'nil', 'none'):
            fields[key] = None
        else:
            try:
                if '.' in value:
                    fields[key] = float(value)
                else:
                    fields[key] = int(value)
            except ValueError:
                fields[key] = value
    
    result.fields = fields
    result.logfmt_count = len(fields)
    
    return result

def parse_timestamp(ts_str):
    if not ts_str:
        return None
    
    ts_str = str(ts_str).strip()
    
    formats = [
        '%Y-%m-%dT%H:%M:%S',
        '%Y-%m-%d %H:%M:%S',
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(ts_str[:19], fmt)
        except ValueError:
            continue
    
    return None

class LogFileParser:
    def __init__(self, timestamp_keys=None):
        self.timestamp_keys = timestamp_keys or ['ts', 'timestamp', 'time', 'datetime']
        self.lines = []
        self.bad_lines = []
        self.good_lines = []
    
    def parse_file(self, filepath):
        self.lines = []
        self.bad_lines = []
        self.good_lines = []
        
        with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
            for line_num, line in enumerate(f, 1):
                parsed = parse_logfmt_line(line, line_num)
                
                for ts_key in self.timestamp_keys:
                    if ts_key in parsed.fields:
                        ts_val = parsed.fields[ts_key]
                        parsed.timestamp = parse_timestamp(ts_val)
                        if parsed.timestamp:
                            break
                
                self.lines.append(parsed)
                if parsed.is_bad:
                    self.bad_lines.append(parsed)
                else:
                    self.good_lines.append(parsed)
        
        return self.good_lines, self.bad_lines
    
    def get_all_fields(self):
        field_types = {}
        for line in self.good_lines:
            for key, value in line.fields.items():
                if key not in field_types:
                    field_types[key] = set()
                field_types[key].add(type(value).__name__)
        return field_types
    
    def get_field_stats(self):
        all_fields = self.get_all_fields()
        stats = {
            'total_lines': len(self.lines),
            'good_lines': len(self.good_lines),
            'bad_lines': len(self.bad_lines),
            'bad_rate': len(self.bad_lines) / len(self.lines) if self.lines else 0,
            'fields_count': len(all_fields),
            'fields': {},
            'sample_bad_lines': [bl.to_dict() for bl in self.bad_lines[:10]]
        }
        
        for field, types in all_fields.items():
            values = []
            for line in self.good_lines:
                if field in line.fields:
                    values.append(line.fields[field])
            
            unique_values = list(set(values))
            stats['fields'][field] = {
                'types': list(types),
                'count': len(values),
                'unique_count': len(unique_values),
                'sample_values': unique_values[:5]
            }
        
        return stats
    
    def sort_by_timestamp(self):
        def sort_key(line):
            if line.timestamp:
                return (0, line.timestamp)
            return (1, line.line_number)
        
        return sorted(self.good_lines, key=sort_key)
    
    def to_ndjson(self, output_path, sort_by_time=False):
        lines = self.sort_by_timestamp() if sort_by_time else self.good_lines
        
        with open(output_path, 'w', encoding='utf-8') as f:
            for line in lines:
                f.write(json.dumps(line.to_dict(), ensure_ascii=False) + '\\n')
        
        bad_path = output_path.replace('.ndjson', '_bad.ndjson')
        with open(bad_path, 'w', encoding='utf-8') as f:
            for line in self.bad_lines:
                f.write(json.dumps(line.to_dict(), ensure_ascii=False) + '\\n')
'''

with open('src/logfmt_cli/parser.py', 'w') as f:
    f.write(parser_content)
print('parser.py created')

# Build reporter.py
reporter_content = '''import json
from typing import Dict, Any
from datetime import datetime
from pathlib import Path

def generate_terminal_summary(stats: Dict[str, Any]) -> str:
    lines = []
    lines.append('=' * 60)
    lines.append('          LOGFMT PARSER SUMMARY')
    lines.append('=' * 60)
    lines.append(f'  Total Lines:    {stats[\"total_lines\"]:>8}')
    lines.append(f'  Parsed OK:      {stats[\"good_lines\"]:>8}')
    lines.append(f'  Bad Lines:      {stats[\"bad_lines\"]:>8}')
    lines.append(f'  Failure Rate:   {stats[\"bad_rate\"]*100:>7.2f}%')
    lines.append(f'  Fields Found:   {stats[\"fields_count\"]:>8}')
    lines.append('')
    lines.append('  Fields:')
    for field, info in stats['fields'].items():
        types = ', '.join(info['types'])
        lines.append(f'    - {field:<20} types: [{types}] count: {info[\"count\"]}')
    lines.append('')
    lines.append('=' * 60)
    return chr(10).join(lines)

def save_report(stats, log_path, output_dir):
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    files = {}
    summary = generate_terminal_summary(stats)
    summary_file = out_path / 'summary.txt'
    with open(summary_file, 'w') as f:
        f.write(summary)
    files['summary'] = str(summary_file)
    return files
'''

with open('src/logfmt_cli/reporter.py', 'w') as f:
    f.write(reporter_content)
print('reporter.py created')

# Build main.py
main_content = '''import click
import sys
from pathlib import Path

from .parser import LogFileParser
from .reporter import generate_terminal_summary, save_report

@click.group()
def cli():
    """Logfmt Structured Parser CLI"""
    pass

@cli.command()
@click.argument('logfile', type=click.Path(exists=True, readable=True))
@click.option('--output', '-o', default='./logfmt_output', help='Output directory')
@click.option('--sort/--no-sort', default=True, help='Sort by timestamp')
@click.option('--quiet', '-q', is_flag=True, help='Quiet mode')
def parse(logfile, output, sort, quiet):
    """Parse log file and extract structured fields"""
    try:
        parser = LogFileParser()
        good_lines, bad_lines = parser.parse_file(logfile)
        stats = parser.get_field_stats()
        
        if not quiet:
            click.echo(generate_terminal_summary(stats))
        
        ndjson_path = Path(output) / 'structured.ndjson'
        parser.to_ndjson(str(ndjson_path), sort_by_time=sort)
        
        report_files = save_report(stats, logfile, output)
        
        if not quiet:
            click.echo('')
            click.echo('Output files saved:')
            click.echo(f'  - summary: {report_files[\"summary\"]}')
            click.echo(f'  - ndjson: {ndjson_path}')
        
        sys.exit(0)
        
    except Exception as e:
        click.echo(f'Error: {str(e)}', err=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    cli()
'''

with open('src/logfmt_cli/main.py', 'w') as f:
    f.write(main_content)
print('main.py created')

# Build __init__.py
with open('src/logfmt_cli/__init__.py', 'w') as f:
    f.write('from .parser import LogFileParser, ParsedLine\\n')
    f.write('from .reporter import generate_terminal_summary, save_report\\n')
print('__init__.py created')

print('All source files created successfully!')
