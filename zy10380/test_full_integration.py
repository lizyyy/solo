#!/usr/bin/env python3
import requests
import json
import time

BASE_URL = 'http://localhost:5001/api/v1'

def print_response(title, response):
    print(f'\n{"="*60}')
    print(f'  {title}')
    print(f'{"="*60}')
    print(f'Status: {response.status_code}')
    try:
        data = response.json()
        print(json.dumps(data, indent=2, ensure_ascii=False))
        return data
    except:
        print(response.text)
        return None

def test_success_flow_with_real_content():
    print('\n' + '#'*60)
    print('#  SUCCESS FLOW - Real JSON Content')
    print('#'*60)
    
    operator = 'admin@example.com'
    
    json_data = [
        {"id": "user_001", "name": "Alice Smith", "email": "alice@example.com", "status": "active"},
        {"id": "user_002", "name": "Bob Johnson", "email": "bob@example.com", "status": "active"},
        {"id": "user_003", "name": "Charlie Brown", "email": "charlie@example.com", "status": "inactive"}
    ]
    
    print('\n1. Create package with real JSON content')
    response = requests.post(f'{BASE_URL}/packages', json={
        'filename': 'users.json',
        'file_type': 'json',
        'file_size': len(json.dumps(json_data)),
        'uploaded_by': operator,
        'content': json.dumps(json_data)
    })
    result = print_response('Create package', response)
    package_id = result['data']['id']
    print(f'Package ID: {package_id}')
    assert result['data']['has_content'] == True, "Package should have content"
    
    print('\n2. Parse the package')
    response = requests.post(f'{BASE_URL}/packages/{package_id}/parse', json={
        'parsed_by': operator
    })
    result = print_response('Parse package', response)
    assert result['data']['total_records'] == 3, "Should have 3 records"
    assert result['data']['valid_records'] == 3, "Should have 3 valid records"
    
    print('\n3. Preview differences (all should be NEW - first import)')
    response = requests.get(f'{BASE_URL}/packages/{package_id}/preview')
    result = print_response('Preview diffs', response)
    assert result['data']['summary']['new_count'] == 3, "Should be 3 NEW records"
    assert result['data']['summary']['update_count'] == 0, "Should be 0 UPDATE records"
    assert result['data']['summary']['delete_count'] == 0, "Should be 0 DELETE records"
    
    print('\n4. Check current source data (should be empty)')
    response = requests.get(f'{BASE_URL}/source-data')
    result = print_response('Source data before write', response)
    print(f'Current records in source: {result["count"]}')
    
    print('\n5. Create confirmation token')
    response = requests.post(f'{BASE_URL}/packages/{package_id}/confirm-token', json={
        'created_by': operator
    })
    result = print_response('Create token', response)
    token = result['data']['token']
    
    print('\n6. Confirm and write to source')
    response = requests.post(f'{BASE_URL}/packages/{package_id}/write', json={
        'token': token,
        'confirmed_by': operator
    })
    result = print_response('Write batch', response)
    batch_id = result['data'][0]['id']
    
    print('\n7. Verify source data has been written')
    response = requests.get(f'{BASE_URL}/source-data')
    result = print_response('Source data after write', response)
    assert result['count'] == 3, "Should have 3 records written"
    record_ids = [r['id'] for r in result['data']]
    assert 'user_001' in record_ids, "user_001 should be in source"
    assert 'user_002' in record_ids, "user_002 should be in source"
    
    print('\n8. View operation history')
    response = requests.get(f'{BASE_URL}/history', params={'package_id': package_id})
    print_response('Operation history', response)
    
    return package_id, batch_id

