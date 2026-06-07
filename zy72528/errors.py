class HallucinationMarkError(Exception):
    def __init__(self, message: str, friendly_message: str = None):
        super().__init__(message)
        self.friendly_message = friendly_message or message


class DuplicateImportError(HallucinationMarkError):
    def __init__(self, sample_id: str):
        message = f"Sample {sample_id} already imported"
        friendly_message = f"样本【{sample_id}】已经导入过了，别重复导哦，先去历史记录看看之前的情况"
        super().__init__(message, friendly_message)


class InvalidPromptVersionError(HallucinationMarkError):
    def __init__(self, version: str, sample_id: str):
        message = f"Invalid prompt version {version} for sample {sample_id}"
        friendly_message = f"样本【{sample_id}】的提示词版本号【{version}】不对，检查下是不是输错了，或者版本还没录入知识库"
        super().__init__(message, friendly_message)


class Link404Error(HallucinationMarkError):
    def __init__(self, link: str, sample_id: str):
        message = f"Link {link} returns 404 for sample {sample_id}"
        friendly_message = f"样本【{sample_id}】的知识库链接【{link}】打不开（404），这个得留给产品经理复核，别急着判正常"
        super().__init__(message, friendly_message)


class ConflictNotFoundError(HallucinationMarkError):
    def __init__(self, sample_id: str):
        message = f"No conflict found for sample {sample_id}"
        friendly_message = f"样本【{sample_id}】没找到冲突记录，确认下是不是已经处理过了"
        super().__init__(message, friendly_message)


class SampleNotFoundError(HallucinationMarkError):
    def __init__(self, sample_id: str):
        message = f"Sample {sample_id} not found"
        friendly_message = f"找不到样本【{sample_id}】，检查下ID是不是输错了"
        super().__init__(message, friendly_message)


class InvalidMaterialTypeError(HallucinationMarkError):
    def __init__(self, material_type: str, sample_id: str):
        message = f"Invalid material type {material_type} for sample {sample_id}"
        friendly_message = f"样本【{sample_id}】的材料类型【{material_type}】不对，只能是：正常材料、错口径材料、补录材料"
        super().__init__(message, friendly_message)


class ExportMismatchError(HallucinationMarkError):
    def __init__(self, detail: str):
        message = f"Export mismatch: {detail}"
        friendly_message = f"导出的数据和系统里的对不上：{detail}，得检查下是不是中间有操作没同步"
        super().__init__(message, friendly_message)
