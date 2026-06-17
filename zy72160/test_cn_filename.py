import requests
import json

BASE = 'http://localhost:3002/api'

def test_chinese_filename():
    print('=== 测试中文文件名上传 ===')
    
    r = requests.post(f'{BASE}/batches', json={'name': '中文文件名测试'})
    batchId = r.json()['data']['id']
    print(f'batchId: {batchId}')
    
    fname = '解放路8号_现场照片.png'
    print(f'上传文件名: {fname}')
    
    with open(f'samples/{fname}', 'rb') as f:
        r = requests.post(
            f'{BASE}/batches/{batchId}/import', 
            files={'file': (fname, f, 'image/png')},
            data={'sourceType': 'photo'}
        )
    
    data = r.json()
    print(f'success: {data.get("success")}')
    
    if data.get('success'):
        job = data['data']
        fileName = job['fileName']
        print(f'job 中的文件名: {repr(fileName)}')
        print(f'文件名长度: {len(fileName)}')
        
        preview = job['rawPreview']
        if preview:
            addr = preview[0].get('address', '')
            print(f'address: {repr(addr)}')
            print(f'address 长度: {len(addr)}')
            has_chinese = any('\u4e00' <= c <= '\u9fa5' for c in addr)
            print(f'包含中文? {has_chinese}')
    else:
        print(f'error: {data.get("error")}')

if __name__ == '__main__':
    test_chinese_filename()
