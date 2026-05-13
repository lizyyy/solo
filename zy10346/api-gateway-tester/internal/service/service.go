package service

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"api-gateway-tester/internal/model"
	"api-gateway-tester/internal/repository"
	"gorm.io/gorm"
)

var (
	ErrUpstreamNotFound     = errors.New("upstream service not found")
	ErrRuleNotFound         = errors.New("route rule not found")
	ErrSampleNotFound       = errors.New("request sample not found")
	ErrTrialNotFound        = errors.New("trial not found")
	ErrDuplicateIdempotency = errors.New("duplicate request with same idempotency key")
	ErrInvalidCondition     = errors.New("invalid match condition")
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) CreateUpstream(req *model.CreateUpstreamRequest) (*model.UpstreamService, error) {
	upstream := &model.UpstreamService{
		Name:   req.Name,
		Host:   req.Host,
		Port:   req.Port,
		Weight: req.Weight,
	}
	if upstream.Weight == 0 {
		upstream.Weight = 100
	}
	err := s.repo.CreateUpstream(upstream)
	if err != nil {
		return nil, fmt.Errorf("failed to create upstream: %w", err)
	}
	return upstream, nil
}

func (s *Service) GetUpstream(id string) (*model.UpstreamService, error) {
	return s.repo.GetUpstreamByID(id)
}

func (s *Service) ListUpstreams() ([]model.UpstreamService, error) {
	return s.repo.ListUpstreams()
}

func (s *Service) CreateRouteRule(req *model.CreateRouteRuleRequest) (*model.RouteRule, error) {
	_, err := s.repo.GetUpstreamByID(req.UpstreamID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUpstreamNotFound
		}
		return nil, err
	}

	conditions := make([]model.MatchCondition, len(req.Conditions))
	for i, c := range req.Conditions {
		conditions[i] = model.MatchCondition{
			Type:     c.Type,
			Key:      c.Key,
			Operator: c.Operator,
			Value:    c.Value,
		}
	}

	rule := &model.RouteRule{
		Name:        req.Name,
		Description: req.Description,
		Priority:    req.Priority,
		Enabled:     req.Enabled,
		Conditions:  conditions,
		UpstreamID:  req.UpstreamID,
	}

	err = s.repo.CreateRouteRule(rule)
	if err != nil {
		return nil, fmt.Errorf("failed to create route rule: %w", err)
	}

	return s.repo.GetRouteRuleByID(rule.ID)
}

func (s *Service) GetRouteRule(id string) (*model.RouteRule, error) {
	return s.repo.GetRouteRuleByID(id)
}

func (s *Service) ListRouteRules() ([]model.RouteRule, error) {
	return s.repo.ListRouteRules()
}

func (s *Service) CreateRequestSample(req *model.CreateRequestSampleRequest) (*model.RequestSample, error) {
	sample := &model.RequestSample{
		Name:    req.Name,
		Method:  req.Method,
		Path:    req.Path,
		Headers: req.Headers,
		Query:   req.Query,
	}
	err := s.repo.CreateRequestSample(sample)
	if err != nil {
		return nil, fmt.Errorf("failed to create request sample: %w", err)
	}
	return sample, nil
}

func (s *Service) GetRequestSample(id string) (*model.RequestSample, error) {
	return s.repo.GetRequestSampleByID(id)
}

func (s *Service) ListRequestSamples() ([]model.RequestSample, error) {
	return s.repo.ListRequestSamples()
}

func (s *Service) MatchCondition(condition model.MatchCondition, sample *model.RequestSample) (bool, string, error) {
	var actualValue string
	var fieldName string

	switch condition.Type {
	case "path":
		actualValue = sample.Path
		fieldName = "path"
	case "method":
		actualValue = sample.Method
		fieldName = "method"
	case "header":
		actualValue = sample.Headers[condition.Key]
		fieldName = fmt.Sprintf("header[%s]", condition.Key)
	case "query":
		actualValue = sample.Query[condition.Key]
		fieldName = fmt.Sprintf("query[%s]", condition.Key)
	default:
		return false, "", ErrInvalidCondition
	}

	matched := false
	var explanation string

	switch condition.Operator {
	case "equals":
		matched = actualValue == condition.Value
		explanation = fmt.Sprintf("%s equals '%s'", fieldName, condition.Value)
	case "contains":
		matched = strings.Contains(actualValue, condition.Value)
		explanation = fmt.Sprintf("%s contains '%s'", fieldName, condition.Value)
	case "starts_with":
		matched = strings.HasPrefix(actualValue, condition.Value)
		explanation = fmt.Sprintf("%s starts with '%s'", fieldName, condition.Value)
	case "ends_with":
		matched = strings.HasSuffix(actualValue, condition.Value)
		explanation = fmt.Sprintf("%s ends with '%s'", fieldName, condition.Value)
	case "regex":
		re, err := regexp.Compile(condition.Value)
		if err != nil {
			return false, "", fmt.Errorf("invalid regex: %w", err)
		}
		matched = re.MatchString(actualValue)
		explanation = fmt.Sprintf("%s matches regex '%s'", fieldName, condition.Value)
	default:
		return false, "", ErrInvalidCondition
	}

	return matched, explanation, nil
}

