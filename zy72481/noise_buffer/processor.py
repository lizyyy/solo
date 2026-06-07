from typing import List, Optional, Dict
from .models import (
    SamplePoint, ComplaintRecord, CorrectionRecord,
    ProjectData, HeatmapCell
)
from .heatmap import calculate_heatmap, flag_missing_night_samples
import uuid
from datetime import datetime


class NoiseProcessor:
    def __init__(self, data: Optional[ProjectData] = None):
        self.data = data or ProjectData()

    def import_samples(self, samples_data: List[Dict]) -> List[SamplePoint]:
        new_samples = []
        for sd in samples_data:
            sample = SamplePoint(
                id=sd.get("id", str(uuid.uuid4())),
                location_id=sd["location_id"],
                location_name=sd["location_name"],
                x=float(sd["x"]),
                y=float(sd["y"]),
                time_slot=sd["time_slot"],
                noise_level=float(sd["noise_level"]),
                is_night=bool(sd.get("is_night", self._is_night_slot(sd["time_slot"]))),
                source=sd.get("source", "on_site_survey"),
                complaint_id=sd.get("complaint_id"),
                status=sd.get("status", "normal"),
                notes=sd.get("notes", "")
            )
            new_samples.append(sample)
            self.data.samples.append(sample)
        return new_samples

    def link_complaint_to_sample(
        self,
        sample_id: str,
        complaint_no: str,
        operator: str = "阿宁"
    ) -> Optional[CorrectionRecord]:
        sample = self._find_sample(sample_id)
        if not sample:
            return None

        complaint = self._find_complaint_by_no(complaint_no)
        if not complaint:
            return None

        old_noise = sample.noise_level
        old_status = sample.status
        old_complaint_id = sample.complaint_id

        sample.complaint_id = complaint.id
        complaint.linked_sample_id = sample.id
        complaint.status = "linked"

        converted_noise = complaint.noise_level * 0.95

        correction = CorrectionRecord(
            id=str(uuid.uuid4()),
            sample_id=sample.id,
            old_noise_level=old_noise,
            new_noise_level=converted_noise,
            old_status=old_status,
            new_status="corrected" if old_status == "from_complaint" else "linked",
            operator=operator,
            reason=f"关联居民投诉编号 {complaint_no}，旧口径补录转换",
            timestamp=datetime.now().isoformat()
        )

        sample.noise_level = converted_noise
        sample.status = correction.new_status
        sample.updated_at = datetime.now().isoformat()
        sample.notes += f" | 关联投诉 {complaint_no}: {complaint.description}"

        self.data.corrections.append(correction)
        return correction

    def manual_correct(
        self,
        sample_id: str,
        new_noise_level: float,
        reason: str,
        operator: str = "阿宁"
    ) -> Optional[CorrectionRecord]:
        sample = self._find_sample(sample_id)
        if not sample:
            return None

        old_noise = sample.noise_level
        old_status = sample.status

        correction = CorrectionRecord(
            id=str(uuid.uuid4()),
            sample_id=sample.id,
            old_noise_level=old_noise,
            new_noise_level=new_noise_level,
            old_status=old_status,
            new_status="corrected",
            operator=operator,
            reason=reason,
            timestamp=datetime.now().isoformat()
        )

        sample.noise_level = new_noise_level
        sample.status = "corrected"
        sample.updated_at = datetime.now().isoformat()
        sample.notes += f" | 人工修正: {reason}"

        self.data.corrections.append(correction)
        return correction

    def recompute_heatmap(self) -> List[HeatmapCell]:
        return calculate_heatmap(self.data.samples)

    def get_warnings(self) -> List[str]:
        return flag_missing_night_samples(self.data.samples)

    def get_sample_summary(self) -> Dict:
        samples = self.data.samples
        return {
            "total": len(samples),
            "night": len([s for s in samples if s.is_night]),
            "day": len([s for s in samples if not s.is_night]),
            "normal": len([s for s in samples if s.status == "normal"]),
            "low_confidence": len([s for s in samples if s.status == "low_confidence"]),
            "corrected": len([s for s in samples if s.status == "corrected"]),
            "from_complaint": len([s for s in samples if s.status == "from_complaint"]),
            "linked": len([s for s in samples if s.status == "linked"]),
        }

    def _find_sample(self, sample_id: str) -> Optional[SamplePoint]:
        for s in self.data.samples:
            if s.id == sample_id:
                return s
        return None

    def _find_complaint_by_no(self, complaint_no: str) -> Optional[ComplaintRecord]:
        for c in self.data.complaints:
            if c.complaint_no == complaint_no or c.id == complaint_no:
                return c
        return None

    @staticmethod
    def _is_night_slot(time_slot: str) -> bool:
        night_start = 19
        night_end = 6
        try:
            start_hour = int(time_slot.split(":")[0].split("-")[0])
            return start_hour >= night_start or start_hour < night_end
        except:
            return False
