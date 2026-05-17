class DockerCacheAuditException(Exception):
    pass


class ParseError(DockerCacheAuditException):
    def __init__(self, line_number: int, line_content: str, message: str, source_file: str):
        self.line_number = line_number
        self.line_content = line_content
        self.source_file = source_file
        super().__init__(f"{source_file}:{line_number} - {message}")


class FileReadError(DockerCacheAuditException):
    pass


class InvalidInstructionError(ParseError):
    pass


class CorruptLogError(ParseError):
    pass
