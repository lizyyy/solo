"""
核心计算模块 - 海洋牧场时序回放
实现经纬度标准化、云遮挡筛选、生物量反演、晚到附件合并
"""

import re
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Tuple
from datetime import datetime
import json
import copy


def normalize_coord_str(lat_str: str, lon_str: str) -> Dict:
    """
    经纬度字符串标准化：支持度分秒、度分、十进制度三种格式
    返回标准化后的十进制度值以及原始字符串
    """
    def parse(s: str, is_lat: bool) -> float:
        s = s.strip().upper()
        hemi = ['N', 'S'] if is_lat else ['E', 'W']
        sign = 1
        for h in hemi:
            if s.endswith(h):
                sign = 1 if (h == 'N' or h == 'E') else -1
                s = s[:-1].strip()
                break
        if '"' in s:
            deg_part, rest = s.split('°')
            min_part, sec_part = rest.split("'")
            deg = float(deg_part)
            m = float(min_part)
            sec = float(sec_part.replace('"', ''))
            return sign * (deg + m / 60 + sec / 3600)
        elif "'" in s:
            deg_part, min_part = s.split('°')
            deg = float(deg_part)
            m = float(min_part.replace("'", ''))
            return sign * (deg + m / 60)
        else:
            return sign * float(s.replace('°', ''))

    lat = parse(lat_str, True)
    lon = parse(lon_str, False)

    # 检测原始格式
    original_format = 'decimal'
    if '"' in lat_str:
        original_format = 'dms'
    elif "'" in lat_str:
        original_format = 'dm'

    return {
        'lat': round(lat, 6),
        'lon': round(lon, 6),
        'original_lat': lat_str,
        'original_lon': lon_str,
        'source_format': original_format
    }


def format_name_for_coord(fmt: str) -> str:
    return {'dms': '度分秒', 'decimal': '十进制度', 'dm': '度分'}.get(fmt, fmt)


def detect_coord_format(lat_str: str) -> str:
    s = lat_str.strip()
    if '"' in s:
        return 'dms'
    elif "'" in s:
        return 'dm'
    else:
        return 'decimal'


@dataclass
class LabResult:
    id: str
    sample_id: str
    site_name: str
    original_lat: str
    original_lon: str
    biomass: float
    sample_date: str
    source_format: str = ''
    is_late_arrival: bool = False
    late_note: str = ''
    normalized: Optional[Dict] = None
    manual_fix: Optional[Dict] = None

    def __post_init__(self):
        if not self.source_format:
            self.source_format = detect_coord_format(self.original_lat)
        if self.normalized is None:
            self.normalized = normalize_coord_str(self.original_lat, self.original_lon)
        if self.manual_fix:
            # 如果有人工修正，覆盖标准化结果
            if 'lat' in self.manual_fix:
                self.normalized['lat'] = float(self.manual_fix['lat'])
                self.normalized['manual_fix_applied'] = True
            if 'lon' in self.manual_fix:
                self.normalized['lon'] = float(self.manual_fix['lon'])
                self.normalized['manual_fix_applied'] = True


@dataclass
class CloudRecord:
    id: str
    scene_id: str
    cloud_percent: float
    date: str
    reason: str
    excluded: bool = True
    manual_override: Optional[str] = None  # 'include' / 'exclude' / None

    def to_dict(self):
        d = asdict(self)
        return d


@dataclass
class LateAttachment:
    id: str
    file_name: str
    received_at: str
    processed_step: str
    reason: str
    sample_count: int
    content: str
    lab_results: List[str] = field(default_factory=list)


@dataclass
class StepParam:
    data_source: str = 'Sentinel-2 L2A'
    cloud_threshold: float = 20.0
    biomass_model: str = 'NDVI 线性回归 v3.2'
    coord_system: str = 'WGS84'
    include_anomaly: bool = False


@dataclass
class Step:
    id: str
    name: str
    status: str = 'done'
    start_time: str = ''
    end_time: str = ''
    inputs: List[str] = field(default_factory=list)
    outputs: List[str] = field(default_factory=list)
    param_snapshot: Dict = field(default_factory=dict)
    anomalies: List[Dict] = field(default_factory=list)
    coord_issues: List[Dict] = field(default_factory=list)
    late_arrival: Optional[Dict] = None
    diff_from_base: Dict = field(default_factory=dict)
    manual_fixes: List[Dict] = field(default_factory=list)


@dataclass
class Run:
    id: str
    name: str
    date: str
    operator: str
    status: str = 'completed'
    remark: str = ''
    base_run_id: Optional[str] = None
    params: StepParam = field(default_factory=StepParam)
    steps: List[Step] = field(default_factory=list)
    lab_results: List[LabResult] = field(default_factory=list)
    cloud_records: List[CloudRecord] = field(default_factory=list)
    late_attachments: List[LateAttachment] = field(default_factory=list)
    manual_corrections: List[Dict] = field(default_factory=list)
    computed_summary: Dict = field(default_factory=dict)
    calc_diff_from_base: Dict = field(default_factory=dict)

    def to_dict(self) -> Dict:
        d = {
            'id': self.id,
            'name': self.name,
            'date': self.date,
            'operator': self.operator,
            'status': self.status,
            'remark': self.remark,
            'baseRunId': self.base_run_id,
            'params': asdict(self.params),
            'steps': [
                {
                    'id': s.id,
                    'name': s.name,
                    'status': s.status,
                    'startTime': s.start_time,
                    'endTime': s.end_time,
                    'inputs': s.inputs,
                    'outputs': s.outputs,
                    'paramSnapshot': s.param_snapshot,
                    'anomalies': s.anomalies,
                    'coordIssues': s.coord_issues,
                    'lateArrival': s.late_arrival,
                    'diffFromBase': s.diff_from_base,
                    'manualFixes': s.manual_fixes,
                }
                for s in self.steps
            ],
            'labResults': [
                {
                    'id': lr.id,
                    'sampleId': lr.sample_id,
                    'siteName': lr.site_name,
                    'originalLat': lr.original_lat,
                    'originalLon': lr.original_lon,
                    'biomass': lr.biomass,
                    'sampleDate': lr.sample_date,
                    'sourceFormat': lr.source_format,
                    'isLateArrival': lr.is_late_arrival,
                    'lateNote': lr.late_note,
                    'normalized': lr.normalized,
                    'manualFix': lr.manual_fix
                }
                for lr in self.lab_results
            ],
            'cloudRecords': [cr.to_dict() for cr in self.cloud_records],
            'lateAttachments': [asdict(la) for la in self.late_attachments],
            'manualCorrections': self.manual_corrections,
            'computedSummary': self.computed_summary,
            'calcDiffFromBase': self.calc_diff_from_base
        }
        return d


# ==================== 样例数据初始化 ====================

