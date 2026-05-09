package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"reflect"
	"sort"
	"time"

	"github.com/api-guardian/api-guardian/internal/database"
	"github.com/api-guardian/api-guardian/internal/logger"
	"github.com/api-guardian/api-guardian/internal/models"
	"github.com/api-guardian/api-guardian/internal/tracing"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type ConsistencyService struct {
	db *gorm.DB
}

func NewConsistencyService() *ConsistencyService {
	return &ConsistencyService{db: database.GetDB()}
}

type ConsistencyIssue struct {
	Field     string `json:"field"`
	Type      string `json:"type"`
	Expected  interface{} `json:"expected"`
	Actual    interface{} `json:"actual"`
	Severity  string `json:"severity"`
}

type ConsistencyCheckResult struct {
	IsConsistent bool              `json:"is_consistent"`
	Issues       []ConsistencyIssue `json:"issues"`
	CheckedAt    time.Time         `json:"checked_at"`
}

func (s *ConsistencyService) CheckMockVsDefinition(ctx context.Context, apiID uint) (*ConsistencyCheckResult, error) {
	_, span := tracing.Start(ctx, "consistency.mock_vs_definition")
	defer span.End()

	var api models.APIDefinition
	if err := s.db.Preload("MockResponses").First(&api, apiID).Error; err != nil {
		span.RecordError(err)
		return nil, err
	}

	result := &ConsistencyCheckResult{
		IsConsistent: true,
		CheckedAt:    time.Now(),
	}

	for _, mockResp := range api.MockResponses {
		if !mockResp.IsDefault {
			continue
		}

		definitionSchema := api.ResponseSchema
		mockResponse := mockResp.ResponseBody

		issues := s.compareSchemas(definitionSchema, mockResponse, "")
		result.Issues = append(result.Issues, issues...)
	}

	result.IsConsistent = len(result.Issues) == 0

	check := &models.ConsistencyCheck{
		APIDefinitionID: apiID,
		CheckType:       "mock_vs_definition",
		Description:     "比较Mock响应与接口定义",
		IsConsistent:    result.IsConsistent,
		CheckedAt:       result.CheckedAt,
	}

	if len(result.Issues) > 0 {
		issuesJSON, _ := json.Marshal(result.Issues)
		check.Issues = models.JSONB{}
		json.Unmarshal(issuesJSON, &check.Issues)
	}

	s.db.Create(check)

	tracing.AddAttribute(span, "api_id", apiID)
	tracing.AddAttribute(span, "is_consistent", result.IsConsistent)
	tracing.AddAttribute(span, "issues_count", len(result.Issues))

	return result, nil
}

func (s *ConsistencyService) CheckMockVsReal(ctx context.Context, apiID uint, realURL string) (*ConsistencyCheckResult, error) {
	ctx, span := tracing.Start(ctx, "consistency.mock_vs_real")
	defer span.End()

	var api models.APIDefinition
	if err := s.db.Preload("MockResponses").First(&api, apiID).Error; err != nil {
		span.RecordError(err)
		return nil, err
	}

	result := &ConsistencyCheckResult{
		IsConsistent: true,
		CheckedAt:    time.Now(),
	}

	var defaultMock *models.MockResponse
	for _, mock := range api.MockResponses {
		if mock.IsDefault {
			defaultMock = &mock
			break
		}
	}

	if defaultMock == nil && len(api.MockResponses) > 0 {
		defaultMock = &api.MockResponses[0]
	}

	if defaultMock == nil {
		result.IsConsistent = false
		result.Issues = append(result.Issues, ConsistencyIssue{
			Field:    "mock_response",
			Type:     "missing",
			Severity: "high",
			Expected: "存在默认Mock响应",
			Actual:   "无Mock响应配置",
		})
		return result, nil
	}

	realResp, err := s.callRealAPI(ctx, api, realURL)
	if err != nil {
		result.IsConsistent = false
		result.Issues = append(result.Issues, ConsistencyIssue{
			Field:    "real_api",
			Type:     "error",
			Severity: "high",
			Expected: "成功调用真实接口",
			Actual:   err.Error(),
		})
		return result, nil
	}

	mockResp := defaultMock.ResponseBody

	if defaultMock.StatusCode != 200 && defaultMock.StatusCode != realResp.StatusCode {
		result.Issues = append(result.Issues, ConsistencyIssue{
			Field:    "status_code",
			Type:     "mismatch",
			Severity: "high",
			Expected: defaultMock.StatusCode,
			Actual:   realResp.StatusCode,
		})
	}

	schemaIssues := s.compareSchemas(mockResp, realResp.Body, "")
	result.Issues = append(result.Issues, schemaIssues...)
	result.IsConsistent = len(result.Issues) == 0

	check := &models.ConsistencyCheck{
		APIDefinitionID: apiID,
		CheckType:       "mock_vs_real",
		Description:     "比较Mock响应与真实接口",
		IsConsistent:    result.IsConsistent,
		CheckedAt:       result.CheckedAt,
	}

	if len(result.Issues) > 0 {
		issuesJSON, _ := json.Marshal(result.Issues)
		check.Issues = models.JSONB{}
		json.Unmarshal(issuesJSON, &check.Issues)
	}

	s.db.Create(check)

	tracing.AddAttribute(span, "api_id", apiID)
	tracing.AddAttribute(span, "is_consistent", result.IsConsistent)

	return result, nil
}

