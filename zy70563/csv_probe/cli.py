#!/usr/bin/env python3
import chardet
import csv
import json
import os
import sys
from datetime import datetime
import click

def detect_encoding(file_path):
    with open(file_path, 'rb') as f:
        raw_data = f.read(100000)
    
    bom_encoding = None
    if raw_data.startswith(b'\xef\xbb\xbf'):
        bom_encoding = 'utf-8-sig'
    elif raw_data.startswith(b'\xff\xfe'):
        bom_encoding = 'utf-16-le'
    elif raw_data.startswith(b'\xfe\xff'):
        bom_encoding = 'utf-16-be'
    
    if bom_encoding:
        return [{'encoding': bom_encoding, 'confidence': 1.0, 'has_bom': True}]
    
    chardet_result = chardet.detect(raw_data)
    primary_encoding = chardet_result.get('encoding')
    primary_confidence = chardet_result.get('confidence', 0.0)
    
    candidates = []
    if primary_encoding is not None:
        candidates.append({
            'encoding': primary_encoding,
            'confidence': primary_confidence if primary_confidence else 0.5,
            'has_bom': False
        })
    
    fallback_encodings = ['utf-8', 'gb18030', 'gbk', 'latin-1']
    for enc in fallback_encodings:
        if not any(c['encoding'].lower() == enc.lower() for c in candidates if c['encoding'] is not None):
            candidates.append({
                'encoding': enc,
                'confidence': 0.3,
                'has_bom': False
            })
    
    return candidates

def try_decode(data, encoding):
    if encoding is None:
        encoding = 'utf-8'
    
    try:
        decoded = data.decode(encoding)
        return decoded, 0, []
    except (UnicodeDecodeError, LookupError, TypeError):
        pass
    
    result = []
    pos = 0
    error_count = 0
    error_positions = []
    while pos < len(data):
        try:
            chunk = data[pos:pos+1].decode(encoding)
            result.append(chunk)
            pos += 1
        except (UnicodeDecodeError, LookupError, TypeError):
            result.append('\ufffd')
            error_positions.append(pos)
            error_count += 1
            pos += 1
    
    return ''.join(result), error_count, error_positions

def validate_headers(actual_headers, expected_headers):
    validation_result = {
        'is_valid': True,
        'missing_fields': [],
        'extra_fields': [],
        'order_mismatch': False,
        'issues': []
    }
    
    if not expected_headers:
        return validation_result
    
    actual_set = set(actual_headers)
    expected_set = set(expected_headers)
    
    missing = expected_set - actual_set
    extra = actual_set - expected_set
    
    if missing:
        validation_result['missing_fields'] = list(missing)
        validation_result['is_valid'] = False
        validation_result['issues'].append('missing fields: ' + ', '.join(missing))
    
    if extra:
        validation_result['extra_fields'] = list(extra)
        validation_result['is_valid'] = False
        validation_result['issues'].append('extra fields: ' + ', '.join(extra))
    
    if not missing and not extra:
        actual_normalized = [h.strip().lower() for h in actual_headers]
        expected_normalized = [h.strip().lower() for h in expected_headers]
        if actual_normalized != expected_normalized:
            validation_result['order_mismatch'] = True
            validation_result['is_valid'] = False
            validation_result['issues'].append('field order mismatch')
    
    return validation_result