def build_sample_run_v1() -> Run:
    """第1次跑：基准版"""
    params = StepParam(
        data_source='Sentinel-2 L2A',
        cloud_threshold=20.0,
        biomass_model='NDVI 线性回归 v3.2',
        coord_system='WGS84',
        include_anomaly=False
    )

    lab_results = [
        LabResult('lab-001', 'SD-2026-042', '桑沟湾示范区',
                  "37°28'45\"N", "122°45'30\"E", 1285.6, '2026-05-12'),
        LabResult('lab-002', 'SD-2026-043', '崆峒岛监测点',
                  '37.4792', '122.7583', 956.3, '2026-05-13'),
        LabResult('lab-003', 'SD-2026-044', '养马岛对照区',
                  "37°28.75'", "122°45.5'", 1402.1, '2026-05-14'),
    ]

    cloud_records = [
        CloudRecord('c-001', 'S2A_MSIL2A_20260415T024551', 35, '2026-04-15', '层积云覆盖超过阈值'),
        CloudRecord('c-002', 'S2A_MSIL2A_20260425T024549', 58, '2026-04-25', '积云团覆盖研究区'),
        CloudRecord('c-003', 'S2B_MSIL2A_20260505T024609', 22, '2026-05-05', '薄云+薄雾，接近阈值'),
    ]

    steps = [
        Step('step-1', '数据导入',
             start_time='09:30:00', end_time='09:32:15',
             inputs=['原始影像清单_202606.xlsx'],
             outputs=['影像元数据表_v1.csv'],
             param_snapshot={'sourceCount': 48, 'dateRange': '2026-04-01 ~ 2026-06-10'}),
        Step('step-2', '云检测与筛选',
             start_time='09:32:20', end_time='09:35:48',
             inputs=['影像元数据表_v1.csv'],
             outputs=['无云影像清单.csv'],
             param_snapshot={'cloudThreshold': 20, 'keepPartial': True},
             anomalies=[{'type': 'cloud_cover', 'level': 'warn', 'count': 3,
                         'desc': '云量>20%，已从正常结果中剔除'}]),
        Step('step-3', '经纬度标准化',
             start_time='09:35:50', end_time='09:36:30',
             inputs=['无云影像清单.csv', '实验室结果表_v1.xlsx'],
             outputs=['坐标标准化对照表.csv'],
             param_snapshot={'targetFormat': '十进制度', 'targetDatum': 'WGS84'},
             coord_issues=[
                 {'originalLat': "37°28'45\"N", 'originalLon': "122°45'30\"E", 'note': '度分秒格式'},
                 {'originalLat': '37.4792', 'originalLon': '122.7583', 'note': '十进制度格式'},
                 {'originalLat': "37°28.75'", 'originalLon': "122°45.5'", 'note': '度分格式'},
             ]),
        Step('step-4', '生物量反演',
             start_time='09:36:35', end_time='09:42:10',
             inputs=['坐标标准化对照表.csv'],
             outputs=['生物量反演结果_v1.shp'],
             param_snapshot={'model': 'NDVI 线性回归 v3.2', 'resolution': '10m'}),
        Step('step-5', '结果汇总导出',
             start_time='09:42:15', end_time='09:45:00',
             inputs=['生物量反演结果_v1.shp'],
             outputs=['海洋牧场时序报告_20260615_v1.pdf'],
             param_snapshot={'format': 'PDF + Shapefile', 'includeAnomaly': False}),
    ]

    run = Run(
        id='run-2026-06-15-v1',
        name='2026-06-15 第1次跑（基准）',
        date='2026-06-15 09:30',
        operator='小林',
        remark='',
        params=params,
        steps=steps,
        lab_results=lab_results,
        cloud_records=cloud_records,
        late_attachments=[]
    )
    return run


def build_sample_run_v2(base_run: Run) -> Run:
    """第2次跑：补晚到附件"""
    params = StepParam(**asdict(base_run.params))

    late_lab = LabResult(
        'lab-004', 'SD-2026-047', '镆铘岛新增点',
        "37°30'12.5\"N", "122°42'18\"E", 1105.8, '2026-05-20',
        is_late_arrival=True, late_note='样品寄送延迟，6月16日晚到'
    )

    lab_results = [copy.deepcopy(lr) for lr in base_run.lab_results] + [late_lab]

    late_attachment = LateAttachment(
        id='late-001',
        file_name='晚到实验室数据_0520.xlsx',
        received_at='2026-06-16 17:45',
        processed_step='step-3',
        reason='样品寄送延迟',
        sample_count=1,
        content='SD-2026-047 镆铘岛新增点 生物量及坐标数据',
        lab_results=['SD-2026-047']
    )

    steps = copy.deepcopy(base_run.steps)
    for s in steps:
        s.diff_from_base = {}

    steps[0].inputs.append('晚到实验室数据_0520.xlsx')
    steps[0].outputs = ['影像元数据表_v2.csv']
    steps[0].param_snapshot['sourceCount'] = 49
    steps[0].diff_from_base = {'sourceCount': '48 → 49 (+1)'}

    steps[2].inputs = ['无云影像清单.csv', '实验室结果表_v2.xlsx']
    steps[2].outputs = ['坐标标准化对照表_v2.csv']
    steps[2].coord_issues.append({
        'originalLat': "37°30'12.5\"N", 'originalLon': "122°42'18\"E",
        'note': '晚到数据，度分秒格式'
    })
    steps[2].diff_from_base = {'coordIssues': '3 → 4 (+1 条，晚到样品)'}

    steps[3].inputs = ['坐标标准化对照表_v2.csv']
    steps[3].outputs = ['生物量反演结果_v2.shp']
    steps[3].late_arrival = {
        'attachment': late_attachment.file_name,
        'receivedAt': late_attachment.received_at,
        'processedIn': 'step-3 经纬度标准化',
        'reason': late_attachment.reason + '，5月20日采样 6月16日才收到数据',
        'affected': ['SD-2026-047']
    }
    steps[3].diff_from_base = {
        'sampleCount': '3 → 4 (+1)',
        'outputVersion': 'v1 → v2'
    }

    steps[4].inputs = ['生物量反演结果_v2.shp']
    steps[4].outputs = ['海洋牧场时序报告_20260617_v2.pdf']
    steps[4].param_snapshot['includeAnomaly'] = True
    steps[4].diff_from_base = {
        'includeAnomaly': 'false → true',
        'outputFile': 'v1 → v2'
    }
    params.include_anomaly = True

    run = Run(
        id='run-2026-06-17-v2',
        name='2026-06-17 第2次跑（补晚到附件）',
        date='2026-06-17 14:20',
        operator='小林',
        remark='补充 5月20日晚到的实验室样品 SD-2026-047',
        base_run_id=base_run.id,
        params=params,
        steps=steps,
        lab_results=lab_results,
        cloud_records=[copy.deepcopy(cr) for cr in base_run.cloud_records],
        late_attachments=[late_attachment]
    )
    return run


