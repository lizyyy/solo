#!/usr/bin/env python3
import urllib.request
import urllib.parse
import json

def encode_multipart_formdata(fields, files):
    boundary = b'----WebKitFormBoundary7MA4YWxkTrZu0gW'
    body = []
    
    for (key, value) in fields:
        body.append(boundary)
        body.append(f'Content-Disposition: form-data; name="{key}"'.encode())
        body.append(b'')
        body.append(str(value).encode())
    
    for (key, filename, value) in files:
        body.append(boundary)
        body.append(
            f'Content-Disposition: form-data; name="{key}"; filename="{filename}"'.encode()
        )
        body.append(b'Content-Type: application/json')
        body.append(b'')
        body.append(value)
    
    body.append(boundary + b'--')
    body.append(b'')
    
    return b'\r\n'.join(body), boundary.decode()

def test_api():
    print("=" * 60)
    print("测试 1: 项目列表 API")
    try:
        resp = urllib.request.urlopen('http://localhost:8000/api/projects')
        data = json.loads(resp.read())
        print(f"[OK] 项目数: {len(data)}")
    except Exception as e:
        print(f"[FAIL] {e}")
        return

    print("\n" + "=" * 60)
    print("测试 2: 创建新项目")
    try:
        project = json.dumps({"name": "情感分析测试", "description": "API端到端测试"}).encode()
        req = urllib.request.Request(
            'http://localhost:8000/api/projects',
            data=project,
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        resp = urllib.request.urlopen(req)
        p = json.loads(resp.read())
        project_id = p['id']
        print(f"[OK] 创建项目 ID={project_id}, 名称={p['name']}")
    except Exception as e:
        print(f"[FAIL] {e}")
        return

    print("\n" + "=" * 60)
    print("测试 3: 手动添加样本（绕过文件上传）")
    try:
        sample_data = {
            "content": "这家餐厅很棒，服务也很好。",
            "external_id": "test_001",
            "annotations": [
                {"annotator": "A", "label": "正面", "confidence": 0.9},
                {"annotator": "B", "label": "正面", "confidence": 0.85},
                {"annotator": "C", "label": "负面", "confidence": 0.7}
            ]
        }
        data = json.dumps(sample_data).encode()
        req = urllib.request.Request(
            f'http://localhost:8000/api/projects/{project_id}/samples',
            data=data,
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        resp = urllib.request.urlopen(req)
        result = json.loads(resp.read())
        print(f"[OK] 添加样本 ID={result['id']}, 标注数={len(result['annotations'])}")
        
        sample2 = {
            "content": "今天天气一般般。",
            "external_id": "test_002",
            "annotations": [
                {"annotator": "A", "label": "中立", "confidence": 0.8},
                {"annotator": "B", "label": "正面", "confidence": 0.6},
                {"annotator": "C", "label": "中立", "confidence": 0.75}
            ]
        }
        data = json.dumps(sample2).encode()
        req = urllib.request.Request(
            f'http://localhost:8000/api/projects/{project_id}/samples',
            data=data,
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        resp = urllib.request.urlopen(req)
        print(f"[OK] 添加第二样本")
    except Exception as e:
        print(f"[FAIL] {e}")
        import traceback
        traceback.print_exc()
        return

    print("\n" + "=" * 60)
    print("测试 4: 运行冲突检测")
    try:
        req = urllib.request.Request(
            f'http://localhost:8000/api/projects/{project_id}/detect-conflicts?method=rule_based',
            data=b'',
            method='POST'
        )
        resp = urllib.request.urlopen(req)
        result = json.loads(resp.read())
        print(f"[OK] 检测到 {result['total_conflicts']} 个冲突")
    except Exception as e:
        print(f"[FAIL] {e}")
        return

    print("\n" + "=" * 60)
    print("测试 5: 获取冲突列表")
    try:
        resp = urllib.request.urlopen(f'http://localhost:8000/api/projects/{project_id}/conflicts')
        conflicts = json.loads(resp.read())
        pending = [c for c in conflicts if c['status'] == 'pending']
        print(f"[OK] 冲突数={len(conflicts)}, 待处理={len(pending)}")
        conflict_id = None
        if pending:
            conflict_id = pending[0]['id']
            labels = [a['label'] for a in pending[0]['annotations']]
            print(f"     冲突#{conflict_id} 标签分歧: {labels}")
    except Exception as e:
        print(f"[FAIL] {e}")
        return

    print("\n" + "=" * 60)
    print("测试 6: 复核一个冲突")
    try:
        decision = {
            "reviewer": "测试复核人",
            "decision": "accept_majority",
            "reasoning": "测试 - 接受多数票"
        }
        data = json.dumps(decision).encode()
        req = urllib.request.Request(
            f'http://localhost:8000/api/conflicts/{conflict_id}/decide',
            data=data,
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        resp = urllib.request.urlopen(req)
        result = json.loads(resp.read())
        print(f"[OK] 复核成功: decision={result['decision']}, resolved={result['resolved']}")
    except Exception as e:
        print(f"[FAIL] {e}")
        return

    print("\n" + "=" * 60)
    print("测试 7: 版本历史")
    try:
        resp = urllib.request.urlopen(f'http://localhost:8000/api/projects/{project_id}/versions')
        versions = json.loads(resp.read())
        print(f"[OK] 版本数={len(versions)}")
        for v in versions:
            print(f"     v{v['version_number']}: {v['action']} - {v['description'][:40]}...")
    except Exception as e:
        print(f"[FAIL] {e}")
        return

    print("\n" + "=" * 60)
    print("测试 8: 导出报告摘要")
    try:
        resp = urllib.request.urlopen(f'http://localhost:8000/api/projects/{project_id}/report/summary')
        summary = json.loads(resp.read())
        print(f"[OK] 总样本={summary['total_samples']}, 冲突率={summary['conflict_rate']}%")
    except Exception as e:
        print(f"[FAIL] {e}")
        return

    print("\n" + "=" * 60)
    print("[SUCCESS] 所有核心 API 测试通过！")
    print("=" * 60)

if __name__ == "__main__":
    test_api()
