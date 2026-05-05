package model

type Case struct {
	ID          string
	Name        string
	Description string
	Category    string
	Seed        int64
	Operations  []*Operation
	Snippets    []*Snippet
}

type Snippet struct {
	Filename    string
	Content     string
	LineStart   int
	LineEnd     int
	Description string
}

type CaseFile struct {
	Cases []*Case `yaml:"cases"`
}

type OpsFile struct {
	Operations []*Operation
}

type Report struct {
	CaseID      string
	CaseName    string
	Steps       []*Step
	Summary     *Summary
}

type Summary struct {
	TotalOperations     int
	TotalGrows          int
	TotalAliases        int
	BigArrayHolders     []string
	MemoryWasteKB       float64
	Recommendation      string
}

type SQLiteTrace struct {
	ID         int64
	Timestamp  int64
	CaseID     string
	StepNumber int
	Operation  string
	SliceName  string
	Len        int
	Cap        int
	ArrayID    string
	DidGrow    bool
	IsAliased  bool
}
