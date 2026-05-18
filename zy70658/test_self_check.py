#!/usr/bin/env python3
import pandas as pd
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from size_processor import (
    SizeStandardizer,
    HeaderRecognizer,
    StudentMerger,
    ClassSummarizer,
    ReportExporter,
    process_import_data
)
from database import init_db, get_db, ImportBatch, SizeRecord, ExceptionNote, OrderReport, ClassInfo, Student


def test_size_standardizer():
    print("=" * 60)
    print("测试 1: 尺码标准化功能")
    print("=" * 60)
    
    test_cases = [
        ("160", "160", []),
        ("XL", "XL", []),
        ("加大", "XL", []),
        ("特大号", "XXL", []),
        ("150cm", "150", []),
        ("小号", "S", []),
        ("超大170", "XXL", []),
    ]
    
    all_passed = True
    for input_size, expected, expected_ex in test_cases:
        result, exceptions = SizeStandardizer.standardize(input_size)
        passed = result == expected
        all_passed = all_passed and passed
        status = "✓" if passed else "✗"
        print(f"  {status} '{input_size}' -> '{result}' (预期: '{expected}')")
    
    print(f"\n  结果: {'通过' if all_passed else '失败'}")
    return all_passed


def test_header_recognizer():
    print("\n" + "=" * 60)
    print("测试 2: 表头识别功能（含补订、备注字段）")
    print("=" * 60)
    
    test_data = {
        '学生姓名': ['张三', '李四'],
        '班级': ['高一1班', '高一2班'],
        '校服尺码': ['160', '170'],
        '学号': ['001', '002'],
        '性别': ['男', '女'],
        '是否补订': ['是', '否'],
        '备注': ['新生', '转学生'],
    }
    
    df = pd.DataFrame(test_data)
    header_mapping, warnings = HeaderRecognizer.recognize_headers(df)
    
    all_passed = True
    expected_fields = ['name', 'class_name', 'size', 'student_no', 'gender', 'is_supplement', 'remark']
    for field in expected_fields:
        passed = field in header_mapping
        all_passed = all_passed and passed
        status = "✓" if passed else "✗"
        print(f"  {status} 字段 '{field}' 识别: {header_mapping.get(field, '未识别')}")
    
    print(f"\n  结果: {'通过' if all_passed else '失败'}")
    return all_passed


def test_student_merger():
    print("\n" + "=" * 60)
    print("测试 3: 重复学生合并功能")
    print("=" * 60)
    
    records = [
        {'name': '张三', 'class_name': '高一1班', 'size': '160', 'original_size': '160', 'student_no': '001'},
        {'name': '张三', 'class_name': '高一1班', 'size': '160', 'original_size': '160cm', 'student_no': '001'},
        {'name': '李四', 'class_name': '高一2班', 'size': '170', 'original_size': '170', 'student_no': '002'},
    ]
    
    merged, duplicates = StudentMerger.merge_duplicates(records)
    
    all_passed = True
    
    passed = len(merged) == 2
    all_passed = all_passed and passed
    print(f"  {'✓' if passed else '✗'} 合并后记录数: {len(merged)} (预期: 2)")
    
    zhangsan = next((r for r in merged if r['name'] == '张三'), None)
    if zhangsan:
        passed = zhangsan['quantity'] == 2
        all_passed = all_passed and passed
        print(f"  {'✓' if passed else '✗'} 张三数量: {zhangsan['quantity']} (预期: 2)")
        passed = zhangsan.get('is_duplicate') == True
        all_passed = all_passed and passed
        print(f"  {'✓' if passed else '✗'} 张三标记为重复: {zhangsan.get('is_duplicate')}")
    
    print(f"\n  结果: {'通过' if all_passed else '失败'}")
    return all_passed


def test_supplement_recognition():
    print("\n" + "=" * 60)
    print("测试 4: 增补记录字段识别")
    print("=" * 60)
    
    test_data = {
        '学生姓名': ['张三', '李四', '王五'],
        '班级': ['高一1班', '高一2班', '高一1班'],
        '校服尺码': ['160', '170', '165'],
        '学号': ['001', '002', '003'],
        '是否补订': ['是', '否', 'true'],
    }
    
    df = pd.DataFrame(test_data)
    result = process_import_data(df)
    
    all_passed = result.success
    
    if result.success:
        records = result.data['records']
        
        supplement_count = sum(1 for r in records if r.get('is_supplement'))
        passed = supplement_count == 2
        all_passed = all_passed and passed
        print(f"  {'✓' if passed else '✗'} 补订记录数: {supplement_count} (预期: 2)")
        
        zhangsan = next((r for r in records if r['name'] == '张三'), None)
        if zhangsan:
            passed = zhangsan.get('is_supplement') == True
            all_passed = all_passed and passed
            print(f"  {'✓' if passed else '✗'} 张三标记为补订: {zhangsan.get('is_supplement')}")
        
        lisi = next((r for r in records if r['name'] == '李四'), None)
        if lisi:
            passed = lisi.get('is_supplement') == False
            all_passed = all_passed and passed
            print(f"  {'✓' if passed else '✗'} 李四标记为非补订: {lisi.get('is_supplement')}")
    else:
        print(f"  ✗ 处理失败: {result.error_message}")
        all_passed = False
    
    print(f"\n  结果: {'通过' if all_passed else '失败'}")
    return all_passed


