package service

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"shadow-test-api/internal/model"
	"shadow-test-api/internal/storage"
	"strconv"
	"strings"
	"time"
)

type ShadowTestService struct {
	store *storage.Storage
}

func NewShadowTestService(store *storage.Storage) *ShadowTestService {
	return &ShadowTestService{store: store}
}

func (s *ShadowTestService) CreateRule(req *model.CreateRuleRequest) (*model.ProxyRule, error) {
	rule := &model.ProxyRule{
		Name:        req.Name,
		Description: req.Description,
		PathPattern: req.PathPattern,
		Method:      req.Method,
		RewriteTo:   req.RewriteTo,
		Headers:     storage.ToJSON(req.Headers),
		IsActive:    true,
	}
	err := s.store.CreateRule(rule)
	return rule, err
}

func (s *ShadowTestService) GetRule(id string) (*model.ProxyRule, error) {
	return s.store.GetRule(id)
}

func (s *ShadowTestService) ListRules(page, pageSize int) (*model.PaginationResponse, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	rules, total, err := s.store.ListRules(page, pageSize)
	if err != nil {
		return nil, err
	}
	return &model.PaginationResponse{
		Total:    int(total),
		Page:     page,
		PageSize: pageSize,
		Items:    rules,
	}, nil
}

func (s *ShadowTestService) CreateSampleRequest(req *model.CreateSampleRequest) (*model.SampleRequest, error) {
	sample := &model.SampleRequest{
		Path:         req.Path,
		Method:       req.Method,
		Headers:      storage.ToJSON(req.Headers),
		Body:         req.Body,
		ExpectedPath: req.ExpectedPath,
		ExpectedCode: req.ExpectedCode,
		Source:       req.Source,
	}
	err := s.store.CreateSampleRequest(sample)
	return sample, err
}

func (s *ShadowTestService) GetSampleRequest(id string) (*model.SampleRequest, error) {
	return s.store.GetSampleRequest(id)
}

func (s *ShadowTestService) ListSampleRequests(page, pageSize int) (*model.PaginationResponse, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	reqs, total, err := s.store.ListSampleRequests(page, pageSize)
	if err != nil {
		return nil, err
	}
	return &model.PaginationResponse{
		Total:    int(total),
		Page:     page,
		PageSize: pageSize,
		Items:    reqs,
	}, nil
}

func (s *ShadowTestService) CreateBatch(req *model.CreateBatchRequest) (*model.ShadowBatch, error) {
	batch := &model.ShadowBatch{
		Name:    req.Name,
		RuleIDs: storage.ToJSON(req.RuleIDs),
		Status:  "pending",
	}
	err := s.store.CreateBatch(batch)
	return batch, err
}

func (s *ShadowTestService) GetBatch(id string) (*model.ShadowBatch, error) {
	return s.store.GetBatch(id)
}

func (s *ShadowTestService) ListBatches(page, pageSize int) (*model.PaginationResponse, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	batches, total, err := s.store.ListBatches(page, pageSize)
	if err != nil {
		return nil, err
	}
	return &model.PaginationResponse{
		Total:    int(total),
		Page:     page,
		PageSize: pageSize,
		Items:    batches,
	}, nil
}

func (s *ShadowTestService) ExecuteBatch(batchID string) error {
	batch, err := s.store.GetBatch(batchID)
	if err != nil {
		return err
	}

	if batch.Status != "pending" {
		return fmt.Errorf("batch status must be pending, current: %s", batch.Status)
	}

	batch.Status = "running"
	batch.StartedAt = time.Now()
	s.store.UpdateBatch(batch)

	var ruleIDs []string
	storage.FromJSON(batch.RuleIDs, &ruleIDs)
	rules, err := s.store.GetRulesByIDs(ruleIDs)
	if err != nil {
		batch.Status = "failed"
		s.store.UpdateBatch(batch)
		return err
	}

	samples, err := s.store.GetAllSampleRequests()
	if err != nil {
		batch.Status = "failed"
		s.store.UpdateBatch(batch)
		return err
	}

	passCount := 0
	failCount := 0
	totalCount := len(samples) * len(rules)

	for _, sample := range samples {
		for _, rule := range rules {
			result := s.processSampleRuleMatch(batchID, &sample, &rule)
			if result.IsPass {
				passCount++
			} else {
				failCount++
			}
		}
	}

	batch.Status = "completed"
	batch.TotalCount = totalCount
	batch.PassCount = passCount
	batch.FailCount = failCount
	batch.CompletedAt = time.Now()
	return s.store.UpdateBatch(batch)
}

