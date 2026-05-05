package analyzer

import (
	"io"
	"time"

	"github.com/google/uuid"

	"escape-analyzer/internal/parser"
	"escape-analyzer/pkg/types"
)

type EscapeAnalyzer struct {
	parser *parser.EscapeLogParser
}

func NewEscapeAnalyzer() *EscapeAnalyzer {
	return &EscapeAnalyzer{
		parser: parser.NewEscapeLogParser(),
	}
}

func (a *EscapeAnalyzer) Analyze(escapeLogReader io.Reader, description string, sourceFiles map[string]string) (*types.AnalysisResult, error) {
	entries, err := a.parser.Parse(escapeLogReader)
	if err != nil {
		return nil, err
	}

	stats := a.calculateStats(entries)

	result := &types.AnalysisResult{
		ID:          uuid.New().String(),
		Timestamp:   time.Now(),
		Description: description,
		EscapeCount: len(entries),
		Entries:     entries,
		SourceFiles: sourceFiles,
		Stats:       stats,
	}

	return result, nil
}

func (a *EscapeAnalyzer) AnalyzeWithBenchmark(escapeLogReader io.Reader, benchmarkReader io.Reader, description string, sourceFiles map[string]string) (*types.AnalysisResult, error) {
	result, err := a.Analyze(escapeLogReader, description, sourceFiles)
	if err != nil {
		return nil, err
	}

	if benchmarkReader != nil {
		benchmarks, err := a.parser.ParseBenchmark(benchmarkReader)
		if err == nil && len(benchmarks) > 0 {
			result.Benchmark = &benchmarks[0]
		}
	}

	return result, nil
}

func (a *EscapeAnalyzer) calculateStats(entries []types.EscapeEntry) types.Statistics {
	byReason := make(map[types.EscapeReason]int)
	for _, entry := range entries {
		byReason[entry.Reason]++
	}

	return types.Statistics{
		ByReason:     byReason,
		TotalEscapes: len(entries),
	}
}

func (a *EscapeAnalyzer) Compare(before, after *types.AnalysisResult) *types.ComparisonResult {
	diff := a.calculateDiff(before.Entries, after.Entries)

	improved := diff.TotalChange < 0
	suggestions := a.generateSuggestions(before, after, diff)

	return &types.ComparisonResult{
		Before:    *before,
		After:     *after,
		Diff:      diff,
		Improved:  improved,
		Suggested: suggestions,
	}
}

func (a *EscapeAnalyzer) calculateDiff(before, after []types.EscapeEntry) types.EscapeDiff {
	var newEscapes, fixedEscapes []types.EscapeEntry
	var changedEscapes []types.ChangedEscape

	beforeMap := make(map[string]types.EscapeEntry)
	for _, entry := range before {
		key := entry.SourceFile + ":" + entry.Variable
		beforeMap[key] = entry
	}

	afterMap := make(map[string]types.EscapeEntry)
	for _, entry := range after {
		key := entry.SourceFile + ":" + entry.Variable
		afterMap[key] = entry
	}

	for key, afterEntry := range afterMap {
		if beforeEntry, exists := beforeMap[key]; exists {
			if beforeEntry.Reason != afterEntry.Reason {
				changedEscapes = append(changedEscapes, types.ChangedEscape{
					Old: beforeEntry,
					New: afterEntry,
				})
			}
		} else {
			newEscapes = append(newEscapes, afterEntry)
		}
	}

	for key, beforeEntry := range beforeMap {
		if _, exists := afterMap[key]; !exists {
			fixedEscapes = append(fixedEscapes, beforeEntry)
		}
	}

	totalChange := (len(before) - len(after)) * -1

	return types.EscapeDiff{
		NewEscapes:     newEscapes,
		FixedEscapes:   fixedEscapes,
		ChangedEscapes: changedEscapes,
		TotalChange:    totalChange,
	}
}

func (a *EscapeAnalyzer) generateSuggestions(before, after *types.AnalysisResult, diff types.EscapeDiff) []types.RefactorSuggestion {
	var suggestions []types.RefactorSuggestion

	for _, entry := range diff.NewEscapes {
		suggestion := a.generateSuggestionForEntry(entry, "new")
		if suggestion != nil {
			suggestions = append(suggestions, *suggestion)
		}
	}

	for _, entry := range diff.FixedEscapes {
		suggestion := a.generateSuggestionForEntry(entry, "fixed")
		if suggestion != nil {
			suggestions = append(suggestions, *suggestion)
		}
	}

	return suggestions
}

