package reporter

import (
	"encoding/json"
	"fmt"
	"io"
	"text/template"
	"time"

	"escape-analyzer/pkg/types"
)

const backtick = "`"

var markdownTemplate = `# 内存逃逸分析报告

## 基本信息
- **分析ID**: {{.Result.ID}}
- **分析时间**: {{.Result.Timestamp.Format "2006-01-02 15:04:05"}}
- **描述**: {{.Result.Description}}

## 统计概览
| 指标 | 值 |
|------|-----|
| 总逃逸次数 | {{.Result.Stats.TotalEscapes}} |
{{range $reason, $count := .Result.Stats.ByReason}}| {{ReasonName $reason}} | {{$count}} |
{{end}}

## 详细逃逸分析
{{if .Result.Entries}}
{{range .Result.Entries}}
### {{.Variable}} ({{.SourceFile}}:{{.LineNumber}})
- **逃逸原因**: {{ReasonName .Reason}}
- **原始日志**: {{.Message}}
{{end}}
{{else}}
无逃逸记录。
{{end}}

{{if .Result.Benchmark}}
## Benchmark 数据
| 指标 | 值 |
|------|-----|
| 基准名称 | {{.Result.Benchmark.Name}} |
| 迭代次数 | {{.Result.Benchmark.Iterations}} |
| 每次耗时 | {{.Result.Benchmark.NsPerOp}} ns/op |
| 每次分配 | {{.Result.Benchmark.BytesPerOp}} B/op |
| 每次分配次数 | {{.Result.Benchmark.AllocsPerOp}} allocs/op |
{{if .Result.Benchmark.MBPerSec}}| 吞吐量 | {{printf "%.2f" .Result.Benchmark.MBPerSec}} MB/s |
{{end}}
{{end}}

{{if .Suggestions}}
## 重构建议
{{range .Suggestions}}
### {{.Title}} ({{.Severity}})
- **位置**: {{.Location}}
- **描述**: {{.Description}}
{{if .Example}}
#### 示例代码
` + backtick + `go
{{.Example}}
` + backtick + `
{{end}}
{{end}}
{{end}}
`

var comparisonTemplate = `# 内存逃逸对比分析报告

## 基本信息
- **分析时间**: {{.Timestamp.Format "2006-01-02 15:04:05"}}

## 对比概览
| 指标 | 优化前 | 优化后 | 变化 |
|------|--------|--------|------|
| 总逃逸次数 | {{.Before.Stats.TotalEscapes}} | {{.After.Stats.TotalEscapes}} | {{if gt .Diff.TotalChange 0}}+{{end}}{{.Diff.TotalChange}} |
{{range $reason, $count := .Before.Stats.ByReason}}
| {{ReasonName $reason}} | {{$count}} | {{index $.After.Stats.ByReason $reason}} | {{sub (index $.After.Stats.ByReason $reason) $count}} |
{{end}}

## 优化结果
{{if .Improved}}
✅ **性能有所提升** - 逃逸次数减少了 {{.Diff.TotalChange | abs}} 次
{{else}}
⚠️ **性能未提升** - 逃逸次数增加了 {{.Diff.TotalChange}} 次
{{end}}

## 详细对比

{{if .Diff.FixedEscapes}}
### 已修复的逃逸 ({{len .Diff.FixedEscapes}} 处)
{{range .Diff.FixedEscapes}}
- **{{.Variable}}** ({{.SourceFile}}:{{.LineNumber}}) - {{ReasonName .Reason}}
{{end}}
{{end}}

{{if .Diff.NewEscapes}}
### 新增的逃逸 ({{len .Diff.NewEscapes}} 处)
{{range .Diff.NewEscapes}}
- **{{.Variable}}** ({{.SourceFile}}:{{.LineNumber}}) - {{ReasonName .Reason}}
{{end}}
{{end}}

{{if .Suggested}}
## 重构建议
{{range .Suggested}}
### {{.Title}} ({{.Severity}})
- **位置**: {{.Location}}
- **描述**: {{.Description}}
{{if .Example}}
#### 示例代码
` + backtick + `go
{{.Example}}
` + backtick + `
{{end}}
{{end}}
{{end}}
`

type Reporter struct{}

func NewReporter() *Reporter {
	return &Reporter{}
}

func (r *Reporter) ExportJSON(result *types.AnalysisResult, w io.Writer) error {
	encoder := json.NewEncoder(w)
	encoder.SetIndent("", "  ")
	return encoder.Encode(result)
}