func (s *ShadowTestService) processSampleRuleMatch(batchID string, sample *model.SampleRequest, rule *model.ProxyRule) *model.HitResult {
	isHit := s.matchRule(sample, rule)

	actualPath := sample.Path
	actualCode := sample.ExpectedCode

	if isHit && rule.RewriteTo != "" {
		actualPath = s.applyRewrite(sample.Path, rule.PathPattern, rule.RewriteTo)
	}

	hasDiff := false
	diffReason := ""

	if sample.ExpectedPath != "" && actualPath != sample.ExpectedPath {
		hasDiff = true
		diffReason = fmt.Sprintf("路径不匹配: 期望=%s, 实际=%s", sample.ExpectedPath, actualPath)
		s.createDiffReason("", "path", sample.ExpectedPath, actualPath, "high", diffReason)
	}

	if sample.ExpectedCode != 0 && actualCode != sample.ExpectedCode {
		hasDiff = true
		codeDiff := fmt.Sprintf("状态码不匹配: 期望=%d, 实际=%d", sample.ExpectedCode, actualCode)
		if diffReason == "" {
			diffReason = codeDiff
		} else {
			diffReason += "; " + codeDiff
		}
		s.createDiffReason("", "status_code", strconv.Itoa(sample.ExpectedCode), strconv.Itoa(actualCode), "high", codeDiff)
	}

	isPass := !hasDiff

	rawReq, _ := json.Marshal(map[string]interface{}{
		"path":    sample.Path,
		"method":  sample.Method,
		"headers": sample.Headers,
		"body":    sample.Body,
	})

	result := &model.HitResult{
		BatchID:    batchID,
		RequestID:  sample.ID,
		RuleID:     rule.ID,
		IsHit:      isHit,
		ActualPath: actualPath,
		ActualCode: actualCode,
		IsPass:     isPass,
		HasDiff:    hasDiff,
		DiffReason: diffReason,
		RawRequest: string(rawReq),
	}

	s.store.CreateHitResult(result)
	return result
}

func (s *ShadowTestService) matchRule(sample *model.SampleRequest, rule *model.ProxyRule) bool {
	if rule.Method != "" && rule.Method != "*" && !strings.EqualFold(sample.Method, rule.Method) {
		return false
	}

	pattern := regexp.QuoteMeta(rule.PathPattern)
	pattern = strings.ReplaceAll(pattern, "\\*", ".*")
	pattern = strings.ReplaceAll(pattern, "\\?", ".")
	matched, _ := regexp.MatchString("^"+pattern+"$", sample.Path)
	return matched
}

func (s *ShadowTestService) applyRewrite(path, pattern, rewriteTo string) string {
	rePattern := regexp.QuoteMeta(pattern)
	rePattern = strings.ReplaceAll(rePattern, "\\*", "(.*)")
	re := regexp.MustCompile("^" + rePattern + "$")

	matches := re.FindStringSubmatch(path)
	if len(matches) == 0 {
		return path
	}

	result := rewriteTo
	for i, match := range matches[1:] {
		result = strings.ReplaceAll(result, fmt.Sprintf("$%d", i+1), match)
	}
	return result
}

func (s *ShadowTestService) createDiffReason(resultID, field, expected, actual, severity, desc string) {
	diff := &model.DiffReason{
		ResultID:    resultID,
		Field:       field,
		Expected:    expected,
		Actual:      actual,
		Severity:    severity,
		Description: desc,
	}
	s.store.CreateDiffReason(diff)
}

func (s *ShadowTestService) CorrectResult(req *model.CorrectResultRequest) (*model.HitResult, error) {
	result, err := s.store.GetHitResult(req.ResultID)
	if err != nil {
		return nil, err
	}

	result.IsCorrected = req.IsCorrected
	result.Remark = req.Remark

	if req.IsCorrected {
		result.IsPass = true
		result.HasDiff = false
		result.DiffReason = ""
	}

	err = s.store.UpdateHitResult(result)
	return result, err
}

func (s *ShadowTestService) ListHitResults(batchID string, page, pageSize int) (*model.PaginationResponse, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	results, total, err := s.store.ListHitResultsByBatch(batchID, page, pageSize)
	if err != nil {
		return nil, err
	}
	return &model.PaginationResponse{
		Total:    int(total),
		Page:     page,
		PageSize: pageSize,
		Items:    results,
	}, nil
}

