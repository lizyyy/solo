#!/usr/bin/env python3
import os

os.makedirs('src/logfmt_cli', exist_ok=True)

# =============== PARSER.PY ===============
parser_content = '''
import re
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

    def to_dict(self):
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
    formats = ['%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S']
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
    f.write(parser_content.strip())

print('✅ parser.py written')

# =============== REPORTER.PY ===============
reporter_content = '''
from pathlib import Path

def generate_terminal_summary(stats):
    lines = []
    lines.append('=' * 60)
    lines.append('LOGFMT PARSER SUMMARY')
    lines.append('=' * 60)
    lines.append(f"Total lines:      {stats['total_lines']}")
    lines.append(f"Good lines:       {stats['good_lines']}")
    lines.append(f"Bad lines:        {stats['bad_lines']}")
    lines.append(f"Bad rate:         {stats['bad_rate']:.1%}")
    lines.append(f"Unique fields:    {stats['fields_count']}")
    lines.append('')
    lines.append('Fields found:')
    for field, info in stats['fields'].items():
        types = ','.join(info['types'])
        samples = ', '.join(str(v) for v in info['sample_values'])
        lines.append(f"  {field} (count={info['count']}, type={types}) : {samples}")
    lines.append('')
    if stats['bad_lines'] > 0:
        lines.append(f"Sample bad lines ({min(stats['bad_lines'], 10)}):")
        for bl in stats['sample_bad_lines']:
            lines.append(f"  Line {bl['line_number']}: {bl['error_reason']} - {repr(bl['raw'][:50])}")
    lines.append('=' * 60)
    return '\\n'.join(lines)

def save_report(stats, log_path, output_dir):
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    log_name = Path(log_path).stem
    report_path = output_dir / f"{log_name}_report.txt"
    report = []
    report.append(f"LogFMT Parser Report")
    report.append(f"Source: {log_path}")
    report.append(f"Generated: {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report.append('')
    report.append(generate_terminal_summary(stats))
    report_path.write_text('\\n'.join(report), encoding='utf-8')
    return report_path
'''

with open('src/logfmt_cli/reporter.py', 'w') as f:
    f.write(reporter_content.strip())

print('✅ reporter.py written')

# =============== MAIN.PY ===============
main_content = '''
import click
import sys
from pathlib import Path

from .parser import LogFileParser
from .reporter import generate_terminal_summary, save_report

@click.group()
def cli():
    pass

@cli.command()
@click.argument('logfile', type=click.Path(exists=True))
@click.option('-o', '--output', type=click.Path(), default='./output')
@click.option('-s', '--sort-by-time', is_flag=True, help='Sort by timestamp')
def parse(logfile, output, sort_by_time):
    try:
        parser = LogFileParser()
        good, bad = parser.parse_file(logfile)
        stats = parser.get_field_stats()
        print(generate_terminal_summary(stats))
        output_path = Path(output)
        output_path.mkdir(parents=True, exist_ok=True)
        ndjson_path = output_path / f"{Path(logfile).stem}.ndjson"
        parser.to_ndjson(str(ndjson_path), sort_by_time=sort_by_time)
        click.echo(f"\\nNDJSON saved to: {ndjson_path}")
        click.echo(f"Bad lines saved to: {str(ndjson_path).replace('.ndjson', '_bad.ndjson')}")
        report_path = save_report(stats, logfile, output)
        click.echo(f"Report saved to: {report_path}")
    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        sys.exit(1)

if __name__ == '__main__':
    cli()
'''

with open('src/logfmt_cli/main.py', 'w') as f:
    f.write(main_content.strip())

print('✅ main.py written')

# =============== __INIT__.PY ===============
init_content = '''
from .parser import LogFileParser, ParsedLine
from .reporter import generate_terminal_summary, save_report
'''

with open('src/logfmt_cli/__init__.py', 'w') as f:
    f.write(init_content.strip())

print('✅ __init__.py written')

print('\\n✅ All modules generated successfully!')