def test_update_flow():
    print('\n' + '#'*60)
    print('#  UPDATE FLOW - Change existing records')
    print('#'*60)
    
    operator = 'admin@example.com'
    
    json_data = [
        {"id": "user_001", "name": "Alice Smith-Updated", "email": "alice.smith@example.com", "status": "active"},
        {"id": "user_002", "name": "Bob Johnson", "email": "bob@example.com", "status": "active"},
        {"id": "user_004", "name": "Diana Prince", "email": "diana@example.com", "status": "active"}
    ]
    
    print('\n1. Create second package with updates')
    response = requests.post(f'{BASE_URL}/packages', json={
        'filename': 'users_update.json',
        'file_type': 'json',
        'file_size': len(json.dumps(json_data)),
        'uploaded_by': operator,
        'content': json.dumps(json_data)
    })
    result = print_response('Create update package', response)
    package_id = result['data']['id']
    
    print('\n2. Parse and preview differences')
    requests.post(f'{BASE_URL}/packages/{package_id}/parse')
    response = requests.get(f'{BASE_URL}/packages/{package_id}/preview')
    result = print_response('Preview update diffs', response)
    
    print(f'  NEW count: {result["data"]["summary"]["new_count"]}')
    print(f'  UPDATE count: {result["data"]["summary"]["update_count"]}')
    print(f'  DELETE count: {result["data"]["summary"]["delete_count"]}')
    
    assert result['data']['summary']['new_count'] >= 1, "Should have NEW records"
    assert result['data']['summary']['update_count'] >= 1, "Should have UPDATE records"
    assert result['data']['summary']['delete_count'] >= 1, "Should have DELETE records"
    
    print('\n3. Confirm and write the update')
    response = requests.post(f'{BASE_URL}/packages/{package_id}/confirm-token')
    token = response.json()['data']['token']
    
    response = requests.post(f'{BASE_URL}/packages/{package_id}/write', json={
        'token': token,
        'confirmed_by': operator
    })
    print_response('Write update batch', response)
    
    print('\n4. Verify source data after update')
    response = requests.get(f'{BASE_URL}/source-data')
    result = print_response('Source data after update', response)
    print(f'Total records: {result["count"]}')
    
    user_001 = next((r for r in result['data'] if r['id'] == 'user_001'), None)
    assert user_001['data']['name'] == 'Alice Smith-Updated', "Name should be updated"
    assert user_001['data']['email'] == 'alice.smith@example.com', "Email should be updated"
    
    return package_id

def test_problem_flow_with_validation():
    print('\n' + '#'*60)
    print('#  PROBLEM FLOW - Validation errors')
    print('#'*60)
    
    operator = 'tester@example.com'
    
    json_data = [
        {"id": "bad_001", "name": "", "email": "not-an-email", "status": "active"},
        {"id": "bad_002", "email": "valid@email.com", "status": "active"},
        {"id": "good_001", "name": "Valid User", "email": "good@example.com", "status": "active"}
    ]
    
    print('\n1. Create package with validation issues')
    response = requests.post(f'{BASE_URL}/packages', json={
        'filename': 'bad_data.json',
        'file_type': 'json',
        'file_size': len(json.dumps(json_data)),
        'uploaded_by': operator,
        'content': json.dumps(json_data)
    })
    package_id = response.json()['data']['id']
    
    print('\n2. Parse and check validation errors')
    response = requests.post(f'{BASE_URL}/packages/{package_id}/parse')
    result = print_response('Parse with validation', response)
    
    print(f'Total: {result["data"]["total_records"]}')
    print(f'Valid: {result["data"]["valid_records"]}')
    print(f'Invalid: {result["data"]["invalid_records"]}')
    
    assert result['data']['invalid_records'] > 0, "Should have invalid records"
    
    print('\n3. Preview diffs (only valid records shown)')
    response = requests.get(f'{BASE_URL}/packages/{package_id}/preview')
    print_response('Diffs with validation', response)
    
    return package_id

def test_csv_support():
    print('\n' + '#'*60)
    print('#  CSV FORMAT SUPPORT')
    print('#'*60)
    
    operator = 'admin@example.com'
    
    csv_content = """id,name,email,status
csv_001,CSV User One,user1@csv.com,active
csv_002,CSV User Two,user2@csv.com,inactive
"""
    
    print('\n1. Create package with CSV content')
    response = requests.post(f'{BASE_URL}/packages', json={
        'filename': 'import.csv',
        'file_type': 'csv',
        'file_size': len(csv_content),
        'uploaded_by': operator,
        'content': csv_content
    })
    result = print_response('Create CSV package', response)
    package_id = result['data']['id']
    
    print('\n2. Parse CSV content')
    response = requests.post(f'{BASE_URL}/packages/{package_id}/parse')
    result = print_response('Parse CSV', response)
    assert result['data']['total_records'] == 2, "Should have 2 CSV records"
    
    print('\n3. Preview diffs')
    response = requests.get(f'{BASE_URL}/packages/{package_id}/preview')
    print_response('CSV diffs', response)
    
    return package_id

