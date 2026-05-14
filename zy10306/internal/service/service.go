package service

import (
	"errors"
	"math/rand"
	"sampling-rule-api/internal/models"
	"sampling-rule-api/internal/repository"
	"strings"
	"time"
)

var (
	ErrDuplicateRequest = errors.New("duplicate request")
	ErrRuleNotFound     = errors.New("rule not found")
	ErrRuleNotActive    = errors.New("rule not active")
	ErrInvalidStatus    = errors.New("invalid status transition")
	ErrTenantNotAllowed = errors.New("tenant not allowed")
	ErrPathNotMatch     = errors.New("path not match")
	ErrWindowExpired    = errors.New("window expired")
	ErrMaxHitsReached   = errors.New("max hits reached")
)

func CreateRule(req *models.CreateRuleRequest) (*models.SamplingRule, error) {
	existingRule, err := repository.GetRuleByRequestID(req.RequestID)
	if err == nil && existingRule != nil {
		return existingRule, ErrDuplicateRequest
	}

	tenantTags := strings.Join(req.TenantTags, ",")
	rule := &models.SamplingRule{
		RequestID:   req.RequestID,
		RuleName:    req.RuleName,
		PathPattern: req.PathPattern,
		TenantTags:  tenantTags,
		SampleRate:  req.SampleRate,
		WindowStart: req.WindowStart,
		WindowEnd:   req.WindowEnd,
		MaxHits:     req.MaxHits,
		CurrentHits: 0,
		Status:      models.RuleStatusPending,
		AutoRecover: req.AutoRecover,
	}

	err = repository.CreateRule(rule)
	if err != nil {
		return nil, err
	}

	AddHistoryRecord(rule.ID, "CREATE", "", string(rule.Status), req.Operator, "Rule created")

	return rule, nil
}

func ActivateRule(ruleID uint, operator string) (*models.SamplingRule, error) {
	rule, err := repository.GetRuleByID(ruleID)
	if err != nil {
		return nil, ErrRuleNotFound
	}

	if rule.Status != models.RuleStatusPending {
		return nil, ErrInvalidStatus
	}

	oldStatus := rule.Status
	rule.Status = models.RuleStatusActive
	err = repository.UpdateRule(rule)
	if err != nil {
		return nil, err
	}

	AddHistoryRecord(rule.ID, "ACTIVATE", string(oldStatus), string(rule.Status), operator, "Rule activated")

	return rule, nil
}

func ValidateRule(req *models.ValidateRuleRequest) (bool, error) {
	existingHit, err := repository.GetHitRecordByRuleIDAndRequestID(req.RuleID, req.RequestID)
	if err == nil && existingHit != nil {
		return existingHit.Sampled, ErrDuplicateRequest
	}

	rule, err := repository.GetRuleByID(req.RuleID)
	if err != nil {
		return false, ErrRuleNotFound
	}

	if rule.Status != models.RuleStatusActive {
		return false, ErrRuleNotActive
	}

	now := time.Now()
	if !repository.CheckWindowValid(rule, now) {
		recordHit(rule, req, false)
		return false, ErrWindowExpired
	}

	if !repository.CheckTenantAllowed(rule, req.TenantTag) {
		recordHit(rule, req, false)
		return false, ErrTenantNotAllowed
	}

	if !repository.CheckPathMatch(rule, req.Path) {
		recordHit(rule, req, false)
		return false, ErrPathNotMatch
	}

	if rule.CurrentHits >= rule.MaxHits {
		recordHit(rule, req, false)
		return false, ErrMaxHitsReached
	}

	sampled := rand.Float64() < rule.SampleRate
	if sampled {
		rule.CurrentHits++
		repository.UpdateRule(rule)
	}

	recordHit(rule, req, sampled)

	return sampled, nil
}

func recordHit(rule *models.SamplingRule, req *models.ValidateRuleRequest, sampled bool) {
	hitRecord := &models.HitRecord{
		RuleID:    rule.ID,
		RequestID: req.RequestID,
		TenantTag: req.TenantTag,
		Path:      req.Path,
		Sampled:   sampled,
		HitAt:     time.Now(),
	}
	repository.CreateHitRecord(hitRecord)
}

