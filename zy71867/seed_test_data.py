#!/usr/bin/env python3
"""
生成教研工具的测试数据，包含：
1. 正常讲义（完整信息 + 通过检查）
2. 缺难度标签的讲义
3. 重复讲评记录
4. 边界情况（垂直切线、多切线、分段函数等）
5. 需要撤回修正的讲义
"""

import os
import sys
import io
from PIL import Image, ImageDraw, ImageFont
from werkzeug.datastructures import FileStorage

sys.path.insert(0, os.path.dirname(__file__))

from database import init_db
from core_logic import import_lecture, add_commentary, update_difficulty, withdraw_lecture
from tangent_checker import check_tangent_lecture

def create_mock_screenshot(filename, text_content):
    """创建模拟的讲义截图"""
    img = Image.new('RGB', (800, 600), color='white')
    draw = ImageDraw.Draw(img)
    
    try:
        font = ImageFont.truetype('/System/Library/Fonts/PingFang.ttc', 24)
        small_font = ImageFont.truetype('/System/Library/Fonts/PingFang.ttc', 18)
    except:
        font = ImageFont.load_default()
        small_font = ImageFont.load_default()
    
    draw.rectangle([10, 10, 790, 70], outline='blue', width=2)
    draw.text((20, 20), "高中数学 - 导数与切线", fill='blue', font=font)
    
    lines = text_content.split('\n')
    y = 100
    for line in lines:
        draw.text((30, y), line, fill='black', font=small_font)
        y += 40
    
    filepath = os.path.join('/tmp', filename)
    img.save(filepath, 'PNG')
    return filepath

def create_file_storage(filepath, filename):
    """将文件转换为Flask的FileStorage对象"""
    f = open(filepath, 'rb')
    return FileStorage(f, filename=filename, content_type='image/png')

