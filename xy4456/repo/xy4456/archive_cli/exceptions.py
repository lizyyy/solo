class ArchiveCLIError(Exception):
    """Base exception for archive CLI errors"""
    pass


class ImportError(ArchiveCLIError):
    """Error during data import"""
    pass


class DatabaseError(ArchiveCLIError):
    """Database operation error"""
    pass


class ValidationError(ArchiveCLIError):
    """Data validation error"""
    pass


class ExportError(ArchiveCLIError):
    """Error during data export"""
    pass


class CheckError(ArchiveCLIError):
    """Error during business rule check"""
    pass
