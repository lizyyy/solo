package evidence

import (
	"time"
)

type EvidenceType string

const (
	TypeTop         EvidenceType = "top"
	TypeHtop        EvidenceType = "htop"
	TypeVmstat      EvidenceType = "vmstat"
	TypeIostat      EvidenceType = "iostat"
	TypeNetstat     EvidenceType = "netstat"
	TypeSs          EvidenceType = "ss"
	TypeStrace      EvidenceType = "strace"
	TypePerfScript  EvidenceType = "perf_script"
	TypeFoldedStack EvidenceType = "folded_stack"
)

type Evidence interface {
	Type() EvidenceType
	GetStartTime() time.Time
	GetEndTime() time.Time
	GetSampleCount() int
	GetMetadata() map[string]string
	GetRawContent() string
}

type BaseEvidence struct {
	EvidenceType EvidenceType
	StartTime    time.Time
	EndTime      time.Time
	SampleCount  int
	Metadata     map[string]string
	RawContent   string
}

func (b *BaseEvidence) Type() EvidenceType {
	return b.EvidenceType
}

func (b *BaseEvidence) GetStartTime() time.Time {
	return b.StartTime
}

func (b *BaseEvidence) GetEndTime() time.Time {
	return b.EndTime
}

func (b *BaseEvidence) GetSampleCount() int {
	return b.SampleCount
}

func (b *BaseEvidence) GetMetadata() map[string]string {
	return b.Metadata
}

func (b *BaseEvidence) GetRawContent() string {
	return b.RawContent
}

type CPUSample struct {
	Timestamp time.Time
	User      float64
	System    float64
	Nice      float64
	Idle      float64
	IOWait    float64
	IRQ       float64
	SoftIRQ   float64
	Steal     float64
	Guest     float64
}

type ProcessSample struct {
	PID        int
	User       string
	CPUPercent float64
	MemPercent float64
	Virt       uint64
	Res        uint64
	SHR        uint64
	Status     string
	Time       string
	Command    string
	Threads    int
}

type TopEvidence struct {
	BaseEvidence
	Samples []struct {
		Timestamp time.Time
		CPUSample CPUSample
		Processes []ProcessSample
		LoadAvg   [3]float64
		TotalMem  uint64
		FreeMem   uint64
		UsedMem   uint64
		BuffMem   uint64
		CacheMem  uint64
		TotalSwap uint64
		FreeSwap  uint64
		UsedSwap  uint64
	}
}

type HtopEvidence struct {
	BaseEvidence
	Samples []struct {
		Timestamp time.Time
		CPUSample CPUSample
		Processes []ProcessSample
		LoadAvg   [3]float64
		Uptime    time.Duration
		Tasks     int
		Threads   int
	}
}

type VmstatSample struct {
	Timestamp time.Time
	R         int
	B         int
	Swpd      uint64
	Free      uint64
	Buff      uint64
	Cache     uint64
	Si        uint64
	So        uint64
	Bi        uint64
	Bo        uint64
	In        uint64
	Cs        uint64
	Us        float64
	Sy        float64
	Id        float64
	Wa        float64
	St        float64
}

type VmstatEvidence struct {
	BaseEvidence
	Samples []VmstatSample
}

type IODeviceSample struct {
	Device    string
	RRQM      float64
	WRQM      float64
	RSec      float64
	WSec      float64
	RAwait    float64
	WAwait    float64
	Await     float64
	SVCTM     float64
	Util      float64
	ReadIOPS  float64
	WriteIOPS float64
}

type IostatSample struct {
	Timestamp time.Time
	Devices   []IODeviceSample
	AvgCPU    CPUSample
}

type IostatEvidence struct {
	BaseEvidence
	Samples []IostatSample
}

type NetworkConnection struct {
	Protocol   string
	LocalAddr  string
	LocalPort  int
	RemoteAddr string
	RemotePort int
	State      string
	Process    string
	PID        int
}

type NetworkStats struct {
	Interface string
	RxBytes   uint64
	TxBytes   uint64
	RxPackets uint64
	TxPackets uint64
	RxErrors  uint64
	TxErrors  uint64
}

type NetstatEvidence struct {
	BaseEvidence
	Samples []struct {
		Timestamp   time.Time
		Connections []NetworkConnection
		Stats       []NetworkStats
		ListenPorts []int
	}
}

type SsEvidence struct {
	BaseEvidence
	Samples []struct {
		Timestamp   time.Time
		Connections []NetworkConnection
		Stats       []NetworkStats
		SocketCount int
		TCPStates   map[string]int
	}
}

type SyscallEvent struct {
	Timestamp   time.Time
	PID         int
	TID         int
	Syscall     string
	Arguments   map[string]string
	ReturnValue int64
	Duration    time.Duration
	IsError     bool
	Errno       int
	ErrMessage  string
}