def build_sample_run_v3(base_run: Run) -> Run:
    """第3次跑：调云阈值+补备注"""
    params = StepParam(**asdict(base_run.params))
    params.cloud_threshold = 25.0

    # 云阈值放宽后，c-003 (22%) 从剔除变纳入
    cloud_records = [copy.deepcopy(cr) for cr in base_run.cloud_records]
    for cr in cloud_records:
        if cr.cloud_percent <= params.cloud_threshold:
            cr.excluded = False
            cr.manual_override = None
    excluded_count = sum(1 for cr in cloud_records if cr.excluded)

    steps = copy.deepcopy(base_run.steps)
    for s in steps:
        s.diff_from_base = {}

    # step-2 云检测变化
    steps[1].param_snapshot['cloudThreshold'] = 25
    steps[1].outputs = ['无云影像清单_v3.csv']
    steps[1].anomalies = [{
        'type': 'cloud_cover', 'level': 'warn',
        'count': excluded_count,
        'desc': f'云量>25%，已从正常结果中剔除'
    }]
    steps[1].diff_from_base = {
        'cloudThreshold': '20 → 25',
        'filteredOut': '3 → 2 景',
        'note': '阈值放宽，1 景薄云数据（S2B_20260505，云量22%）纳入正常结果'
    }

    # step-3 输入来源变更
    steps[2].inputs = ['无云影像清单_v3.csv', '实验室结果表_v2.xlsx']

    # step-4 输入变化
    steps[3].inputs = ['坐标标准化对照表_v2.csv', '无云影像清单_v3.csv']
    steps[3].outputs = ['生物量反演结果_v3.shp']
    steps[3].diff_from_base = {
        'inputScenes': '+1 景（薄云纳入）',
        'outputVersion': 'v2 → v3'
    }

    # step-5
    steps[4].inputs = ['生物量反演结果_v3.shp']
    steps[4].outputs = ['海洋牧场时序报告_20260618_v3.pdf']
    steps[4].param_snapshot['includeAnomaly'] = True
    steps[4].param_snapshot['remark'] = '云阈值调至25%，纳入薄云数据'
    steps[4].diff_from_base = {
        'outputFile': 'v2 → v3',
        'remark': '新增备注字段'
    }

    run = Run(
        id='run-2026-06-18-v3',
        name='2026-06-18 第3次跑（调云阈值+补备注）',
        date='2026-06-18 10:15',
        operator='小林',
        remark='云阈值从 20% 调到 25%，补全备注字段后重跑',
        base_run_id=base_run.id,
        params=params,
        steps=steps,
        lab_results=[copy.deepcopy(lr) for lr in base_run.lab_results],
        cloud_records=cloud_records,
        late_attachments=copy.deepcopy(base_run.late_attachments)
    )
    return run


# ==================== 核心计算引擎 ====================

