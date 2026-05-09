class FermentationQCError(Exception):
    def __init__(self, message, sample_id=None, error_code=None):
        self.sample_id = sample_id
        self.error_code = error_code
        super().__init__(message)

    def to_dict(self):
        return {
            "sample_id": self.sample_id,
            "error_code": self.error_code,
            "message": str(self),
        }


class DataImportError(FermentationQCError):
    def __init__(self, message, sample_id=None, file_path=None):
        super().__init__(message, sample_id=sample_id, error_code="DATA_IMPORT_ERROR")
        self.file_path = file_path


class MissingDataError(FermentationQCError):
    def __init__(self, message, sample_id=None, missing_columns=None):
        super().__init__(message, sample_id=sample_id, error_code="MISSING_DATA")
        self.missing_columns = missing_columns or []


class UnitConversionError(FermentationQCError):
    def __init__(self, message, sample_id=None, unit=None, parameter=None):
        super().__init__(message, sample_id=sample_id, error_code="UNIT_CONVERSION_ERROR")
        self.unit = unit
        self.parameter = parameter


class QCError(FermentationQCError):
    def __init__(self, message, sample_id=None, rule_name=None):
        super().__init__(message, sample_id=sample_id, error_code="QC_ERROR")
        self.rule_name = rule_name


class SampleProcessingError(FermentationQCError):
    def __init__(self, message, sample_id=None, stage=None, original_error=None):
        super().__init__(message, sample_id=sample_id, error_code="SAMPLE_PROCESSING_ERROR")
        self.stage = stage
        self.original_error = str(original_error) if original_error else None
