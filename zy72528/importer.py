from typing import List, Dict, Any
from models import SampleRecord, MaterialType, HistoryRecord
from errors import DuplicateImportError, InvalidMaterialTypeError, InvalidPromptVersionError


VALID_PROMPT_VERSIONS = {"v1.0", "v1.1", "v1.2", "v2.0", "v2.1"}


class SampleImporter:
    def __init__(self):
        self.samples: Dict[str, SampleRecord] = {}
        self.history: List[HistoryRecord] = []

    def import_sample(
        self,
        sample_id: str,
        prompt_version: str,
        knowledge_link: str,
        material_type: str,
        hallucination_mark: bool,
        operator: str = "系统",
        supplementary_from: str = None
    ) -> SampleRecord:
        if sample_id in self.samples:
            raise DuplicateImportError(sample_id)

        try:
            mat_type = MaterialType(material_type)
        except ValueError:
            raise InvalidMaterialTypeError(material_type, sample_id)

        if prompt_version not in VALID_PROMPT_VERSIONS:
            raise InvalidPromptVersionError(prompt_version, sample_id)

        sample = SampleRecord(
            sample_id=sample_id,
            prompt_version=prompt_version,
            knowledge_link=knowledge_link,
            material_type=mat_type,
            hallucination_mark=hallucination_mark,
            operator=operator,
            supplementary_from=supplementary_from
        )

        self.samples[sample_id] = sample

        if mat_type == MaterialType.SUPPLEMENTARY and supplementary_from:
            detail = f"补录导入，来源：{supplementary_from}"
        else:
            detail = f"首次导入，材料类型：{mat_type.value}"

        self._add_history(sample_id, "导入样本", None, sample.status.value, operator, detail)

        return sample

    def import_batch(self, data_list: List[Dict[str, Any]], operator: str = "系统") -> List[SampleRecord]:
        results = []
        for data in data_list:
            sample = self.import_sample(
                sample_id=data["sample_id"],
                prompt_version=data["prompt_version"],
                knowledge_link=data["knowledge_link"],
                material_type=data["material_type"],
                hallucination_mark=data["hallucination_mark"],
                operator=operator,
                supplementary_from=data.get("supplementary_from")
            )
            results.append(sample)
        return results

    def supplementary_import(
        self,
        original_sample_id: str,
        new_prompt_version: str = None,
        new_knowledge_link: str = None,
        operator: str = "算法运营老唐"
    ) -> SampleRecord:
        if original_sample_id not in self.samples:
            from errors import SampleNotFoundError
            raise SampleNotFoundError(original_sample_id)

        original = self.samples[original_sample_id]
        new_sample_id = f"{original_sample_id}_sup"
        count = 1
        while new_sample_id in self.samples:
            new_sample_id = f"{original_sample_id}_sup{count}"
            count += 1

        sample = self.import_sample(
            sample_id=new_sample_id,
            prompt_version=new_prompt_version or original.prompt_version,
            knowledge_link=new_knowledge_link or original.knowledge_link,
            material_type=MaterialType.SUPPLEMENTARY.value,
            hallucination_mark=original.hallucination_mark,
            operator=operator,
            supplementary_from=original_sample_id
        )

        self._add_history(
            original_sample_id,
            "补录样本",
            original.status.value,
            original.status.value,
            operator,
            f"生成补录样本：{new_sample_id}"
        )

        return sample

    def _add_history(
        self,
        sample_id: str,
        action: str,
        before_status: str,
        after_status: str,
        operator: str,
        detail: str
    ):
        record = HistoryRecord(
            sample_id=sample_id,
            action=action,
            before_status=before_status,
            after_status=after_status,
            operator=operator,
            detail=detail
        )
        self.history.append(record)

    def get_sample(self, sample_id: str) -> SampleRecord:
        if sample_id not in self.samples:
            from errors import SampleNotFoundError
            raise SampleNotFoundError(sample_id)
        return self.samples[sample_id]

    def get_all_samples(self) -> List[SampleRecord]:
        return list(self.samples.values())

    def get_history(self, sample_id: str = None) -> List[HistoryRecord]:
        if sample_id:
            return [h for h in self.history if h.sample_id == sample_id]
        return self.history.copy()
