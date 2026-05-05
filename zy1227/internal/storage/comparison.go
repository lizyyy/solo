package storage

import (
	"fmt"

	"github.com/yourteam/sync-analyzer/internal/models"
)

// CompareRuns 比较两次分析运行的结果
func (s *SQLiteStore) CompareRuns(baseRunID, compareRunID int64) (*models.ComparisonResult, error) {
	// 获取两次运行的结果
	baseResult, err := s.GetAnalysisResult(baseRunID)
	if err != nil {
		return nil, fmt.Errorf("failed to get base run: %w", err)
	}

	compareResult, err := s.GetAnalysisResult(compareRunID)
	if err != nil {
		return nil, fmt.Errorf("failed to get compare run: %w", err)
	}

	// 构建比较结果
	result := &models.ComparisonResult{
		BaseRunID:      baseRunID,
		BaseRunName:    baseResult.RunName,
		CompareRunID:   compareRunID,
		CompareRunName: compareResult.RunName,
		NewIssues:      []models.Issue{},
		FixedIssues:    []models.Issue{},
		ChangedIssues:  []models.IssueChange{},
	}

	// 创建问题指纹映射
	baseIssueMap := make(map[string]models.Issue)
	for _, issue := range baseResult.Issues {
		fingerprint := generateIssueFingerprint(&issue)
		baseIssueMap[fingerprint] = issue
	}

	compareIssueMap := make(map[string]models.Issue)
	for _, issue := range compareResult.Issues {
		fingerprint := generateIssueFingerprint(&issue)
		compareIssueMap[fingerprint] = issue
	}

	// 查找新增的问题
	for fingerprint, issue := range compareIssueMap {
		if _, exists := baseIssueMap[fingerprint]; !exists {
			result.NewIssues = append(result.NewIssues, issue)
		}
	}

	// 查找已修复的问题
	for fingerprint, issue := range baseIssueMap {
		if _, exists := compareIssueMap[fingerprint]; !exists {
			result.FixedIssues = append(result.FixedIssues, issue)
		}
	}

	// 查找严重程度变化的问题
	for fingerprint, baseIssue := range baseIssueMap {
		if compareIssue, exists := compareIssueMap[fingerprint]; exists {
			if baseIssue.Severity != compareIssue.Severity {
				result.ChangedIssues = append(result.ChangedIssues, models.IssueChange{
					IssueID:     compareIssue.ID,
					OldSeverity: baseIssue.Severity,
					NewSeverity: compareIssue.Severity,
					Description: compareIssue.Description,
				})
			}
		}
	}

	// 生成摘要
	result.Summary = models.ComparisonSummary{
		NewIssueCount:     len(result.NewIssues),
		FixedIssueCount:   len(result.FixedIssues),
		ChangedIssueCount: len(result.ChangedIssues),
	}

	return result, nil
}

// generateIssueFingerprint 生成问题指纹，用于比较问题是否是同一个问题
func generateIssueFingerprint(issue *models.Issue) string {
	// 使用问题类型、文件和行号作为指纹
	// 这是一个简单的实现，可以根据需要改进
	return fmt.Sprintf("%s:%s:%d", issue.Type, issue.File, issue.Line)
}

// GetLatestAnalysisRun 获取最新的分析运行
func (s *SQLiteStore) GetLatestAnalysisRun() (*models.AnalysisRun, error) {
	query := `
	SELECT id, name, start_time, end_time, status, created_at, updated_at
	FROM analysis_runs
	ORDER BY created_at DESC
	LIMIT 1
	`

	var run models.AnalysisRun
	err := s.db.QueryRow(query).Scan(
		&run.ID,
		&run.Name,
		&run.StartTime,
		&run.EndTime,
		&run.Status,
		&run.CreatedAt,
		&run.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get latest analysis run: %w", err)
	}

	return &run, nil
}

// GetIssueStatistics 获取问题统计信息
func (s *SQLiteStore) GetIssueStatistics() (map[models.IssueType]int, error) {
	query := `
	SELECT type, COUNT(*) as count
	FROM issues
	GROUP BY type
	ORDER BY count DESC
	`

	rows, err := s.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to get issue statistics: %w", err)
	}
	defer rows.Close()

	stats := make(map[models.IssueType]int)
	for rows.Next() {
		var issueType string
		var count int
		if err := rows.Scan(&issueType, &count); err != nil {
			return nil, fmt.Errorf("failed to scan issue statistics: %w", err)
		}
		stats[models.IssueType(issueType)] = count
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate issue statistics: %w", err)
	}

	return stats, nil
}

// GetSeverityStatistics 获取严重程度统计信息
func (s *SQLiteStore) GetSeverityStatistics() (map[models.IssueSeverity]int, error) {
	query := `
	SELECT severity, COUNT(*) as count
	FROM issues
	GROUP BY severity
	`

	rows, err := s.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to get severity statistics: %w", err)
	}
	defer rows.Close()

	stats := make(map[models.IssueSeverity]int)
	for rows.Next() {
		var severity string
		var count int
		if err := rows.Scan(&severity, &count); err != nil {
			return nil, fmt.Errorf("failed to scan severity statistics: %w", err)
		}
		stats[models.IssueSeverity(severity)] = count
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate severity statistics: %w", err)
	}

	return stats, nil
}