func (s *Service) MatchRule(rule *model.RouteRule, sample *model.RequestSample) (bool, float64, []string, error) {
	if !rule.Enabled {
		return false, 0, nil, nil
	}

	if len(rule.Conditions) == 0 {
		return true, 1.0, []string{"rule has no conditions (matches all)"}, nil
	}

	matchedCount := 0
	var explanations []string

	for _, cond := range rule.Conditions {
		matched, explanation, err := s.MatchCondition(cond, sample)
		if err != nil {
			return false, 0, nil, err
		}
		if matched {
			matchedCount++
			explanations = append(explanations, explanation)
		}
	}

	matchScore := float64(matchedCount) / float64(len(rule.Conditions))
	allMatched := matchedCount == len(rule.Conditions)

	return allMatched, matchScore, explanations, nil
}

func (s *Service) DetectConflicts(rules []model.RouteRule) ([]model.ConflictRule, error) {
	var conflicts []model.ConflictRule

	for i := 0; i < len(rules); i++ {
		for j := i + 1; j < len(rules); j++ {
			rule1 := rules[i]
			rule2 := rules[j]

			if rule1.Priority == rule2.Priority {
				existingConflicts, err := s.repo.GetConflictsByRuleIDs(rule1.ID, rule2.ID)
				if err != nil {
					return nil, err
				}

				if len(existingConflicts) == 0 {
					conflict := &model.ConflictRule{
						RuleID1:        rule1.ID,
						RuleID2:        rule2.ID,
						ConflictType:   "priority_conflict",
						Description:    fmt.Sprintf("Rules '%s' and '%s' have the same priority (%d)", rule1.Name, rule2.Name, rule1.Priority),
						ResolutionHint: "Adjust priorities to ensure deterministic routing",
					}
					err := s.repo.CreateConflictRule(conflict)
					if err != nil {
						return nil, err
					}
					conflicts = append(conflicts, *conflict)
				} else {
					conflicts = append(conflicts, existingConflicts...)
				}
			}
		}
	}

	return conflicts, nil
}

func (s *Service) StartTrial(req *model.StartTrialRequest) (*model.TrialResult, error) {
	existingRequest, err := s.repo.GetTrialRequestByIdempotencyKey(req.IdempotencyKey)
	if err == nil && existingRequest != nil {
		result, err := s.repo.GetTrialResultByRequestID(existingRequest.ID)
		if err == nil {
			return result, nil
		}
	}

	_, err = s.repo.GetRequestSampleByID(req.RequestSampleID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrSampleNotFound
		}
		return nil, err
	}

	var rules []model.RouteRule
	if len(req.RuleIDs) > 0 {
		rules, err = s.repo.GetRouteRulesByIDs(req.RuleIDs)
		if err != nil {
			return nil, err
		}
	} else {
		rules, err = s.repo.ListRouteRules()
		if err != nil {
			return nil, err
		}
	}

	trialRequest := &model.TrialRequest{
		IdempotencyKey:  req.IdempotencyKey,
		RequestSampleID: req.RequestSampleID,
		RuleIDs:         req.RuleIDs,
		Status:          model.TrialStatusRunning,
	}

	err = s.repo.CreateTrialRequest(trialRequest)
	if err != nil {
		return nil, fmt.Errorf("failed to create trial request: %w", err)
	}

	startTime := time.Now()

	sample, err := s.repo.GetRequestSampleByID(req.RequestSampleID)
	if err != nil {
		s.repo.UpdateTrialRequestStatus(trialRequest.ID, model.TrialStatusFailed)
		return nil, err
	}

	var matchedRule *model.RouteRule
	var bestMatchScore float64
	var bestExplanations []string

	for _, rule := range rules {
		matched, score, explanations, err := s.MatchRule(&rule, sample)
		if err != nil {
			continue
		}
		if matched {
			if matchedRule == nil || rule.Priority > matchedRule.Priority || 
				(rule.Priority == matchedRule.Priority && score > bestMatchScore) {
				matchedRule = &rule
				bestMatchScore = score
				bestExplanations = explanations
			}
		}
	}

	conflicts, err := s.DetectConflicts(rules)
	if err != nil {
		s.repo.UpdateTrialRequestStatus(trialRequest.ID, model.TrialStatusFailed)
		return nil, err
	}

	explanation := ""
	if matchedRule != nil {
		explanation = fmt.Sprintf("Request matched rule '%s' (priority: %d). Conditions satisfied: %s",
			matchedRule.Name, matchedRule.Priority, strings.Join(bestExplanations, "; "))
	} else {
		explanation = "No matching route rule found for the request."
	}

	duration := time.Since(startTime).Milliseconds()
	completedAt := time.Now()

	var matchedRuleID *string
	if matchedRule != nil {
		matchedRuleID = &matchedRule.ID
	}

	result := &model.TrialResult{
		RequestID:        trialRequest.ID,
		MatchedRuleID:    matchedRuleID,
		Status:           model.TrialStatusCompleted,
		ConflictDetected: len(conflicts) > 0,
		Conflicts:        conflicts,
		Explanation:      explanation,
		DurationMs:       duration,
		CompletedAt:      &completedAt,
	}

	err = s.repo.CreateTrialResult(result)
	if err != nil {
		s.repo.UpdateTrialRequestStatus(trialRequest.ID, model.TrialStatusFailed)
		return nil, fmt.Errorf("failed to create trial result: %w", err)
	}

	s.repo.UpdateTrialRequestStatus(trialRequest.ID, model.TrialStatusCompleted)

	return s.repo.GetTrialResultByID(result.ID)
}

