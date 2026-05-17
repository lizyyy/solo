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
    return '\n'.join(lines)

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
    report_path.write_text('\n'.join(report), encoding='utf-8')
    return report_path