func UpdateRuleStatus(req *models.UpdateStatusRequest) (*models.SamplingRule, error) {
	rule, err := repository.GetRuleByID(req.RuleID)
	if err != nil {
		return nil, ErrRuleNotFound
	}

	oldStatus := string(rule.Status)
	newStatus := models.RuleStatus(req.NewStatus)

	if !isValidStatusTransition(rule.Status, newStatus) {
		return nil, ErrInvalidStatus
	}

	rule.Status = newStatus
	if newStatus == models.RuleStatusExpired && rule.AutoRecover {
		recoverAt := time.Now().Add(24 * time.Hour)
		rule.RecoverAt = &recoverAt
	}

	err = repository.UpdateRule(rule)
	if err != nil {
		return nil, err
	}

	AddHistoryRecord(rule.ID, "STATUS_UPDATE", oldStatus, string(newStatus), req.Operator, req.Description)

	return rule, nil
}

func isValidStatusTransition(oldStatus, newStatus models.RuleStatus) bool {
	validTransitions := map[models.RuleStatus][]models.RuleStatus{
		models.RuleStatusPending:   {models.RuleStatusActive, models.RuleStatusPaused},
		models.RuleStatusActive:    {models.RuleStatusPaused, models.RuleStatusExpired},
		models.RuleStatusPaused:    {models.RuleStatusActive, models.RuleStatusExpired},
		models.RuleStatusExpired:   {models.RuleStatusRecovered},
		models.RuleStatusRecovered: {models.RuleStatusActive, models.RuleStatusExpired},
	}

	for _, valid := range validTransitions[oldStatus] {
		if valid == newStatus {
			return true
		}
	}
	return false
}

func AddHistoryRecord(ruleID uint, operation, oldStatus, newStatus, operator, description string) {
	record := &models.HistoryRecord{
		RuleID:      ruleID,
		Operation:   operation,
		OldStatus:   oldStatus,
		NewStatus:   newStatus,
		Operator:    operator,
		Description: description,
		OperatedAt:  time.Now(),
	}
	repository.CreateHistoryRecord(record)
}

func GetRule(ruleID uint) (*models.SamplingRule, error) {
	return repository.GetRuleByID(ruleID)
}

func GetAllRules() ([]models.SamplingRule, error) {
	return repository.GetAllRules()
}

func GetHitRecords(ruleID uint) ([]models.HitRecord, error) {
	return repository.GetHitRecordsByRuleID(ruleID)
}

func GetHistoryRecords(ruleID uint) ([]models.HistoryRecord, error) {
	return repository.GetHistoryRecordsByRuleID(ruleID)
}

func ProcessExpiredRules() error {
	rules, err := repository.GetExpiredRules()
	if err != nil {
		return err
	}

	for i := range rules {
		rule := &rules[i]
		oldStatus := rule.Status
		rule.Status = models.RuleStatusExpired
		if rule.AutoRecover {
			recoverAt := time.Now().Add(24 * time.Hour)
			rule.RecoverAt = &recoverAt
		}
		repository.UpdateRule(rule)
		AddHistoryRecord(rule.ID, "EXPIRE", string(oldStatus), string(rule.Status), "system", "Rule expired automatically")
	}

	return nil
}

func ProcessRecoverRules() error {
	rules, err := repository.GetRulesToRecover()
	if err != nil {
		return err
	}

	for i := range rules {
		rule := &rules[i]
		oldStatus := rule.Status
		rule.Status = models.RuleStatusRecovered
		rule.CurrentHits = 0
		repository.UpdateRule(rule)
		AddHistoryRecord(rule.ID, "RECOVER", string(oldStatus), string(rule.Status), "system", "Rule recovered automatically")
	}

	return nil
}

func StartBackgroundJobs() {
	ticker := time.NewTicker(1 * time.Minute)
	go func() {
		for range ticker.C {
			ProcessExpiredRules()
			ProcessRecoverRules()
		}
	}()
}