func (a *EscapeAnalyzer) generateSuggestionForEntry(entry types.EscapeEntry, status string) *types.RefactorSuggestion {
	location := entry.SourceFile
	if entry.LineNumber > 0 {
		location = location + ":" + string(rune(entry.LineNumber))
	}

	switch entry.Reason {
	case types.EscapeReasonInterfaceBox:
		return &types.RefactorSuggestion{
			Title:       "接口装箱优化",
			Description: "变量 " + entry.Variable + " 因装箱到接口而逃逸。考虑使用具体类型或 sync.Pool 复用对象。",
			Severity:    "high",
			Location:    location,
			Example: `// 优化前（逃逸）
var w io.Writer = &bytes.Buffer{}
w.Write(data)

// 优化后（栈分配）
buf := &bytes.Buffer{}
buf.Write(data)`,
		}

	case types.EscapeReasonClosureCapture:
		return &types.RefactorSuggestion{
			Title:       "闭包捕获优化",
			Description: "变量 " + entry.Variable + " 被闭包捕获导致逃逸。考虑传递值副本或重构为非闭包实现。",
			Severity:    "medium",
			Location:    location,
			Example: `// 优化前（逃逸）
for _, item := range items {
    go func() {
        process(item)
    }()
}

// 优化后（传值副本）
for _, item := range items {
    local := item
    go func() {
        process(local)
    }()
}`,
		}

	case types.EscapeReasonPointerReturn:
		return &types.RefactorSuggestion{
			Title:       "指针返回优化",
			Description: "变量 " + entry.Variable + " 作为指针返回导致逃逸。考虑返回值类型或让调用者预分配内存。",
			Severity:    "high",
			Location:    location,
			Example: `// 优化前（逃逸）
func Create() *User {
    return &User{Name: "test"}
}

// 优化后（可栈分配）
func Create() User {
    return User{Name: "test"}
}

// 或让调用者预分配
func Create(u *User) {
    *u = User{Name: "test"}
}`,
		}

	case types.EscapeReasonSliceGrow:
		return &types.RefactorSuggestion{
			Title:       "Slice 预分配",
			Description: "Slice " + entry.Variable + " 因动态扩容导致逃逸。预分配足够容量可减少堆分配。",
			Severity:    "medium",
			Location:    location,
			Example: `// 优化前（可能多次扩容）
var items []string
for i := 0; i < 1000; i++ {
    items = append(items, strconv.Itoa(i))
}

// 优化后（预分配）
items := make([]string, 0, 1000)
for i := 0; i < 1000; i++ {
    items = append(items, strconv.Itoa(i))
}`,
		}

	case types.EscapeReasonMapGrow:
		return &types.RefactorSuggestion{
			Title:       "Map 预分配",
			Description: "Map " + entry.Variable + " 因动态扩容导致逃逸。预分配足够容量可减少堆分配。",
			Severity:    "medium",
			Location:    location,
			Example: `// 优化前（可能多次扩容）
m := make(map[string]int)
for i := 0; i < 1000; i++ {
    m[strconv.Itoa(i)] = i
}

// 优化后（预分配）
m := make(map[string]int, 1000)
for i := 0; i < 1000; i++ {
    m[strconv.Itoa(i)] = i
}`,
		}

	case types.EscapeReasonGoroutine:
		return &types.RefactorSuggestion{
			Title:       "Goroutine 边界优化",
			Description: "变量 " + entry.Variable + " 跨 goroutine 边界导致逃逸。考虑使用值传递或 sync.Pool。",
			Severity:    "high",
			Location:    location,
			Example: `// 优化前（逃逸）
data := make([]byte, 1024)
go func() {
    process(data)
}()

// 优化后（传递副本或使用池）
data := make([]byte, 1024)
copyData := make([]byte, len(data))
copy(copyData, data)
go func() {
    process(copyData)
}()`,
		}

	default:
		if status == "fixed" {
			return &types.RefactorSuggestion{
				Title:       "已修复的逃逸",
				Description: "变量 " + entry.Variable + " 已不再逃逸到堆上。继续保持良好的编码习惯。",
				Severity:    "info",
				Location:    location,
				Example:     "",
			}
		}
		return nil
	}
}
