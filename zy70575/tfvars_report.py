#!/usr/bin/env python3
import argparse
import json
import re
import os
import sys
from pathlib import Path
from datetime import datetime

def parse_tf_file(file_path):
    variables = {}
    references = []
    errors = []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except Exception as e:
        errors.append({'file': file_path, 'line': 0, 'col': 0, 'raw': '', 'msg': 'Read error: ' + str(e), 'type': 'file_access'})
        return variables, references, errors
    var_pattern = re.compile(r'^\s*variable\s+"([^"]+)"\s*\{')
    ref_pattern = re.compile(r'var\.([a-zA-Z_][a-zA-Z0-9_\-]*)')
    in_var_block = False
    current_var = None
    brace_depth = 0
    for line_num, line in enumerate(lines, 1):
        try:
            var_match = var_pattern.match(line)
            if var_match:
                var_name = var_match.group(1)
                current_var = {'name': var_name, 'file': file_path, 'line': line_num, 'has_default': False}
                in_var_block = True
                brace_depth = 1
                continue
            if in_var_block:
                brace_depth += line.count('{')
                brace_depth -= line.count('}')
                if 'default' in line and '=' in line:
                    current_var['has_default'] = True
                if brace_depth <= 0:
                    variables[current_var['name']] = current_var
                    in_var_block = False
                    current_var = None
                continue
            for match in ref_pattern.finditer(line):
                var_name = match.group(1)
                references.append({'name': var_name, 'file': file_path, 'line': line_num, 'col': match.start() + 1})
        except Exception as e:
            errors.append({'file': file_path, 'line': line_num, 'col': 1, 'raw': line.strip(), 'msg': 'Parse failed: ' + str(e), 'type': 'parse_error'})
    return variables, references, errors

def analyze_path(path):
    all_vars = {}
    all_refs = []
    all_errors = []
    p = Path(path)
    tf_files = []
    if p.is_file() and p.suffix in ('.tf', '.tfvars'):
        tf_files.append(str(p))
    elif p.is_dir():
        tf_files.extend([str(f) for f in p.rglob('*.tf')])
        tf_files.extend([str(f) for f in p.rglob('*.tfvars')])
    for tf_file in tf_files:
        vars_refs, refs_refs, errs_refs = parse_tf_file(tf_file)
        all_vars.update(vars_refs)
        all_refs.extend(refs_refs)
        all_errors.extend(errs_refs)
    return all_vars, all_refs, all_errors

def generate_report(all_vars, all_refs, all_errors):
    referenced_vars = set(ref['name'] for ref in all_refs)
    all_var_names = set(all_vars.keys()) | referenced_vars
    var_reports = {}
    issues = []
    for var_name in all_var_names:
        var_def = all_vars.get(var_name)
        refs = [r for r in all_refs if r['name'] == var_name]
        is_used = len(refs) > 0
        var_reports[var_name] = {'name': var_name, 'defined': var_def is not None, 'is_used': is_used, 'has_default': var_def['has_default'] if var_def else False, 'definition': var_def, 'references': refs, 'issues': []}
        if not var_def:
            issues.append((var_name, 'referenced but not defined', refs[0] if refs else None))
            var_reports[var_name]['issues'].append('referenced but not defined')
        else:
            if not is_used:
                issues.append((var_name, 'defined but never used', var_def))
                var_reports[var_name]['issues'].append('defined but never used')
            if not var_def['has_default']:
                issues.append((var_name, 'missing default value', var_def))
                var_reports[var_name]['issues'].append('missing default value')
    summary = {'total_variables': len(all_vars), 'used_variables': sum(1 for vr in var_reports.values() if vr['is_used']), 'unused_variables': sum(1 for vr in var_reports.values() if vr['defined'] and not vr['is_used']), 'variables_with_default': sum(1 for vr in var_reports.values() if vr['defined'] and vr['has_default']), 'variables_without_default': sum(1 for vr in var_reports.values() if vr['defined'] and not vr['has_default']), 'undefined_but_referenced': sum(1 for vr in var_reports.values() if not vr['defined']), 'total_errors': len(all_errors), 'total_issues': len(issues)}
    return {'summary': summary, 'variables': var_reports, 'errors': all_errors, 'issues': issues}

def print_terminal_report(result):
    s = result['summary']
    print('')
    print('=' * 60)
    print('           Terraform Variable Usage Report')
    print('=' * 60)
    print('')
    print('Summary:')
    print(f"  Total variables:      {s['total_variables']}")
    print(f"  Used variables:       {s['used_variables']}")
    print(f"  Unused variables:     {s['unused_variables']}")
    print(f"  With default value:   {s['variables_with_default']}")
    print(f"  Without default:      {s['variables_without_default']}")
    print(f"  Undefined but used:   {s['undefined_but_referenced']}")
    print(f"  Total issues:         {s['total_issues']}")
    print(f"  Parse errors:         {s['total_errors']}")
    print('')
    if result['errors']:
        print('Parse errors (dirty data kept):')
        for err in result['errors']:
            print(f"  * {err['file']}:{err['line']}:{err['col']}")
            print(f"    Type: {err['type']}")
            print(f"    Message: {err['msg']}")
            if err['raw']:
                print(f"    Content: {err['raw']}")
            print('')
    if result['issues']:
        print('Variable issues:')
        for var_name, issue, location in result['issues']:
            if location:
                loc = f"{location.get('file', '?')}:{location.get('line', '?')}"
            else:
                loc = 'unknown'
            print(f"  * {var_name} - {issue}")
            print(f"    Location: {loc}")
        print('')
    unused_vars = [n for n, r in result['variables'].items() if r['defined'] and not r['is_used']]
    if unused_vars:
        print('Unused variables:')
        for var_name in sorted(unused_vars):
            defn = result['variables'][var_name]['definition']
            print(f"  - {var_name} ({defn['file']}:{defn['line']})")
        print('')
    no_default_vars = [n for n, r in result['variables'].items() if r['defined'] and not r['has_default'] and r['is_used']]
    if no_default_vars:
        print('Used variables without default:')
        for var_name in sorted(no_default_vars):
            defn = result['variables'][var_name]['definition']
            print(f"  - {var_name} ({defn['file']}:{defn['line']})")
        print('')