type StraceEvidence struct {
	BaseEvidence
	Events       []SyscallEvent
	SyscallStats map[string]struct {
		Count     int
		TotalTime time.Duration
		AvgTime   time.Duration
		Errors    int
	}
	BlockedCalls []SyscallEvent
}

type PerfStack struct {
	PID         int
	TID         int
	Comm        string
	CallChain   []string
	SampleCount int
}

type PerfScriptEvidence struct {
	BaseEvidence
	Stacks       []PerfStack
	HotSymbols   map[string]int
	HotFunctions map[string]struct {
		SampleCount int
		Percent     float64
	}
}

type FoldedStackEvidence struct {
	BaseEvidence
	Stacks []struct {
		CallChain   string
		SampleCount int
	}
	HotSymbols   map[string]int
	TotalSamples int
}

type TimelineGap struct {
	EvidenceType EvidenceType
	StartTime    time.Time
	EndTime      time.Time
	Duration     time.Duration
	Reason       string
	Severity     GapSeverity
}

type GapSeverity string

const (
	SeverityCritical GapSeverity = "critical"
	SeverityHigh     GapSeverity = "high"
	SeverityMedium   GapSeverity = "medium"
	SeverityLow      GapSeverity = "low"
)

type AlignmentResult struct {
	IsAligned       bool
	CommonStartTime time.Time
	CommonEndTime   time.Time
	EvidenceRanges  map[EvidenceType]struct {
		Start time.Time
		End   time.Time
	}
	Gaps              []TimelineGap
	Overlapping       []TimelineGap
	TotalDuration     time.Duration
	SampleRateWarning bool
}

type AnalysisResult struct {
	SessionID       string
	Timestamp       time.Time
	Alignment       AlignmentResult
	Bottlenecks     []Bottleneck
	Recommendations []Recommendation
	Summary         string
}

type Bottleneck struct {
	Category        BottleneckCategory
	Severity        BottleneckSeverity
	Timestamp       time.Time
	Duration        time.Duration
	Description     string
	EvidenceSources []EvidenceType
	SupportingData  map[string]interface{}
}

type BottleneckCategory string

const (
	CategoryCPU     BottleneckCategory = "cpu"
	CategoryMemory  BottleneckCategory = "memory"
	CategoryIO      BottleneckCategory = "io"
	CategoryNetwork BottleneckCategory = "network"
	CategorySyscall BottleneckCategory = "syscall"
	CategoryLock    BottleneckCategory = "lock"
	CategoryUnknown BottleneckCategory = "unknown"
)

type BottleneckSeverity string

const (
	SeverityBlocker BottleneckSeverity = "blocker"
	SeverityMajor   BottleneckSeverity = "major"
	SeverityMinor   BottleneckSeverity = "minor"
	SeverityInfo    BottleneckSeverity = "info"
)

type Recommendation struct {
	Priority     RecommendationPriority
	Title        string
	Description  string
	ActionSteps  []string
	EvidenceType EvidenceType
	References   []string
}

type RecommendationPriority string

const (
	PriorityImmediate RecommendationPriority = "immediate"
	PriorityHigh      RecommendationPriority = "high"
	PriorityMedium    RecommendationPriority = "medium"
	PriorityLow       RecommendationPriority = "low"
)

type AuditResult struct {
	SessionID       string
	Timestamp       time.Time
	EvidenceTypes   []EvidenceType
	MissingTypes    []EvidenceType
	QualityScore    float64
	Issues          []AuditIssue
	Recommendations []Recommendation
}

type AuditIssue struct {
	EvidenceType  EvidenceType
	Severity      IssueSeverity
	Message       string
	FixSuggestion string
}

type IssueSeverity string

const (
	IssueCritical IssueSeverity = "critical"
	IssueWarning  IssueSeverity = "warning"
	IssueInfo     IssueSeverity = "info"
)

type ParseError struct {
	EvidenceType EvidenceType
	LineNumber   int
	LineContent  string
	ErrorType    ParseErrorType
	Message      string
	Suggestion   string
}

type ParseErrorType string

const (
	ErrInvalidFormat      ParseErrorType = "invalid_format"
	ErrMissingField       ParseErrorType = "missing_field"
	ErrInvalidValue       ParseErrorType = "invalid_value"
	ErrUnsupportedVersion ParseErrorType = "unsupported_version"
	ErrIncompleteData     ParseErrorType = "incomplete_data"
)

func (e *ParseError) Error() string {
	return e.Message
}

type CollectorSuggestion struct {
	EvidenceType EvidenceType
	Command      string
	Description  string
	Priority     int
}
