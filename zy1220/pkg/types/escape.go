package types

import "time"

type EscapeReason string

const (
	EscapeReasonInterfaceBox   EscapeReason = "interface_box"
	EscapeReasonClosureCapture EscapeReason = "closure_capture"
	EscapeReasonPointerReturn  EscapeReason = "pointer_return"
	EscapeReasonSliceGrow      EscapeReason = "slice_grow"
	EscapeReasonMapGrow        EscapeReason = "map_grow"
	EscapeReasonGoroutine      EscapeReason = "goroutine"
	EscapeReasonUnknown        EscapeReason = "unknown"
)

type EscapeEntry struct {
	LineNumber  int          `json:"line_number"`
	Function    string       `json:"function"`
	Variable    string       `json:"variable"`
	Reason      EscapeReason `json:"reason"`
	Message     string       `json:"message"`
	SourceFile  string       `json:"source_file"`
	RawLogEntry string       `json:"raw_log_entry"`
}

type AnalysisResult struct {
	ID          string         `json:"id"`
	Timestamp   time.Time      `json:"timestamp"`
	Description string         `json:"description"`
	EscapeCount int            `json:"escape_count"`
	Entries     []EscapeEntry  `json:"entries"`
	SourceFiles map[string]string `json:"source_files,omitempty"`
	Benchmark   *BenchmarkData `json:"benchmark,omitempty"`
	Stats       Statistics     `json:"stats"`
}

type BenchmarkData struct {
	Name           string  `json:"name"`
	Iterations     int     `json:"iterations"`
	NsPerOp        int64   `json:"ns_per_op"`
	BytesPerOp     int64   `json:"bytes_per_op"`
	AllocsPerOp    int64   `json:"allocs_per_op"`
	MBPerSec       float64 `json:"mb_per_sec,omitempty"`
}

type Statistics struct {
	ByReason     map[EscapeReason]int `json:"by_reason"`
	TotalEscapes int                   `json:"total_escapes"`
}

type ComparisonResult struct {
	Before    AnalysisResult    `json:"before"`
	After     AnalysisResult    `json:"after"`
	Diff      EscapeDiff        `json:"diff"`
	Improved  bool              `json:"improved"`
	Suggested []RefactorSuggestion `json:"suggested"`
}

type EscapeDiff struct {
	NewEscapes    []EscapeEntry `json:"new_escapes"`
	FixedEscapes  []EscapeEntry `json:"fixed_escapes"`
	ChangedEscapes []ChangedEscape `json:"changed_escapes"`
	TotalChange   int           `json:"total_change"`
}

type ChangedEscape struct {
	Old EscapeEntry `json:"old"`
	New EscapeEntry `json:"new"`
}

type RefactorSuggestion struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Severity    string `json:"severity"`
	Location    string `json:"location"`
	Example     string `json:"example"`
}