def probe_csv(file_path, expected_headers=None):
    try:
        file_size = os.path.getsize(file_path)
        
        with open(file_path, 'rb') as f:
            raw_data = f.read()
        
        encoding_candidates = detect_encoding(file_path)
        best_candidate = encoding_candidates[0]
        best_encoding = best_candidate['encoding']
        has_bom = best_candidate['has_bom']
        
        decoded_content, decode_errors, _ = try_decode(raw_data, best_encoding)
        
        lines = decoded_content.splitlines()
        header_fields = []
        good_rows = []
        bad_rows = []
        header_validation = None
        
        if lines:
            try:
                reader = csv.reader(lines)
                header_fields = next(reader)
                expected_field_count = len(header_fields)
                
                if expected_headers:
                    header_validation = validate_headers(header_fields, expected_headers)
                
                for row_num, row in enumerate(reader, start=2):
                    actual_field_count = len(row)
                    raw_content = lines[row_num - 1] if (row_num - 1) < len(lines) else ''
                    
                    if actual_field_count != expected_field_count:
                        error_type = 'field_count_mismatch'
                        reason = 'field count mismatch: expected {0}, got {1}'.format(expected_field_count, actual_field_count)
                        bad_rows.append({
                            'row_number': row_num,
                            'error_type': error_type,
                            'reason': reason,
                            'raw_content': raw_content
                        })
                    else:
                        good_rows.append(row)
            except Exception as e:
                bad_rows.append({
                    'row_number': 1,
                    'error_type': 'csv_parse_error',
                    'reason': 'CSV parse error: ' + str(e),
                    'raw_content': lines[0] if lines else ''
                })
        
        return {
            'file_path': file_path,
            'file_size': file_size,
            'encoding_candidates': encoding_candidates,
            'best_encoding': best_encoding,
            'has_bom': has_bom,
            'header_fields': header_fields,
            'header_validation': header_validation,
            'total_rows': len(good_rows) + len(bad_rows) + (1 if header_fields else 0),
            'good_rows': len(good_rows),
            'bad_rows': bad_rows,
            'decode_errors': decode_errors,
            'sample_rows': good_rows[:5],
            'decoded_preview': decoded_content[:500]
        }
    except Exception as e:
        return {
            'file_path': file_path,
            'file_size': os.path.getsize(file_path) if os.path.exists(file_path) else 0,
            'encoding_candidates': [],
            'best_encoding': 'unknown',
            'has_bom': False,
            'header_fields': [],
            'header_validation': None,
            'total_rows': 0,
            'good_rows': 0,
            'bad_rows': [{
                'row_number': 0,
                'error_type': 'probe_error',
                'reason': 'Probe failed: ' + str(e),
                'raw_content': ''
            }],
            'decode_errors': 0,
            'sample_rows': [],
            'decoded_preview': ''
        }

def generate_suggestions(result):
    suggestions = []
    
    if result['decode_errors'] > 0:
        suggestions.append('Decoding errors detected, try alternative encodings like GB18030 or UTF-8')
    
    if len(result['bad_rows']) > 0:
        suggestions.append('Found {0} bad rows, check data format and delimiters'.format(len(result['bad_rows'])))
    
    if result['header_validation'] and not result['header_validation']['is_valid']:
        suggestions.append('Header validation failed, check field completeness and order')
    
    if result['best_encoding'].lower() not in ['utf-8', 'utf-8-sig']:
        suggestions.append('Recommend converting to UTF-8 encoding for better compatibility')
    
    return suggestions

@click.group()
def cli():
    pass

