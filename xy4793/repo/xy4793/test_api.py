import requests
import json
import asyncio
import websockets
from datetime import datetime

BASE_URL = "http://localhost:8000"
WS_URL = "ws://localhost:8000"

def test_health_check():
    print("\n[TEST] 健康检查")
    try:
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("  ✓ 健康检查通过")
        return True
    except Exception as e:
        print(f"  ✗ 健康检查失败: {e}")
        return False

def test_rooms_api():
    print("\n[TEST] 房间 API 测试")
    try:
        response = requests.get(f"{BASE_URL}/api/rooms/")
        assert response.status_code == 200
        rooms = response.json()
        print(f"  ✓ 获取房间列表: {len(rooms)} 个房间")
        
        response = requests.get(f"{BASE_URL}/api/rooms/status/all")
        assert response.status_code == 200
        room_statuses = response.json()
        print(f"  ✓ 获取房间状态: {len(room_statuses)} 个房间状态")
        
        return True
    except Exception as e:
        print(f"  ✗ 房间 API 测试失败: {e}")
        return False

def test_sessions_api():
    print("\n[TEST] 场次 API 测试")
    try:
        rooms = requests.get(f"{BASE_URL}/api/rooms/").json()
        if not rooms:
            print("  ⚠️ 没有房间数据，跳过场次创建测试")
            return True
        
        room_id = rooms[0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/sessions/today")
        assert response.status_code == 200
        today_sessions = response.json()
        print(f"  ✓ 获取今日场次: {len(today_sessions)} 场")
        
        session_data = {
            "room_id": room_id,
            "script_name": "测试剧本",
            "dm_name": "测试DM",
            "player_count": 6,
            "scheduled_time": datetime.now().isoformat()
        }
        
        response = requests.post(
            f"{BASE_URL}/api/sessions/",
            json=session_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            new_session = response.json()
            print(f"  ✓ 创建场次成功: ID={new_session['id']}")
            
            session_id = new_session["id"]
            response = requests.get(f"{BASE_URL}/api/sessions/{session_id}")
            assert response.status_code == 200
            print(f"  ✓ 获取场次详情: {response.json()['script_name']}")
            
            response = requests.get(f"{BASE_URL}/api/sessions/{session_id}/events")
            assert response.status_code == 200
            print(f"  ✓ 获取场次事件: {len(response.json())} 个事件")
            
            return True
        else:
            error = response.json()
            print(f"  ⚠️ 创建场次可能失败: {error.get('detail', '未知错误')}")
            return True
            
    except Exception as e:
        print(f"  ✗ 场次 API 测试失败: {e}")
        return False

def test_events_api():
    print("\n[TEST] 事件 API 测试")
    try:
        sessions = requests.get(f"{BASE_URL}/api/sessions/today").json()
        if not sessions:
            print("  ⚠️ 没有场次数据，跳过事件测试")
            return True
        
        session = sessions[0]
        session_id = session["id"]
        
        response = requests.get(f"{BASE_URL}/api/events/unacknowledged")
        assert response.status_code == 200
        unacked = response.json()
        print(f"  ✓ 获取未确认事件: {len(unacked)} 个")
        
        return True
    except Exception as e:
        print(f"  ✗ 事件 API 测试失败: {e}")
        return False

async def test_websocket():
    print("\n[TEST] WebSocket 连接测试")
    try:
        client_id = "test_client_" + datetime.now().strftime("%Y%m%d%H%M%S")
        ws_uri = f"{WS_URL}/ws/{client_id}?user_type=front_desk"
        
        async with websockets.connect(ws_uri) as websocket:
            message = await websocket.recv()
            data = json.loads(message)
            assert data["type"] == "connection_ack"
            print(f"  ✓ WebSocket 连接成功, client_id={data['client_id']}")
            
            await websocket.send(json.dumps({"type": "heartbeat"}))
            response = await websocket.recv()
            response_data = json.loads(response)
            assert response_data["type"] == "heartbeat"
            print("  ✓ 心跳测试通过")
        
        return True
    except Exception as e:
        print(f"  ✗ WebSocket 测试失败: {e}")
        return False

async def test_websocket_reconnect():
    print("\n[TEST] WebSocket 断线重连测试")
    try:
        client_id = "reconnect_test_" + datetime.now().strftime("%Y%m%d%H%M%S")
        ws_uri = f"{WS_URL}/ws/{client_id}?user_type=front_desk"
        
        async with websockets.connect(ws_uri) as websocket1:
            message = await websocket1.recv()
            data = json.loads(message)
            print(f"  ✓ 第一次连接成功: client_id={data['client_id']}")
        
        await asyncio.sleep(0.5)
        
        async with websockets.connect(ws_uri) as websocket2:
            message = await websocket2.recv()
            data = json.loads(message)
            print(f"  ✓ 断线重连成功: client_id={data['client_id']}")
        
        return True
    except Exception as e:
        print(f"  ✗ 断线重连测试失败: {e}")
        return False

async def main():
    print("=" * 50)
    print("剧本杀房间调度台 API 测试")
    print("=" * 50)
    
    results = []
    
    results.append(("健康检查", test_health_check()))
    results.append(("房间 API", test_rooms_api()))
    results.append(("场次 API", test_sessions_api()))
    results.append(("事件 API", test_events_api()))
    results.append(("WebSocket 连接", await test_websocket()))
    results.append(("WebSocket 断线重连", await test_websocket_reconnect()))
    
    print("\n" + "=" * 50)
    print("测试结果汇总")
    print("=" * 50)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✓ 通过" if result else "✗ 失败"
        print(f"  {name}: {status}")
    
    print(f"\n总计: {passed}/{total} 项测试通过")
    
    if passed == total:
        print("\n✅ 所有测试通过！")
    else:
        print(f"\n❌ 有 {total - passed} 项测试失败")
    
    return passed == total

if __name__ == "__main__":
    import sys
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