func (s *Service) GetTrialResult(id string) (*model.TrialResult, error) {
	return s.repo.GetTrialResultByID(id)
}

func (s *Service) GetTrialHistory(query *model.TrialHistoryQuery) (*model.PaginatedResponse, error) {
	if query.Page == 0 {
		query.Page = 1
	}
	if query.PageSize == 0 {
		query.PageSize = 10
	}

	results, total, err := s.repo.QueryTrialHistory(query)
	if err != nil {
		return nil, err
	}

	totalPages := int(total) / query.PageSize
	if int(total)%query.PageSize > 0 {
		totalPages++
	}

	return &model.PaginatedResponse{
		Data:       results,
		Total:      total,
		Page:       query.Page,
		PageSize:   query.PageSize,
		TotalPages: totalPages,
	}, nil
}

func (s *Service) ExplainRule(ruleID string, sampleID string) (*model.RuleExplanation, error) {
	rule, err := s.repo.GetRouteRuleByID(ruleID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrRuleNotFound
		}
		return nil, err
	}

	sample, err := s.repo.GetRequestSampleByID(sampleID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrSampleNotFound
		}
		return nil, err
	}

	matched, score, explanations, err := s.MatchRule(rule, sample)
	if err != nil {
		return nil, err
	}

	statusText := "would match"
	if !matched {
		statusText = "would NOT match"
	}

	explanation := fmt.Sprintf("Rule '%s' %s the request. Match score: %.2f. Conditions: %s",
		rule.Name, statusText, score, strings.Join(explanations, "; "))

	return &model.RuleExplanation{
		RuleID:            rule.ID,
		RuleName:          rule.Name,
		Priority:          rule.Priority,
		Explanation:       explanation,
		MatchScore:        score,
		MatchedConditions: explanations,
	}, nil
}

func (s *Service) ExportTrials(req *model.ExportRequest) (interface{}, error) {
	var trials []model.TrialResult
	var err error

	if len(req.TrialIDs) > 0 {
		trials, err = s.repo.GetTrialResultsByIDs(req.TrialIDs)
	} else {
		query := &model.TrialHistoryQuery{Page: 1, PageSize: 1000}
		var paginated *model.PaginatedResponse
		paginated, err = s.GetTrialHistory(query)
		if err == nil {
			trials = paginated.Data.([]model.TrialResult)
		}
	}

	if err != nil {
		return nil, err
	}

	if req.Format == "csv" {
		return s.convertToCSV(trials), nil
	}

	return trials, nil
}

func (s *Service) convertToCSV(trials []model.TrialResult) string {
	var builder strings.Builder
	builder.WriteString("ID,Status,Matched Rule,Conflict Detected,Duration (ms),Created At\n")

	for _, t := range trials {
		matchedRuleName := ""
		if t.MatchedRule != nil {
			matchedRuleName = t.MatchedRule.Name
		}
		builder.WriteString(fmt.Sprintf("%s,%s,%s,%t,%d,%s\n",
			t.ID, t.Status, matchedRuleName, t.ConflictDetected, t.DurationMs, t.CreatedAt.Format(time.RFC3339)))
	}

	return builder.String()
}