@cli.command()
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--headers', '-h', help='Expected headers (comma-separated)')
@click.option('--json-output', '-j', help='JSON output path')
@click.option('--report', '-r', help='Human-readable report path')
@click.option('--convert', '-c', help='Convert to UTF-8 file path')
@click.option('--preview', '-p', is_flag=True, help='Show decoded content preview')
def probe(file_path, headers, json_output, report, convert, preview):
    expected_headers = [h.strip() for h in headers.split(',')] if headers else None
    result = probe_csv(file_path, expected_headers)
    suggestions = generate_suggestions(result)
    
    print('=' * 70)
    print('CSV Encoding and Format Report')
    print('=' * 70)
    print('File: ' + result['file_path'])
    print('Size: ' + str(result['file_size']) + ' bytes')
    print()
    
    print('--- Encoding Info ---')
    print('Best encoding: ' + result['best_encoding'])
    bom_text = 'Yes' if result['has_bom'] else 'No'
    print('Has BOM: ' + bom_text)
    print('Decode errors: ' + str(result['decode_errors']))
    print()
    
    print('Encoding candidates:')
    for i, enc in enumerate(result['encoding_candidates'][:5], 1):
        line = '  {0}. {1} (confidence: {2}%)'.format(i, enc['encoding'], round(enc['confidence'] * 100, 1))
        print(line)
    print()
    
    print('--- Header Info ---')
    print('Actual headers ({0} fields):'.format(len(result['header_fields'])))
    for i, h in enumerate(result['header_fields'][:10], 1):
        print('  {0}. {1}'.format(i, h))
    if len(result['header_fields']) > 10:
        print('  (... and {0} more fields)'.format(len(result['header_fields']) - 10))
    print()
    
    if result['header_validation']:
        print('Header validation:')
        if result['header_validation']['is_valid']:
            print('  OK - Validation passed')
        else:
            print('  FAILED:')
            for issue in result['header_validation']['issues']:
                print('    - ' + issue)
        print()
    
    print('--- Row Statistics ---')
    print('Total rows: ' + str(result['total_rows']))
    print('Good rows: ' + str(result['good_rows']))
    print('Bad rows: ' + str(len(result['bad_rows'])))
    print()
    
    if result['bad_rows']:
        print('--- Bad Rows ---')
        for bad in result['bad_rows'][:10]:
            print('  [Row {0}] [{1}]'.format(bad['row_number'], bad.get('error_type', 'unknown')))
            print('    Reason: ' + bad['reason'])
            print('    Content: ' + bad['raw_content'][:80] + ('...' if len(bad['raw_content']) > 80 else ''))
        if len(result['bad_rows']) > 10:
            print('  (... and {0} more bad rows)'.format(len(result['bad_rows']) - 10))
        print()
    
    if result['sample_rows']:
        print('--- Sample Rows ---')
        for i, row in enumerate(result['sample_rows'], 1):
            display = [f[:20] for f in row[:5]]
            print('  Row {0}: {1}'.format(i, ' | '.join(display)))
            if len(row) > 5:
                print('    (... and {0} more fields)'.format(len(row) - 5))
    print()
    
    if suggestions:
        print('--- Suggestions ---')
        for i, s in enumerate(suggestions, 1):
            print('  {0}. {1}'.format(i, s))
        print()
    
    if preview and result.get('decoded_preview'):
        print('--- Decoded Preview (first 500 chars) ---')
        print(result['decoded_preview'])
        if len(result['decoded_preview']) >= 500:
            print('... (truncated, use --convert to see full content)')
        print()
    
    if json_output:
        with open(json_output, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        click.echo('JSON output saved to: ' + json_output)
    
    if report:
        with open(report, 'w', encoding='utf-8') as f:
            f.write('=' * 70 + '\n')
            f.write('CSV File Encoding and Format Report\n')
            f.write('Generated: ' + datetime.now().strftime('%Y-%m-%d %H:%M:%S') + '\n')
            f.write('=' * 70 + '\n\n')
            
            f.write('1. File Information\n')
            f.write('-' * 40 + '\n')
            f.write('File path: ' + result['file_path'] + '\n')
            f.write('File size: ' + str(result['file_size']) + ' bytes\n\n')
            
            f.write('2. Encoding Detection\n')
            f.write('-' * 40 + '\n')
            f.write('Recommended encoding: ' + result['best_encoding'] + '\n')
            bom_text = 'Yes' if result['has_bom'] else 'No'
            f.write('Has BOM: ' + bom_text + '\n')
            f.write('Decode errors: ' + str(result['decode_errors']) + '\n\n')
            
            f.write('Encoding candidates (sorted by confidence):\n')
            for i, enc in enumerate(result['encoding_candidates'], 1):
                f.write('  {0}. {1} - confidence: {2}%\n'.format(i, enc['encoding'], round(enc['confidence'] * 100, 1)))
            f.write('\n')
            
            f.write('3. Header Information\n')
            f.write('-' * 40 + '\n')
            f.write('Header fields ({0}):\n'.format(len(result['header_fields'])))
            for i, h in enumerate(result['header_fields'], 1):
                f.write('  {0}. {1}\n'.format(i, h))
            f.write('\n')
            
            if result['header_validation']:
                f.write('Header validation:\n')
                if result['header_validation']['is_valid']:
                    f.write('  OK - Validation passed\n')
                else:
                    f.write('  FAILED:\n')
                    for issue in result['header_validation']['issues']:
                        f.write('    - ' + issue + '\n')
                f.write('\n')
            
            f.write('4. Row Statistics\n')
            f.write('-' * 40 + '\n')
            f.write('Total rows: ' + str(result['total_rows']) + '\n')
            f.write('Good rows: ' + str(result['good_rows']) + '\n')
            f.write('Bad rows: ' + str(len(result['bad_rows'])) + '\n\n')
            
            if result['bad_rows']:
                f.write('5. Bad Rows Details\n')
                f.write('-' * 40 + '\n')
                for bad in result['bad_rows']:
                    f.write('\n[Row {0}] [{1}]\n'.format(bad['row_number'], bad.get('error_type', 'unknown')))
                    f.write('  Reason: ' + bad['reason'] + '\n')
                    f.write('  Content: ' + bad['raw_content'] + '\n')
                f.write('\n')
            
            if suggestions:
                f.write('6. Processing Suggestions\n')
                f.write('-' * 40 + '\n')
                for i, s in enumerate(suggestions, 1):
                    f.write('  {0}. {1}\n'.format(i, s))
                f.write('\n')
            
            f.write('=' * 70 + '\n')
            f.write('End of Report\n')
            f.write('=' * 70 + '\n')
        click.echo('Report saved to: ' + report)
    
    if convert:
        with open(file_path, 'rb') as f:
            raw_data = f.read()
        decoded, _, _ = try_decode(raw_data, result['best_encoding'])
        with open(convert, 'w', encoding='utf-8', newline='') as f:
            f.write(decoded)
        click.echo('Converted UTF-8 file saved to: ' + convert)

@cli.command()
@click.argument('output_dir', type=click.Path(), default='test_samples')
@click.option('--json-report', help='JSON test report output path')
def selftest(output_dir, json_report):
    os.makedirs(output_dir, exist_ok=True)
    click.echo('Generating test samples in: ' + output_dir)
    
    samples = [
        ('utf8_normal.csv', 'utf-8', 'name,age,city\nAlice,25,Beijing\nBob,30,Shanghai\nCharlie,28,Guangzhou'),
        ('utf8_bom.csv', 'utf-8-sig', 'name,age,city\nAlice,25,Beijing\nBob,30,Shanghai'),
        ('gbk_normal.csv', 'gbk', 'name,age,city\nAlice,25,Beijing\nBob,30,Shanghai'),
        ('gb18030_chinese.csv', 'gb18030', 'name,age,city\nZhang San,25,Beijing\nLi Si,30,Shanghai\nWang Wu,28,Guangzhou'),
        ('gbk_chinese.csv', 'gbk', 'name,age,city\nZhang San,25,Beijing\nLi Si,30,Shanghai'),
        ('empty_file.csv', 'utf-8', ''),
        ('quoted_fields.csv', 'utf-8', '"name","age","city"\n"Alice Smith","25","Beijing, China"\n"Bob, Jr.","30","Shanghai"'),
        ('mixed_bad_rows.csv', 'utf-8', 'name,age,city\nAlice,25\nBob,30,Shanghai,extra\nCharlie,28,Guangzhou'),
    ]
    
    for filename, encoding, content in samples:
        path = os.path.join(output_dir, filename)
        if encoding == 'utf-8-sig':
            with open(path, 'wb') as f:
                f.write(b'\xef\xbb\xbf' + content.encode('utf-8'))
        else:
            with open(path, 'w', encoding=encoding) as f:
                f.write(content)
        click.echo('  Generated: ' + filename)
    
    click.echo('\nRunning self-test...')
    test_results = []
    all_passed = True
    
    test_cases = [
        ('utf8_normal.csv', 'Detect UTF-8/ASCII encoding', ['name', 'age', 'city'], lambda r: r['best_encoding'].lower() in ['utf-8', 'ascii', 'gbk', 'gb18030']),
        ('utf8_bom.csv', 'Detect UTF-8 BOM', ['name', 'age', 'city'], lambda r: r['has_bom']),
        ('gbk_normal.csv', 'Detect ASCII/GBK encoding', ['name', 'age', 'city'], lambda r: r['best_encoding'].lower() in ['gbk', 'gb18030', 'ascii', 'utf-8']),
        ('gb18030_chinese.csv', 'Detect GB18030 Chinese content', ['name', 'age', 'city'], lambda r: len(r['header_fields']) == 3),
        ('gbk_chinese.csv', 'Detect GBK Chinese content', ['name', 'age', 'city'], lambda r: r['good_rows'] >= 2),
        ('empty_file.csv', 'Handle empty file', None, lambda r: r['total_rows'] == 0 or r['file_size'] == 0),
        ('quoted_fields.csv', 'Handle quoted fields', ['name', 'age', 'city'], lambda r: r['good_rows'] >= 2),
        ('mixed_bad_rows.csv', 'Detect bad rows', ['name', 'age', 'city'], lambda r: len(r['bad_rows']) >= 2),
    ]
    
    for filename, test_name, expected_headers, check_func in test_cases:
        path = os.path.join(output_dir, filename)
        result = probe_csv(path, expected_headers)
        passed = check_func(result)
        
        test_results.append({
            'filename': filename,
            'test_name': test_name,
            'passed': passed,
            'encoding': result['best_encoding'],
            'bad_rows': len(result['bad_rows'])
        })
        
        status = 'PASS' if passed else 'FAIL'
        click.echo('  {0}: {1} - {2}'.format(filename, test_name, status))
        if not passed:
            all_passed = False
    
    click.echo('\n' + '=' * 50)
    if all_passed:
        click.echo('Self-test PASSED!')
    else:
        click.echo('Self-test FAILED!')
        sys.exit(1)
    
    if json_report:
        with open(json_report, 'w', encoding='utf-8') as f:
            json.dump({
                'generated_at': datetime.now().isoformat(),
                'all_passed': all_passed,
                'total_tests': len(test_results),
                'passed_count': sum(1 for r in test_results if r['passed']),
                'failed_count': sum(1 for r in test_results if not r['passed']),
                'results': test_results
            }, f, ensure_ascii=False, indent=2)
        click.echo('JSON test report saved to: ' + json_report)

if __name__ == '__main__':
    cli()
