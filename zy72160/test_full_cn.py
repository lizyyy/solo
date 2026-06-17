import requests
import json
import sys

BASE = 'http://localhost:3002/api'

def test_full_flow_cn():
    print('=== 测试完整证据链流程（中文文件名） ===')
    
    # 1. 创建批次
    print('\n1. 创建导入批次...')
    r = requests.post(f'{BASE}/batches', json={
        'name': '历史街区业态更新-证据链测试'
    })
    data = r.json()
    print(f'   响应: success={data.get("success")}')
    batchId = data['data']['id']
    print(f'   batchId: {batchId}')
    
    # 2. 上传 GIS CSV
    print('\n2. 上传 GIS CSV...')
    with open('samples/gis_points.csv', 'rb') as f:
        r = requests.post(f'{BASE}/batches/{batchId}/import', 
            files={'file': ('gis_points.csv', f, 'text/csv')},
            data={'sourceType': 'gis'}
        )
    data = r.json()
    print(f'   响应: success={data.get("success")}')
    gisJobId = data['data']['id']
    print(f'   gisJobId: {gisJobId[:8]}...')
    
    # 3. 上传街道表格 CSV
    print('\n3. 上传街道表格 CSV...')
    with open('samples/street_table.csv', 'rb') as f:
        r = requests.post(f'{BASE}/batches/{batchId}/import', 
            files={'file': ('street_table.csv', f, 'text/csv')},
            data={'sourceType': 'street_table'}
        )
    data = r.json()
    print(f'   响应: success={data.get("success")}')
    streetJobId = data['data']['id']
    print(f'   streetJobId: {streetJobId[:8]}...')
    
    # 4. 上传照片
    photo_jobs = []
    print('\n4. 上传照片...')
    for fname in ['解放路8号_现场照片.png', '解放路12号_门头照片.png']:
        with open(f'samples/{fname}', 'rb') as f:
            r = requests.post(f'{BASE}/batches/{batchId}/import', 
                files={'file': (fname, f, 'image/png')},
                data={'sourceType': 'photo'}
            )
        data = r.json()
        ok = data.get('success')
        jid = data['data']['id'] if ok else '?'
        addr = data['data']['rawPreview'][0].get('address', '?') if ok else '?'
        print(f'   {fname}: success={ok} address={addr}')
        if ok:
            photo_jobs.append(jid)
    
    # 5. 上传审批 PDF
    approval_jobs = []
    print('\n5. 上传审批 PDF...')
    for fname in ['解放路8号_经营许可.pdf', '中山路25号_消防验收.pdf']:
        with open(f'samples/{fname}', 'rb') as f:
            r = requests.post(f'{BASE}/batches/{batchId}/import', 
                files={'file': (fname, f, 'application/pdf')},
                data={'sourceType': 'approval'}
            )
        data = r.json()
        ok = data.get('success')
        jid = data['data']['id'] if ok else '?'
        addr = data['data']['rawPreview'][0].get('address', '?') if ok else '?'
        print(f'   {fname}: success={ok} address={addr}')
        if ok:
            approval_jobs.append(jid)
    
    # 6. 确认所有任务
    print('\n6. 确认所有导入任务...')
    all_job_ids = [gisJobId, streetJobId] + photo_jobs + approval_jobs
    for jid in all_job_ids:
        r = requests.post(f'{BASE}/batches/{jid}/confirm')
        data = r.json()
        print(f'   {jid[:8]}...: success={data.get("success")} status={data["data"].get("status") if data.get("success") else "?"}')
    
    # 7. 归并
    print('\n7. 执行归并...')
    r = requests.post(f'{BASE}/batches/{batchId}/merge')
    data = r.json()
    print(f'   响应: success={data.get("success")}')
    if data.get('success'):
        result = data['data']
        print(f'   归并结果: new={result.get("newCount")}, matched={result.get("matchedCount")}, conflicts={result.get("conflictCount")}, anomalies={result.get("anomalyCount")}')
    
    # 8. 查看归并点位列表
    print('\n8. 查看归并点位列表...')
    r = requests.get(f'{BASE}/batches/{batchId}/merged-points')
    data = r.json()
    points = data['data'] if data.get('success') else []
    print(f'   点位数: {len(points)}')
    for p in points:
        sources = p.get('sources', [])
        source_types = [s.get('sourceType') for s in sources]
        notes_count = len(p.get('appendedNotes', []))
        print(f'   - {p["address"]}: sourceCount={p["sourceCount"]} sources={source_types} notes={notes_count}')
        print(f'     originalNotes: {p.get("originalNotes")}')
        print(f'     conflictStatus: {p.get("conflictStatus")}')
    
    # 9. 查看解放路8号的详情
    jf8 = next((p for p in points if '解放路8号' in p['address']), None)
    if jf8:
        pointId = jf8['id']
        print(f'\n9. 查看点位 解放路8号 详情...')
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
                print(f'       importTime={s.get("importTime")[:19]} processTime={s.get("processTime", "")[:19]}')
                if s.get('originalValue'):
                    val = s['originalValue']
                    if len(val) > 60:
                        val = val[:60] + '...'
                    print(f'       originalValue: {val}')
    
    # 10. 追加备注
    if jf8:
        pointId = jf8['id']
        print(f'\n10. 给点位 解放路8号 追加备注...')
        r = requests.post(f'{BASE}/batches/points/{pointId}/notes', json={
            'content': '经现场复核，该店铺经营状态正常，符合历史街区业态规划要求。',
            'author': '复核员老曹'
        })
        data = r.json()
        print(f'   响应: success={data.get("success")}')
        if data.get('success'):
            note = data['data']
            print(f'   备注内容: {note["content"]}')
            print(f'   作者: {note.get("author")}')
        
        # 重新加载验证
        print(f'\n   重新加载验证备注...')
        r = requests.get(f'{BASE}/batches/points/{pointId}')
        data = r.json()
        if data.get('success'):
            notes = data['data'].get('appendedNotes', [])
            print(f'   追加备注数: {len(notes)}')
            for n in notes:
                print(f'     - {n["author"]}: {n["content"]}')
    
    # 11. 导出 Excel
    print('\n11. 导出 Excel...')
    r = requests.post(f'{BASE}/batches/{batchId}/export', json={'format': 'excel'})
    print(f'   状态码: {r.status_code}')
    if r.status_code == 200:
        print(f'   文件大小: {len(r.content)} bytes')
        with open('/tmp/test_cn_export.xlsx', 'wb') as f:
            f.write(r.content)
        print('   已保存到 /tmp/test_cn_export.xlsx')
    
    # 12. 导出 PDF
    print('\n12. 导出 PDF...')
    r = requests.post(f'{BASE}/batches/{batchId}/export', json={'format': 'pdf'})
    print(f'   状态码: {r.status_code}')
    if r.status_code == 200:
        print(f'   文件大小: {len(r.content)} bytes')
        with open('/tmp/test_cn_export.pdf', 'wb') as f:
            f.write(r.content)
        print('   已保存到 /tmp/test_cn_export.pdf')
    
    print('\n=== 测试完成 ===')

if __name__ == '__main__':
    test_full_flow_cn()
