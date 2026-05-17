class SanCheckerError(Exception):
    pass

class ParseError(SanCheckerError):
    def __init__(self, message, file_path=None, line_number=None, raw_content=None):
        super().__init__(message)
        self.file_path = file_path
        self.line_number = line_number
        self.raw_content = raw_content
    
    def __str__(self):
        parts = [super().__str__()]
        if self.file_path:
            parts.append(f"File: {self.file_path}")
        if self.line_number is not None:
            parts.append(f"Line: {self.line_number}")
        if self.raw_content:
            parts.append(f"Raw content: {self.raw_content}")
        return " | ".join(parts)

class CertificateParseError(ParseError):
    pass

class CSRParseError(ParseError):
    pass

class DomainListParseError(ParseError):
    pass
