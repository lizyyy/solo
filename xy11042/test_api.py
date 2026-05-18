import requests
import json
import time
import os

os.environ['NO_PROXY'] = 'localhost,127.0.0.1'
os.environ['no_proxy'] = 'localhost,127.0.0.1'

BASE_URL = 'http://127.0.0.1:5000'


def 测试健康检查():
    print('=' * 60)
    print('测试1: 健康检查')
    try:
        response = requests.get(f'{BASE_URL}/health')
        print(f'状态码: {response.status_code}')
        print(f'响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}')
        return True
    except Exception as e:
        print(f'错误: {e}')
        return False


def 测试查询班级():
    print('\n' + '=' * 60)
    print('测试2: 查询班级列表')
    try:
        response = requests.get(f'{BASE_URL}/api/classes')
        print(f'状态码: {response.status_code}')
        print(f'班级数: {len(response.json())}')
        print(f'响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}')
        return True
    except Exception as e:
        print(f'错误: {e}')
        return False


def 测试查询学生():
    print('\n' + '=' * 60)
    print('测试3: 查询学生列表')
    try:
        response = requests.get(f'{BASE_URL}/api/students')
        print(f'状态码: {response.status_code}')
        print(f'学生数: {len(response.json())}')
        print(f'响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}')
        return True
    except Exception as e:
        print(f'错误: {e}')
        return False


def 测试查询画材包():
    print('\n' + '=' * 60)
    print('测试4: 查询画材包列表')
    try:
        response = requests.get(f'{BASE_URL}/api/packages')
        print(f'状态码: {response.status_code}')
        print(f'画材包类型数: {len(response.json())}')
        print(f'响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}')
        return True
    except Exception as e:
        print(f'错误: {e}')
        return False


def 测试正常分发():
    print('\n' + '=' * 60)
    print('测试5: 正常分发画材包（小丽领取油画包）')
    try:
        data = {
            '学号': 'X2024004',
            '包类型编号': 'PKG-OIL',
            '分发人': '王老师'
        }
        response = requests.post(f'{BASE_URL}/api/distribute', json=data)
        print(f'状态码: {response.status_code}')
        print(f'响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}')
        return True
    except Exception as e:
        print(f'错误: {e}')
        return False


def 测试重复分发冲突():
    print('\n' + '=' * 60)
    print('测试6: 重复分发冲突（小明已领取素描包，再次领取）')
    try:
        data = {
            '学号': 'X2024001',
            '包类型编号': 'PKG-SKETCH',
            '分发人': '张老师'
        }
        response = requests.post(f'{BASE_URL}/api/distribute', json=data)
        print(f'状态码: {response.status_code}')
        print(f'响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}')
        return True
    except Exception as e:
        print(f'错误: {e}')
        return False


def 测试跨班补领冲突():
    print('\n' + '=' * 60)
    print('测试7: 跨班补领冲突（用小明的记录给小红补领）')
    try:
        data = {
            '学号': 'X2024002',
            '包类型编号': 'PKG-SKETCH',
            '分发人': '张老师',
            '是否补领': True,
            '原分发记录编号': 'FH202401010001'
        }
        response = requests.post(f'{BASE_URL}/api/distribute', json=data)
        print(f'状态码: {response.status_code}')
        print(f'响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}')
        return True
    except Exception as e:
        print(f'错误: {e}')
        return False


def 测试查询分发记录():
    print('\n' + '=' * 60)
    print('测试8: 查询分发记录列表')
    try:
        response = requests.get(f'{BASE_URL}/api/distributions')
        print(f'状态码: {response.status_code}')
        result = response.json()
        print(f'记录总数: {result["记录总数"]}')
        print(f'响应: {json.dumps(result, ensure_ascii=False, indent=2)}')
        return True
    except Exception as e:
        print(f'错误: {e}')
        return False


def 测试导出JSON格式():
    print('\n' + '=' * 60)
    print('测试9: 导出分发记录（JSON格式）')
    try:
        response = requests.get(f'{BASE_URL}/api/export')
        print(f'状态码: {response.status_code}')
        result = response.json()
        print(f'导出时间: {result["导出时间"]}')
        print(f'记录总数: {result["记录总数"]}')
        print(f'响应: {json.dumps(result, ensure_ascii=False, indent=2)}')
        return True
    except Exception as e:
        print(f'错误: {e}')
        return False


def 测试导出表格格式():
    print('\n' + '=' * 60)
    print('测试10: 导出分发记录（表格格式）')
    try:
        response = requests.get(f'{BASE_URL}/api/export?格式=table')
        print(f'状态码: {response.status_code}')
        print(f'表格内容:\n{response.text}')
        return True
    except Exception as e:
        print(f'错误: {e}')
        return False


def 测试导入功能():
    print('\n' + '=' * 60)
    print('测试11: 导入分发记录（包含正常、冲突、坏行）')
    try:
        with open('test_import_data.json', 'rb') as f:
            files = {'文件': ('test_import_data.json', f, 'application/json')}
            response = requests.post(f'{BASE_URL}/api/import', files=files)
        print(f'状态码: {response.status_code}')
        print(f'响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}')
        return True
    except Exception as e:
        print(f'错误: {e}')
        return False


def 测试查询异常日志():
    print('\n' + '=' * 60)
    print('测试12: 查询异常日志')
    try:
        response = requests.get(f'{BASE_URL}/api/errors')
        print(f'状态码: {response.status_code}')
        result = response.json()
        print(f'异常总数: {result["异常总数"]}')
        print(f'响应: {json.dumps(result, ensure_ascii=False, indent=2)}')
        return True
    except Exception as e:
        print(f'错误: {e}')
        return False


def 运行所有测试():
    print('美术培训室画材包分发API - 验收测试')
    print('开始时间:', time.strftime('%Y-%m-%d %H:%M:%S'))
    
    测试列表 = [
        测试健康检查,
        测试查询班级,
        测试查询学生,
        测试查询画材包,
        测试正常分发,
        测试重复分发冲突,
        测试跨班补领冲突,
        测试查询分发记录,
        测试导出JSON格式,
        测试导出表格格式,
        测试导入功能,
        测试查询异常日志
    ]
    
    通过数 = 0
    失败数 = 0
    
    for 测试 in 测试列表:
        if 测试():
            通过数 += 1
        else:
            失败数 += 1
    
    print('\n' + '=' * 60)
    print('测试总结:')
    print(f'总测试数: {len(测试列表)}')
    print(f'通过数: {通过数}')
    print(f'失败数: {失败数}')
    print(f'通过率: {通过数/len(测试列表)*100:.1f}%')
    print('结束时间:', time.strftime('%Y-%m-%d %H:%M:%S'))
    print('=' * 60)


if __name__ == '__main__':
    运行所有测试()
