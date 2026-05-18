class JiazhengCallbackError(Exception):
    pass


class FileReadError(JiazhengCallbackError):
    pass


class MissingColumnError(JiazhengCallbackError):
    pass


class EmptyFileError(JiazhengCallbackError):
    pass


class OutputWriteError(JiazhengCallbackError):
    pass
