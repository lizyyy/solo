from enum import Enum


class TaskStatus(str, Enum):
    CREATED = "created"
    MODEL_UPLOADED = "model_uploaded"
    ANALYZING = "analyzing"
    ANALYZED = "analyzed"
    PARAMS_RECEIVED = "params_received"
    ESTIMATING = "estimating"
    ESTIMATED = "estimated"
    REPORT_GENERATING = "report_generating"
    REPORT_GENERATED = "report_generated"
    COMPLETED = "completed"
    FAILED = "failed"


class TaskStatusCategory(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"


STATUS_CATEGORY_MAP = {
    TaskStatus.CREATED: TaskStatusCategory.PENDING,
    TaskStatus.MODEL_UPLOADED: TaskStatusCategory.PENDING,
    TaskStatus.ANALYZING: TaskStatusCategory.PROCESSING,
    TaskStatus.ANALYZED: TaskStatusCategory.SUCCESS,
    TaskStatus.PARAMS_RECEIVED: TaskStatusCategory.PENDING,
    TaskStatus.ESTIMATING: TaskStatusCategory.PROCESSING,
    TaskStatus.ESTIMATED: TaskStatusCategory.SUCCESS,
    TaskStatus.REPORT_GENERATING: TaskStatusCategory.PROCESSING,
    TaskStatus.REPORT_GENERATED: TaskStatusCategory.SUCCESS,
    TaskStatus.COMPLETED: TaskStatusCategory.SUCCESS,
    TaskStatus.FAILED: TaskStatusCategory.FAILED,
}


class AnomalyType(str, Enum):
    MESH_BROKEN_FACES = "mesh_broken_faces"
    MESH_NON_MANIFOLD = "mesh_non_manifold"
    MESH_SELF_INTERSECTING = "mesh_self_intersecting"
    MESH_DUPLICATE_FACES = "mesh_duplicate_faces"
    SUPPORT_DUPLICATE = "support_duplicate"
    SUPPORT_INSUFFICIENT = "support_insufficient"
    TIME_UNDERESTIMATED = "time_underestimated"
    MATERIAL_INSUFFICIENT = "material_insufficient"
    PARAMS_INCOMPLETE = "params_incomplete"
    MODEL_CORRUPTED = "model_corrupted"


class AnomalySeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class MaterialType(str, Enum):
    PLA = "PLA"
    ABS = "ABS"
    PETG = "PETG"
    TPU = "TPU"
    NYLON = "Nylon"
    RESIN = "Resin"


class FileType(str, Enum):
    STL = "stl"
    OBJ = "obj"
    THREE_MF = "3mf"
    GCODE = "gcode"