def test_exception_details():
    print("\n" + "=" * 60)
    print("测试 5: 异常信息详情（含行号、学生信息）")
    print("=" * 60)
    
    test_data = {
        '学生姓名': ['张三', '李四', '王五'],
        '班级': ['高一1班', '高一2班', '高一1班'],
        '校服尺码': ['非正常尺码', '170', '165'],
        '学号': ['001', '002', '003'],
    }
    
    df = pd.DataFrame(test_data)
    result = process_import_data(df)
    
    all_passed = result.success
    
    if result.success:
        exceptions = result.data['exceptions']
        
        passed = len(exceptions) == 1
        all_passed = all_passed and passed
        print(f"  {'✓' if passed else '✗'} 异常数量: {len(exceptions)} (预期: 1)")
        
        if exceptions:
            ex = exceptions[0]
            required_fields = ['row', 'name', 'class_name', 'student_no', 'original_size', 'type', 'message']
            for field in required_fields:
                passed = field in ex
                all_passed = all_passed and passed
                status = "✓" if passed else "✗"
                print(f"  {status} 异常包含字段 '{field}': {ex.get(field)}")
    else:
        print(f"  ✗ 处理失败: {result.error_message}")
        all_passed = False
    
    print(f"\n  结果: {'通过' if all_passed else '失败'}")
    return all_passed


def test_export_with_exceptions():
    print("\n" + "=" * 60)
    print("测试 6: 报告导出含异常清单")
    print("=" * 60)
    
    records = [
        {'班级': '高一1班', '姓名': '张三', '学号': '001', '原尺码': '160', '标准尺码': '160', '数量': 1, '是否补订': '否'},
        {'班级': '高一1班', '姓名': '李四', '学号': '002', '原尺码': '加大', '标准尺码': 'XL', '数量': 1, '是否补订': '是'},
    ]
    
    summary = {
        '高一1班': {'160': 1, 'XL': 1},
    }
    
    exceptions = [
        {'行号': 2, '班级': '高一1班', '姓名': '测试学生', '异常类型': 'non_standard_size', '异常描述': '测试异常', '是否已解决': '否'},
    ]
    
    os.makedirs('test_output', exist_ok=True)
    test_file = 'test_output/test_report_with_exceptions.xlsx'
    
    success = ReportExporter.export_to_excel(records, summary, test_file, exceptions)
    
    all_passed = success and os.path.exists(test_file)
    
    print(f"  {'✓' if success else '✗'} 导出函数执行成功")
    print(f"  {'✓' if os.path.exists(test_file) else '✗'} 输出文件存在: {test_file}")
    
    if os.path.exists(test_file):
        xl = pd.ExcelFile(test_file)
        sheets = xl.sheet_names
        passed = '异常清单' in sheets
        all_passed = all_passed and passed
        print(f"  {'✓' if passed else '✗'} 包含'异常清单'工作表: {sheets}")
        
        if '异常清单' in sheets:
            df_ex = pd.read_excel(test_file, sheet_name='异常清单')
            passed = len(df_ex) == 1
            all_passed = all_passed and passed
            print(f"  {'✓' if passed else '✗'} 异常清单记录数: {len(df_ex)} (预期: 1)")
    
    print(f"\n  结果: {'通过' if all_passed else '失败'}")
    return all_passed


