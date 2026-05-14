package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"net/url"
	"strings"
	"time"

	"traffic-mirror-controller/internal/model"
	"traffic-mirror-controller/internal/repository"
)

type MirrorService struct {
	db     *repository.Database
	client *http.Client
}

func NewMirrorService(db *repository.Database) *MirrorService {
	return &MirrorService{
		db: db,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (s *MirrorService) CreateTargetEnv(req *model.TargetEnvRequest) (*model.TargetEnvironment, error) {
	env := &model.TargetEnvironment{
		Name:       req.Name,
		BaseURL:    req.BaseURL,
		AuthType:   req.AuthType,
		AuthToken:  req.AuthToken,
		Headers:    req.Headers,
		TimeoutSec: req.TimeoutSec,
		Enabled:    req.Enabled,
	}

	if env.TimeoutSec == 0 {
		env.TimeoutSec = 30
	}

	err := s.db.CreateTargetEnv(env)
	if err != nil {
		return nil, err
	}

	return env, nil
}

func (s *MirrorService) GetTargetEnv(id string) (*model.TargetEnvironment, error) {
	return s.db.GetTargetEnvByID(id)
}

func (s *MirrorService) ListTargetEnvs(page, pageSize int) ([]*model.TargetEnvironment, int, error) {
	return s.db.ListTargetEnvs(page, pageSize)
}

func (s *MirrorService) CreateMirrorRule(req *model.CreateMirrorRuleRequest) (*model.MirrorRule, error) {
	existing, err := s.db.GetMirrorRuleByIdempotencyKey(req.IdempotencyKey)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return existing, nil
	}

	for _, targetID := range req.Targets {
		env, err := s.db.GetTargetEnvByID(targetID)
		if err != nil {
			return nil, fmt.Errorf("invalid target environment: %s", targetID)
		}
		if env == nil {
			return nil, fmt.Errorf("target environment not found: %s", targetID)
		}
	}

	rule := &model.MirrorRule{
		IdempotencyKey: req.IdempotencyKey,
		Name:           req.Name,
		Description:    req.Description,
		SourcePath:     req.SourcePath,
		SourceMethod:   req.SourceMethod,
		SampleRate:     req.SampleRate,
		Targets:        req.Targets,
		CompareMode:    req.CompareMode,
		CreatedBy:      req.CreatedBy,
	}

	for _, mf := range req.MaskingFields {
		rule.MaskingFields = append(rule.MaskingFields, model.MaskingField{
			FieldPath:   mf.FieldPath,
			MaskType:    mf.MaskType,
			MaskPattern: mf.MaskPattern,
		})
	}

	err = s.db.CreateMirrorRule(rule)
	if err != nil {
		return nil, err
	}

	return rule, nil
}

func (s *MirrorService) GetMirrorRule(id string) (*model.MirrorRule, error) {
	return s.db.GetMirrorRuleByID(id)
}

func (s *MirrorService) ListMirrorRules(status string, page, pageSize int) ([]*model.MirrorRule, int, error) {
	return s.db.ListMirrorRules(status, page, pageSize)
}

func (s *MirrorService) UpdateMirrorRuleStatus(id string, status model.MirrorRuleStatus) error {
	validStatuses := map[model.MirrorRuleStatus]bool{
		model.RuleStatusDraft:    true,
		model.RuleStatusActive:   true,
		model.RuleStatusPaused:   true,
		model.RuleStatusDisabled: true,
	}

	if !validStatuses[status] {
		return fmt.Errorf("invalid status: %s", status)
	}

	rule, err := s.db.GetMirrorRuleByID(id)
	if err != nil {
		return err
	}
	if rule == nil {
		return fmt.Errorf("rule not found: %s", id)
	}

	validTransitions := map[model.MirrorRuleStatus][]model.MirrorRuleStatus{
		model.RuleStatusDraft:    {model.RuleStatusActive, model.RuleStatusDisabled},
		model.RuleStatusActive:   {model.RuleStatusPaused, model.RuleStatusDisabled},
		model.RuleStatusPaused:   {model.RuleStatusActive, model.RuleStatusDisabled},
		model.RuleStatusDisabled: {},
	}

	allowed := false
	for _, s := range validTransitions[rule.Status] {
		if s == status {
			allowed = true
			break
		}
	}

	if !allowed {
		return fmt.Errorf("invalid status transition: %s -> %s", rule.Status, status)
	}

	return s.db.UpdateMirrorRuleStatus(id, status)
}

func (s *MirrorService) ShouldMirror(rule *model.MirrorRule) bool {
	if rule.Status != model.RuleStatusActive {
		return false
	}

	if rule.SampleRate >= 1.0 {
		return true
	}

	return rand.Float64() < rule.SampleRate
}

func (s *MirrorService) ApplyMasking(body string, fields []model.MaskingField) (string, error) {
	if len(fields) == 0 {
		return body, nil
	}

	var data map[string]interface{}
	if err := json.Unmarshal([]byte(body), &data); err != nil {
		return body, nil
	}

	for _, mf := range fields {
		s.applyMaskToField(data, mf.FieldPath, mf.MaskType, mf.MaskPattern)
	}

	masked, err := json.Marshal(data)
	if err != nil {
		return body, err
	}

	return string(masked), nil
}

func (s *MirrorService) applyMaskToField(data map[string]interface{}, path, maskType, pattern string) {
	parts := strings.Split(path, ".")
	current := data

	for i, part := range parts {
		if i == len(parts)-1 {
			if _, exists := current[part]; exists {
				current[part] = s.maskValue(current[part], maskType, pattern)
			}
			return
		}

		if next, ok := current[part].(map[string]interface{}); ok {
			current = next
		} else {
			return
		}
	}
}

func (s *MirrorService) maskValue(value interface{}, maskType, pattern string) interface{} {
	switch maskType {
	case "REDACT":
		return "***REDACTED***"
	case "HASH":
		return fmt.Sprintf("%x", value)
	case "MASK":
		str := fmt.Sprintf("%v", value)
		if len(str) <= 4 {
			return "****"
		}
		return str[:2] + "****" + str[len(str)-2:]
	default:
		return "***"
	}
}

func (s *MirrorService) SubmitRequestForMirroring(ruleID, traceID, method, url, headers, body string) error {
	rule, err := s.db.GetMirrorRuleByID(ruleID)
	if err != nil {
		return err
	}
	if rule == nil {
		return fmt.Errorf("rule not found: %s", ruleID)
	}

	if !s.ShouldMirror(rule) {
		return nil
	}

	maskedBody, err := s.ApplyMasking(body, rule.MaskingFields)
	if err != nil {
		return err
	}

	for _, targetEnvID := range rule.Targets {
		rc := &model.RequestCopy{
			RuleID:         ruleID,
			TraceID:        traceID,
			TargetEnvID:    targetEnvID,
			OriginalURL:    url,
			Method:         method,
			RequestHeaders: headers,
			RequestBody:    body,
			MaskedBody:     maskedBody,
		}

		if err := s.db.CreateRequestCopy(rc); err != nil {
			return err
		}
	}

	return nil
}

func (s *MirrorService) ProcessPendingRequests(limit int) error {
	copies, err := s.db.GetPendingRequestCopies(limit)
	if err != nil {
		return err
	}

	for _, rc := range copies {
		go s.deliverRequest(rc)
	}

	return nil
}

func (s *MirrorService) deliverRequest(rc *model.RequestCopy) {
	env, err := s.db.GetTargetEnvByID(rc.TargetEnvID)
	if err != nil || env == nil {
		errorMsg := "target environment not found"
		if err != nil {
			errorMsg = err.Error()
		}
		rc.ErrorMsg = &errorMsg
		rc.Status = model.RequestStatusFailed
		s.db.UpdateRequestCopy(rc)
		return
	}

	parsedURL, err := url.Parse(rc.OriginalURL)
	if err != nil {
		errorMsg := fmt.Sprintf("invalid original URL: %v", err)
		rc.ErrorMsg = &errorMsg
		rc.Status = model.RequestStatusFailed
		s.db.UpdateRequestCopy(rc)
		return
	}

	parsedBaseURL, err := url.Parse(env.BaseURL)
	if err != nil {
		errorMsg := fmt.Sprintf("invalid target base URL: %v", err)
		rc.ErrorMsg = &errorMsg
		rc.Status = model.RequestStatusFailed
		s.db.UpdateRequestCopy(rc)
		return
	}

	parsedBaseURL.Path = parsedURL.Path
	parsedBaseURL.RawQuery = parsedURL.RawQuery
	targetURL := parsedBaseURL.String()

	startTime := time.Now()

	var reqBody []byte
	if rc.MaskedBody != "" {
		reqBody = []byte(rc.MaskedBody)
	} else {
		reqBody = []byte(rc.RequestBody)
	}

	req, err := http.NewRequest(rc.Method, targetURL, bytes.NewBuffer(reqBody))
	if err != nil {
		errorMsg := err.Error()
		rc.ErrorMsg = &errorMsg
		rc.Status = model.RequestStatusFailed
		s.db.UpdateRequestCopy(rc)
		return
	}

	if rc.RequestHeaders != "" {
		var headers map[string]string
		if json.Unmarshal([]byte(rc.RequestHeaders), &headers) == nil {
			for k, v := range headers {
				req.Header.Set(k, v)
			}
		}
	}

	if env.AuthToken != "" {
		switch env.AuthType {
		case "Bearer":
			req.Header.Set("Authorization", "Bearer "+env.AuthToken)
		case "Basic":
			req.Header.Set("Authorization", "Basic "+env.AuthToken)
		default:
			req.Header.Set("Authorization", env.AuthToken)
		}
	}

	client := &http.Client{
		Timeout: time.Duration(env.TimeoutSec) * time.Second,
	}

	resp, err := client.Do(req)
	duration := time.Since(startTime).Milliseconds()
	rc.DurationMs = &duration

	if err != nil {
		errorMsg := err.Error()
		rc.ErrorMsg = &errorMsg
		rc.Status = model.RequestStatusFailed
		s.db.UpdateRequestCopy(rc)
		return
	}
	defer resp.Body.Close()

	statusCode := resp.StatusCode
	rc.StatusCode = &statusCode

	var respBody bytes.Buffer
	respBody.ReadFrom(resp.Body)
	respStr := respBody.String()
	rc.Response = &respStr

	now := time.Now()
	rc.DeliveredAt = &now
	rc.Status = model.RequestStatusDelivered

	s.db.UpdateRequestCopy(rc)

	rule, _ := s.db.GetMirrorRuleByID(rc.RuleID)
	if rule != nil && rule.CompareMode {
		go s.compareResponses(rc)
	}
}

func (s *MirrorService) compareResponses(rc *model.RequestCopy) {
	copies, err := s.db.GetRequestCopiesByTraceID(rc.TraceID)
	if err != nil || len(copies) < 2 {
		return
	}

	var original *model.RequestCopy
	for _, c := range copies {
		if c.TargetEnvID != rc.TargetEnvID {
			original = c
			break
		}
	}

	if original == nil || original.Response == nil || rc.Response == nil {
		return
	}

	statusCodeMatch := *original.StatusCode == *rc.StatusCode
	bodyMatch := *original.Response == *rc.Response

	headersMatch := original.RequestHeaders == rc.RequestHeaders

	similarity := 0.0
	if statusCodeMatch {
		similarity += 0.3
	}
	if bodyMatch {
		similarity += 0.5
	}
	if headersMatch {
		similarity += 0.2
	}

	diffDetails := ""
	if !bodyMatch {
		diffDetails = "Response body differs between environments"
	}

	cr := &model.CompareResult{
		OriginalCopyID:  original.ID,
		MirroredCopyID:  rc.ID,
		RuleID:          rc.RuleID,
		StatusCodeMatch: &statusCodeMatch,
		BodyMatch:       &bodyMatch,
		HeadersMatch:    &headersMatch,
		SimilarityScore: similarity,
		DiffDetails:     diffDetails,
	}

	s.db.CreateCompareResult(cr)

	rc.Status = model.RequestStatusCompared
	s.db.UpdateRequestCopy(rc)
}

func (s *MirrorService) ListRequestCopies(ruleID, traceID, status string, page, pageSize int) ([]*model.RequestCopy, int, error) {
	return s.db.ListRequestCopies(ruleID, traceID, status, page, pageSize)
}

func (s *MirrorService) ListCompareResults(ruleID string, page, pageSize int) ([]*model.CompareResult, int, error) {
	return s.db.ListCompareResults(ruleID, page, pageSize)
}

func (s *MirrorService) ExportMirrorRules(status string) ([]*model.MirrorRule, error) {
	return s.db.GetAllMirrorRules(status)
}

func (s *MirrorService) ExportRequestCopies(ruleID, traceID, status string) ([]*model.RequestCopy, error) {
	return s.db.GetAllRequestCopies(ruleID, traceID, status)
}

func (s *MirrorService) ExportCompareResults(ruleID string) ([]*model.CompareResult, error) {
	return s.db.GetAllCompareResults(ruleID)
}
