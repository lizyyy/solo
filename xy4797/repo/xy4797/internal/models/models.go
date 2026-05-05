package models

import (
	"time"

	"gorm.io/gorm"
)

// ScanRecord 扫描记录
type ScanRecord struct {
	ID          uint           `json:"id" gorm:"primaryKey"`
	ProjectName string         `json:"project_name" gorm:"index"`
	ProjectPath string         `json:"project_path" gorm:"uniqueIndex"`
	GoModPath   string         `json:"go_mod_path"`
	Status      string         `json:"status" gorm:"default:pending"` // pending, running, completed, failed
	ErrorMsg    string         `json:"error_msg,omitempty"`
	ScanResult  *ScanResult    `json:"scan_result,omitempty" gorm:"-"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index"`
}

// ScanResult 扫描结果
type ScanResult struct {
	ID           uint          `json:"id" gorm:"primaryKey"`
	ScanRecordID uint          `json:"scan_record_id" gorm:"index"`
	ScanRecord   *ScanRecord   `json:"scan_record,omitempty" gorm:"foreignKey:ScanRecordID"`
	Issues       []*Issue      `json:"issues,omitempty" gorm:"-"`
	Summary      *ScanSummary  `json:"summary,omitempty" gorm:"-"`
	GoModInfo    *GoModInfo    `json:"go_mod_info,omitempty" gorm:"-"`
	CreatedAt    time.Time     `json:"created_at"`
	UpdatedAt    time.Time     `json:"updated_at"`
}

// Issue 扫描发现的问题
type Issue struct {
	ID            uint           `json:"id" gorm:"primaryKey"`
	ScanResultID  uint           `json:"scan_result_id" gorm:"index"`
	ScanResult    *ScanResult    `json:"scan_result,omitempty" gorm:"foreignKey:ScanResultID"`
	RuleType      string         `json:"rule_type" gorm:"index"`
	Severity      string         `json:"severity" gorm:"index"`
	Description   string         `json:"description"`
	File          string         `json:"file" gorm:"index"`
	Line          int            `json:"line"`
	Column        int            `json:"column"`
	CodeSnippet   string         `json:"code_snippet,omitempty"`
	Message       string         `json:"message"`
	IsFalsePositive bool         `json:"is_false_positive" gorm:"default:false"`
	FalsePositiveReason string     `json:"false_positive_reason,omitempty"`
	Resolved      bool           `json:"resolved" gorm:"default:false"`
	ResolvedAt    *time.Time     `json:"resolved_at,omitempty"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index"`
}

// GoModInfo go.mod 信息
type GoModInfo struct {
	ID           uint           `json:"id" gorm:"primaryKey"`
	ScanResultID uint           `json:"scan_result_id" gorm:"uniqueIndex"`
	ScanResult   *ScanResult    `json:"scan_result,omitempty" gorm:"foreignKey:ScanResultID"`
	ModuleName   string         `json:"module_name"`
	GoVersion    string         `json:"go_version"`
	Dependencies []*Dependency  `json:"dependencies,omitempty" gorm:"-"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
}

// Dependency 依赖信息
type Dependency struct {
	ID          uint           `json:"id" gorm:"primaryKey"`
	GoModInfoID uint           `json:"go_mod_info_id" gorm:"index"`
	GoModInfo   *GoModInfo     `json:"go_mod_info,omitempty" gorm:"foreignKey:GoModInfoID"`
	Path        string         `json:"path"`
	Version     string         `json:"version"`
	Indirect    bool           `json:"indirect" gorm:"default:false"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

// ScanSummary 扫描摘要
type ScanSummary struct {
	TotalIssues       int `json:"total_issues"`
	CriticalIssues    int `json:"critical_issues"`
	HighIssues        int `json:"high_issues"`
	MediumIssues      int `json:"medium_issues"`
	LowIssues         int `json:"low_issues"`
	FalsePositives    int `json:"false_positives"`
	ResolvedIssues    int `json:"resolved_issues"`
	FilesScanned      int `json:"files_scanned"`
	TestFilesScanned  int `json:"test_files_scanned"`
}

// ReportConfig 报告配置
type ReportConfig struct {
	Format         string   `json:"format"`          // markdown, json
	IncludeSummary bool     `json:"include_summary"`
	IncludeDetails bool     `json:"include_details"`
	FilterSeverity []string `json:"filter_severity,omitempty"`
	ExcludeFalsePositive bool `json:"exclude_false_positive"`
}

// Project 项目信息（用于扫描提交）
type Project struct {
	Name string `json:"name" binding:"required"`
	Path string `json:"path" binding:"required"`
}

// FalsePositiveRequest 误报标记请求
type FalsePositiveRequest struct {
	Reason string `json:"reason" binding:"required"`
}