func (s *ShadowTestService) ExportReport(batchID, format string) (*model.TestReport, error) {
	batch, err := s.store.GetBatch(batchID)
	if err != nil {
		return nil, err
	}

	results, _, err := s.store.ListHitResultsByBatch(batchID, 1, 10000)
	if err != nil {
		return nil, err
	}

	var content string
	if format == "json" || format == "" {
		reportData := map[string]interface{}{
			"batch":   batch,
			"results": results,
			"summary": map[string]interface{}{
				"total":   batch.TotalCount,
				"pass":    batch.PassCount,
				"fail":    batch.FailCount,
				"passRate": fmt.Sprintf("%.2f%%", float64(batch.PassCount)/float64(batch.TotalCount)*100),
			},
		}
		data, _ := json.MarshalIndent(reportData, "", "  ")
		content = string(data)
	} else {
		content = s.generateMarkdownReport(batch, results)
	}

	report := &model.TestReport{
		BatchID: batchID,
		Content: content,
		Format:  format,
	}
	err = s.store.CreateReport(report)
	return report, err
}

func (s *ShadowTestService) generateMarkdownReport(batch *model.ShadowBatch, results []model.HitResult) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("# 影子测试报告: %s\n\n", batch.Name))
	sb.WriteString(fmt.Sprintf("- 执行时间: %s\n", batch.CompletedAt.Format(time.RFC3339)))
	sb.WriteString(fmt.Sprintf("- 总用例数: %d\n", batch.TotalCount))
	sb.WriteString(fmt.Sprintf("- 通过数: %d\n", batch.PassCount))
	sb.WriteString(fmt.Sprintf("- 失败数: %d\n", batch.FailCount))
	sb.WriteString(fmt.Sprintf("- 通过率: %.2f%%\n\n", float64(batch.PassCount)/float64(batch.TotalCount)*100))

	sb.WriteString("## 失败用例详情\n\n")
	for _, result := range results {
		if !result.IsPass {
			sb.WriteString(fmt.Sprintf("### 结果ID: %s\n", result.ID))
			sb.WriteString(fmt.Sprintf("- 规则ID: %s\n", result.RuleID))
			sb.WriteString(fmt.Sprintf("- 请求ID: %s\n", result.RequestID))
			sb.WriteString(fmt.Sprintf("- 是否命中: %v\n", result.IsHit))
			sb.WriteString(fmt.Sprintf("- 实际路径: %s\n", result.ActualPath))
			sb.WriteString(fmt.Sprintf("- 差异原因: %s\n\n", result.DiffReason))
		}
	}
	return sb.String()
}

func (s *ShadowTestService) ListReports(page, pageSize int) (*model.PaginationResponse, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	reports, total, err := s.store.ListReports(page, pageSize)
	if err != nil {
		return nil, err
	}
	return &model.PaginationResponse{
		Total:    int(total),
		Page:     page,
		PageSize: pageSize,
		Items:    reports,
	}, nil
}

func (s *ShadowTestService) UpdateBatchStatus(batchID, status string) (*model.ShadowBatch, error) {
	validStatus := map[string]bool{"pending": true, "running": true, "completed": true, "failed": true, "cancelled": true}
	if !validStatus[status] {
		return nil, fmt.Errorf("invalid status: %s", status)
	}

	batch, err := s.store.GetBatch(batchID)
	if err != nil {
		return nil, err
	}

	batch.Status = status
	err = s.store.UpdateBatch(batch)
	return batch, err
}

func (s *ShadowTestService) ReCalculateBatch(batchID string) error {
	batch, err := s.store.GetBatch(batchID)
	if err != nil {
		return err
	}

	batch.Status = "pending"
	batch.TotalCount = 0
	batch.PassCount = 0
	batch.FailCount = 0
	err = s.store.UpdateBatch(batch)
	if err != nil {
		return err
	}

	return s.ExecuteBatch(batchID)
}

func RespondSuccess(data interface{}) *model.APIResponse {
	return &model.APIResponse{
		Code:    http.StatusOK,
		Message: "success",
		Data:    data,
	}
}

func RespondError(code int, message string) *model.APIResponse {
	return &model.APIResponse{
		Code:    code,
		Message: message,
	}
}