def seed_data():
    print("初始化数据库...")
    if os.path.exists('teaching_research.db'):
        os.remove('teaching_research.db')
    init_db()
    
    test_cases = []
    
    print("\n=== 测试用例1: 正常完整讲义（检查通过） ===")
    img_path = create_mock_screenshot('case1_normal.png', 
        '题目：求函数y = x²在点(1,1)处的切线方程\n'
        '解：\n'
        '1. 验证切点：当x=1时，f(1)=1²=1，点(1,1)在曲线上 ✓\n'
        '2. 求导数：f\'(x) = 2x\n'
        '3. 求斜率：k = f\'(1) = 2\n'
        '4. 点斜式：y - 1 = 2(x - 1)\n'
        '5. 整理得：y = 2x - 1\n')
    img_file = create_file_storage(img_path, 'case1_normal.png')
    
    result = import_lecture(
        title='2.1 导数的几何意义 - 基础练习1',
        screenshot_file=img_file,
        difficulty_tag='基础',
        commentary_content='这是一道基础的切线求解题目，重点在于让学生掌握点斜式的应用。学生常见错误是忘记验证切点是否在曲线上。建议在课堂上强调："切点一定在曲线上，也一定在切线上"。',
        teacher='张老师',
        operator='admin'
    )
    check_result = check_tangent_lecture(result['lecture_id'], operator='admin')
    print(f"  导入成功，ID: {result['lecture_id']}")
    print(f"  检查结果: {check_result['result']}, 置信度: {check_result['confidence']:.0%}")
    test_cases.append(('正常完整讲义', result['lecture_id'], check_result['result']))
    
    print("\n=== 测试用例2: 缺少难度标签 ===")
    img_path2 = create_mock_screenshot('case2_no_diff.png',
        '题目：求函数y = x³ - 2x在x=1处的切线方程\n'
        'f(1) = 1 - 2 = -1\n'
        'f\'(x) = 3x² - 2\n'
        'k = f\'(1) = 3 - 2 = 1\n'
        '切线方程：y + 1 = 1·(x - 1)\n'
        '即 y = x - 2\n')
    img_file2 = create_file_storage(img_path2, 'case2_no_diff.png')
    
    result2 = import_lecture(
        title='2.1 导数的几何意义 - 基础练习2',
        screenshot_file=img_file2,
        difficulty_tag=None,
        commentary_content='这道题比上一题稍难，因为涉及到三次函数。',
        teacher='李老师',
        operator='admin'
    )
    check_result2 = check_tangent_lecture(result2['lecture_id'], operator='admin')
    print(f"  导入成功，ID: {result2['lecture_id']}")
    print(f"  缺少难度: {result2['missing_difficulty']}")
    print(f"  检查结果: {check_result2['result']}")
    test_cases.append(('缺少难度标签', result2['lecture_id'], check_result2['result']))
    
    print("\n=== 测试用例3: 重复讲评内容 ===")
    img_path3 = create_mock_screenshot('case3_dup.png',
        '题目：求y = e^x在x=0处的切线\n'
        'f(0) = e^0 = 1\n'
        'f\'(x) = e^x\n'
        'k = f\'(0) = 1\n'
        'y - 1 = 1·(x - 0)\n'
        'y = x + 1\n')
    img_file3 = create_file_storage(img_path3, 'case3_dup.png')
    
    duplicate_comment = '这是一道非常经典的例题，一定要让学生掌握。'
    
    result3 = import_lecture(
        title='2.2 指数函数的切线',
        screenshot_file=img_file3,
        difficulty_tag='中等',
        commentary_content=duplicate_comment,
        teacher='王老师',
        operator='admin'
    )
    
    add_result = add_commentary(
        lecture_id=result3['lecture_id'],
        content=duplicate_comment,
        teacher='王老师',
        operator='admin'
    )
    print(f"  导入成功，ID: {result3['lecture_id']}")
    print(f"  添加重复讲评，检测到重复: {len(add_result['duplicates']) > 0}")
    if add_result['duplicates']:
        for d in add_result['duplicates']:
            print(f"    - {d['message']}")
    
    check_result3 = check_tangent_lecture(result3['lecture_id'], operator='admin')
    print(f"  检查结果: {check_result3['result']}")
    test_cases.append(('重复讲评记录', result3['lecture_id'], check_result3['result']))
    
    print("\n=== 测试用例4: 边界情况 - 垂直切线（导数不存在） ===")
    img_path4 = create_mock_screenshot('case4_vertical.png',
        '题目：求曲线y = ³√x在点(0,0)处的切线\n'
        'f(x) = x^(1/3)\n'
        'f\'(x) = (1/3)x^(-2/3)\n'
        '当x→0时，f\'(x)→∞\n'
        '切线方程：x = 0\n')
    img_file4 = create_file_storage(img_path4, 'case4_vertical.png')
    
    result4 = import_lecture(
        title='拓展：垂直切线问题',
        screenshot_file=img_file4,
        difficulty_tag='难题',
        commentary_content='这是一个边界情况，当导数趋向无穷大时，切线是垂直的。学生容易误以为导数不存在就没有切线。',
        teacher='赵老师',
        operator='admin'
    )
    check_result4 = check_tangent_lecture(result4['lecture_id'], operator='admin')
    print(f"  导入成功，ID: {result4['lecture_id']}")
    print(f"  检查结果: {check_result4['result']}")
    if check_result4['result'] == 'failed':
        print("  检测到的问题:")
        for e in check_result4['errors']:
            print(f"    - [{e['severity']}] {e['name']}: {e['reason'][:50]}...")
    test_cases.append(('边界情况-垂直切线', result4['lecture_id'], check_result4['result']))
    
    print("\n=== 测试用例5: 边界情况 - 从外部点作切线（多解） ===")
    img_path5 = create_mock_screenshot('case5_multi.png',
        '题目：从点(2,0)作抛物线y = x²的切线，求切线方程\n'
        '设切点为(x0, x0²)\n'
        'f\'(x0) = 2x0\n'
        '切线方程：y - x0² = 2x0(x - x0)\n'
        '代入点(2,0)：\n'
        '0 - x0² = 2x0(2 - x0)\n')
    img_file5 = create_file_storage(img_path5, 'case5_multi.png')
    
    result5 = import_lecture(
        title='难点：过点作切线（双解问题）',
        screenshot_file=img_file5,
        difficulty_tag='较难',
        commentary_content='这是一个典型的易错题，学生往往只求出一个解就认为完成了。实际上从外部点作抛物线的切线应该有两条。',
        teacher='张老师',
        operator='admin'
    )
    check_result5 = check_tangent_lecture(result5['lecture_id'], operator='admin')
    print(f"  导入成功，ID: {result5['lecture_id']}")
    print(f"  检查结果: {check_result5['result']}")
    if check_result5['result'] == 'failed':
        print("  检测到的问题:")
        for e in check_result5['errors']:
            print(f"    - [{e['severity']}] {e['name']}")
    test_cases.append(('边界情况-多切线', result5['lecture_id'], check_result5['result']))
    
    print("\n=== 测试用例6: 不完整的解题过程（切点验证缺失） ===")
    img_path6 = create_mock_screenshot('case6_incomplete.png',
        '题目：求y = x² + 1在x=2处的切线方程\n'
        'f\'(x) = 2x\n'
        'k = f\'(2) = 4\n'
        '切线方程：y = 4x + b\n')
    img_file6 = create_file_storage(img_path6, 'case6_incomplete.png')
    
    result6 = import_lecture(
        title='学生作业分析 - 解题不完整案例',
        screenshot_file=img_file6,
        difficulty_tag='基础',
        commentary_content='这是学生作业中常见的错误，直接套用斜截式而没有使用点斜式，而且没有验证切点。',
        teacher='李老师',
        operator='admin'
    )
    check_result6 = check_tangent_lecture(result6['lecture_id'], operator='admin')
    print(f"  导入成功，ID: {result6['lecture_id']}")
    print(f"  检查结果: {check_result6['result']}")
    if check_result6['result'] == 'failed':
        print("  检测到的问题:")
        for e in check_result6['errors']:
            print(f"    - [{e['severity']}] {e['name']}: {e['reason']}")
    test_cases.append(('解题不完整', result6['lecture_id'], check_result6['result']))
    
    print("\n=== 测试用例7: 需要撤回的讲义（有错误） ===")
    img_path7 = create_mock_screenshot('case7_withdraw.png',
        '题目：求y = ln x在x=1处的切线\n'
        'f(1) = ln 1 = 1  （此处错误！ln 1 = 0）\n'
        'f\'(x) = 1/x\n'
        'k = f\'(1) = 1\n'
        'y - 1 = 1(x - 1)\n')
    img_file7 = create_file_storage(img_path7, 'case7_withdraw.png')
    
    result7 = import_lecture(
        title='错题分析 - 对数函数切线',
        screenshot_file=img_file7,
        difficulty_tag='中等',
        commentary_content='这道题的解题过程有错误，需要修正后再使用。',
        teacher='王老师',
        operator='admin'
    )
    check_result7 = check_tangent_lecture(result7['lecture_id'], operator='admin')
    
    withdraw_lecture(
        lecture_id=result7['lecture_id'],
        reason='解题过程存在错误，ln 1 应该等于 0 而不是 1，需要重新制作',
        operator='admin'
    )
    print(f"  导入并撤回成功，ID: {result7['lecture_id']}")
    print(f"  检查结果: {check_result7['result']}")
    test_cases.append(('已撤回讲义', result7['lecture_id'], 'withdrawn'))
    
    print("\n=== 测试用例8: 重复导入相同截图 ===")
    img_file8 = create_file_storage(img_path, 'case1_normal_copy.png')
    result8 = import_lecture(
        title='2.1 导数的几何意义 - 基础练习1（重复导入）',
        screenshot_file=img_file8,
        difficulty_tag='基础',
        commentary_content='重复导入测试',
        teacher='张老师',
        operator='admin'
    )
    print(f"  导入成功，ID: {result8['lecture_id']}")
    print(f"  检测到重复: {result8['has_duplicate']}")
    if result8['duplicates']:
        for d in result8['duplicates']:
            print(f"    - {d['message']}")
    test_cases.append(('重复导入截图', result8['lecture_id'], 'duplicate'))
    
    print("\n=== 测试用例9: 分段函数边界点（竞赛级难度） ===")
    img_path9 = create_mock_screenshot('case9_piecewise.png',
        '题目：讨论函数 f(x) = { x², x ≥ 0; -x², x < 0 }\n'
        '在x=0处的可导性，并求切线（若存在）\n'
        '\n'
        '分析：\n'
        'f(0) = 0\n'
        '右导数：f+\'(0) = lim(x→0+) (x²-0)/x = 0\n'
        '左导数：f-\'(0) = lim(x→0-) (-x²-0)/x = 0\n')
    img_file9 = create_file_storage(img_path9, 'case9_piecewise.png')
    
    result9 = import_lecture(
        title='竞赛拓展：分段函数的可导性讨论',
        screenshot_file=img_file9,
        difficulty_tag='竞赛级',
        commentary_content='这道题需要分别计算左右导数，只有当左右导数都存在且相等时，函数在该点才可导。',
        teacher='赵老师',
        operator='admin'
    )
    check_result9 = check_tangent_lecture(result9['lecture_id'], operator='admin')
    print(f"  导入成功，ID: {result9['lecture_id']}")
    print(f"  检查结果: {check_result9['result']}")
    if check_result9['result'] == 'failed':
        print("  检测到的问题:")
        for e in check_result9['errors']:
            print(f"    - [{e['severity']}] {e['name']}")
    test_cases.append(('分段函数边界点', result9['lecture_id'], check_result9['result']))
    
    print("\n" + "="*60)
    print("测试数据生成完成！")
    print("="*60)
    print("\n测试用例汇总：")
    print("-" * 60)
    for i, (name, lid, status) in enumerate(test_cases, 1):
        print(f"{i:2d}. {name:<20} | ID: {lid[:16]}... | 状态: {status}")
    print("-" * 60)
    print(f"\n总计: {len(test_cases)} 条测试用例")
    
    print("\n下一步：")
    print("1. pip install -r requirements.txt")
    print("2. python app.py")
    print("3. 打开浏览器访问 http://localhost:5000")
    
    for f in [img_path, img_path2, img_path3, img_path4, img_path5, img_path6, img_path7, img_path9]:
        try:
            os.close(open(f).fileno())
        except:
            pass

if __name__ == '__main__':
    seed_data()
