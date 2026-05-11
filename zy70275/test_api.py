#!/usr/bin/env python3
import sys
import json
from datetime import datetime, timedelta
import time

try:
    import httpx
except ImportError:
    print("请先安装依赖: pip install httpx")
    sys.exit(1)

BASE_URL = "http://127.0.0.1:8000"


def print_header(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def print_step(step, desc):
    print(f"\n  [{step}] {desc}")


def print_success(msg):
    print(f"  ✓ {msg}")


def print_error(msg, resp=None):
    print(f"  ✗ {msg}")
    if resp is not None:
        if hasattr(resp, 'status_code'):
            print(f"    状态码: {resp.status_code}")
            print(f"    响应: {resp.text}")
        else:
            print(f"    详情: {resp}")


def pretty_json(obj):
    return json.dumps(obj, ensure_ascii=False, indent=2)


def format_time(dt):
    if isinstance(dt, str):
        return dt
    return dt.isoformat()


class ParkingAPITest:
    def __init__(self):
        self.client = httpx.Client(timeout=10.0)
        self.cleanup_ids = {"visitors": [], "meetings": [], "reservations": []}
        self.temp_data = {}

    def close(self):
        self.client.close()

    def _post(self, endpoint, data):
        return self.client.post(f"{BASE_URL}{endpoint}", json=data)

    def _get(self, endpoint):
        return self.client.get(f"{BASE_URL}{endpoint}")

    def _create_visitor(self, name, company, phone, plate, id_card=None):
        data = {
            "name": name,
            "company": company,
            "phone": phone,
            "license_plate": plate,
            "id_card": id_card
        }
        resp = self._post("/api/visitors", data)
        if resp.status_code == 200:
            v = resp.json()
            self.cleanup_ids["visitors"].append(v["id"])
            return v
        return None

    def _create_meeting(self, visitor_id, start, end):
        data = {
            "visitor_id": visitor_id,
            "host_name": "张三",
            "host_department": "研发部",
            "meeting_room": "会议室A301",
            "purpose": "商务洽谈",
            "scheduled_start": format_time(start),
            "scheduled_end": format_time(end)
        }
        resp = self._post("/api/meetings", data)
        if resp.status_code == 200:
            m = resp.json()
            self.cleanup_ids["meetings"].append(m["id"])
            return m
        return None

    def test_1_initialize_spots(self):
        print_header("测试 1: 初始化车位数据")
        resp = self._get("/api/parking-spots")
        if resp.status_code == 200:
            spots = resp.json()
            print_success(f"系统已初始化 {len(spots)} 个访客车位")
            for s in spots[:3]:
                print(f"    - {s['spot_number']} ({s['zone']})")
            if len(spots) > 3:
                print(f"    ... 还有 {len(spots) - 3} 个")
            self.temp_data["total_spots"] = len(spots)
            return True
        print_error("获取车位列表失败", resp)
        return False

    def test_2_normal_flow(self):
        print_header("测试 2: 完整业务流程 - 从访客申请到车位释放")
        
        now = datetime.now()
        meet_start = now + timedelta(hours=1)
        meet_end = now + timedelta(hours=3)
        plate = f"京A{int(now.timestamp()) % 10000:04d}"
        
        print_step("2.1", "注册访客")
        visitor = self._create_visitor(
            name="李四",
            company="科技有限公司",
            phone="13800001111",
            plate=plate,
            id_card="110101199001011234"
        )
        if not visitor:
            print_error("访客注册失败")
            return False
        print_success(f"访客已注册: ID={visitor['id']}, 车牌={plate}")
        self.temp_data["visitor"] = visitor
        
        print_step("2.2", "创建会议申请")
        meeting = self._create_meeting(visitor["id"], meet_start, meet_end)
        if not meeting:
            print_error("会议创建失败")
            return False
        print_success(f"会议已创建: ID={meeting['id']}, 状态={meeting['status']}")
        self.temp_data["meeting"] = meeting
        
        print_step("2.3", "审批会议")
        resp = self._post(f"/api/meetings/{meeting['id']}/approve", {
            "approve": True,
            "note": "同意来访"
        })
        if resp.status_code != 200:
            print_error("审批失败", resp)
            return False
        meeting = resp.json()
        print_success(f"会议已审批: 状态={meeting['status']}")
        self.temp_data["meeting"] = meeting
        
        print_step("2.4", "创建车位预约 - 系统自动锁定车位")
        resp = self._post("/api/parking-reservations", {
            "meeting_id": meeting["id"],
            "source_record": "APP-20260512-001"
        })
        if resp.status_code != 200:
            print_error("预约失败", resp)
            return False
        reservation = resp.json()
        print_success(f"预约已创建: ID={reservation['id']}, 车位ID={reservation['spot_id']}, 状态={reservation['status']}")
        print(f"    锁定到期: {reservation['lock_expires_at']}")
        self.temp_data["reservation"] = reservation
        self.cleanup_ids["reservations"].append(reservation["id"])
        
        print_step("2.5", "确认预约")
        resp = self._post(f"/api/parking-reservations/{reservation['id']}/confirm", {})
        if resp.status_code != 200:
            print_error("确认失败", resp)
            return False
        reservation = resp.json()
        print_success(f"预约已确认: 状态={reservation['status']}, 锁定已释放")
        
        print_step("2.6", "车辆入场")
        resp = self._post(f"/api/parking-reservations/{reservation['id']}/check-in", {})
        if resp.status_code != 200:
            print_error("入场失败", resp)
            return False
        reservation = resp.json()
        print_success(f"已入场: 状态={reservation['status']}, 实际入场时间={reservation['actual_start']}")
        
        print_step("2.7", "车辆离场")
        resp = self._post(f"/api/parking-reservations/{reservation['id']}/check-out", {})
        if resp.status_code != 200:
            print_error("离场失败", resp)
            return False
        reservation = resp.json()
        print_success(f"已离场: 状态={reservation['status']}, 实际离场时间={reservation['actual_end']}")
        
        print_step("2.8", "查询会议关联的完整记录")
        resp = self._get(f"/api/reports/by-meeting/{meeting['id']}")
        if resp.status_code == 200:
            report = resp.json()
            print_success(f"会议报告: 预约记录数={len(report['reservations'])}")
            print(f"    会议: {report['meeting']['host_name']} - {report['meeting']['purpose']}")
            print(f"    访客: {report['visitor']['name']} ({report['visitor']['company']})")
            print(f"    车牌匹配: {'是' if report['review_summary']['license_plate_match'] else '否'}")
        
        return True

    def test_3_duplicate_submission(self):
        print_header("测试 3: 重复提交边界情况")
        
        now = datetime.now()
        plate = f"京B{int(now.timestamp()) % 10000:04d}"
        
        print_step("3.1", "重复注册访客（同一车牌）")
        visitor = self._create_visitor(
            name="王五",
            company="测试公司",
            phone="13900002222",
            plate=plate
        )
        if not visitor:
            print_error("首次注册失败")
            return False
        print_success(f"首次注册成功")
        
        resp = self._post("/api/visitors", {
            "name": "另一个人",
            "company": "另一家公司",
            "phone": "13900003333",
            "license_plate": plate
        })
        if resp.status_code == 400:
            data = resp.json()
            if data.get("code") == "DUPLICATE_LICENSE_PLATE":
                print_success(f"正确拦截重复车牌: {data['error']}")
            else:
                print_error(f"错误码不匹配: {data.get('code')}")
        else:
            print_error("应拦截但未拦截", resp)
        
        print_step("3.2", "重复创建车位预约")
        meet_start = now + timedelta(hours=2)
        meet_end = now + timedelta(hours=4)
        meeting = self._create_meeting(visitor["id"], meet_start, meet_end)
        if not meeting:
            print_error("会议创建失败")
            return False
        
        self._post(f"/api/meetings/{meeting['id']}/approve", {"approve": True})
        
        resp1 = self._post("/api/parking-reservations", {
            "meeting_id": meeting["id"],
            "source_record": "DUP-TEST-001"
        })
        if resp1.status_code != 200:
            print_error("首次预约失败", resp1)
            return False
        res = resp1.json()
        self.cleanup_ids["reservations"].append(res["id"])
        print_success(f"首次预约成功: ID={res['id']}")
        
        resp2 = self._post("/api/parking-reservations", {
            "meeting_id": meeting["id"],
            "source_record": "DUP-TEST-002"
        })
        if resp2.status_code == 400:
            data = resp2.json()
            if data.get("code") == "DUPLICATE_RESERVATION":
                print_success(f"正确拦截重复预约: {data['error']}")
            else:
                print_error(f"错误码不匹配: {data.get('code')}")
        else:
            print_error("应拦截但未拦截", resp2)
        
        return True

    def test_4_status_conflicts(self):
        print_header("测试 4: 状态冲突边界情况")
        
        now = datetime.now()
        plate = f"京C{int(now.timestamp()) % 10000:04d}"
        meet_start = now + timedelta(hours=1)
        meet_end = now + timedelta(hours=2)
        
        visitor = self._create_visitor("冲突测试", "冲突公司", "13911112222", plate)
        meeting = self._create_meeting(visitor["id"], meet_start, meet_end)
        
        print_step("4.1", "未审批会议尝试预约 - 应被拒绝")
        resp = self._post("/api/parking-reservations", {
            "meeting_id": meeting["id"],
            "source_record": "CONF-TEST-001"
        })
        if resp.status_code == 400:
            data = resp.json()
            if data.get("code") == "MEETING_NOT_APPROVED":
                print_success(f"正确拦截未审批会议: {data['error']}")
            else:
                print_error(f"错误码不匹配: {data.get('code')}")
        else:
            print_error("应拦截但未拦截", resp)
        
        print_step("4.2", "审批后创建预约，再尝试审批已完成状态 - 应被拒绝")
        self._post(f"/api/meetings/{meeting['id']}/approve", {"approve": True})
        
        resp = self._post("/api/parking-reservations", {
            "meeting_id": meeting["id"],
            "source_record": "CONF-TEST-002"
        })
        reservation = resp.json()
        self.cleanup_ids["reservations"].append(reservation["id"])
        
        resp2 = self._post(f"/api/meetings/{meeting['id']}/approve", {"approve": True})
        if resp2.status_code == 400:
            data = resp2.json()
            if data.get("code") == "INVALID_STATUS_TRANSITION":
                print_success(f"正确拦截状态冲突: {data['error']}")
            else:
                print_error(f"错误码不匹配: {data.get('code')}")
        else:
            print_error("应拦截但未拦截", resp2)
        
        print_step("4.3", "取消后的预约尝试再操作 - 应被拒绝")
        self._post(f"/api/parking-reservations/{reservation['id']}/cancel", {})
        
        resp = self._post(f"/api/parking-reservations/{reservation['id']}/confirm", {})
        if resp.status_code == 400:
            data = resp.json()
            if data.get("code") == "INVALID_STATUS_TRANSITION":
                print_success(f"正确拦截已取消预约操作: {data['error']}")
            else:
                print_error(f"错误码不匹配: {data.get('code')}")
        else:
            print_error("应拦截但未拦截", resp)
        
        return True

    def test_5_missing_source_record(self):
        print_header("测试 5: 来源记录缺失边界情况")
        
        now = datetime.now()
        plate = f"京D{int(now.timestamp()) % 10000:04d}"
        meet_start = now + timedelta(hours=1)
        meet_end = now + timedelta(hours=2)
        
        visitor = self._create_visitor("来源测试", "来源公司", "13922223333", plate)
        meeting = self._create_meeting(visitor["id"], meet_start, meet_end)
        self._post(f"/api/meetings/{meeting['id']}/approve", {"approve": True})
        
        print_step("5.1", "空来源记录 - 应被拒绝")
        resp = self._post("/api/parking-reservations", {
            "meeting_id": meeting["id"],
            "source_record": ""
        })
        if resp.status_code == 400:
            data = resp.json()
            if data.get("code") == "MISSING_SOURCE_RECORD":
                print_success(f"正确拦截空来源记录: {data['error']}")
            else:
                print_error(f"错误码不匹配: {data.get('code')}")
        else:
            print_error("应拦截但未拦截", resp)
        
        print_step("5.2", "空白来源记录 - 应被拒绝")
        resp = self._post("/api/parking-reservations", {
            "meeting_id": meeting["id"],
            "source_record": "   "
        })
        if resp.status_code == 400:
            data = resp.json()
            if data.get("code") == "MISSING_SOURCE_RECORD":
                print_success(f"正确拦截空白来源记录: {data['error']}")
            else:
                print_error(f"错误码不匹配: {data.get('code')}")
        else:
            print_error("应拦截但未拦截", resp)
        
        return True

    def test_6_extension_conflict(self):
        print_header("测试 6: 临时延时占用后续车位")
        
        now = datetime.now()
        plate1 = f"京E{int(now.timestamp()) % 10000:04d}"
        plate2 = f"京F{int((now.timestamp() + 1) % 10000):04d}"
        
        meet1_start = now + timedelta(hours=1)
        meet1_end = now + timedelta(hours=2)
        
        meet2_start = now + timedelta(hours=2)
        meet2_end = now + timedelta(hours=3)
        
        print_step("6.1", "预约A: 10:00-11:00")
        visitor1 = self._create_visitor("延时测试者A", "延时公司", "13933334444", plate1)
        meeting1 = self._create_meeting(visitor1["id"], meet1_start, meet1_end)
        self._post(f"/api/meetings/{meeting1['id']}/approve", {"approve": True})
        resp = self._post("/api/parking-reservations", {
            "meeting_id": meeting1["id"],
            "source_record": "EXT-TEST-A"
        })
        res_a = resp.json()
        self.cleanup_ids["reservations"].append(res_a["id"])
        self._post(f"/api/parking-reservations/{res_a['id']}/confirm", {})
        spot_used = res_a["spot_id"]
        print_success(f"预约A成功: 车位={spot_used}")
        
        print_step("6.2", "预约B: 11:00-12:00（使用同一车位）")
        visitor2 = self._create_visitor("延时测试者B", "延时公司", "13944445555", plate2)
        meeting2 = self._create_meeting(visitor2["id"], meet2_start, meet2_end)
        self._post(f"/api/meetings/{meeting2['id']}/approve", {"approve": True})
        resp = self._post("/api/parking-reservations", {
            "meeting_id": meeting2["id"],
            "source_record": "EXT-TEST-B"
        })
        res_b = resp.json()
        self.cleanup_ids["reservations"].append(res_b["id"])
        print_success(f"预约B成功: 车位={res_b['spot_id']}")
        
        print_step("6.3", "A尝试延时30分钟 - 应被B预约占用而拒绝")
        resp = self._post(f"/api/parking-reservations/{res_a['id']}/extend", {
            "reservation_id": res_a["id"],
            "minutes": 30,
            "reason": "会议延长"
        })
        if resp.status_code == 400:
            data = resp.json()
            if data.get("code") == "EXTENSION_CONFLICT":
                print_success(f"正确拦截冲突延时: {data['error']}")
                print(f"    详情: 后续预约已占用该车位")
            else:
                print_error(f"错误码不匹配: {data.get('code')}")
        else:
            print_error("应拦截但未拦截", resp)
        
        print_step("6.4", "取消B的预约，再尝试延时")
        self._post(f"/api/parking-reservations/{res_b['id']}/cancel", {})
        
        resp = self._post(f"/api/parking-reservations/{res_a['id']}/extend", {
            "reservation_id": res_a["id"],
            "minutes": 30,
            "reason": "会议延长"
        })
        if resp.status_code == 200:
            updated = resp.json()
            print_success(f"延时成功: 预约状态={updated['status']}, 新结束时间={updated['scheduled_end']}")
        else:
            print_error("延时期望成功但失败", resp)
        
        return True

    def test_7_dashboard(self):
        print_header("测试 7: 看板与报表")
        
        print_step("7.1", "获取总览看板")
        resp = self._get("/api/reports/dashboard")
        if resp.status_code == 200:
            dashboard = resp.json()
            print_success(f"看板数据获取成功")
            print(f"    日期: {dashboard['date']}")
            print(f"    车位总数: {dashboard['overview']['total_spots']}")
            print(f"    当前使用率: {dashboard['overview']['utilization_rate'] * 100:.1f}%")
            print(f"    今日预约数: {dashboard['today_stats']['total']}")
            print(f"    今日延时数: {dashboard['today_stats']['extensions']}")
            print(f"    活跃预约数: {len(dashboard['active_reservations'])}")
            return True
        else:
            print_error("看板获取失败", resp)
            return False

    def run_all(self):
        print("="*60)
        print("  园区访客车位预约 API - 完整测试套件")
        print("="*60)
        
        try:
            results = []
            
            results.append(("初始化车位", self.test_1_initialize_spots()))
            results.append(("完整业务流程", self.test_2_normal_flow()))
            results.append(("重复提交", self.test_3_duplicate_submission()))
            results.append(("状态冲突", self.test_4_status_conflicts()))
            results.append(("来源记录缺失", self.test_5_missing_source_record()))
            results.append(("延时冲突", self.test_6_extension_conflict()))
            results.append(("看板报表", self.test_7_dashboard()))
            
            print("\n" + "="*60)
            print("  测试结果汇总")
            print("="*60)
            
            passed = 0
            failed = 0
            for name, result in results:
                status = "✓ 通过" if result else "✗ 失败"
                print(f"  {name}: {status}")
                if result:
                    passed += 1
                else:
                    failed += 1
            
            print(f"\n  总计: {passed} 通过, {failed} 失败")
            print("="*60)
            
            return failed == 0
            
        finally:
            self.close()


if __name__ == "__main__":
    print("请确保API服务已启动: uvicorn app.main:app --reload\n")
    
    test = ParkingAPITest()
    success = test.run_all()
    sys.exit(0 if success else 1)
