import os

def build_cli():
    code = r'''#!/usr/bin/env python3
import chardet
import csv
import io
import json
import os
import sys
from dataclasses import dataclass, asdict
from typing import List, Dict, Optional, Tuple
from datetime import datetime
import click


@dataclass
class EncodingCandidate:
    encoding: str
    confidence: float
    has_bom: bool = False


@dataclass
class BadRow:
    row_number: int
    reason: str
    raw_content: str
    fields: List[str]


@dataclass
class ProbeResult:
    file_path: str
    file_size: int
    encoding_candidates: List[EncodingCandidate]
    best_encoding: str
    has_bom: bool
    header_fields: List[str]
    expected_headers: List[str]
    header_match: bool
    missing_headers: List[str]
    extra_headers: List[str]
    total_rows: int
    good_rows: int
    bad_rows: List[BadRow]
    decode_errors: int
    sample_rows: List[List[str]]


BOM_SIGNATURES = [
    (b'\xef\xbb\xbf', 'utf-8-sig'),
    (b'\xff\xfe', 'utf-16-le'),
    (b'\xfe\xff', 'utf-16-be'),
]


def detect_bom(data: bytes) -> Tuple[Optional[str], int]:
    for bom_sig, encoding in BOM_SIGNATURES:
        if data.startswith(bom_sig):
            return encoding, len(bom_sig)
    return None, 0


def detect_encoding(file_path: str, sample_size: int = 100000) -> List[EncodingCandidate]:
    with open(file_path, 'rb') as f:
        raw_data = f.read(sample_size)
    
    bom_encoding, bom_length = detect_bom(raw_data)
    has_bom = bom_encoding is not None
    
    chardet_result = chardet.detect(raw_data)
    primary_encoding = chardet_result['encoding']
    primary_confidence = chardet_result['confidence']
    
    candidates = []
    
    if bom_encoding:
        candidates.append(EncodingCandidate(
            encoding=bom_encoding,
            confidence=1.0 if primary_encoding and primary_encoding.lower().startswith('utf') else 0.95,
            has_bom=True
        ))
    
    encoding_map = {
        'gb2312': ['gb18030', 'gbk', 'cp936'],
        'gbk': ['gb18030', 'gbk', 'cp936'],
    }
    
    if primary_encoding:
        primary_lower = primary_encoding.lower()
        alt_encodings = encoding_map.get(primary_lower, [])
        
        candidates.append(EncodingCandidate(
            encoding=primary_encoding,
            confidence=primary_confidence,
            has_bom=has_bom
        ))
        
        for alt_enc in alt_encodings:
            if alt_enc.lower() != primary_lower:
                candidates.append(EncodingCandidate(
                    encoding=alt_enc,
                    confidence=primary_confidence * 0.7,
                    has_bom=False
                ))
    
    fallback_encodings = ['utf-8', 'gb18030', 'gbk', 'latin-1']
    for enc in fallback_encodings:
        if not any(c.encoding.lower() == enc.lower() for c in candidates):
            candidates.append(EncodingCandidate(
                encoding=enc,
                confidence=0.3,
                has_bom=False
            ))
    
    seen = set()
    unique_candidates = []
    for c in candidates:
        key = c.encoding.lower()
        if key not in seen:
            seen.add(key)
            unique_candidates.append(c)
    
    return sorted(unique_candidates, key=lambda x: -x.confidence)


def try_decode(data: bytes, encoding: str) -> Tuple[str, int, List[int]]:
    bom_encoding, bom_len = detect_bom(data)
    if encoding == 'utf-8-sig' or encoding.lower().endswith('-sig'):
        data = data[bom_len:]
        encoding = 'utf-8'
    
    error_positions = []
    
    try:
        decoded = data.decode(encoding)
        return decoded, 0, error_positions
    except UnicodeDecodeError:
        pass
    
    result = []
    pos = 0
    error_count = 0
    while pos < len(data):
        try:
            chunk = data[pos:pos+1].decode(encoding)
            result.append(chunk)
            pos += 1
        except UnicodeDecodeError:
            result.append('\ufffd')
            error_positions.append(pos)
            error_count += 1
            pos += 1
    
    return ''.join(result), error_count, error_positions


def parse_csv_with_errors(content: str, expected_headers: List[str] = None):
    bad_rows = []
    good_rows = []
    header_fields = []
    header_match = False
    missing_headers = []
    extra_headers = []
    
    lines = content.splitlines()
    if not lines:
        return [], [], [], False, [], []
    
    try:
        reader = csv.reader(lines)
        header_fields = next(reader)
        
        if expected_headers:
            expected_set = set(h.strip() for h in expected_headers)
            actual_set = set(h.strip() for h in header_fields)
            missing_headers = list(expected_set - actual_set)
            extra_headers = list(actual_set - expected_set)
            header_match = len(missing_headers) == 0
        
        for row_num, row in enumerate(reader, start=2):
            try:
                good_rows.append(row)
            except Exception as e:
                bad_rows.append(BadRow(
                    row_number=row_num,
                    reason=str(e),
                    raw_content=lines[row_num-1] if row_num-1 < len(lines) else '',
                    fields=[]
                ))
    except Exception as e:
        bad_rows.append(BadRow(
            row_number=1,
            reason=f'CSV parse error: {str(e)}',
            raw_content=lines[0] if lines else '',
            fields=[]
        ))
    
    return header_fields, good_rows, bad_rows, header_match, missing_headers, extra_headers


def probe_csv(file_path: str, expected_headers: List[str] = None, sample_rows_count: int = 5) -> ProbeResult:
    file_size = os.path.getsize(file_path)
    
    with open(file_path, 'rb') as f:
        raw_data = f.read()
    
    encoding_candidates = detect_encoding(file_path)
    best_candidate = encoding_candidates[0]
    best_encoding = best_candidate.encoding
    has_bom = best_candidate.has_bom
    
    decoded_content, decode_errors, _ = try_decode(raw_data, best_encoding)
    
    header_fields, good_rows, bad_rows, header_match, missing_headers, extra_headers = parse_csv_with_errors(decoded_content, expected_headers)
    
    sample_rows = good_rows[:sample_rows_count] if good_rows else []
    
    return ProbeResult(
        file_path=file_path,
        file_size=file_size,
        encoding_candidates=encoding_candidates,
        best_encoding=best_encoding,
        has_bom=has_bom,
        header_fields=header_fields,
        expected_headers=expected_headers or [],
        header_match=header_match,
        missing_headers=missing_headers,
        extra_headers=extra_headers,
        total_rows=len(good_rows) + len(bad_rows) + (1 if header_fields else 0),
        good_rows=len(good_rows),
        bad_rows=bad_rows,
        decode_errors=decode_errors,
        sample_rows=sample_rows
    )


def print_terminal_summary(result: ProbeResult):
    print('=' * 60)
    print('CSV 编码探测报告')
    print('=' * 60)
    print(f'文件: {result.file_path}')
    print(f'大小: {result.file_size} bytes')
    print()
    
    print('--- 编码信息 ---')
    print(f'最佳编码: {result.best_encoding}')
    print(f'包含 BOM: {'是' if result.has_bom else '否'}')
    print(f'解码错误数: {result.decode_errors}')
    print()
    
    print('编码候选列表:')
    for i, enc in enumerate(result.encoding_candidates[:5], 1):
        bom_mark = '*' if enc.has_bom else ' '
        print(f'  {i}. {enc.encoding:<15} (置信度: {enc.confidence:.2%}) {bom_mark}')
    print()
    
    print('--- 表头校验 ---')
    if result.expected_headers:
        status = '✓ 匹配' if result.header_match else '✗ 不匹配'
        print(f'校验状态: {status}')
        if result.missing_headers:
            print(f'缺失字段: {', '.join(result.missing_headers)}')
        if result.extra_headers:
            print(f'额外字段: {', '.join(result.extra_headers)}')
    print(f'实际表头: {', '.join(result.header_fields[:10])}')
    if len(result.header_fields) > 10:
        print(f'  (...还有 {len(result.header_fields) - 10} 个字段)')
    print()
    
    print('--- 行统计 ---')
    print(f'总行数: {result.total_rows}')
    print(f'正常行: {result.good_rows}')
    print(f'异常行: {len(result.bad_rows)}')
    print()
    
    if result.bad_rows:
        print('--- 异常行详情 ---')
        for bad in result.bad_rows[:10]:
            print(f'  行 {bad.row_number}: {bad.reason}')
            preview = bad.raw_content[:50] + '...' if len(bad.raw_content) > 50 else bad.raw_content
            print(f'    内容: {preview}')
        if len(result.bad_rows) > 10:
            print(f'  (...还有 {len(result.bad_rows) - 10} 个异常行)')
        print()
    
    if result.sample_rows:
        print('--- 数据预览 (前5行) ---')
        for i, row in enumerate(result.sample_rows, 1):
            display = [f[:20] for f in row[:5]]
            print(f'  行 {i}: {' | '.join(display)}')
            if len(row) > 5:
                print(f'    (...还有 {len(row) - 5} 个字段)')
    print()


def result_to_dict(result: ProbeResult) -> Dict:
    return {
        'file_path': result.file_path,
        'file_size': result.file_size,
        'best_encoding': result.best_encoding,
        'has_bom': result.has_bom,
        'encoding_candidates': [
            {'encoding': e.encoding, 'confidence': e.confidence, 'has_bom': e.has_bom}
            for e in result.encoding_candidates
        ],
        'header_fields': result.header_fields,
        'expected_headers': result.expected_headers,
        'header_match': result.header_match,
        'missing_headers': result.missing_headers,
        'extra_headers': result.extra_headers,
        'total_rows': result.total_rows,
        'good_rows': result.good_rows,
        'bad_rows_count': len(result.bad_rows),
        'bad_rows': [
            {'row_number': b.row_number, 'reason': b.reason, 'raw_content': b.raw_content}
            for b in result.bad_rows
        ],
        'decode_errors': result.decode_errors,
        'sample_rows': result.sample_rows
    }


def generate_human_report(result: ProbeResult, output_path: str):
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('=' * 70 + '\n')
        f.write('CSV 文件编码与格式检测报告\n')
        f.write(f'生成时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}\n')
        f.write('=' * 70 + '\n\n')
        
        f.write('一、文件基本信息\n')
        f.write('-' * 40 + '\n')
        f.write(f'文件路径: {result.file_path}\n')
        f.write(f'文件大小: {result.file_size} bytes ({result.file_size / 1024:.2f} KB)\n\n')
        
        f.write('二、编码检测结果\n')
        f.write('-' * 40 + '\n')
        f.write(f'推荐编码: {result.best_encoding}\n')
        f.write(f'是否包含 BOM: {'是' if result.has_bom else '否'}\n')
        f.write(f'解码过程发现的字符错误数: {result.decode_errors}\n\n')
        
        f.write('编码候选列表 (按置信度排序):\n')
        for i, enc in enumerate(result.encoding_candidates, 1):
            bom_mark = ' (含BOM)' if enc.has_bom else ''
            f.write(f'  {i}. {enc.encoding} - 置信度: {enc.confidence:.2%}{bom_mark}\n')
        f.write('\n')
        
        f.write('三、表头校验\n')
        f.write('-' * 40 + '\n')
        if result.expected_headers:
            f.write(f'校验结果: {'通过' if result.header_match else '未通过'}\n')
            if result.missing_headers:
                f.write(f'缺失字段: {', '.join(result.missing_headers)}\n')
            if result.extra_headers:
                f.write(f'额外字段: {', '.join(result.extra_headers)}\n')
        f.write(f'实际表头字段 ({len(result.header_fields)}个):\n')
        for i, h in enumerate(result.header_fields, 1):
            f.write(f'  {i}. {h}\n')
        f.write('\n')
        
        f.write('四、数据行统计\n')
        f.write('-' * 40 + '\n')
        f.write(f'总行数 (含表头): {result.total_rows}\n')
        f.write(f'正常数据行: {result.good_rows}\n')
        f.write(f'异常数据行: {len(result.bad_rows)}\n\n')
        
        if result.bad_rows:
            f.write('五、异常行详情\n')
            f.write('-' * 40 + '\n')
            for bad in result.bad_rows:
                f.write(f'\n【行 {bad.row_number}】\n')
                f.write(f'  错误原因: {bad.reason}\n')
                f.write(f'  原始内容: {bad.raw_content}\n')
            f.write('\n')
        
        if result.sample_rows:
            f.write('六、数据预览 (前5行)\n')
            f.write('-' * 40 + '\n')
            for i, row in enumerate(result.sample_rows, 1):
                f.write(f'\n第 {i} 行:\n')
                for j, val in enumerate(row, 1):
                    f.write(f'  字段 {j}: {val}\n')
        
        f.write('\n' + '=' * 70 + '\n')
        f.write('报告结束\n')
        f.write('=' * 70 + '\n')


@click.group()
def cli():
    pass


@cli.command()
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--headers', '-h', help='预期的表头字段，用逗号分隔')
@click.option('--json-output', '-j', help='JSON 结果输出路径')
@click.option('--report', '-r', help='可读报告输出路径')
@click.option('--convert', '-c', help='转换为 UTF-8 编码的文件路径')
def probe(file_path, headers, json_output, report, convert):
    expected_headers = [h.strip() for h in headers.split(',')] if headers else None
    result = probe_csv(file_path, expected_headers)
    print_terminal_summary(result)
    
    if json_output:
        with open(json_output, 'w', encoding='utf-8') as f:
            json.dump(result_to_dict(result), f, ensure_ascii=False, indent=2)
        click.echo(f'JSON 结果已保存到: {json_output}')
    
    if report:
        generate_human_report(result, report)
        click.echo(f'可读报告已保存到: {report}')
    
    if convert:
        with open(file_path, 'rb') as f:
            raw_data = f.read()
        decoded, _, _ = try_decode(raw_data, result.best_encoding)
        with open(convert, 'w', encoding='utf-8', newline='') as f:
            f.write(decoded)
        click.echo(f'转换后的 UTF-8 文件已保存到: {convert}')


@cli.command()
@click.argument('output_dir', type=click.Path(), default='test_samples')
def selftest(output_dir):
    os.makedirs(output_dir, exist_ok=True)
    click.echo(f'生成测试样本到: {output_dir}')
    
    samples = [
        ('utf8_normal.csv', 'utf-8', '名称,年龄,城市\n张三,25,北京\n李四,30,上海\n王五,28,广州'),
        ('utf8_bom.csv', 'utf-8-sig', '名称,年龄,城市\n张三,25,北京\n李四,30,上海'),
        ('gbk_normal.csv', 'gbk', '名称,年龄,城市\n张三,25,北京\n李四,30,上海'),
        ('mixed_bad_rows.csv', 'utf-8', '名称,年龄,城市\n张三,25\n李四,30,上海,额外字段\n王五,28,广州'),
    ]
    
    for filename, encoding, content in samples:
        path = os.path.join(output_dir, filename)
        if encoding == 'utf-8-sig':
            with open(path, 'wb') as f:
                f.write(b'\xef\xbb\xbf' + content.encode('utf-8'))
        else:
            with open(path, 'w', encoding=encoding) as f:
                f.write(content)
        click.echo(f'  生成: {filename}')
    
    click.echo('\n开始自检...')
    all_passed = True
    
    for filename, expected_encoding, _ in samples:
        path = os.path.join(output_dir, filename)
        result = probe_csv(path, ['名称', '年龄', '城市'])
        click.echo(f'  {filename}: 检测到编码 {result.best_encoding}')
        
        if filename == 'mixed_bad_rows.csv':
            if len(result.bad_rows) >= 1:
                click.echo(f'    ✓ 正确发现 {len(result.bad_rows)} 个异常行')
            else:
                click.echo(f'    ✗ 未发现异常行')
                all_passed = False
    
    click.echo('\n' + ('=' * 40))
    if all_passed:
        click.echo('自检通过！')
    else:
        click.echo('自检失败')
        sys.exit(1)


if __name__ == '__main__':
    cli()
'''
    
    with open('csv_probe/cli.py', 'w', encoding='utf-8') as f:
        f.write(code)
    print('cli.py created successfully!')

if __name__ == '__main__':
    build_cli()
