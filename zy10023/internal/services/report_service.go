package services

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"sort"
	"time"

	"github.com/api-guardian/api-guardian/internal/database"
	"github.com/api-guardian/api-guardian/internal/logger"
	"github.com/api-guardian/api-guardian/internal/models"
	"github.com/api-guardian/api-guardian/internal/tracing"
	"go.opentelemetry.io/otel/codes"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type ReportService struct {
	db *gorm.DB
}

func NewReportService() *ReportService {
	return &ReportService{db: database.GetDB()}
}

func (s *ReportService) CreateIssueReport(ctx context.Context, report *models.IssueReport) error {
	_, span := tracing.Start(ctx, "report.create_issue")
	defer span.End()

	if err := s.db.Create(report).Error; err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}

	logger.Info("Issue report created",
		zap.Uint("report_id", report.ID),
		zap.String("severity", report.Severity),
		zap.String("category", report.Category),
	)

	tracing.AddAttribute(span, "report_id", report.ID)
	return nil
}

func (s *ReportService) GetIssueReport(ctx context.Context, id uint) (*models.IssueReport, error) {
	_, span := tracing.Start(ctx, "report.get_issue")
	defer span.End()

	var report models.IssueReport
	if err := s.db.First(&report, id).Error; err != nil {
		return nil, err
	}

	return &report, nil
}