func (r *Reporter) ExportMarkdown(result *types.AnalysisResult, w io.Writer) error {
	funcMap := template.FuncMap{
		"ReasonName": reasonName,
	}

	tpl, err := template.New("markdown").Funcs(funcMap).Parse(markdownTemplate)
	if err != nil {
		return fmt.Errorf("failed to parse markdown template: %w", err)
	}

	data := struct {
		Result      *types.AnalysisResult
		Suggestions []types.RefactorSuggestion
	}{
		Result:      result,
		Suggestions: r.generateSuggestions(result),
	}

	return tpl.Execute(w, data)
}

func (r *Reporter) ExportComparisonJSON(comparison *types.ComparisonResult, w io.Writer) error {
	encoder := json.NewEncoder(w)
	encoder.SetIndent("", "  ")
	return encoder.Encode(comparison)
}

func (r *Reporter) ExportComparisonMarkdown(comparison *types.ComparisonResult, w io.Writer) error {
	funcMap := template.FuncMap{
		"ReasonName": reasonName,
		"sub":        func(a, b int) int { return a - b },
		"abs":        func(x int) int {
			if x < 0 {
				return -x
			}
			return x
		},
	}

	tpl, err := template.New("comparison").Funcs(funcMap).Parse(comparisonTemplate)
	if err != nil {
		return fmt.Errorf("failed to parse comparison template: %w", err)
	}

	data := struct {
		*types.ComparisonResult
		Timestamp time.Time
	}{
		ComparisonResult: comparison,
		Timestamp:        time.Now(),
	}

	return tpl.Execute(w, data)
}

func (r *Reporter) generateSuggestions(result *types.AnalysisResult) []types.RefactorSuggestion {
	var suggestions []types.RefactorSuggestion

	for _, entry := range result.Entries {
		location := entry.SourceFile
		if entry.LineNumber > 0 {
			location = fmt.Sprintf("%s:%d", entry.SourceFile, entry.LineNumber)
		}

		switch entry.Reason {
		case types.EscapeReasonInterfaceBox:
			suggestions = append(suggestions, types.RefactorSuggestion{
				Title:       "接口装箱优化",
				Description: fmt.Sprintf("变量 %s 因装箱到接口而逃逸。考虑使用具体类型或 sync.Pool 复用对象。", entry.Variable),
				Severity:    "high",
				Location:    location,
				Example: `// 优化前（逃逸）
var w io.Writer = &bytes.Buffer{}
w.Write(data)

// 优化后（栈分配）
buf := &bytes.Buffer{}
buf.Write(data)`,
			})

		case types.EscapeReasonPointerReturn:
			suggestions = append(suggestions, types.RefactorSuggestion{
				Title:       "指针返回优化",
				Description: fmt.Sprintf("变量 %s 作为指针返回导致逃逸。考虑返回值类型或让调用者预分配内存。", entry.Variable),
				Severity:    "high",
				Location:    location,
				Example: `// 优化前（逃逸）
func Create() *User {
    return &User{Name: "test"}
}

// 优化后（可栈分配）
func Create() User {
    return User{Name: "test"}
}`,
			})

		case types.EscapeReasonSliceGrow:
			suggestions = append(suggestions, types.RefactorSuggestion{
				Title:       "Slice 预分配",
				Description: fmt.Sprintf("Slice %s 因动态扩容导致逃逸。预分配足够容量可减少堆分配。", entry.Variable),
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
			})

		case types.EscapeReasonMapGrow:
			suggestions = append(suggestions, types.RefactorSuggestion{
				Title:       "Map 预分配",
				Description: fmt.Sprintf("Map %s 因动态扩容导致逃逸。预分配足够容量可减少堆分配。", entry.Variable),
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
			})
		}
	}

	return suggestions
}

func reasonName(reason types.EscapeReason) string {
	names := map[types.EscapeReason]string{
		types.EscapeReasonInterfaceBox:   "接口装箱",
		types.EscapeReasonClosureCapture: "闭包捕获",
		types.EscapeReasonPointerReturn:  "指针返回",
		types.EscapeReasonSliceGrow:      "Slice 扩容",
		types.EscapeReasonMapGrow:        "Map 扩容",
		types.EscapeReasonGoroutine:      "Goroutine 边界",
		types.EscapeReasonUnknown:        "未知原因",
	}
	if name, ok := names[reason]; ok {
		return name
	}
	return string(reason)
}
