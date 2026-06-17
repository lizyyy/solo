import requests
import json

BASE = 'http://localhost:3002/api'

def test_full_flow():
    print('=== 测试完整证据链流程（英文文件名） ===')
    
    # 1. 创建批次
    print('\n1. 创建导入批次...')
    r = requests.post(f'{BASE}/batches', json={
        'name': '证据链测试批次-英文'
    })
    data = r.json()
    print(f'   响应: success={data.get("success")}')
    batchId = data['data']['id']
    print(f'   batchId: {batchId}')
    
    # 2. 上传 GIS CSV
    print('\n2. 上传 GIS CSV...')
    with open('samples/gis_points_en.csv', 'rb') as f:
        r = requests.post(f'{BASE}/batches/{batchId}/import', 
            files={'file': ('gis_points_en.csv', f, 'text/csv')},
            data={'sourceType': 'gis'}
        )
    data = r.json()
    print(f'   响应: success={data.get("success")}')
    gisJobId = data['data']['id']
    print(f'   gisJobId: {gisJobId}')
    print(f'   状态: {data["data"]["status"]}')
    print(f'   预览条数: {data["data"]["recordCount"]}')
    
    # 3. 上传街道表格 CSV
    print('\n3. 上传街道表格 CSV...')
    with open('samples/street_table_en.csv', 'rb') as f:
        r = requests.post(f'{BASE}/batches/{batchId}/import', 
            files={'file': ('street_table_en.csv', f, 'text/csv')},
            data={'sourceType': 'street_table'}
        )
    data = r.json()
    print(f'   响应: success={data.get("success")}')
    streetJobId = data['data']['id']
    print(f'   streetJobId: {streetJobId}')
    
    # 4. 上传照片
    print('\n4. 上传照片 1 (JiefangRoad8)...')
    with open('samples/JiefangRoad8_photo.png', 'rb') as f:
        r = requests.post(f'{BASE}/batches/{batchId}/import', 
            files={'file': ('JiefangRoad8_photo.png', f, 'image/png')},
            data={'sourceType': 'photo'}
        )
    data = r.json()
    print(f'   响应: success={data.get("success")}')
    photo1JobId = None
    if data.get('success'):
        photo1JobId = data['data']['id']
        print(f'   jobId: {photo1JobId}')
        print(f'   状态: {data["data"]["status"]}')
        preview = data['data']['rawPreview']
        if preview and len(preview) > 0:
            print(f'   address: {preview[0].get("address")}')
            print(f'   fileName: {preview[0].get("fileName")}')
    else:
        print(f'   error: {data.get("message")}')
    
    print('\n   上传照片 2 (JiefangRoad12)...')
    with open('samples/JiefangRoad12_photo.png', 'rb') as f:
        r = requests.post(f'{BASE}/batches/{batchId}/import', 
            files={'file': ('JiefangRoad12_photo.png', f, 'image/png')},
            data={'sourceType': 'photo'}
        )
    data = r.json()
    print(f'   响应: success={data.get("success")}')
    photo2JobId = data['data']['id'] if data.get('success') else None
    
    # 5. 上传审批 PDF
    print('\n5. 上传审批 PDF 1 (JiefangRoad8)...')
    with open('samples/JiefangRoad8_approval.pdf', 'rb') as f:
        r = requests.post(f'{BASE}/batches/{batchId}/import', 
            files={'file': ('JiefangRoad8_approval.pdf', f, 'application/pdf')},
            data={'sourceType': 'approval'}
        )
    data = r.json()
    print(f'   响应: success={data.get("success")}')
    approval1JobId = None
    if data.get('success'):
        approval1JobId = data['data']['id']
        print(f'   jobId: {approval1JobId}')
        preview = data['data']['rawPreview']
        if preview and len(preview) > 0:
            print(f'   address: {preview[0].get("address")}')
    
    print('\n   上传审批 PDF 2 (ZhongshanRoad25)...')
    with open('samples/ZhongshanRoad25_approval.pdf', 'rb') as f:
        r = requests.post(f'{BASE}/batches/{batchId}/import', 
            files={'file': ('ZhongshanRoad25_approval.pdf', f, 'application/pdf')},
            data={'sourceType': 'approval'}
        )
    data = r.json()
    print(f'   响应: success={data.get("success")}')
    approval2JobId = data['data']['id'] if data.get('success') else None
    
    # 6. 获取批次详情
    print('\n6. 获取批次详情（所有任务）...')
    r = requests.get(f'{BASE}/batches/{batchId}')
    data = r.json()
    print(f'   success={data.get("success")}')
    if data.get('success'):
        batch_data = data['data']
        jobs = batch_data.get('jobs', [])
        print(f'   任务数: {len(jobs)}')
        for job in jobs:
            print(f'     - {job["sourceType"]}: {job["fileName"]} status={job["status"]} records={job["recordCount"]}')
    
    # 7. 确认所有任务
    print('\n7. 确认所有导入任务...')
    job_ids = [gisJobId, streetJobId, photo1JobId, photo2JobId, approval1JobId, approval2JobId]
    for jid in job_ids:
        if not jid: continue
        r = requests.post(f'{BASE}/batches/{jid}/confirm')
        data = r.json()
        print(f'   {jid[:8]}...: success={data.get("success")} status={data["data"].get("status") if data.get("success") else "?"}')
    
    # 8. 归并
    print('\n8. 执行归并...')
    r = requests.post(f'{BASE}/batches/{batchId}/merge')
    data = r.json()
    print(f'   响应: success={data.get("success")}')
    if data.get('success'):
        result = data['data']
        print(f'   归并结果: newCount={result.get("newCount")}, matchedCount={result.get("matchedCount")}, conflicts={result.get("conflictCount")}, anomalies={result.get("anomalyCount")}')
    
    # 9. 查看归并点位列表
    print('\n9. 查看归并点位列表...')
    r = requests.get(f'{BASE}/batches/{batchId}/merged-points')
    data = r.json()
    print(f'   响应: success={data.get("success")}')
    points = []
    if data.get('success'):
        points = data['data']
        print(f'   点位数: {len(points)}')
        for p in points:
            sources = p.get('sources', [])
            source_types = [s.get('sourceType') for s in sources]
            notes_count = len(p.get('appendedNotes', []))
            print(f'     - {p["address"]}: status={p["status"]} sourceCount={p["sourceCount"]} sources={source_types} notes={notes_count}')
            print(f'       originalNotes: {p.get("originalNotes")}')
    
    # 10. 查看第一个点位的详情（证据链）
    if len(points) > 0:
        pointId = points[0]['id']
        print(f'\n10. 查看点位 {points[0]["address"]} 的详情...')
        r = requests.get(f'{BASE}/batches/points/{pointId}')
        data = r.json()
        if data.get('success'):
            point = data['data']
            print(f'   地址: {point["address"]}')
            print(f'   原始备注: {point.get("originalNotes")}')
            print(f'   来源数: {point.get("sourceCount")}')
            sources = point.get('sources', [])
            print(f'   证据记录 ({len(sources)}):')
            for s in sources:
                print(f'     - {s["sourceType"]}: {s.get("fileName", "")}')
                print(f'       importTime={s.get("importTime")} processTime={s.get("processTime")}')
                if s.get('originalValue'):
                    print(f'       originalValue: {s["originalValue"][:80]}')
    
    # 11. 追加备注
    if len(points) > 0:
        pointId = points[0]['id']
        print(f'\n11. 给点位 {points[0]["address"]} 追加备注...')
        r = requests.post(f'{BASE}/batches/points/{pointId}/notes', json={
            'content': '这是测试追加的备注内容',
            'author': '测试员'
        })
        data = r.json()
        print(f'   响应: success={data.get("success")}')
        if data.get('success'):
            note = data['data']
            print(f'   备注ID: {note["id"]}')
            print(f'   内容: {note["content"]}')
            print(f'   作者: {note.get("author")}')
        
        # 重新加载点位，验证备注已保存
        print(f'\n   重新加载点位验证备注...')
        r = requests.get(f'{BASE}/batches/points/{pointId}')
        data = r.json()
        if data.get('success'):
            notes = data['data'].get('appendedNotes', [])
            print(f'   追加备注数: {len(notes)}')
            for n in notes:
                print(f'     - {n["author"]}: {n["content"]} ({n["createdAt"]})')
    
    # 12. 导出 Excel
    print('\n12. 导出 Excel...')
    r = requests.post(f'{BASE}/batches/{batchId}/export', json={'format': 'excel'})
    print(f'   状态码: {r.status_code}')
    if r.status_code == 200:
        print(f'   Content-Type: {r.headers.get("content-type")}')
        print(f'   文件大小: {len(r.content)} bytes')
    
    # 13. 导出 PDF
    print('\n13. 导出 PDF...')
    r = requests.post(f'{BASE}/batches/{batchId}/export', json={'format': 'pdf'})
    print(f'   状态码: {r.status_code}')
    if r.status_code == 200:
        print(f'   Content-Type: {r.headers.get("content-type")}')
        print(f'   文件大小: {len(r.content)} bytes')
    
    print('\n=== 测试完成 ===')

if __name__ == '__main__':
    test_full_flow()
