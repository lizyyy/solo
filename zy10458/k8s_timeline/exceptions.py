class K8sTimelineError(Exception):
    pass


class ParseError(K8sTimelineError):
    def __init__(self, message, file_path=None, line_number=None, raw_line=None):
        self.file_path = file_path
        self.line_number = line_number
        self.raw_line = raw_line
        super().__init__(self._format_message(message))

    def _format_message(self, message):
        parts = [message]
        if self.file_path:
            parts.append(f"File: {self.file_path}")
        if self.line_number is not None:
            parts.append(f"Line: {self.line_number}")
        if self.raw_line:
            parts.append(f"Raw content: {self.raw_line.strip()}")
        return " | ".join(parts)


class ValidationError(K8sTimelineError):
    pass


class KubectlError(K8sTimelineError):
    pass


class OutputError(K8sTimelineError):
    pass