func (s *ReportService) ListIssueReports(ctx context.Context, status, severity string, page, pageSize int) ([]models.IssueReport, int64, error) {
	_, span := tracing.Start(ctx, "report.list_issues")
	defer span.End()

	var reports []models.IssueReport
	var total int64

	query := s.db.Model(&models.IssueReport{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if severity != "" {
		query = query.Where("severity = ?", severity)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&reports).Error; err != nil {
		return nil, 0, err
	}

	return reports, total, nil
}

func (s *ReportService) UpdateIssueReport(ctx context.Context, report *models.IssueReport) error {
	_, span := tracing.Start(ctx, "report.update_issue")
	defer span.End()

	if report.Status == "resolved" && report.ResolvedAt == nil {
		now := time.Now()
		report.ResolvedAt = &now
	}

	return s.db.Save(report).Error
}

type TrafficReport struct {
	TestID            uint                  `json:"test_id"`
	TestName          string                `json:"test_name"`
	StartTime         time.Time             `json:"start_time"`
	EndTime           time.Time             `json:"end_time"`
	Duration          time.Duration         `json:"duration"`
	TotalRequests     int                   `json:"total_requests"`
	SuccessCount      int                   `json:"success_count"`
	FailureCount      int                   `json:"failure_count"`
	SuccessRate       float64               `json:"success_rate"`
	AvgResponseTime   float64               `json:"avg_response_time_ms"`
	P95ResponseTime   float64               `json:"p95_response_time_ms"`
	P99ResponseTime   float64               `json:"p99_response_time_ms"`
	StatusCodes       map[int]int           `json:"status_codes"`
	SlowRequests      []TrafficSlowRequest  `json:"slow_requests"`
	ErrorRequests     []TrafficErrorRequest `json:"error_requests"`
	Recommendations   []string              `json:"recommendations"`
}

type TrafficSlowRequest struct {
	RequestNumber int    `json:"request_number"`
	ResponseTime  int64  `json:"response_time_ms"`
	TraceID       string `json:"trace_id"`
}

type TrafficErrorRequest struct {
	RequestNumber int    `json:"request_number"`
	StatusCode    int    `json:"status_code"`
	ErrorMessage  string `json:"error_message"`
	TraceID       string `json:"trace_id"`
}

func (s *ReportService) GenerateTrafficReport(ctx context.Context, testID uint) (*TrafficReport, error) {
	_, span := tracing.Start(ctx, "report.generate_traffic")
	defer span.End()

	var test models.TrafficTest
	if err := s.db.First(&test, testID).Error; err != nil {
		return nil, err
	}

	var results []models.TrafficTestResult
	if err := s.db.Where("traffic_test_id = ?", testID).Find(&results).Error; err != nil {
		return nil, err
	}

	report := &TrafficReport{
		TestID:          test.ID,
		TestName:        test.Name,
		StartTime:       *test.StartTime,
		EndTime:         *test.EndTime,
		Duration:        test.EndTime.Sub(*test.StartTime),
		TotalRequests:   test.TotalRequests,
		SuccessCount:    test.SuccessCount,
		FailureCount:    test.FailureCount,
		AvgResponseTime: test.AvgResponseTimeMs,
		P95ResponseTime: test.P95ResponseTimeMs,
		P99ResponseTime: test.P99ResponseTimeMs,
		StatusCodes:     make(map[int]int),
		Recommendations: []string{},
	}

	if test.TotalRequests > 0 {
		report.SuccessRate = float64(test.SuccessCount) / float64(test.TotalRequests) * 100
	}

	var slowRequests []TrafficSlowRequest
	var errorRequests []TrafficErrorRequest

	for _, result := range results {
		report.StatusCodes[result.StatusCode]++

		if result.ResponseTimeMs > 2000 {
			slowRequests = append(slowRequests, TrafficSlowRequest{
				RequestNumber: result.RequestNumber,
				ResponseTime:  result.ResponseTimeMs,
				TraceID:       result.TraceID,
			})
		}

		if !result.IsSuccess {
			errorRequests = append(errorRequests, TrafficErrorRequest{
				RequestNumber: result.RequestNumber,
				StatusCode:    result.StatusCode,
				ErrorMessage:  result.ErrorMessage,
				TraceID:       result.TraceID,
			})
		}
	}

	sort.Slice(slowRequests, func(i, j int) bool {
		return slowRequests[i].ResponseTime > slowRequests[j].ResponseTime
	})

	if len(slowRequests) > 10 {
		report.SlowRequests = slowRequests[:10]
	} else {
		report.SlowRequests = slowRequests
	}

	report.ErrorRequests = errorRequests

	report.Recommendations = s.generateRecommendations(report)

	tracing.AddAttribute(span, "test_id", testID)
	tracing.AddAttribute(span, "success_rate", report.SuccessRate)

	return report, nil
}

func (s *ReportService) generateRecommendations(report *TrafficReport) []string {
	var recommendations []string

	if report.SuccessRate < 90 {
		recommendations = append(recommendations, "成功率低于90%，建议检查服务稳定性和错误率")
	}

	if report.P99ResponseTime > 5000 {
		recommendations = append(recommendations, "P99响应时间超过5秒，建议优化慢查询或增加服务器资源")
	}

	if report.P95ResponseTime > 2000 {
		recommendations = append(recommendations, "P95响应时间超过2秒，建议检查数据库性能和网络延迟")
	}

	if len(report.SlowRequests) > 100 {
		recommendations = append(recommendations, "存在大量慢请求，建议分析慢请求的trace详情")
	}

	if len(report.StatusCodes) > 5 {
		recommendations = append(recommendations, "返回多种状态码，建议检查接口行为一致性")
	}

	if len(recommendations) == 0 {
		recommendations = append(recommendations, "测试结果良好，各项指标在正常范围内")
	}

	return recommendations
}

func (s *ReportService) ExportTrafficReportAsCSV(ctx context.Context, testID uint) ([]byte, error) {
	_, span := tracing.Start(ctx, "report.export_csv")
	defer span.End()

	report, err := s.GenerateTrafficReport(ctx, testID)
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)
	writer.Comma = ','

	writer.Write([]string{"API Guardian - Traffic Test Report"})
	writer.Write([]string{})
	writer.Write([]string{"Test Name", report.TestName})
	writer.Write([]string{"Test ID", fmt.Sprintf("%d", report.TestID)})
	writer.Write([]string{"Start Time", report.StartTime.Format(time.RFC3339)})
	writer.Write([]string{"End Time", report.EndTime.Format(time.RFC3339)})
	writer.Write([]string{"Duration", report.Duration.String()})
	writer.Write([]string{})

	writer.Write([]string{"Summary"})
	writer.Write([]string{"Total Requests", fmt.Sprintf("%d", report.TotalRequests)})
	writer.Write([]string{"Success Count", fmt.Sprintf("%d", report.SuccessCount)})
	writer.Write([]string{"Failure Count", fmt.Sprintf("%d", report.FailureCount)})
	writer.Write([]string{"Success Rate", fmt.Sprintf("%.2f%%", report.SuccessRate)})
	writer.Write([]string{"Avg Response Time (ms)", fmt.Sprintf("%.2f", report.AvgResponseTime)})
	writer.Write([]string{"P95 Response Time (ms)", fmt.Sprintf("%.2f", report.P95ResponseTime)})
	writer.Write([]string{"P99 Response Time (ms)", fmt.Sprintf("%.2f", report.P99ResponseTime)})
	writer.Write([]string{})

	writer.Write([]string{"Status Code Distribution"})
	for code, count := range report.StatusCodes {
		writer.Write([]string{fmt.Sprintf("%d", code), fmt.Sprintf("%d", count)})
	}
	writer.Write([]string{})

	writer.Write([]string{"Recommendations"})
	for _, rec := range report.Recommendations {
		writer.Write([]string{rec})
	}

	writer.Flush()

	logger.Info("Traffic report exported as CSV", zap.Uint("test_id", testID))
	return buf.Bytes(), nil
}

func (s *ReportService) ExportTrafficReportAsJSON(ctx context.Context, testID uint) ([]byte, error) {
	_, span := tracing.Start(ctx, "report.export_json")
	defer span.End()

	report, err := s.GenerateTrafficReport(ctx, testID)
	if err != nil {
		return nil, err
	}

	data, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return nil, err
	}

	logger.Info("Traffic report exported as JSON", zap.Uint("test_id", testID))
	return data, nil
}