def test_database_exception_with_size_record():
    print("\n" + "=" * 60)
    print("测试 7: 数据库异常记录与尺码记录关联")
    print("=" * 60)
    
    from sqlalchemy.orm import Session
    from database import engine
    
    test_data = {
        '学生姓名': ['张三', '李四'],
        '班级': ['高一1班', '高一2班'],
        '校服尺码': ['非正常尺码', '170'],
        '学号': ['001', '002'],
    }
    
    df = pd.DataFrame(test_data)
    result = process_import_data(df)
    
    if not result.success:
        print(f"  ✗ 处理失败: {result.error_message}")
        return False
    
    db = Session(bind=engine)
    try:
        batch = ImportBatch(
            file_name='test.xlsx',
            status='processed',
            total_records=2,
            processed_records=2,
            has_exceptions=True,
            created_by='test'
        )
        db.add(batch)
        db.flush()
        
        size_record_ids = {}
        for i, record in enumerate(result.data['records']):
            class_obj = db.query(ClassInfo).filter(ClassInfo.class_name == record['class_name']).first()
            if not class_obj:
                class_obj = ClassInfo(grade='高一', class_name=record['class_name'])
                db.add(class_obj)
                db.flush()
            
            student = db.query(Student).filter(Student.name == record['name'], Student.class_id == class_obj.id).first()
            if not student:
                student = Student(class_id=class_obj.id, name=record['name'], student_no=record.get('student_no', ''))
                db.add(student)
                db.flush()
            
            size_record = SizeRecord(
                student_id=student.id,
                import_batch_id=batch.id,
                original_size=record['original_size'],
                standardized_size=record['size'],
                is_duplicate=record.get('is_duplicate', False),
                is_supplement=record.get('is_supplement', False),
                quantity=record.get('quantity', 1)
            )
            db.add(size_record)
            db.flush()
            size_record_ids[i] = size_record.id
        
        for i, ex in enumerate(result.data['exceptions']):
            record_idx = ex.get('record_idx', -1)
            size_record_id = size_record_ids.get(record_idx)
            
            exception_note = ExceptionNote(
                size_record_id=size_record_id,
                import_batch_id=batch.id,
                exception_type=ex['type'],
                message=ex['message'],
                student_name=ex.get('name', ''),
                class_name=ex.get('class_name', ''),
                student_no=ex.get('student_no', ''),
                original_size=ex.get('original_size', ''),
                row_number=ex.get('row', 0),
                is_resolved=False
            )
            db.add(exception_note)
        
        db.commit()
        
        exceptions = db.query(ExceptionNote).filter(ExceptionNote.import_batch_id == batch.id).all()
        
        all_passed = True
        passed = len(exceptions) == 1
        all_passed = all_passed and passed
        print(f"  {'✓' if passed else '✗'} 数据库异常记录数: {len(exceptions)} (预期: 1)")
        
        ex = exceptions[0]
        passed = ex.size_record_id is not None
        all_passed = all_passed and passed
        print(f"  {'✓' if passed else '✗'} 异常关联 size_record_id: {ex.size_record_id}")
        
        passed = ex.student_name == '张三'
        all_passed = all_passed and passed
        print(f"  {'✓' if passed else '✗'} 异常记录学生姓名: {ex.student_name} (预期: 张三)")
        
        passed = ex.row_number == 2
        all_passed = all_passed and passed
        print(f"  {'✓' if passed else '✗'} 异常记录行号: {ex.row_number} (预期: 2)")
        
        passed = ex.class_name == '高一1班'
        all_passed = all_passed and passed
        print(f"  {'✓' if passed else '✗'} 异常记录班级: {ex.class_name} (预期: 高一1班)")
        
        db.delete(ex)
        db.query(SizeRecord).filter(SizeRecord.import_batch_id == batch.id).delete()
        db.query(Student).filter(Student.class_id.in_(db.query(ClassInfo.id).filter(ClassInfo.class_name.in_(['高一1班', '高一2班'])))).delete(synchronize_session=False)
        db.query(ClassInfo).filter(ClassInfo.class_name.in_(['高一1班', '高一2班'])).delete(synchronize_session=False)
        db.delete(batch)
        db.commit()
        
    except Exception as e:
        print(f"  ✗ 数据库操作异常: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        all_passed = False
    finally:
        db.close()
    
    print(f"\n  结果: {'通过' if all_passed else '失败'}")
    return all_passed


def main():
    print("\n" + "╔" + "═" * 58 + "╗")
    print("║" + " " * 12 + "校服尺码标准化系统自检 (增强版)" + " " * 15 + "║")
    print("╚" + "═" * 58 + "╝")
    
    init_db()
    
    tests = [
        test_size_standardizer,
        test_header_recognizer,
        test_student_merger,
        test_supplement_recognition,
        test_exception_details,
        test_export_with_exceptions,
        test_database_exception_with_size_record,
    ]
    
    results = []
    for test in tests:
        try:
            results.append(test())
        except Exception as e:
            print(f"  ✗ 测试异常: {e}")
            import traceback
            traceback.print_exc()
            results.append(False)
    
    print("\n" + "=" * 60)
    print("自检总结")
    print("=" * 60)
    
    passed_count = sum(results)
    total_count = len(results)
    
    print(f"\n通过: {passed_count}/{total_count}")
    
    if passed_count == total_count:
        print("\n🎉 所有测试通过！系统正常工作。")
        print("\n新增功能验证:")
        print("  ✓ 补订/增补字段自动识别")
        print("  ✓ 异常信息含行号、学生定位信息")
        print("  ✓ ExceptionNote 关联 size_record_id")
        print("  ✓ 导出 Excel 包含异常清单工作表")
    else:
        print(f"\n⚠️  有 {total_count - passed_count} 个测试未通过，请检查。")
    
    print("\n")
    
    return passed_count == total_count


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
