from .models import Point, Street, Complaint, PointType
from .store import DataStore
from .boundary import BoundaryChecker


def create_demo_streets() -> list:
    streets = [
        Street(
            id="ST-001",
            name="和平街道",
            color="#3498db",
            boundary=[
                (116.395, 39.905),
                (116.405, 39.905),
                (116.405, 39.915),
                (116.395, 39.915)
            ]
        ),
        Street(
            id="ST-002",
            name="建设街道",
            color="#e74c3c",
            boundary=[
                (116.405, 39.905),
                (116.415, 39.905),
                (116.415, 39.915),
                (116.405, 39.915)
            ]
        ),
        Street(
            id="ST-003",
            name="胜利街道",
            color="#2ecc71",
            boundary=[
                (116.395, 39.915),
                (116.405, 39.915),
                (116.405, 39.925),
                (116.395, 39.925)
            ]
        )
    ]
    return streets


def create_demo_points() -> list:
    return [
        Point(
            id="P-001",
            name="人民公园公厕",
            lng=116.398,
            lat=39.908,
            address="和平街道人民公园东门",
            point_type=PointType.NORMAL
        ),
        Point(
            id="P-002",
            name="夜市路口公厕",
            lng=116.405,
            lat=39.910,
            address="和平街道与建设街道交界处夜市路口",
            point_type=PointType.NIGHT_SAMPLING
        ),
        Point(
            id="P-003",
            name="火车站广场公厕",
            lng=116.410,
            lat=39.908,
            address="建设街道火车站西广场",
            point_type=PointType.NORMAL
        ),
        Point(
            id="P-004",
            name="老街社区公厕",
            lng=116.400,
            lat=39.920,
            address="胜利街道老街社区12号",
            point_type=PointType.NORMAL
        ),
        Point(
            id="P-005",
            name="三岔口公厕",
            lng=116.405,
            lat=39.915,
            address="和平、建设、胜利三街道交界三岔口",
            point_type=PointType.NIGHT_SAMPLING
        )
    ]


def create_demo_complaints() -> list:
    return [
        Complaint(
            id="C-001",
            complaint_no="TS-2026-0528-001",
            point_id="P-002",
            description="夜间人流量大，公厕异味严重，蚊虫多",
            reporter="李先生",
            report_date="2026-05-28",
            source="12345热线"
        ),
        Complaint(
            id="C-002",
            complaint_no="TS-2026-0603-015",
            point_id="P-005",
            description="三岔口公厕夜间照明损坏，存在安全隐患",
            reporter="张阿姨",
            report_date="2026-06-03",
            source="社区登记"
        )
    ]


def setup_demo_data(store: DataStore = None):
    if store is None:
        store = DataStore()

    store.clear_all()

    streets = create_demo_streets()
    for s in streets:
        store.save_street(s)

    points = create_demo_points()
    for p in points:
        store.save_point(p)

    checker = BoundaryChecker(streets)
    processed = checker.process_all_points(points)
    for p in processed:
        store.save_point(p)

    complaints = create_demo_complaints()
    for c in complaints:
        store.save_complaint(c)

    point_p002 = store.get_point("P-002")
    complaint_p002 = store.get_complaint("C-001")
    point_p002.add_complaint(complaint_p002)
    point_p002.manual_fix("社区书记周姐", "已协调物业增加夜间消杀频次")
    store.save_point(point_p002)

    point_p005 = store.get_point("P-005")
    point_p005.re_run("复核员小王")
    store.save_point(point_p005)

    return store
