import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
SCHEMES_DIR = os.path.join(BASE_DIR, 'schemes')
EXPORTS_DIR = os.path.join(BASE_DIR, 'exports')

for d in [DATA_DIR, SCHEMES_DIR, EXPORTS_DIR]:
    os.makedirs(d, exist_ok=True)

SERVICE_RADIUS = {
    'school_primary': 500,
    'school_secondary': 1000,
    'kindergarten': 300,
    'elderly': 800,
    'park': 500,
    'market': 500,
    'bus_stop': 300,
    'community_center': 800
}

LAND_USE_TYPES = {
    'R': '居住用地',
    'R2': '二类居住用地',
    'R3': '三类居住用地',
    'A': '公共管理与公共服务设施用地',
    'A3': '教育科研用地',
    'A5': '医疗卫生用地',
    'A6': '社会福利用地',
    'B': '商业服务业设施用地',
    'B1': '商业用地',
    'B2': '商务用地',
    'G': '绿地与广场用地',
    'G1': '公园绿地',
    'S': '道路与交通设施用地',
    'S4': '交通场站用地',
    'M': '工业用地'
}

POPULATION_DENSITY = {
    'R': 100,
    'R2': 80,
    'R3': 120
}

DEMAND_PER_1000_PEOPLE = {
    'school_primary': 40,
    'school_secondary': 30,
    'kindergarten': 30,
    'elderly': 50,
    'park': 2.0,
    'market': 1.0,
    'bus_stop': 1.0
}