class OceanRanchCalculator:
    """时序回放计算引擎"""

    def __init__(self):
        self.runs: Dict[str, Run] = {}
        self._init_sample_data()

    def _init_sample_data(self):
        r1 = build_sample_run_v1()
        self._fill_computed_summary(r1)
        self.runs[r1.id] = r1

        r2 = build_sample_run_v2(r1)
        self._fill_computed_summary(r2)
        self._fill_calc_diff(r2, r1)
        self.runs[r2.id] = r2

        r3 = build_sample_run_v3(r2)
        self._fill_computed_summary(r3)
        self._fill_calc_diff(r3, r2)
        self.runs[r3.id] = r3

    # ---- 经纬度标准化（受人工修正影响） ----
    def _normalize_lab_results(self, run: Run) -> List[Dict]:
        cleaned = []
        for lr in run.lab_results:
            # 基础标准化
            base = normalize_coord_str(lr.original_lat, lr.original_lon)
            base['sample_id'] = lr.sample_id
            base['site_name'] = lr.site_name
            base['source_format_name'] = format_name_for_coord(lr.source_format)

            # 应用人工修正
            if lr.manual_fix:
                base['before_manual_fix'] = {
                    'lat': base['lat'],
                    'lon': base['lon']
                }
                if 'lat' in lr.manual_fix:
                    base['lat'] = float(lr.manual_fix['lat'])
                    base['manual_fix_lat'] = True
                if 'lon' in lr.manual_fix:
                    base['lon'] = float(lr.manual_fix['lon'])
                    base['manual_fix_lon'] = True
                base['has_manual_fix'] = True
                base['manual_fix_note'] = lr.manual_fix.get('note', '')
            else:
                base['has_manual_fix'] = False

            cleaned.append(base)
        return cleaned

    # ---- 云遮挡筛选（受阈值和人工 override 影响） ----
    def _filter_cloud_records(self, run: Run) -> Dict:
        threshold = run.params.cloud_threshold
        excluded = []
        included = []

        for cr in run.cloud_records:
            # 先看人工 override
            if cr.manual_override == 'include':
                included.append(cr.to_dict())
            elif cr.manual_override == 'exclude':
                excluded.append(cr.to_dict())
            else:
                if cr.cloud_percent > threshold:
                    excluded.append(cr.to_dict())
                else:
                    included.append(cr.to_dict())

        return {
            'threshold': threshold,
            'excluded': excluded,
            'included': included,
            'excluded_count': len(excluded),
            'included_count': len(included),
            'total_scenes': len(excluded) + len(included)
        }

    # ---- 生物量反演（受数据点数量、纳入云景数影响） ----
    def _calc_biomass(self, run: Run, cleaned_coords: List[Dict],
                      cloud_filter: Dict) -> Dict:
        # 基础样本数
        sample_count = len(run.lab_results)
        late_count = sum(1 for lr in run.lab_results if lr.is_late_arrival)

        # 基础平均
        raw_avg = sum(lr.biomass for lr in run.lab_results) / sample_count if sample_count else 0

        # 云纳入景数影响系数：纳入越多，置信度越高，均值微调
        included_cloud = cloud_filter['included_count']
        total_cloud = cloud_filter['total_scenes'] or 1
        cloud_factor = 1.0 + (included_cloud / total_cloud) * 0.02

        # 人工修正影响：每有一个人工修正，标记为"人工介入"，置信度-1%
        manual_fix_count = sum(1 for c in cleaned_coords if c.get('has_manual_fix'))
        manual_factor = 1.0 - manual_fix_count * 0.01

        adjusted_avg = round(raw_avg * cloud_factor * manual_factor, 2)
        total_biomass = round(adjusted_avg * sample_count, 2)

        # 样本极值
        max_b = max((lr.biomass for lr in run.lab_results), default=0)
        min_b = min((lr.biomass for lr in run.lab_results), default=0)
        max_site = next((lr.site_name for lr in run.lab_results if lr.biomass == max_b), '')
        min_site = next((lr.site_name for lr in run.lab_results if lr.biomass == min_b), '')

        return {
            'sample_count': sample_count,
            'late_count': late_count,
            'manual_fix_count': manual_fix_count,
            'raw_average_biomass': round(raw_avg, 2),
            'adjusted_average_biomass': adjusted_avg,
            'total_biomass': total_biomass,
            'max_biomass': max_b,
            'min_biomass': min_b,
            'max_site': max_site,
            'min_site': min_site,
            'cloud_factor_applied': round(cloud_factor, 4),
            'manual_factor_applied': round(manual_factor, 4),
            'valid_scenes': included_cloud,
            'excluded_scenes': cloud_filter['excluded_count']
        }

    # ---- 填充计算摘要 ----
    def _fill_computed_summary(self, run: Run):
        cleaned = self._normalize_lab_results(run)
        clouds = self._filter_cloud_records(run)
        biomass = self._calc_biomass(run, cleaned, clouds)

        run.computed_summary = {
            'coord_cleaned': cleaned,
            'cloud_filter': clouds,
            'biomass_result': biomass,
            'lab_count': len(run.lab_results),
            'cloud_count': len(run.cloud_records),
            'late_count': len(run.late_attachments),
            'generated_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }

    # ---- 与基准跑次的差异 ----
    def _fill_calc_diff(self, run: Run, base_run: Run):
        diff = {}

        s1 = run.computed_summary
        s2 = base_run.computed_summary

        # 生物量差异
        b1 = s1['biomass_result']
        b2 = s2['biomass_result']
        diff['biomass'] = {
            'sample_count': f"{b2['sample_count']} → {b1['sample_count']} ({'+' if b1['sample_count']-b2['sample_count']>=0 else ''}{b1['sample_count']-b2['sample_count']})",
            'avg_before': b2['adjusted_average_biomass'],
            'avg_after': b1['adjusted_average_biomass'],
            'avg_delta': round(b1['adjusted_average_biomass'] - b2['adjusted_average_biomass'], 2),
            'total_before': b2['total_biomass'],
            'total_after': b1['total_biomass'],
            'total_delta': round(b1['total_biomass'] - b2['total_biomass'], 2)
        }

        # 云筛选差异
        c1 = s1['cloud_filter']
        c2 = s2['cloud_filter']
        diff['cloud'] = {
            'threshold_before': c2['threshold'],
            'threshold_after': c1['threshold'],
            'excluded_before': c2['excluded_count'],
            'excluded_after': c1['excluded_count'],
            'delta_excluded': c1['excluded_count'] - c2['excluded_count']
        }

        # 坐标差异
        coord_changes = []
        for a, b in zip(s1['coord_cleaned'], s2['coord_cleaned']):
            if a.get('has_manual_fix'):
                coord_changes.append({
                    'sample_id': a['sample_id'],
                    'site': a['site_name'],
                    'note': '人工修正经纬度',
                    'before': a.get('before_manual_fix', {}),
                    'after': {'lat': a['lat'], 'lon': a['lon']}
                })
        if len(s1['coord_cleaned']) != len(s2['coord_cleaned']):
            diff['coord_new_samples'] = [
                c for c in s1['coord_cleaned'][len(s2['coord_cleaned']):]
            ]
        diff['coord_manual_fixes'] = coord_changes
        diff['coord_count'] = f"{len(s2['coord_cleaned'])} → {len(s1['coord_cleaned'])}"

        run.calc_diff_from_base = diff

    # ==================== 对外 API 方法 ====================

    def get_all_runs(self) -> List[Dict]:
        return [
            {
                'id': r.id,
                'name': r.name,
                'date': r.date,
                'operator': r.operator,
                'remark': r.remark,
                'baseRunId': r.base_run_id,
                'status': r.status,
                'summary': {
                    'labCount': r.computed_summary.get('lab_count', 0),
                    'cloudCount': r.computed_summary.get('cloud_count', 0),
                    'lateCount': r.computed_summary.get('late_count', 0),
                    'avgBiomass': r.computed_summary.get('biomass_result', {}).get('adjusted_average_biomass', 0)
                }
            }
            for r in self.runs.values()
        ]

    def get_run_detail(self, run_id: str) -> Optional[Dict]:
        run = self.runs.get(run_id)
        if not run:
            return None
        return run.to_dict()

    def get_base_run(self, run: Run) -> Optional[Run]:
        if run.base_run_id:
            return self.runs.get(run.base_run_id)
        return None

    def rerun_with_corrections(self, base_run_id: str, remark: str,
                               corrections: List[Dict],
                               param_overrides: Optional[Dict] = None) -> Dict:
        """
        根据修正记录重新计算跑次
        corrections 列表项支持：
          { 'type': 'coord', 'lab_id': 'lab-001', 'lat': 37.123, 'lon': 122.456, 'note': '...' }
          { 'type': 'cloud_override', 'cloud_id': 'c-003', 'action': 'include' | 'exclude', 'note': '...' }
          { 'type': 'cloud_threshold', 'value': 25, 'note': '...' }
          { 'type': 'add_late_lab', 'lab_data': {...} }
        param_overrides: 全局参数覆盖 { cloud_threshold, include_anomaly, ... }
        """
        base_run = self.runs.get(base_run_id)
        if not base_run:
            raise ValueError(f'基准跑次 {base_run_id} 不存在')

        # 深拷贝基础数据
        new_run = copy.deepcopy(base_run)

        # 生成新 ID
        new_run_num = len(self.runs) + 1
        today = datetime.now().strftime('%Y-%m-%d')
        now_str = datetime.now().strftime('%Y-%m-%d %H:%M')
        new_run.id = f'run-{today}-v{new_run_num}'
        new_run.name = f'{today} 第{new_run_num}次跑（补备注重跑）'
        new_run.date = now_str
        new_run.operator = '小林'
        new_run.remark = remark or base_run.remark
        new_run.base_run_id = base_run_id
        new_run.manual_corrections = corrections or []
        new_run.steps = copy.deepcopy(base_run.steps)
        for s in new_run.steps:
            s.diff_from_base = {}
            s.manual_fixes = []

        # 处理参数覆盖
        if param_overrides:
            old_thr = new_run.params.cloud_threshold
            if 'cloud_threshold' in param_overrides:
                new_run.params.cloud_threshold = float(param_overrides['cloud_threshold'])
            if 'include_anomaly' in param_overrides:
                new_run.params.include_anomaly = bool(param_overrides['include_anomaly'])

            # step-2 变化记录
            if 'cloud_threshold' in param_overrides and old_thr != new_run.params.cloud_threshold:
                new_run.steps[1].param_snapshot['cloudThreshold'] = new_run.params.cloud_threshold
                new_run.steps[1].diff_from_base['cloudThreshold'] = f'{old_thr} → {new_run.params.cloud_threshold}'

        # 应用每条修正
        for corr in corrections or []:
            ctype = corr.get('type')

            if ctype == 'coord':
                # 修正指定样品的经纬度
                lab_id = corr.get('lab_id')
                for lr in new_run.lab_results:
                    if lr.id == lab_id:
                        fix = {}
                        if 'lat' in corr:
                            fix['lat'] = corr['lat']
                        if 'lon' in corr:
                            fix['lon'] = corr['lon']
                        fix['note'] = corr.get('note', '')
                        lr.manual_fix = fix
                        # step-3 记录
                        new_run.steps[2].manual_fixes.append({
                            'sampleId': lr.sample_id,
                            'site': lr.site_name,
                            'fix': fix
                        })
                        if not new_run.steps[2].diff_from_base:
                            new_run.steps[2].diff_from_base = {}
                        new_run.steps[2].diff_from_base['manualCoordFix'] = f'{lr.sample_id} 人工修正坐标'
                        break

            elif ctype == 'cloud_override':
                # 人工指定云景是否纳入
                cloud_id = corr.get('cloud_id')
                action = corr.get('action')  # include / exclude
                for cr in new_run.cloud_records:
                    if cr.id == cloud_id:
                        cr.manual_override = action
                        # step-2 记录
                        new_run.steps[1].manual_fixes.append({
                            'sceneId': cr.scene_id,
                            'action': '纳入' if action == 'include' else '剔除',
                            'note': corr.get('note', '')
                        })
                        if not new_run.steps[1].diff_from_base:
                            new_run.steps[1].diff_from_base = {}
                        action_str = '纳入正常结果' if action == 'include' else '额外剔除'
                        new_run.steps[1].diff_from_base[f'manualCloud_{cr.id}'] = f'{cr.scene_id} 人工{action_str}'
                        break

            elif ctype == 'cloud_threshold':
                old_t = new_run.params.cloud_threshold
                new_t = float(corr.get('value', 20))
                new_run.params.cloud_threshold = new_t
                new_run.steps[1].param_snapshot['cloudThreshold'] = new_t
                new_run.steps[1].diff_from_base['cloudThreshold'] = f'{old_t} → {new_t}'

            elif ctype == 'add_late_lab':
                # 添加晚到样品数据
                lab_data = corr.get('lab_data', {})
                new_id = f'lab-{int(new_run.lab_results[-1].id.split("-")[1]) + 1:03d}' if new_run.lab_results else 'lab-001'
                new_lab = LabResult(
                    id=new_id,
                    sample_id=lab_data.get('sample_id', new_id.upper()),
                    site_name=lab_data.get('site_name', '新增点'),
                    original_lat=lab_data.get('original_lat', '37.0'),
                    original_lon=lab_data.get('original_lon', '122.0'),
                    biomass=float(lab_data.get('biomass', 1000)),
                    sample_date=lab_data.get('sample_date', today),
                    is_late_arrival=True,
                    late_note=corr.get('note', '晚到样品数据')
                )
                new_run.lab_results.append(new_lab)
                # step-3 记录
                new_run.steps[2].coord_issues.append({
                    'originalLat': new_lab.original_lat,
                    'originalLon': new_lab.original_lon,
                    'note': f'晚到样品新增 - {new_lab.site_name}'
                })
                if not new_run.steps[2].diff_from_base:
                    new_run.steps[2].diff_from_base = {}
                new_run.steps[2].diff_from_base['lateSampleAdded'] = f'+1 样品 {new_lab.sample_id}'

                # step-4 记录
                new_run.steps[3].late_arrival = {
                    'attachment': lab_data.get('source_file', '晚到数据(手动录入)'),
                    'receivedAt': now_str,
                    'processedIn': 'step-3 经纬度标准化',
                    'reason': corr.get('note', '人工录入晚到样品'),
                    'affected': [new_lab.sample_id]
                }
                new_run.steps[3].diff_from_base['lateSample'] = f'新增样品 {new_lab.sample_id}'

        # 最后一步：更新输出文件名
        for s in new_run.steps:
            s.manual_fixes = s.manual_fixes or []

        ver = f'v{new_run_num}'
        new_run.steps[4].outputs = [f'海洋牧场时序报告_{today.replace("-", "")}_{ver}.pdf']
        new_run.steps[4].param_snapshot['remark'] = remark or '重跑'
        if not new_run.steps[4].diff_from_base:
            new_run.steps[4].diff_from_base = {}
        new_run.steps[4].diff_from_base['outputFile'] = f'上一版 → {ver}'
        if remark:
            new_run.steps[4].diff_from_base['remark'] = remark

        # 重新计算结果摘要
        self._fill_computed_summary(new_run)

        # 与基准对比差异
        self._fill_calc_diff(new_run, base_run)

        # 保存
        self.runs[new_run.id] = new_run

        return {
            'newRun': new_run.to_dict(),
            'baseRun': base_run.to_dict(),
            'appliedCorrections': corrections or [],
            'summaryDiff': new_run.calc_diff_from_base
        }

    def generate_report(self, run_id: str, fmt: str = 'html') -> bytes:
        """
        生成导出报告
        fmt: 'html' | 'json' | 'csv'
        """
        run = self.runs.get(run_id)
        if not run:
            raise ValueError(f'跑次 {run_id} 不存在')

        d = run.to_dict()
        summary = run.computed_summary
        diff = run.calc_diff_from_base
        base_run = self.get_base_run(run)

        if fmt == 'json':
            report_data = {
                'reportType': '海洋牧场时序回放报告',
                'generatedAt': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'runInfo': {
                    'id': run.id, 'name': run.name, 'date': run.date,
                    'operator': run.operator, 'remark': run.remark,
                    'baseRunId': run.base_run_id,
                    'baseRunName': base_run.name if base_run else None
                },
                'inputParams': d['params'],
                'coordCleaning': {
                    'samples': summary['coord_cleaned'],
                    'formatStats': self._format_stats(run)
                },
                'cloudRecords': {
                    'filter': summary['cloud_filter'],
                    'records': d['cloudRecords']
                },
                'lateAttachments': d['lateAttachments'],
                'biomassResult': summary['biomass_result'],
                'manualCorrections': d['manualCorrections'],
                'diffFromBase': diff,
                'steps': d['steps']
            }
            return json.dumps(report_data, ensure_ascii=False, indent=2).encode('utf-8')

        elif fmt == 'csv':
            lines = []
            lines.append('海洋牧场时序回放报告')
            lines.append(f'生成时间,{datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
            lines.append(f'跑次,{run.name}')
            lines.append(f'操作人,{run.operator}')
            lines.append(f'备注,{run.remark or "(无)"}')
            lines.append('')
            lines.append('=== 输入参数 ===')
            for k, v in d['params'].items():
                lines.append(f'{k},{v}')
            lines.append('')
            lines.append('=== 经纬度清洗前后 ===')
            lines.append('样品ID,站点,原始纬度,原始经度,原始格式,标准化纬度,标准化经度,是否人工修正,修正说明')
            for c in summary['coord_cleaned']:
                mf = '是' if c.get('has_manual_fix') else '否'
                note = c.get('manual_fix_note', '')
                lines.append(
                    f"{c['sample_id']},{c['site_name']},{c['original_lat']},{c['original_lon']},"
                    f"{c['source_format_name']},{c['lat']},{c['lon']},{mf},{note}"
                )
            lines.append('')
            lines.append('=== 云遮挡记录（单独拎出） ===')
            lines.append('影像ID,日期,云量%,是否纳入正常结果,原因,人工覆盖')
            cf = summary['cloud_filter']
            all_cloud = cf['excluded'] + cf['included']
            excluded_ids = {r['id'] for r in cf['excluded']}
            for r in sorted(all_cloud, key=lambda x: x['date']):
                excluded = r['id'] in excluded_ids
                mo = {'include': '人工纳入', 'exclude': '人工剔除', None: '-'}.get(r.get('manual_override'), '-')
                lines.append(f"{r['scene_id']},{r['date']},{r['cloud_percent']}%,{'剔除' if excluded else '纳入'},{r['reason']},{mo}")
            lines.append(f"\n云量阈值,{cf['threshold']}%\n剔除景数,{cf['excluded_count']}\n纳入景数,{cf['included_count']}")
            lines.append('')
            lines.append('=== 晚到附件 ===')
            if d['lateAttachments']:
                lines.append('文件名,收到时间,处理环节,原因,影响样品数,内容')
                for la in d['lateAttachments']:
                    lines.append(f"{la['file_name']},{la['received_at']},{la['processed_step']},{la['reason']},{la['sample_count']},{la['content']}")
            else:
                lines.append('(无晚到附件)')
            lines.append('')
            lines.append('=== 生物量计算结果 ===')
            br = summary['biomass_result']
            lines.append(f"样品数,{br['sample_count']}")
            lines.append(f"晚到样品数,{br['late_count']}")
            lines.append(f"人工修正次数,{br['manual_fix_count']}")
            lines.append(f"原始平均(kg/ha),{br['raw_average_biomass']}")
            lines.append(f"校正后平均(kg/ha),{br['adjusted_average_biomass']}")
            lines.append(f"总生物量估计(kg),{br['total_biomass']}")
            lines.append(f"最高站点,{br['max_site']} ({br['max_biomass']})")
            lines.append(f"最低站点,{br['min_site']} ({br['min_biomass']})")
            lines.append(f"纳入影像数,{br['valid_scenes']} 景")
            lines.append(f"剔除影像数,{br['excluded_scenes']} 景")
            lines.append('')
            lines.append('=== 重算差异（与上一版对比） ===')
            if diff:
                bd = diff.get('biomass', {})
                if bd:
                    lines.append(f"平均生物量变化,{bd.get('avg_before')} → {bd.get('avg_after')} ({'+' if bd.get('avg_delta',0)>=0 else ''}{bd.get('avg_delta',0)})")
                    lines.append(f"总生物量变化,{bd.get('total_before')} → {bd.get('total_after')} ({'+' if bd.get('total_delta',0)>=0 else ''}{bd.get('total_delta',0)})")
                cd = diff.get('cloud', {})
                if cd:
                    lines.append(f"云阈值变化,{cd.get('threshold_before')} → {cd.get('threshold_after')}")
                    lines.append(f"剔除景数变化,{cd.get('excluded_before')} → {cd.get('excluded_after')} ({'+' if cd.get('delta_excluded',0)>=0 else ''}{cd.get('delta_excluded',0)})")
                if diff.get('coord_manual_fixes'):
                    lines.append(f"坐标人工修正,{len(diff['coord_manual_fixes'])} 条")
                if diff.get('coord_new_samples'):
                    lines.append(f"新增样品,{len(diff['coord_new_samples'])} 条")
            else:
                lines.append('(基准跑次，无对比)')
            lines.append('')
            lines.append('=== 人工修正记录 ===')
            if d['manualCorrections']:
                for i, mc in enumerate(d['manualCorrections'], 1):
                    lines.append(f'{i},{mc}')
            else:
                lines.append('(无人工修正)')
            lines.append('')
            lines.append('=== 重跑流程步骤 ===')
            lines.append('步骤,名称,输入文件,输出文件,关键参数快照,变化标记')
            for s in d['steps']:
                diffs = '; '.join(f'{k}={v}' for k, v in s.get('diffFromBase', {}).items()) if s.get('diffFromBase') else '-'
                ps = '; '.join(f'{k}={v}' for k, v in s.get('paramSnapshot', {}).items())
                lines.append(f"{s['id']},{s['name']},{'|'.join(s.get('inputs',[]))},{'|'.join(s.get('outputs',[]))},\"{ps}\",\"{diffs}\"")
            return '\n'.join(lines).encode('utf-8-sig')

        # === HTML 格式（默认） ===
        base_run_name = base_run.name if base_run else '（基准版）'
        html_parts = []
        html_parts.append('''<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<title>海洋牧场时序回放报告</title>
<style>
body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;margin:40px;color:#1f2937;line-height:1.6}
h1{color:#1e3a5f;border-bottom:3px solid #3b82f6;padding-bottom:10px}
h2{color:#1e40af;margin-top:28px;border-left:4px solid #3b82f6;padding-left:10px}
h3{color:#374151;margin-top:20px}
table{border-collapse:collapse;width:100%;margin:12px 0;font-size:13px}
th,td{border:1px solid #e5e7eb;padding:8px 12px;text-align:left}
th{background:#f1f5f9;color:#1e293b}
tr:nth-child(even){background:#f8fafc}
.info-box{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px;margin:12px 0}
.warn-box{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px;margin:12px 0}
.late-box{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px;margin:12px 0}
.diff-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px;margin:12px 0}
.tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;margin-left:6px}
.tag.dms{background:#fce7f3;color:#9d174d}
.tag.decimal{background:#dbeafe;color:#1e40af}
.tag.dm{background:#d1fae5;color:#065f46}
.tag.mf{background:#fef3c7;color:#92400e}
.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600}
.badge.exclude{background:#fee2e2;color:#991b1b}
.badge.include{background:#d1fae5;color:#065f46}
.meta-row{display:flex;gap:20px;flex-wrap:wrap;font-size:14px;color:#475569;margin:10px 0}
.meta-row span strong{color:#0f172a}
.bar{display:inline-block;width:80px;height:8px;background:#fee2e2;border-radius:4px;overflow:hidden;vertical-align:middle;margin-right:6px}
.bar span{display:block;height:100%;background:#ef4444}
.step-item{padding:10px 14px;margin:8px 0;background:#f8fafc;border-radius:6px;border-left:3px solid #94a3b8}
.step-item.diff{border-left-color:#f59e0b;background:#fffbeb}
.step-title{font-weight:600;color:#1e293b}
.step-meta{font-size:12px;color:#64748b}
.kv{display:flex;gap:8px}
.kv dt{font-weight:600;color:#475569;min-width:120px}
.kv dd{margin:0;color:#0f172a}
</style></head><body>''')

        html_parts.append(f'<h1>🌊 海洋牧场时序回放报告</h1>')
        html_parts.append(f'''<div class="info-box">
<h3>📋 跑次信息</h3>
<div class="meta-row">
<span><strong>跑次名称：</strong>{run.name}</span>
<span><strong>生成时间：</strong>{datetime.now().strftime("%Y-%m-%d %H:%M:%S")}</span>
<span><strong>操作人：</strong>{run.operator}</span>
<span><strong>基于版本：</strong>{base_run_name}</span>
</div>
{ run.remark and f'<p><strong>📝 备注：</strong>{run.remark}</p>'}
</div>''')

        # 输入参数
        html_parts.append('<h2>1️⃣ 输入参数</h2><dl class="kv">')
        pm = d['params']
        html_parts.append(f'<dt>数据源</dt><dd>{pm["data_source"]}</dd>')
        html_parts.append(f'<dt>云量阈值</dt><dd>{pm["cloud_threshold"]}%</dd>')
        html_parts.append(f'<dt>生物量模型</dt><dd>{pm["biomass_model"]}</dd>')
        html_parts.append(f'<dt>坐标系</dt><dd>{pm["coord_system"]}</dd>')
        html_parts.append(f'<dt>包含异常导出</dt><dd>{"是" if pm["include_anomaly"] else "否"}</dd>')
        html_parts.append('</dl>')

        # 经纬度清洗
        html_parts.append('<h2>2️⃣ 经纬度清洗前后对照</h2>')
        html_parts.append(f'<p>共 {len(summary["coord_cleaned"])} 条样品，以下为原始写法 → 标准化结果：</p>')
        html_parts.append('<table><thead><tr><th>样品ID</th><th>站点</th><th>原始纬度</th><th>原始经度</th><th>原始格式</th><th>标准化纬度</th><th>标准化经度</th><th>状态</th></tr></thead><tbody>')
        for c in summary['coord_cleaned']:
            fmt_tag = f'<span class="tag {c["source_format"]}">{c["source_format_name"]}</span>'
            mf_tag = ''
            status = '正常'
            if c.get('has_manual_fix'):
                mf_tag = f' <span class="tag mf">人工修正</span>'
                b4 = c.get('before_manual_fix', {})
                status = f'<div style="font-size:11px;color:#92400e">修正前: {b4.get("lat","")}, {b4.get("lon","")}</div>'
            if c.get('source_format') != 'decimal':
                status = f'<div style="font-size:11px;color:#6b7280">格式转换</div>' + (status if status != '正常' else '')
            html_parts.append(f'''<tr>
<td>{c['sample_id']}</td><td>{c['site_name']}</td>
<td><code>{c['original_lat']}</code></td><td><code>{c['original_lon']}</code></td>
<td>{fmt_tag}{mf_tag}</td>
<td><strong>{c['lat']}</strong></td><td><strong>{c['lon']}</strong></td>
<td>{status}</td></tr>''')
        html_parts.append('</tbody></table>')

        # 云遮挡
        html_parts.append('<h2>3️⃣ 云遮挡记录（已单独拎出）</h2>')
        cf = summary['cloud_filter']
        html_parts.append(f'''<div class="warn-box">
<p>当前云量阈值：<strong>{cf['threshold']}%</strong>，共 {cf['total_scenes']} 景影像</p>
<p>❌ 剔除（不进入正常计算）：<strong>{cf['excluded_count']} 景</strong> &nbsp;&nbsp;
✅ 纳入（参与反演）：<strong>{cf['included_count']} 景</strong></p>
</div>''')
        html_parts.append('<table><thead><tr><th>影像编号</th><th>日期</th><th>云量</th><th>处理结果</th><th>原因</th><th>人工覆盖</th></tr></thead><tbody>')
        excluded_ids = {r['id'] for r in cf['excluded']}
        all_cloud = sorted(d['cloudRecords'], key=lambda x: x['date'])
        for r in all_cloud:
            excluded = r['id'] in excluded_ids
            badge = f'<span class="badge {"exclude" if excluded else "include"}">{"剔除" if excluded else "纳入"}</span>'
            mo = r.get('manual_override')
            mo_text = {'include': '人工纳入 ✋', 'exclude': '人工剔除 ✋', None: '-'}.get(mo, '-')
            html_parts.append(f'''<tr>
<td><code>{r['scene_id']}</code></td>
<td>{r['date']}</td>
<td><div class="bar"><span style="width:{min(r['cloud_percent']*1.5, 100)}%"></span></div>{r['cloud_percent']}%</td>
<td>{badge}</td><td>{r['reason']}</td><td>{mo_text}</td></tr>''')
        html_parts.append('</tbody></table>')

        # 晚到附件
        html_parts.append('<h2>4️⃣ 晚到附件处理痕迹</h2>')
        if d['lateAttachments']:
            for la in d['lateAttachments']:
                html_parts.append(f'''<div class="late-box">
<h3>📎 {la['file_name']}</h3>
<dl class="kv">
<dt>收到时间</dt><dd>{la['received_at']}</dd>
<dt>处理环节</dt><dd>第 {la['processed_step'].replace('step-','')} 步 / 经纬度标准化阶段</dd>
<dt>原因</dt><dd>{la['reason']}</dd>
<dt>影响样品</dt><dd>{la['sample_count']} 条：{la['content']}</dd>
</dl></div>''')
        else:
            html_parts.append('<p>本次运行无晚到附件。</p>')

        # 生物量结果
        html_parts.append('<h2>5️⃣ 生物量计算结果</h2>')
        br = summary['biomass_result']
        html_parts.append(f'''<div class="info-box">
<table>
<tr><th>指标</th><th>数值</th><th>说明</th></tr>
<tr><td>有效样品数</td><td><strong>{br['sample_count']}</strong></td><td>含晚到 {br['late_count']} 条，人工修正 {br['manual_fix_count']} 条</td></tr>
<tr><td>原始平均生物量</td><td>{br['raw_average_biomass']} kg/ha</td><td>直接算术平均</td></tr>
<tr><td>校正后平均生物量</td><td><strong style="color:#1e40af;font-size:16px">{br['adjusted_average_biomass']} kg/ha</strong></td>
<td>云因子 ×{br['cloud_factor_applied']}，人工因子 ×{br['manual_factor_applied']}</td></tr>
<tr><td>总生物量估计</td><td><strong>{br['total_biomass']} kg</strong></td><td>校正平均 × 样品数</td></tr>
<tr><td>最高站点</td><td>{br['max_site']} ({br['max_biomass']})</td><td></td></tr>
<tr><td>最低站点</td><td>{br['min_site']} ({br['min_biomass']})</td><td></td></tr>
<tr><td>有效/剔除影像</td><td>{br['valid_scenes']} / {br['excluded_scenes']} 景</td><td></td></tr>
</table></div>''')

        # 差异对比
        html_parts.append('<h2>6️⃣ 重算差异（与上一版对比）</h2>')
        if diff:
            html_parts.append('<div class="diff-box">')
            bd = diff.get('biomass', {})
            if bd:
                html_parts.append(f'''<h3>📊 生物量差异</h3>
<ul>
<li>平均生物量：{bd.get('avg_before')} → <strong>{bd.get('avg_after')}</strong>
（变化：<span style="color:{"#16a34a" if bd.get("avg_delta",0)>=0 else "#dc2626"}">{'+' if bd.get('avg_delta',0)>=0 else ''}{bd.get('avg_delta',0)}</span>）</li>
<li>总生物量：{bd.get('total_before')} → <strong>{bd.get('total_after')}</strong>
（变化：<span style="color:{"#16a34a" if bd.get("total_delta",0)>=0 else "#dc2626"}">{'+' if bd.get('total_delta',0)>=0 else ''}{bd.get('total_delta',0)}</span>）</li>
<li>样品数变化：{bd.get('sample_count')}</li>
</ul>''')
            cd = diff.get('cloud', {})
            if cd:
                html_parts.append(f'''<h3>☁️ 云筛选差异</h3>
<ul>
<li>云量阈值：{cd.get('threshold_before')}% → <strong>{cd.get('threshold_after')}%</strong></li>
<li>剔除景数：{cd.get('excluded_before')} → {cd.get('excluded_after')}
（变化 {('+' if cd.get('delta_excluded',0)>=0 else '') + str(cd.get('delta_excluded',0))}）</li>
</ul>''')
            if diff.get('coord_manual_fixes'):
                html_parts.append('<h3>📍 坐标人工修正</h3><ul>')
                for cf_item in diff['coord_manual_fixes']:
                    b = cf_item.get('before', {})
                    a = cf_item.get('after', {})
                    html_parts.append(f"<li>{cf_item['site']} ({cf_item['sample_id']})：{b.get('lat','')},{b.get('lon','')} → <strong>{a.get('lat','')},{a.get('lon','')}</strong></li>")
                html_parts.append('</ul>')
            if diff.get('coord_new_samples'):
                html_parts.append('<h3>➕ 新增样品</h3><ul>')
                for ns in diff['coord_new_samples']:
                    html_parts.append(f"<li>{ns['site_name']} ({ns['sample_id']})，生物量 {ns.get('biomass','?')} kg/ha</li>")
                html_parts.append('</ul>')
            html_parts.append('</div>')
        else:
            html_parts.append('<p>本版为基准跑次，无对比版本。</p>')

        # 人工修正记录
        html_parts.append('<h2>7️⃣ 人工修正与备注记录</h2>')
        if d['manualCorrections']:
            html_parts.append('<ol style="line-height:1.8">')
            type_label = {
                'coord': '📍坐标修正',
                'cloud_override': '☁️云量人工覆盖',
                'cloud_threshold': '⚙️云阈值调整',
                'add_late_lab': '📦新增晚到样品'
            }
            for i, mc in enumerate(d['manualCorrections'], 1):
                t = mc.get('type', 'unknown')
                label = type_label.get(t, t)
                detail_parts = []
                if t == 'coord':
                    detail_parts.append(f"样品={mc.get('lab_id','')} → ({mc.get('lat','')}, {mc.get('lon','')})")
                elif t == 'cloud_override':
                    action_txt = '人工纳入' if mc.get('action') == 'include' else '人工剔除'
                    detail_parts.append(f"云记录={mc.get('cloud_id','')} → {action_txt}")
                elif t == 'cloud_threshold':
                    detail_parts.append(f"新阈值={mc.get('value','')}%")
                elif t == 'add_late_lab':
                    ld = mc.get('lab_data') or {}
                    detail_parts.append(f"样品={ld.get('sampleId', ld.get('sample_id',''))}, 生物量={ld.get('biomass','')}")
                note = mc.get('note', '')
                if note:
                    detail_parts.append(f"<em>「{note}」</em>")
                html_parts.append(f'<li><strong>{label}</strong> — {"；".join(detail_parts)}</li>')
            html_parts.append('</ol>')
        else:
            html_parts.append('<p>无人工修正记录。</p>')

        # 步骤
        html_parts.append('<h2>8️⃣ 重跑流程步骤详情</h2>')
        for s in d['steps']:
            has_diff = bool(s.get('diffFromBase'))
            cls = 'step-item diff' if has_diff else 'step-item'
            diff_html = ''
            if has_diff:
                diff_html = '<div style="color:#b45309;font-size:12px;margin-top:4px"><strong>变化：</strong>'
                diff_html += '；'.join(f'<code>{k}</code>: {v}' for k, v in s['diffFromBase'].items())
                diff_html += '</div>'
            ps_html = '<div style="color:#6b7280;font-size:12px;margin-top:4px"><strong>参数：</strong>'
            ps_html += '；'.join(f'{k}={v}' for k, v in s['paramSnapshot'].items())
            ps_html += '</div>'
            mf_html = ''
            if s.get('manualFixes'):
                mf_html = '<div style="color:#92400e;font-size:12px;margin-top:4px">⚠️ 人工介入：'
                mf_html += '；'.join(str(mf) for mf in s['manualFixes'])
                mf_html += '</div>'
            html_parts.append(f'''<div class="{cls}">
<div class="step-title">{s['id']}. {s['name']}
 {'<span style="background:#f59e0b;color:white;padding:1px 8px;border-radius:10px;font-size:11px;margin-left:6px">有变化</span>' if has_diff else ''}</div>
<div class="step-meta">{s['startTime']} - {s['endTime']} | 输入: {', '.join(s['inputs'])} → 输出: {', '.join(s['outputs'])}</div>
{ps_html}{mf_html}{diff_html}
</div>''')

        html_parts.append('''<hr style="margin-top:40px;border:none;border-top:1px dashed #cbd5e1">
<p style="color:#94a3b8;font-size:12px;text-align:center">本报告由海洋牧场时序回放系统自动生成</p>
</body></html>''')
        return ''.join(html_parts).encode('utf-8')

    def _format_stats(self, run: Run) -> Dict:
        stats = {'dms': 0, 'decimal': 0, 'dm': 0}
        for lr in run.lab_results:
            stats[lr.source_format] = stats.get(lr.source_format, 0) + 1
        return stats
