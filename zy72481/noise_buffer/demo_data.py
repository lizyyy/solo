from .models import SamplePoint, ComplaintRecord, CorrectionRecord, ProjectData
import uuid


def create_demo_data() -> ProjectData:
    samples = []

    samples.append(SamplePoint(
        id=str(uuid.uuid4()),
        location_id="LOC-001",
        location_name="口袋篮球场A区",
        x=2.0,
        y=2.0,
        time_slot="14:00-16:00",
        noise_level=62.5,
        is_night=False,
        source="on_site_survey",
        status="normal",
        notes="日间正常采样，数据完整"
    ))

    samples.append(SamplePoint(
        id=str(uuid.uuid4()),
        location_id="LOC-001",
        location_name="口袋篮球场A区",
        x=2.0,
        y=2.0,
        time_slot="20:00-22:00",
        noise_level=58.0,
        is_night=True,
        source="on_site_survey",
        status="normal",
        notes="夜间采样，居民活动高峰"
    ))

    sample_low_conf = SamplePoint(
        id=str(uuid.uuid4()),
        location_id="LOC-002",
        location_name="口袋篮球场B区",
        x=5.0,
        y=3.0,
        time_slot="20:00-22:00",
        noise_level=48.0,
        is_night=True,
        source="estimated",
        status="low_confidence",
        notes="晚上缺采样，使用白天数据估算，热力图偏低，待复核"
    )
    samples.append(sample_low_conf)

    samples.append(SamplePoint(
        id=str(uuid.uuid4()),
        location_id="LOC-002",
        location_name="口袋篮球场B区",
        x=5.0,
        y=3.0,
        time_slot="10:00-12:00",
        noise_level=55.0,
        is_night=False,
        source="on_site_survey",
        status="normal",
        notes="日间正常采样"
    ))

    sample_old_caliber = SamplePoint(
        id=str(uuid.uuid4()),
        location_id="LOC-003",
        location_name="口袋篮球场C区",
        x=8.0,
        y=5.0,
        time_slot="21:00-23:00",
        noise_level=52.0,
        is_night=True,
        source="old_caliber",
        status="from_complaint",
        complaint_id="COMP-2024-003",
        notes="从居民投诉编号补录，旧口径数据"
    )
    samples.append(sample_old_caliber)

    samples.append(SamplePoint(
        id=str(uuid.uuid4()),
        location_id="LOC-003",
        location_name="口袋篮球场C区",
        x=8.0,
        y=5.0,
        time_slot="15:00-17:00",
        noise_level=60.0,
        is_night=False,
        source="on_site_survey",
        status="normal",
        notes="日间正常采样"
    ))

    complaints = []

    complaints.append(ComplaintRecord(
        id="COMP-2024-001",
        complaint_no="TS-20240315-001",
        location_id="LOC-002",
        location_name="口袋篮球场B区",
        noise_level=72.0,
        reported_at="2024-03-15T21:30:00",
        description="居民反映晚上打球声音太大，影响休息",
        status="pending"
    ))

    complaints.append(ComplaintRecord(
        id="COMP-2024-002",
        complaint_no="TS-20240316-002",
        location_id="LOC-001",
        location_name="口袋篮球场A区",
        noise_level=65.0,
        reported_at="2024-03-16T22:00:00",
        description="周末晚上打球到很晚",
        status="linked"
    ))

    complaints.append(ComplaintRecord(
        id="COMP-2024-003",
        complaint_no="TS-20240310-003",
        location_id="LOC-003",
        location_name="口袋篮球场C区",
        noise_level=68.0,
        reported_at="2024-03-10T20:45:00",
        description="老旧小区，隔音差，篮球场噪声明显",
        source_caliber="old_system",
        status="linked",
        linked_sample_id=sample_old_caliber.id
    ))

    corrections = []

    corrections.append(CorrectionRecord(
        id=str(uuid.uuid4()),
        sample_id=sample_old_caliber.id,
        old_noise_level=52.0,
        new_noise_level=65.0,
        old_status="from_complaint",
        new_status="corrected",
        operator="阿宁",
        reason="人工修正：根据居民投诉编号TS-20240310-003补录，旧口径转换为新口径",
        timestamp="2024-03-12T10:00:00"
    ))

    return ProjectData(samples=samples, complaints=complaints, corrections=corrections)
