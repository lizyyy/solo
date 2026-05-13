package model

import (
	"time"
)

type TaskStatus string

const (
	StatusCreated   TaskStatus = "created"
	StatusValidated TaskStatus = "validated"
	StatusProcessing TaskStatus = "processing"
	StatusCompleted TaskStatus = "completed"
	StatusFailed    TaskStatus = "failed"
)

type RiskLevel string

const (
	RiskLow    RiskLevel = "low"
	RiskMedium RiskLevel = "medium"
	RiskHigh   RiskLevel = "high"
	RiskCritical RiskLevel = "critical"
)

type ArchiveType string

const (
	ArchiveZip ArchiveType = "zip"
	ArchiveRar ArchiveType = "rar"
	ArchiveTar ArchiveType = "tar"
	ArchiveGz  ArchiveType = "tar.gz"
)

type ArchiveTask struct {
	TaskID      string     `json:"task_id"`
	ArchiveName string     `json:"archive_name"`
	ArchiveType ArchiveType `json:"archive_type"`
	ArchiveSize int64      `json:"archive_size"`
	FileHash    string     `json:"file_hash"`
	Status      TaskStatus `json:"status"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	IsolationDir string    `json:"isolation_dir"`
}

type UnpackRule struct {
	MaxFileSize       int64  `json:"max_file_size"`
	MaxTotalSize      int64  `json:"max_total_size"`
	MaxFileCount      int    `json:"max_file_count"`
	AllowPathTraversal bool  `json:"allow_path_traversal"`
	BlockedExtensions []string `json:"blocked_extensions"`
	BlockedPatterns   []string `json:"blocked_patterns"`
}

type FileEntry struct {
	Path     string `json:"path"`
	FileName string `json:"file_name"`
	FileSize int64  `json:"file_size"`
	IsDir    bool   `json:"is_dir"`
	FileMode uint32 `json:"file_mode"`
}

type RiskItem struct {
	RiskID    string    `json:"risk_id"`
	TaskID    string    `json:"task_id"`
	FilePath  string    `json:"file_path"`
	RiskType  string    `json:"risk_type"`
	RiskLevel RiskLevel `json:"risk_level"`
	Message   string    `json:"message"`
	DetectedAt time.Time `json:"detected_at"`
}

type ProcessResult struct {
	TaskID       string      `json:"task_id"`
	Status       TaskStatus  `json:"status"`
	TotalFiles   int         `json:"total_files"`
	TotalSize    int64       `json:"total_size"`
	FileList     []FileEntry `json:"file_list"`
	RiskCount    int         `json:"risk_count"`
	Risks        []RiskItem  `json:"risks"`
	StartedAt    time.Time   `json:"started_at"`
	CompletedAt  time.Time   `json:"completed_at"`
	ErrorMsg     string      `json:"error_msg,omitempty"`
	OutputDir    string      `json:"output_dir"`
}

type CreateTaskRequest struct {
	ArchiveName string     `json:"archive_name" validate:"required"`
	ArchiveType ArchiveType `json:"archive_type" validate:"required,oneof=zip rar tar tar.gz"`
	ArchiveSize int64      `json:"archive_size" validate:"required,min=1"`
	FileHash    string     `json:"file_hash" validate:"required"`
}

type CreateTaskResponse struct {
	TaskID string     `json:"task_id"`
	Status TaskStatus `json:"status"`
}

type TaskResponse struct {
	Task   ArchiveTask   `json:"task"`
	Result *ProcessResult `json:"result,omitempty"`
	Risks  []RiskItem     `json:"risks,omitempty"`
}

type ErrorResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Detail  string `json:"detail,omitempty"`
}
