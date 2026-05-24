package types

import "time"

type EnumValue struct {
	Name    string `json:"name"`
	Number  int32  `json:"number"`
	IsAlias bool   `json:"is_alias"`
}

type Enum struct {
	Name         string      `json:"name"`
	FullName     string      `json:"full_name"`
	Values       []EnumValue `json:"values"`
	Reserved     []Reserved  `json:"reserved"`
	FilePath     string      `json:"file_path"`
	PackageName  string      `json:"package_name"`
	MessageNest  []string    `json:"message_nest"`
}

type Reserved struct {
	Start    int32  `json:"start"`
	End      int32  `json:"end"`
	IsRange  bool   `json:"is_range"`
	Value    int32  `json:"value,omitempty"`
	Name     string `json:"name,omitempty"`
	IsByName bool   `json:"is_by_name"`
}

type ProtoFile struct {
	FilePath    string `json:"file_path"`
	PackageName string `json:"package_name"`
	Enums       []Enum `json:"enums"`
	Syntax      string `json:"syntax"`
}

type Snapshot struct {
	Version   string     `json:"version"`
	Timestamp time.Time  `json:"timestamp"`
	Service   string     `json:"service"`
	Files     []ProtoFile `json:"files"`
}

type IssueSeverity string

const (
	SeverityError   IssueSeverity = "error"
	SeverityWarning IssueSeverity = "warning"
	SeverityInfo    IssueSeverity = "info"
)

type IssueType string

const (
	IssueNumberReuse        IssueType = "number_reuse"
	IssueReservedMissing    IssueType = "reserved_missing"
	IssueAliasMisuse        IssueType = "alias_misuse"
	IssueEnumRemoved        IssueType = "enum_removed"
	IssueValueRemoved       IssueType = "value_removed"
	IssueValueNumberChanged IssueType = "value_number_changed"
	IssueReservedViolation  IssueType = "reserved_violation"
	IssueDuplicateNumber    IssueType = "duplicate_number"
)

type Issue struct {
	Type        IssueType     `json:"type"`
	Severity    IssueSeverity `json:"severity"`
	Message     string        `json:"message"`
	FilePath    string        `json:"file_path"`
	EnumName    string        `json:"enum_name"`
	ValueName   string        `json:"value_name,omitempty"`
	Number      int32         `json:"number,omitempty"`
	Details     string        `json:"details,omitempty"`
	ExitCode    int           `json:"exit_code"`
}

type Report struct {
	Service       string        `json:"service"`
	GeneratedAt   time.Time     `json:"generated_at"`
	InputFiles    []string      `json:"input_files"`
	SnapshotFile  string        `json:"snapshot_file,omitempty"`
	Issues        []Issue       `json:"issues"`
	TotalErrors   int           `json:"total_errors"`
	TotalWarnings int           `json:"total_warnings"`
	ExitCode      int           `json:"exit_code"`
	ExitCodeDesc  string        `json:"exit_code_desc"`
}

const (
	ExitCodeSuccess          = 0
	ExitCodeParseError       = 1
	ExitCodeValidationError  = 2
	ExitCodeBreakingChange   = 3
	ExitCodeSnapshotError    = 4
	ExitCodeIOError          = 5
)

var ExitCodeDescriptions = map[int]string{
	ExitCodeSuccess:          "检查通过，未发现问题",
	ExitCodeParseError:       "Proto 文件解析错误",
	ExitCodeValidationError:  "输入参数验证失败",
	ExitCodeBreakingChange:   "发现破坏性变更或严重问题",
	ExitCodeSnapshotError:    "快照文件读取或解析错误",
	ExitCodeIOError:          "文件读写错误",
}
