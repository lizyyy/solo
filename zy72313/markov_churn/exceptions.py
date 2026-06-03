class MarkovChurnError(Exception):
    pass


class DuplicateImportError(MarkovChurnError):
    def __init__(self, file_hash, message="重复导入检测到相同数据"):
        self.file_hash = file_hash
        self.message = message
        super().__init__(self.message)


class MultipleAnswersError(MarkovChurnError):
    def __init__(self, student_id, versions, message="同一学生存在多版答案，需业务复核"):
        self.student_id = student_id
        self.versions = versions
        self.message = message
        super().__init__(self.message)


class ReviewRequiredError(MarkovChurnError):
    def __init__(self, item_id, review_type, message="该操作需要业务复核"):
        self.item_id = item_id
        self.review_type = review_type
        self.message = message
        super().__init__(self.message)


class VersionNotFoundError(MarkovChurnError):
    def __init__(self, version_id, message="指定的版本不存在"):
        self.version_id = version_id
        self.message = message
        super().__init__(self.message)


class RollbackError(MarkovChurnError):
    def __init__(self, current_version, target_version, message="回滚操作失败"):
        self.current_version = current_version
        self.target_version = target_version
        self.message = message
        super().__init__(self.message)