func (s *ReportService) DetectIssuesFromTestResults(ctx context.Context, testID uint) ([]models.IssueReport, error) {
	ctx, span := tracing.Start(ctx, "report.detect_issues")
	defer span.End()

	report, err := s.GenerateTrafficReport(ctx, testID)
	if err != nil {
		return nil, err
	}

	var issues []models.IssueReport

	if report.SuccessRate < 90 {
		issue := models.IssueReport{
			Title:       fmt.Sprintf("Test %s: 低成功率 (%.2f%%)", report.TestName, report.SuccessRate),
			Description: fmt.Sprintf("测试成功率仅为%.2f%%，低于90%%的阈值。总请求: %d, 失败: %d",
				report.SuccessRate, report.TotalRequests, report.FailureCount),
			Severity:    "high",
			Category:    "stability",
			Status:      "open",
			SourceType:  "traffic_test",
			SourceID:    testID,
		}
		issues = append(issues, issue)
	}

	if report.P99ResponseTime > 5000 {
		issue := models.IssueReport{
			Title:       fmt.Sprintf("Test %s: P99响应时间过高", report.TestName),
			Description: fmt.Sprintf("P99响应时间为%.2fms，超过5000ms阈值", report.P99ResponseTime),
			Severity:    "high",
			Category:    "performance",
			Status:      "open",
			SourceType:  "traffic_test",
			SourceID:    testID,
		}
		issues = append(issues, issue)
	}

	if len(report.ErrorRequests) > 0 {
		var traceIDs []string
		for _, err := range report.ErrorRequests {
			traceIDs = append(traceIDs, err.TraceID)
		}
		issue := models.IssueReport{
			Title:       fmt.Sprintf("Test %s: 发现错误请求", report.TestName),
			Description: fmt.Sprintf("测试中发现%d个错误请求", len(report.ErrorRequests)),
			Severity:    "high",
			Category:    "errors",
			Status:      "open",
			SourceType:  "traffic_test",
			SourceID:    testID,
			TraceIDs:    map[string]interface{}{"trace_ids": traceIDs},
		}
		issues = append(issues, issue)
	}

	for _, issue := range issues {
		if err := s.CreateIssueReport(ctx, &issue); err != nil {
			logger.Error("Failed to create issue report", zap.Error(err))
		}
	}

	tracing.AddAttribute(span, "issues_detected", len(issues))
	return issues, nil
}