def save_json(result, output_path):
    output = {**result, 'generated_at': datetime.now().isoformat()}
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f'JSON saved to: {output_path}')

def save_markdown(result, output_path):
    s = result['summary']
    content = f'# Terraform Variable Usage Report\n\nGenerated: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}\n\n## Summary\n\n| Metric | Value |\n|--------|-------|\n| Total variables | {s["total_variables"]} |\n| Used variables | {s["used_variables"]} |\n| Unused variables | {s["unused_variables"]} |\n| With default value | {s["variables_with_default"]} |\n| Without default | {s["variables_without_default"]} |\n| Undefined but used | {s["undefined_but_referenced"]} |\n| Total issues | {s["total_issues"]} |\n| Parse errors | {s["total_errors"]} |\n\n'
    if result['errors']:
        content += '## Parse errors (dirty data kept)\n\n| File | Line | Col | Type | Message | Content |\n|------|------|-----|------|---------|---------|\n'
        for err in result['errors']:
            content += f"| {err['file']} | {err['line']} | {err['col']} | {err['type']} | {err['msg']} | {err['raw']} |\n"
        content += '\n'
    if result['issues']:
        content += '## Variable issues\n\n| Variable | Issue | Location |\n|----------|-------|----------|\n'
        for var_name, issue, location in result['issues']:
            loc = f"{location.get('file', '?')}:{location.get('line', '?')}" if location else 'unknown'
            content += f'| {var_name} | {issue} | {loc} |\n'
        content += '\n'
    unused_vars = [(n, result['variables'][n]['definition']) for n, r in result['variables'].items() if r['defined'] and not r['is_used']]
    if unused_vars:
        content += '## Unused variables\n\n| Variable | File | Line |\n|----------|------|------|\n'
        for var_name, defn in sorted(unused_vars, key=lambda x: x[0]):
            content += f'| {var_name} | {defn["file"]} | {defn["line"]} |\n'
        content += '\n'
    no_default_vars = [(n, result['variables'][n]['definition']) for n, r in result['variables'].items() if r['defined'] and not r['has_default'] and r['is_used']]
    if no_default_vars:
        content += '## Used variables without default\n\n| Variable | File | Line |\n|----------|------|------|\n'
        for var_name, defn in sorted(no_default_vars, key=lambda x: x[0]):
            content += f'| {var_name} | {defn["file"]} | {defn["line"]} |\n'
        content += '\n'
    content += '## All variables\n\n| Variable | Defined | Used | Has default | Issues |\n|----------|---------|------|-------------|--------|\n'
    for var_name, report in sorted(result['variables'].items()):
        check_def = 'YES' if report['defined'] else 'NO'
        check_use = 'YES' if report['is_used'] else 'NO'
        check_default = 'YES' if report['has_default'] else 'NO'
        content += f'| {var_name} | {check_def} | {check_use} | {check_default} | {len(report["issues"])} |\n'
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Report saved to: {output_path}')

def main():
    parser = argparse.ArgumentParser(description='Terraform Variable Usage Analyzer - Detect unused variables, missing defaults', formatter_class=argparse.RawDescriptionHelpFormatter, epilog='''
Examples:
  python tfvars_report.py ./terraform           # Analyze directory
  python tfvars_report.py main.tf variables.tf  # Analyze specific files
  python tfvars_report.py . --json result.json  # Output JSON
  python tfvars_report.py . --report report.md  # Generate Markdown report
  python tfvars_report.py . --all               # Output all formats
        ''')
    parser.add_argument('paths', nargs='+', help='Terraform files or directories to analyze')
    parser.add_argument('--json', help='Output JSON results to specified file')
    parser.add_argument('--report', help='Output Markdown report to specified file')
    parser.add_argument('--all', action='store_true', help='Output all formats (terminal, JSON, report)')
    parser.add_argument('--output-dir', default='.', help='Output directory')
    args = parser.parse_args()
    all_vars = {}
    all_refs = []
    all_errors = []
    for path in args.paths:
        vars_refs, refs_refs, errs_refs = analyze_path(path)
        all_vars.update(vars_refs)
        all_refs.extend(refs_refs)
        all_errors.extend(errs_refs)
    result = generate_report(all_vars, all_refs, all_errors)
    if args.all or not (args.json or args.report):
        print_terminal_report(result)
    json_path = args.json or (os.path.join(args.output_dir, 'tfvars-result.json') if args.all else None)
    if json_path:
        save_json(result, json_path)
    report_path = args.report or (os.path.join(args.output_dir, 'tfvars-report.md') if args.all else None)
    if report_path:
        save_markdown(result, report_path)
    has_issues = result['summary']['total_issues'] > 0 or result['summary']['total_errors'] > 0
    sys.exit(1 if has_issues else 0)

if __name__ == '__main__':
    main()
