package model

import "time"

type SparePart struct {
	OriginalName   string
	UnifiedName    string
	SpecModel      string
	Quantity       int
	Source         string
	SourceLineNum  int
	RawFields      map[string]string
}

type DowntimeWindow struct {
	WindFarm       string
	TurbineID      string
	UnifiedTurbine string
	StartDate      time.Time
	EndDate        time.Time
	Reason         string
	SourceLineNum  int
}

type ArrivalPlan struct {
	OriginalName   string
	UnifiedName    string
	SpecModel      string
	Quantity       int
	Supplier       string
	ETA            time.Time
	OrderNo        string
	SourceLineNum  int
}

type RemarkStatus struct {
	UnifiedName    string
	SpecModel      string
	Status         string
	Remark         string
	ScreenshotRef  string
	ThresholdNote  string
	UpdatedAt      time.Time
}

type ScheduleResult struct {
	RunID          int64
	RunTag         string
	CreatedAt      time.Time

	UnifiedName    string
	OriginalNames  []string
	SpecModel      string
	RequiredQty    int
	ArrivedQty     int
	ETA            time.Time
	DowntimeStart  time.Time
	DowntimeEnd    time.Time
	WillMakeWindow bool
	DaysLate       int
	IsAnomaly      bool
	AnomalyReasons []string
	RawSourceQuote string
	PrevStatus     string
	PrevRemark     string
	PrevScreenshot string
	ThresholdText  string
	Status         string
	Remark         string
	ScreenshotRef  string
}

type DBRun struct {
	ID        int64
	Tag       string
	CreatedAt time.Time
	Summary   string
}

type DBAnomaly struct {
	ID             int64
	RunID          int64
	UnifiedName    string
	Reasons        string
	RawSourceQuote string
	Status         string
	Remark         string
	ScreenshotRef  string
	DeltaFromPrev  string
}
