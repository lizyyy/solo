package model

import "time"

type ScanResult struct {
	ID        int64     `json:"id"`
	RepoName  string    `json:"repo_name"`
	Branch    string    `json:"branch"`
	Commit    string    `json:"commit"`
	ScanTime  time.Time `json:"scan_time"`
	Summary   Summary   `json:"summary"`
}

type Summary struct {
	TotalChecks    int            `json:"total_checks"`
	PassedChecks   int            `json:"passed_checks"`
	FailedChecks   int            `json:"failed_checks"`
	ViolationsByType map[string]int `json:"violations_by_type"`
}

type Violation struct {
	ID          int64     `json:"id"`
	ScanResultID int64    `json:"scan_result_id"`
	Type        string    `json:"type"`
	Severity    string    `json:"severity"`
	Message     string    `json:"message"`
	File        string    `json:"file"`
	Line        int       `json:"line"`
	Detail      string    `json:"detail"`
	DetectedAt  time.Time `json:"detected_at"`
}

type ServicePolicy struct {
	ProjectName  string           `yaml:"project_name"`
	Modules      []ModuleConfig   `yaml:"modules"`
	CheckRules   CheckRules       `yaml:"check_rules"`
	ErrorCodes   []ErrorCodeDef   `yaml:"error_codes"`
	LogFields    []LogFieldDef    `yaml:"log_fields"`
}

type ModuleConfig struct {
	Name        string   `yaml:"name"`
	Path        string   `yaml:"path"`
	Type        string   `yaml:"type"`
	AllowedImports []string `yaml:"allowed_imports"`
}

type CheckRules struct {
	EnableCyclicDepCheck      bool `yaml:"enable_cyclic_dep_check"`
	EnableCrossLayerCheck     bool `yaml:"enable_cross_layer_check"`
	EnableApiSyncCheck        bool `yaml:"enable_api_sync_check"`
	EnableMigrationCheck      bool `yaml:"enable_migration_check"`
	EnableErrorCodeCheck      bool `yaml:"enable_error_code_check"`
	EnableLogFieldCheck       bool `yaml:"enable_log_field_check"`
	MaxAllowedDependencies    int  `yaml:"max_allowed_dependencies"`
}

type ErrorCodeDef struct {
	Code        string `yaml:"code"`
	Message     string `yaml:"message"`
	Category    string `yaml:"category"`
}

type LogFieldDef struct {
	Name        string `yaml:"name"`
	Type        string `yaml:"type"`
	Required    bool   `yaml:"required"`
	Description string `yaml:"description"`
}

type Dependency struct {
	ModulePath string `json:"module_path"`
	ImportPath string `json:"import_path"`
	Version    string `json:"version"`
	Indirect   bool   `json:"indirect"`
}

type PackageImport struct {
	ImportingPkg string `json:"importing_pkg"`
	ImportedPkg  string `json:"imported_pkg"`
}

type MigrationFile struct {
	FileName    string    `json:"file_name"`
	Version     string    `json:"version"`
	Direction   string    `json:"direction"`
	Content     string    `json:"content"`
	HasUp       bool      `json:"has_up"`
	HasDown     bool      `json:"has_down"`
}

type OpenAPISpec struct {
	FilePath    string                 `json:"file_path"`
	Title       string                 `json:"title"`
	Version     string                 `json:"version"`
	Paths       map[string]interface{} `json:"paths"`
	Components  map[string]interface{} `json:"components"`
	Checksum    string                 `json:"checksum"`
}

type CompareResult struct {
	BaseScanID       int64              `json:"base_scan_id"`
	TargetScanID     int64              `json:"target_scan_id"`
	NewViolations    []Violation        `json:"new_violations"`
	FixedViolations  []Violation        `json:"fixed_violations"`
	ChangedViolations []ViolationChange `json:"changed_violations"`
	SummaryDiff      SummaryDiff        `json:"summary_diff"`
}

type ViolationChange struct {
	BaseViolation   Violation `json:"base_violation"`
	TargetViolation Violation `json:"target_violation"`
	ChangeType      string    `json:"change_type"`
}

type SummaryDiff struct {
	TotalDiff      int `json:"total_diff"`
	PassedDiff     int `json:"passed_diff"`
	FailedDiff     int `json:"failed_diff"`
}
