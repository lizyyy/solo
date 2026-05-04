package types

type IssueSeverity string

const (
	SeverityCritical IssueSeverity = "critical"
	SeverityHigh     IssueSeverity = "high"
	SeverityMedium   IssueSeverity = "medium"
	SeverityLow      IssueSeverity = "low"
	SeverityInfo     IssueSeverity = "info"
)

type IssueType string

const (
	IssueTypeFieldDeleted        IssueType = "field_deleted"
	IssueTypeFieldRenamed        IssueType = "field_renamed"
	IssueTypeTypeNarrowed        IssueType = "type_narrowed"
	IssueTypeRequiredMissing     IssueType = "required_missing"
	IssueTypeUnknownField        IssueType = "unknown_field"
	IssueTypeDefaultValueDrift   IssueType = "default_value_drift"
	IssueTypeEnumExtended        IssueType = "enum_extended"
	IssueTypeTimestampPrecision  IssueType = "timestamp_precision"
	IssueTypeRepeatedChanged     IssueType = "repeated_changed"
	IssueTypeCompatibilityBreak  IssueType = "compatibility_break"
)

type Issue struct {
	ID          string
	Type        IssueType
	Severity    IssueSeverity
	Message     string
	MessageType string
	FieldName   string
	PayloadID   string
	Details     map[string]interface{}
}

type IssueCollection struct {
	TotalCount      int
	CriticalCount   int
	HighCount       int
	MediumCount     int
	LowCount        int
	InfoCount       int
	Issues          []Issue
	ByType          map[IssueType][]Issue
	BySeverity      map[IssueSeverity][]Issue
}
