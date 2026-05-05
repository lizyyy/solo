package reporter

import (
	"db-audit/internal/storage"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type Reporter struct {
	storage *storage.Storage
}

type ReportData struct {
	Session         *storage.AnalysisSession
	Bottlenecks     []storage.Bottleneck
	IndexIssues     []storage.IndexAnalysis
	SlowQueries     []storage.SlowQueryAnalysis
	ConnectionPool  *storage.ConnectionPoolAnalysis
	WritePerformance []storage.WritePerformanceAnalysis
	ReadWrite       *storage.ReadWriteAnalysis
	Sharding        *storage.ShardingAnalysis
	GeneratedAt     time.Time
}

type JSONReport struct {
	ProjectName     string           `json:"project_name"`
	Version         string           `json:"version"`
	GeneratedAt     string           `json:"generated_at"`
	SessionID       int64            `json:"session_id"`
	Status          string           `json:"status"`
	ConnectionPool  *ConnectionPoolReport `json:"connection_pool,omitempty"`
	Indexes         *IndexReport     `json:"indexes,omitempty"`
	SlowQueries     *SlowQueryReport `json:"slow_queries,omitempty"`
	WritePerformance *WritePerformanceReport `json:"write_performance,omitempty"`
	ReadWrite       *ReadWriteReport `json:"read_write,omitempty"`
	Sharding        *ShardingReport  `json:"sharding,omitempty"`
	Bottlenecks     []BottleneckItem `json:"bottlenecks"`
	Summary         *SummaryReport   `json:"summary"`
}

type ConnectionPoolReport struct {
	MaxOpenConns     int      `json:"max_open_conns"`
	MaxIdleConns     int      `json:"max_idle_conns"`
	Rating           string   `json:"rating"`
	Issues           []string `json:"issues"`
	Suggestions      []string `json:"suggestions"`
}

type IndexReport struct {
	TotalIssues    int              `json:"total_issues"`
	CriticalCount  int              `json:"critical_count"`
	HighCount      int              `json:"high_count"`
	MediumCount    int              `json:"medium_count"`
	Issues         []IndexIssueItem `json:"issues"`
}

type IndexIssueItem struct {
	TableName   string `json:"table_name"`
	IndexName   string `json:"index_name"`
	IssueType   string `json:"issue_type"`
	Severity    string `json:"severity"`
	Description string `json:"description"`
	Suggestion  string `json:"suggestion"`
}

type SlowQueryReport struct {
	TotalQueries   int                   `json:"total_queries"`
	MaxQueryTime   float64               `json:"max_query_time_seconds"`
	AvgQueryTime   float64               `json:"avg_query_time_seconds"`
	Queries        []SlowQueryItem       `json:"queries"`
}

type SlowQueryItem struct {
	SQL          string  `json:"sql"`
	QueryTime    float64 `json:"query_time_seconds"`
	LockTime     float64 `json:"lock_time_seconds"`
	RowsExamined int64   `json:"rows_examined"`
	RowsSent     int64   `json:"rows_sent"`
	Severity     string  `json:"severity"`
	Description  string  `json:"description"`
	Suggestion   string  `json:"suggestion"`
	OptimizedSQL string  `json:"optimized_sql,omitempty"`
}

type WritePerformanceReport struct {
	SingleRowAvgTime   float64 `json:"single_row_avg_time_ms"`
	BatchRowAvgTime    float64 `json:"batch_row_avg_time_ms"`
	PerformanceRatio   float64 `json:"performance_ratio"`
	Recommendation     string  `json:"recommendation"`
}

type ReadWriteReport struct {
	Enabled            bool     `json:"enabled"`
	ReadRatio          float64  `json:"configured_read_ratio"`
	ActualReadRatio    float64  `json:"actual_read_ratio"`
	ReadEndpointCount  int      `json:"read_endpoint_count"`
	Issues             []string `json:"issues"`
	Suggestions        []string `json:"suggestions"`
}

type ShardingReport struct {
	Enabled            bool     `json:"enabled"`
	ShardKey           string   `json:"shard_key,omitempty"`
	ShardCount         int      `json:"shard_count,omitempty"`
	HotspotRisk        string   `json:"hotspot_risk"`
	HotspotTables      []string `json:"hotspot_tables,omitempty"`
	Issues             []string `json:"issues"`
	Suggestions        []string `json:"suggestions"`
}

type BottleneckItem struct {
	Category    string  `json:"category"`
	Description string  `json:"description"`
	Severity    string  `json:"severity"`
	Priority    int     `json:"priority"`
	Impact      float64 `json:"impact"`
}

type SummaryReport struct {
	TotalBottlenecks    int            `json:"total_bottlenecks"`
	CriticalCount       int            `json:"critical_count"`
	HighCount           int            `json:"high_count"`
	MediumCount         int            `json:"medium_count"`
	OverallRating       string         `json:"overall_rating"`
	TopRecommendations  []string       `json:"top_recommendations"`
}

func NewReporter(store *storage.Storage) *Reporter {
	return &Reporter{
		storage: store,
	}
}

func (r *Reporter) GenerateReport(sessionID int64) (*ReportData, error) {
	session, err := r.storage.GetSession(sessionID)
	if err != nil {
		return nil, err
	}
	if session == nil {
		return nil, fmt.Errorf("session %d not found", sessionID)
	}

	report := &ReportData{
		Session:     session,
		GeneratedAt: time.Now(),
	}

	report.Bottlenecks, err = r.storage.GetBottlenecksBySession(sessionID)
	if err != nil {
		return nil, err
	}

	report.IndexIssues, err = r.storage.GetIndexAnalysisBySession(sessionID)
	if err != nil {
		return nil, err
	}

	report.SlowQueries, err = r.storage.GetSlowQueryAnalysisBySession(sessionID)
	if err != nil {
		return nil, err
	}

	report.ConnectionPool, err = r.storage.GetConnectionPoolAnalysisBySession(sessionID)
	if err != nil {
		return nil, err
	}

	report.WritePerformance, err = r.storage.GetWritePerformanceAnalysisBySession(sessionID)
	if err != nil {
		return nil, err
	}

	report.ReadWrite, err = r.storage.GetReadWriteAnalysisBySession(sessionID)
	if err != nil {
		return nil, err
	}

	report.Sharding, err = r.storage.GetShardingAnalysisBySession(sessionID)
	if err != nil {
		return nil, err
	}

	return report, nil
}

func (r *Reporter) ExportJSON(sessionID int64, outputPath string) error {
	report, err := r.GenerateReport(sessionID)
	if err != nil {
		return err
	}

	jsonReport := r.convertToJSONReport(report)

	data, err := json.MarshalIndent(jsonReport, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}

	if outputPath != "" {
		dir := filepath.Dir(outputPath)
		if dir != "." {
			os.MkdirAll(dir, 0755)
		}
		return os.WriteFile(outputPath, data, 0644)
	}

	fmt.Println(string(data))
	return nil
}

func (r *Reporter) ExportMarkdown(sessionID int64, outputPath string) error {
	report, err := r.GenerateReport(sessionID)
	if err != nil {
		return err
	}

	md := r.generateMarkdown(report)

	if outputPath != "" {
		dir := filepath.Dir(outputPath)
		if dir != "." {
			os.MkdirAll(dir, 0755)
		}
		return os.WriteFile(outputPath, []byte(md), 0644)
	}

	fmt.Println(md)
	return nil
}

func (r *Reporter) convertToJSONReport(data *ReportData) *JSONReport {
	report := &JSONReport{
		ProjectName: data.Session.ProjectName,
		Version:     data.Session.Version,
		GeneratedAt: data.GeneratedAt.Format(time.RFC3339),
		SessionID:   data.Session.ID,
		Status:      data.Session.Status,
	}

	if data.ConnectionPool != nil {
		report.ConnectionPool = &ConnectionPoolReport{
			MaxOpenConns: data.ConnectionPool.MaxOpenConns,
			MaxIdleConns: data.ConnectionPool.MaxIdleConns,
			Rating:       data.ConnectionPool.ConnectionRating,
			Issues:       splitBySemicolon(data.ConnectionPool.Issues),
			Suggestions:  splitBySemicolon(data.ConnectionPool.Suggestions),
		}
	}

	if len(data.IndexIssues) > 0 {
		indexReport := &IndexReport{
			TotalIssues: len(data.IndexIssues),
		}

		for _, issue := range data.IndexIssues {
			switch issue.Severity {
			case "CRITICAL":
				indexReport.CriticalCount++
			case "HIGH":
				indexReport.HighCount++
			case "MEDIUM":
				indexReport.MediumCount++
			}

			indexReport.Issues = append(indexReport.Issues, IndexIssueItem{
				TableName:   issue.TableName,
				IndexName:   issue.IndexName,
				IssueType:   issue.IssueType,
				Severity:    issue.Severity,
				Description: issue.Description,
				Suggestion:  issue.Suggestion,
			})
		}

		report.Indexes = indexReport
	}

	if len(data.SlowQueries) > 0 {
		slowReport := &SlowQueryReport{
			TotalQueries: len(data.SlowQueries),
		}

		var totalTime float64
		for _, q := range data.SlowQueries {
			qt := q.QueryTime.Seconds()
			if qt > slowReport.MaxQueryTime {
				slowReport.MaxQueryTime = qt
			}
			totalTime += qt

			slowReport.Queries = append(slowReport.Queries, SlowQueryItem{
				SQL:          q.SQL,
				QueryTime:    qt,
				LockTime:     q.LockTime.Seconds(),
				RowsExamined: q.RowsExamined,
				RowsSent:     q.RowsSent,
				Severity:     q.Severity,
				Description:  q.Description,
				Suggestion:   q.Suggestion,
				OptimizedSQL: q.OptimizedSQL,
			})
		}

		if len(data.SlowQueries) > 0 {
			slowReport.AvgQueryTime = totalTime / float64(len(data.SlowQueries))
		}

		report.SlowQueries = slowReport
	}

	if len(data.WritePerformance) > 0 {
		wp := data.WritePerformance[0]
		report.WritePerformance = &WritePerformanceReport{
			SingleRowAvgTime: float64(wp.AvgSingleRowTime.Milliseconds()),
			BatchRowAvgTime:  float64(wp.AvgBatchRowTime.Milliseconds()),
			PerformanceRatio: wp.PerformanceRatio,
			Recommendation:   wp.Recommendation,
		}
	}

	if data.ReadWrite != nil {
		report.ReadWrite = &ReadWriteReport{
			Enabled:           data.ReadWrite.ReadWriteEnabled,
			ReadRatio:         data.ReadWrite.ReadRatio,
			ActualReadRatio:   data.ReadWrite.ActualReadRatio,
			ReadEndpointCount: data.ReadWrite.ReadEndpointCount,
			Issues:            splitBySemicolon(data.ReadWrite.Issues),
			Suggestions:       splitBySemicolon(data.ReadWrite.Suggestions),
		}
	}

	if data.Sharding != nil {
		report.Sharding = &ShardingReport{
			Enabled:       data.Sharding.ShardingEnabled,
			ShardKey:      data.Sharding.ShardKey,
			ShardCount:    data.Sharding.ShardCount,
			HotspotRisk:   data.Sharding.HotspotRisk,
			HotspotTables: splitBySemicolon(data.Sharding.HotspotTables),
			Issues:        splitBySemicolon(data.Sharding.Suggestions),
			Suggestions:   splitBySemicolon(data.Sharding.Suggestions),
		}
	}

	for _, b := range data.Bottlenecks {
		report.Bottlenecks = append(report.Bottlenecks, BottleneckItem{
			Category:    b.Category,
			Description: b.Description,
			Severity:    b.Severity,
			Priority:    b.Priority,
			Impact:      b.Impact,
		})
	}

	report.Summary = r.calculateSummary(data)

	return report
}

func (r *Reporter) calculateSummary(data *ReportData) *SummaryReport {
	summary := &SummaryReport{
		TotalBottlenecks: len(data.Bottlenecks),
	}

	for _, b := range data.Bottlenecks {
		switch b.Severity {
		case "CRITICAL":
			summary.CriticalCount++
		case "HIGH":
			summary.HighCount++
		case "MEDIUM":
			summary.MediumCount++
		}
	}

	for _, idx := range data.IndexIssues {
		switch idx.Severity {
		case "CRITICAL":
			summary.CriticalCount++
		case "HIGH":
			summary.HighCount++
		case "MEDIUM":
			summary.MediumCount++
		}
	}

	summary.TotalBottlenecks = summary.CriticalCount + summary.HighCount + summary.MediumCount

	if summary.CriticalCount > 0 {
		summary.OverallRating = "POOR"
	} else if summary.HighCount > 2 {
		summary.OverallRating = "FAIR"
	} else if summary.HighCount > 0 || summary.MediumCount > 3 {
		summary.OverallRating = "GOOD"
	} else {
		summary.OverallRating = "EXCELLENT"
	}

	summary.TopRecommendations = r.collectTopRecommendations(data)

	return summary
}

func (r *Reporter) collectTopRecommendations(data *ReportData) []string {
	var recommendations []string

	for _, b := range data.Bottlenecks {
		if b.Severity == "CRITICAL" || b.Severity == "HIGH" {
			recommendations = append(recommendations, b.Description)
		}
	}

	for _, idx := range data.IndexIssues {
		if idx.Severity == "CRITICAL" || idx.Severity == "HIGH" {
			recommendations = append(recommendations, idx.Suggestion)
		}
	}

	if len(recommendations) > 10 {
		recommendations = recommendations[:10]
	}

	return recommendations
}

func (r *Reporter) generateMarkdown(data *ReportData) string {
	var sb strings.Builder

	sb.WriteString("# 数据库性能体检报告\n\n")
	sb.WriteString(fmt.Sprintf("**生成时间**: %s\n\n", data.GeneratedAt.Format("2006-01-02 15:04:05")))
	sb.WriteString(fmt.Sprintf("**项目名称**: %s\n\n", data.Session.ProjectName))
	sb.WriteString(fmt.Sprintf("**版本**: %s\n\n", data.Session.Version))
	sb.WriteString(fmt.Sprintf("**会话ID**: %d\n\n", data.Session.ID))
	sb.WriteString("---\n\n")

	summary := r.calculateSummary(data)
	sb.WriteString("## 总体评估\n\n")
	sb.WriteString(fmt.Sprintf("**总体评级**: %s\n\n", summary.OverallRating))
	sb.WriteString(fmt.Sprintf("**问题总数**: %d\n", summary.TotalBottlenecks))
	sb.WriteString(fmt.Sprintf("- 严重 (CRITICAL): %d\n", summary.CriticalCount))
	sb.WriteString(fmt.Sprintf("- 高 (HIGH): %d\n", summary.HighCount))
	sb.WriteString(fmt.Sprintf("- 中 (MEDIUM): %d\n\n", summary.MediumCount))

	if len(summary.TopRecommendations) > 0 {
		sb.WriteString("### 关键建议\n\n")
		for i, rec := range summary.TopRecommendations {
			sb.WriteString(fmt.Sprintf("%d. %s\n", i+1, rec))
		}
		sb.WriteString("\n")
	}

	if len(data.Bottlenecks) > 0 {
		sb.WriteString("## 瓶颈分析\n\n")
		sb.WriteString("| 优先级 | 类别 | 描述 | 严重程度 | 影响评分 |\n")
		sb.WriteString("|--------|------|------|----------|----------|\n")

		sort.Slice(data.Bottlenecks, func(i, j int) bool {
			return data.Bottlenecks[i].Priority < data.Bottlenecks[j].Priority
		})

		for _, b := range data.Bottlenecks {
			sb.WriteString(fmt.Sprintf("| %d | %s | %s | %s | %.1f |\n",
				b.Priority, b.Category, b.Description, b.Severity, b.Impact))
		}
		sb.WriteString("\n")
	}

	if data.ConnectionPool != nil {
		sb.WriteString("## 连接池分析\n\n")
		sb.WriteString(fmt.Sprintf("**评级**: %s\n\n", data.ConnectionPool.ConnectionRating))
		sb.WriteString(fmt.Sprintf("- 最大连接数 (max_open_conns): %d\n", data.ConnectionPool.MaxOpenConns))
		sb.WriteString(fmt.Sprintf("- 最大空闲连接数 (max_idle_conns): %d\n\n", data.ConnectionPool.MaxIdleConns))

		if data.ConnectionPool.Issues != "" {
			sb.WriteString("### 发现的问题\n\n")
			for _, issue := range splitBySemicolon(data.ConnectionPool.Issues) {
				sb.WriteString(fmt.Sprintf("- %s\n", issue))
			}
			sb.WriteString("\n")
		}

		if data.ConnectionPool.Suggestions != "" {
			sb.WriteString("### 建议\n\n")
			for _, sugg := range splitBySemicolon(data.ConnectionPool.Suggestions) {
				sb.WriteString(fmt.Sprintf("- %s\n", sugg))
			}
			sb.WriteString("\n")
		}
	}

	if len(data.IndexIssues) > 0 {
		sb.WriteString("## 索引分析\n\n")

		criticalCount := 0
		highCount := 0
		mediumCount := 0

		for _, idx := range data.IndexIssues {
			switch idx.Severity {
			case "CRITICAL":
				criticalCount++
			case "HIGH":
				highCount++
			case "MEDIUM":
				mediumCount++
			}
		}

		sb.WriteString(fmt.Sprintf("**问题总数**: %d\n", len(data.IndexIssues)))
		sb.WriteString(fmt.Sprintf("- 严重: %d\n", criticalCount))
		sb.WriteString(fmt.Sprintf("- 高: %d\n", highCount))
		sb.WriteString(fmt.Sprintf("- 中: %d\n\n", mediumCount))

		sb.WriteString("### 索引问题详情\n\n")
		for _, idx := range data.IndexIssues {
			sb.WriteString(fmt.Sprintf("#### %s.%s [%s]\n\n", idx.TableName, idx.IndexName, idx.Severity))
			sb.WriteString(fmt.Sprintf("**问题类型**: %s\n\n", idx.IssueType))
			sb.WriteString(fmt.Sprintf("**描述**: %s\n\n", idx.Description))
			sb.WriteString(fmt.Sprintf("**建议**: %s\n\n", idx.Suggestion))
		}
	}

	if len(data.SlowQueries) > 0 {
		sb.WriteString("## 慢查询分析\n\n")

		var maxTime float64
		var totalTime float64
		for _, q := range data.SlowQueries {
			qt := q.QueryTime.Seconds()
			if qt > maxTime {
				maxTime = qt
			}
			totalTime += qt
		}

		sb.WriteString(fmt.Sprintf("**慢查询总数**: %d\n", len(data.SlowQueries)))
		sb.WriteString(fmt.Sprintf("**最长执行时间**: %.2f 秒\n", maxTime))
		sb.WriteString(fmt.Sprintf("**平均执行时间**: %.2f 秒\n\n", totalTime/float64(len(data.SlowQueries))))

		sb.WriteString("### 慢查询详情\n\n")
		for i, q := range data.SlowQueries {
			sb.WriteString(fmt.Sprintf("#### 查询 %d [%s]\n\n", i+1, q.Severity))
			sb.WriteString(fmt.Sprintf("**执行时间**: %.2f 秒\n", q.QueryTime.Seconds()))
			sb.WriteString(fmt.Sprintf("**锁等待时间**: %.2f 秒\n", q.LockTime.Seconds()))
			sb.WriteString(fmt.Sprintf("**扫描行数**: %d\n", q.RowsExamined))
			sb.WriteString(fmt.Sprintf("**返回行数**: %d\n\n", q.RowsSent))

			sb.WriteString("**SQL**:\n```sql\n")
			sb.WriteString(q.SQL)
			sb.WriteString("\n```\n\n")

			if q.Description != "" {
				sb.WriteString(fmt.Sprintf("**问题**: %s\n\n", q.Description))
			}

			if q.Suggestion != "" {
				sb.WriteString(fmt.Sprintf("**建议**: %s\n\n", q.Suggestion))
			}

			if q.OptimizedSQL != "" {
				sb.WriteString("**优化后SQL**:\n```sql\n")
				sb.WriteString(q.OptimizedSQL)
				sb.WriteString("\n```\n\n")
			}
		}
	}

	if len(data.WritePerformance) > 0 {
		sb.WriteString("## 写入性能分析\n\n")

		for _, wp := range data.WritePerformance {
			sb.WriteString(fmt.Sprintf("**表**: %s\n\n", wp.TableName))
			sb.WriteString(fmt.Sprintf("**单条写入平均时间**: %v\n", wp.AvgSingleRowTime))
			sb.WriteString(fmt.Sprintf("**批量写入平均时间**: %v\n", wp.AvgBatchRowTime))
			sb.WriteString(fmt.Sprintf("**性能比**: %.2fx\n\n", wp.PerformanceRatio))
			sb.WriteString(fmt.Sprintf("**建议**: %s\n\n", wp.Recommendation))
		}
	}

	if data.ReadWrite != nil {
		sb.WriteString("## 读写分离分析\n\n")
		sb.WriteString(fmt.Sprintf("**是否启用**: %v\n", data.ReadWrite.ReadWriteEnabled))
		sb.WriteString(fmt.Sprintf("**配置读比例**: %.2f\n", data.ReadWrite.ReadRatio))
		sb.WriteString(fmt.Sprintf("**实际读比例**: %.2f\n", data.ReadWrite.ActualReadRatio))
		sb.WriteString(fmt.Sprintf("**读端点数量**: %d\n\n", data.ReadWrite.ReadEndpointCount))

		if data.ReadWrite.Issues != "" {
			sb.WriteString("### 发现的问题\n\n")
			for _, issue := range splitBySemicolon(data.ReadWrite.Issues) {
				sb.WriteString(fmt.Sprintf("- %s\n", issue))
			}
			sb.WriteString("\n")
		}

		if data.ReadWrite.Suggestions != "" {
			sb.WriteString("### 建议\n\n")
			for _, sugg := range splitBySemicolon(data.ReadWrite.Suggestions) {
				sb.WriteString(fmt.Sprintf("- %s\n", sugg))
			}
			sb.WriteString("\n")
		}
	}

	if data.Sharding != nil {
		sb.WriteString("## 分库分表分析\n\n")
		sb.WriteString(fmt.Sprintf("**是否启用**: %v\n", data.Sharding.ShardingEnabled))
		sb.WriteString(fmt.Sprintf("**分片键**: %s\n", data.Sharding.ShardKey))
		sb.WriteString(fmt.Sprintf("**分片数量**: %d\n", data.Sharding.ShardCount))
		sb.WriteString(fmt.Sprintf("**热点风险**: %s\n\n", data.Sharding.HotspotRisk))

		if data.Sharding.HotspotTables != "" {
			sb.WriteString("### 热点表\n\n")
			for _, table := range splitBySemicolon(data.Sharding.HotspotTables) {
				sb.WriteString(fmt.Sprintf("- %s\n", table))
			}
			sb.WriteString("\n")
		}

		if data.Sharding.Suggestions != "" {
			sb.WriteString("### 建议\n\n")
			for _, sugg := range splitBySemicolon(data.Sharding.Suggestions) {
				sb.WriteString(fmt.Sprintf("- %s\n", sugg))
			}
			sb.WriteString("\n")
		}
	}

	sb.WriteString("---\n\n")
	sb.WriteString("*此报告由 db-audit 工具自动生成*\n")

	return sb.String()
}

func splitBySemicolon(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ";")
	var result []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}
	return result
}
