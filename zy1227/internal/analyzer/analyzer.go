package analyzer

import (
	"time"

	"github.com/yourteam/sync-analyzer/internal/models"
	"github.com/yourteam/sync-analyzer/internal/parser"
)

// Analyzer 是主分析器接口
type Analyzer interface {
	Analyze(cases []models.SyncCase, events []models.SyncEvent, snippets []*models.CodeSnippet) (*models.AnalysisResult, error)
}

// SyncAnalyzer 实现了 Analyzer 接口
type SyncAnalyzer struct {
	detectors []Detector
}

// Detector 定义了问题检测器接口
type Detector interface {
	Name() string
	Detect(cases []models.SyncCase, events []models.SyncEvent, snippets []*models.CodeSnippet) ([]models.Issue, error)
}

// NewSyncAnalyzer 创建一个新的同步分析器
func NewSyncAnalyzer() *SyncAnalyzer {
	return &SyncAnalyzer{
		detectors: []Detector{
			NewLockOrderDetector(),
			NewRWMutexStarvationDetector(),
			NewWaitGroupCountDetector(),
			NewOnceInitDetector(),
			NewCondWakeupDetector(),
			NewPoolMisuseDetector(),
			NewRaceConditionDetector(),
		},
	}
}

// Analyze 执行完整的分析
func (a *SyncAnalyzer) Analyze(cases []models.SyncCase, events []models.SyncEvent, snippets []*models.CodeSnippet) (*models.AnalysisResult, error) {
	result := &models.AnalysisResult{
		Primitives: a.extractPrimitives(cases, snippets),
		Events:     events,
		Issues:     []models.Issue{},
	}

	// 运行所有检测器
	for _, detector := range a.detectors {
		issues, err := detector.Detect(cases, events, snippets)
		if err != nil {
			return nil, err
		}
		result.Issues = append(result.Issues, issues...)
	}

	// 生成摘要
	result.Summary = a.generateSummary(result)

	return result, nil
}

// extractPrimitives 从案例和代码片段中提取 sync 原语
func (a *SyncAnalyzer) extractPrimitives(cases []models.SyncCase, snippets []*models.CodeSnippet) []models.SyncPrimitive {
	var primitives []models.SyncPrimitive
	primitiveMap := make(map[string]bool)

	// 从案例配置中提取
	for _, c := range cases {
		for _, p := range c.Primitives {
			key := string(p.Type) + ":" + p.Name
			if !primitiveMap[key] {
				primitiveMap[key] = true
				primitives = append(primitives, models.SyncPrimitive{
					Type:     p.Type,
					Name:     p.Name,
					Location: p.Location,
				})
			}
		}
	}

	// 从代码片段中提取
	for _, snippet := range snippets {
		for _, p := range snippet.Primitives {
			key := string(p.Type) + ":" + p.Name
			if !primitiveMap[key] {
				primitiveMap[key] = true
				primitives = append(primitives, models.SyncPrimitive{
					Type:        p.Type,
					Name:        p.Name,
					Location:    p.Location.File,
					File:        p.Location.File,
					Line:        p.Location.Line,
					Declaration: p.Declaration,
				})
			}
		}
	}

	return primitives
}

// generateSummary 生成分析摘要
func (a *SyncAnalyzer) generateSummary(result *models.AnalysisResult) models.AnalysisSummary {
	summary := models.AnalysisSummary{
		TotalPrimitives:  len(result.Primitives),
		TotalEvents:      len(result.Events),
		TotalIssues:      len(result.Issues),
		IssuesByType:     make(map[models.IssueType]int),
		IssuesBySeverity: make(map[models.IssueSeverity]int),
	}

	for _, issue := range result.Issues {
		summary.IssuesByType[issue.Type]++
		summary.IssuesBySeverity[issue.Severity]++
	}

	return summary
}

// issueTemplate 创建问题模板
func issueTemplate(issueType models.IssueType, severity models.IssueSeverity, title, description, location, file string, line int, codeSnippet, suggestion, references string) models.Issue {
	return models.Issue{
		Type:        issueType,
		Severity:    severity,
		Title:       title,
		Description: description,
		Location:    location,
		File:        file,
		Line:        line,
		CodeSnippet: codeSnippet,
		Suggestion:  suggestion,
		References:  references,
		CreatedAt:   time.Now(),
	}
}