type RealAPIResponse struct {
	StatusCode int
	Body       map[string]interface{}
	Headers    map[string]string
}

func (s *ConsistencyService) callRealAPI(ctx context.Context, api models.APIDefinition, url string) (*RealAPIResponse, error) {
	_, span := tracing.Start(ctx, "consistency.call_real_api")
	defer span.End()

	var reqBody io.Reader
	if api.RequestSchema != nil {
		bodyBytes, _ := json.Marshal(api.RequestSchema)
		reqBody = bytes.NewBuffer(bodyBytes)
	}

	req, err := http.NewRequestWithContext(ctx, api.Method, url, reqBody)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	for key, value := range api.Headers {
		if strVal, ok := value.(string); ok {
			req.Header.Set(key, strVal)
		}
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	var body map[string]interface{}
	if len(bodyBytes) > 0 {
		json.Unmarshal(bodyBytes, &body)
	}

	headers := make(map[string]string)
	for key, values := range resp.Header {
		if len(values) > 0 {
			headers[key] = values[0]
		}
	}

	return &RealAPIResponse{
		StatusCode: resp.StatusCode,
		Body:       body,
		Headers:    headers,
	}, nil
}

func (s *ConsistencyService) compareSchemas(schema, actual interface{}, prefix string) []ConsistencyIssue {
	var issues []ConsistencyIssue

	if schema == nil && actual == nil {
		return issues
	}

	if schema == nil || actual == nil {
		issues = append(issues, ConsistencyIssue{
			Field:    prefix,
			Type:     "missing",
			Severity: "high",
			Expected: schema,
			Actual:   actual,
		})
		return issues
	}

	schemaMap, isSchemaMap := schema.(map[string]interface{})
	actualMap, isActualMap := actual.(map[string]interface{})

	if isSchemaMap && isActualMap {
		allKeys := make(map[string]bool)
		for k := range schemaMap {
			allKeys[k] = true
		}
		for k := range actualMap {
			allKeys[k] = true
		}

		var keys []string
		for k := range allKeys {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		for _, key := range keys {
			fullPath := key
			if prefix != "" {
				fullPath = prefix + "." + key
			}

			schemaVal, schemaOk := schemaMap[key]
			actualVal, actualOk := actualMap[key]

			if !schemaOk && actualOk {
				issues = append(issues, ConsistencyIssue{
					Field:    fullPath,
					Type:     "extra_field",
					Severity: "medium",
					Expected: nil,
					Actual:   actualVal,
				})
			} else if schemaOk && !actualOk {
				issues = append(issues, ConsistencyIssue{
					Field:    fullPath,
					Type:     "missing_field",
					Severity: "high",
					Expected: schemaVal,
					Actual:   nil,
				})
			} else {
				schemaType := reflect.TypeOf(schemaVal)
				actualType := reflect.TypeOf(actualVal)

				if schemaType != actualType {
					issues = append(issues, ConsistencyIssue{
						Field:    fullPath,
						Type:     "type_mismatch",
						Severity: "high",
						Expected: schemaType.String(),
						Actual:   actualType.String(),
					})
				}

				if isSubMap, _ := schemaVal.(map[string]interface{}); isSubMap != nil {
					subIssues := s.compareSchemas(schemaVal, actualVal, fullPath)
					issues = append(issues, subIssues...)
				}
			}
		}
	}

	schemaSlice, isSchemaSlice := schema.([]interface{})
	actualSlice, isActualSlice := actual.([]interface{})

	if isSchemaSlice && isActualSlice {
		if len(schemaSlice) > 0 && len(actualSlice) > 0 {
			for i := 0; i < len(schemaSlice) && i < len(actualSlice); i++ {
				subIssues := s.compareSchemas(schemaSlice[i], actualSlice[i], fmt.Sprintf("%s[%d]", prefix, i))
				issues = append(issues, subIssues...)
			}
		}
	}

	return issues
}

func (s *ConsistencyService) RunFullConsistencyCheck(ctx context.Context, apiID uint, realURL string) (*models.ConsistencyCheck, error) {
	ctx, span := tracing.Start(ctx, "consistency.full_check")
	defer span.End()

	var allIssues []ConsistencyIssue

	mockVsDef, err := s.CheckMockVsDefinition(ctx, apiID)
	if err == nil && !mockVsDef.IsConsistent {
		allIssues = append(allIssues, mockVsDef.Issues...)
	}

	if realURL != "" {
		mockVsReal, err := s.CheckMockVsReal(ctx, apiID, realURL)
		if err == nil && !mockVsReal.IsConsistent {
			allIssues = append(allIssues, mockVsReal.Issues...)
		}
	}

	check := &models.ConsistencyCheck{
		APIDefinitionID: apiID,
		CheckType:       "full",
		Description:     "完整一致性检查",
		IsConsistent:    len(allIssues) == 0,
		CheckedAt:       time.Now(),
	}

	if len(allIssues) > 0 {
		issuesJSON, _ := json.Marshal(allIssues)
		check.Issues = models.JSONB{}
		json.Unmarshal(issuesJSON, &check.Issues)
	}

	s.db.Create(check)

	if !check.IsConsistent {
		reportService := NewReportService()
		var api models.APIDefinition
		s.db.First(&api, apiID)

		issue := &models.IssueReport{
			Title:       fmt.Sprintf("接口 %s 存在一致性问题", api.Name),
			Description: fmt.Sprintf("在完整一致性检查中发现 %d 个问题", len(allIssues)),
			Severity:    "high",
			Category:    "consistency",
			Status:      "open",
			SourceType:  "consistency_check",
			SourceID:    check.ID,
			AffectedAPIs: models.JSONB{
				"api_id":   apiID,
				"api_name": api.Name,
			},
		}
		reportService.CreateIssueReport(ctx, issue)
	}

	tracing.AddAttribute(span, "api_id", apiID)
	tracing.AddAttribute(span, "is_consistent", check.IsConsistent)
	tracing.AddAttribute(span, "issues_count", len(allIssues))

	logger.Info("Full consistency check completed",
		zap.Uint("api_id", apiID),
		zap.Bool("is_consistent", check.IsConsistent),
		zap.Int("issues_count", len(allIssues)),
	)

	return check, nil
}

func (s *ConsistencyService) ListChecks(ctx context.Context, apiID uint, page, pageSize int) ([]models.ConsistencyCheck, int64, error) {
	_, span := tracing.Start(ctx, "consistency.list_checks")
	defer span.End()

	var checks []models.ConsistencyCheck
	var total int64

	query := s.db.Model(&models.ConsistencyCheck{}).Where("api_definition_id = ?", apiID)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&checks).Error; err != nil {
		return nil, 0, err
	}

	return checks, total, nil
}