def test_revocation_flow():
    print('\n' + '#'*60)
    print('#  REVOCATION FLOW - Undo last write')
    print('#'*60)
    
    operator = 'manager@example.com'
    
    json_data = [
        {"id": "rev_test_001", "name": "Revocable User", "email": "revoke@test.com", "status": "active"}
    ]
    
    print('\n1. Create and write a test package')
    response = requests.post(f'{BASE_URL}/packages', json={
        'filename': 'revocable.json',
        'file_type': 'json',
        'file_size': len(json.dumps(json_data)),
        'uploaded_by': operator,
        'content': json.dumps(json_data)
    })
    package_id = response.json()['data']['id']
    
    requests.post(f'{BASE_URL}/packages/{package_id}/parse')
    response = requests.post(f'{BASE_URL}/packages/{package_id}/confirm-token')
    token = response.json()['data']['token']
    
    response = requests.post(f'{BASE_URL}/packages/{package_id}/write', json={
        'token': token,
        'confirmed_by': operator
    })
    batch_id = response.json()['data'][0]['id']
    
    print('\n2. Verify record was written')
    response = requests.get(f'{BASE_URL}/source-data')
    data = response.json()
    has_record = any(r['id'] == 'rev_test_001' for r in data['data'])
    print(f'Record written: {has_record}')
    assert has_record, "Record should be written"
    
    print('\n3. Revoke the batch')
    response = requests.post(f'{BASE_URL}/batches/{batch_id}/revoke', json={
        'revoked_by': operator,
        'reason': 'Testing revocation functionality'
    })
    print_response('Revoke batch', response)
    
    print('\n4. Verify record was deactivated')
    response = requests.get(f'{BASE_URL}/source-data')
    data = response.json()
    has_record = any(r['id'] == 'rev_test_001' for r in data['data'])
    print(f'Record still active: {has_record}')
    assert not has_record, "Record should be deactivated after revocation"
    
    print('\n5. Verify package status is REVOKED')
    response = requests.get(f'{BASE_URL}/packages/{package_id}')
    result = print_response('Package status after revocation', response)
    assert result['data']['package']['status'] == 'REVOKED', "Package should be REVOKED"
    
    return package_id

def main():
    print('='*60)
    print('  Multi-step Import API - Full Integration Test')
    print('='*60)
    
    print('\nWaiting for server...')
    for i in range(3):
        try:
            response = requests.get(f'{BASE_URL}/health', timeout=2)
            if response.status_code == 200:
                print('Server ready!')
                break
        except:
            print(f'Waiting... ({i+1}/3)')
            time.sleep(2)
    else:
        print('ERROR: Cannot connect to server. Please run python run.py')
        return
    
    try:
        print('\nCleaning up old test data...')
        response = requests.get(f'{BASE_URL}/source-data')
        for r in response.json()['data']:
            requests.delete(f'{BASE_URL}/source-data/{r["id"]}')
        print('Source data store cleared.')
        
        package1, batch1 = test_success_flow_with_real_content()
        package2 = test_update_flow()
        package3 = test_problem_flow_with_validation()
        package4 = test_csv_support()
        package5 = test_revocation_flow()
        
        print('\n' + '#'*60)
        print('#  TEST SUMMARY')
        print('#'*60)
        print(f'Success flow package: {package1}')
        print(f'Update flow package: {package2}')
        print(f'Problem flow package: {package3}')
        print(f'CSV flow package: {package4}')
        print(f'Revocation flow package: {package5}')
        print('\nAll tests passed! Real content parsing and diff generation works.')
        
    except Exception as e:
        print(f'\nTest failed: {e}')
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
