package service

import (
	"encoding/json"
	"fmt"

	"strategy-hotload-api/internal/model"
	"strategy-hotload-api/internal/store"
)

type StrategyService struct {
	store store.Store
}

func NewStrategyService(s store.Store) *StrategyService {
	return &StrategyService{store: s}
}

func (s *StrategyService) CreatePackage(req *model.CreatePackageRequest) (*model.StrategyPackage, error) {
	pkg := &model.StrategyPackage{
		ID:          model.NewID(),
		Name:        req.Name,
		Description: req.Description,
		CreatedAt:   model.Now(),
		UpdatedAt:   model.Now(),
		CreatedBy:   req.CreatedBy,
	}
	if err := s.store.CreatePackage(pkg); err != nil {
		return nil, err
	}
	s.logAudit("package", pkg.ID, "create", nil, store.ToMap(pkg), req.CreatedBy, "create strategy package")
	return pkg, nil
}

func (s *StrategyService) GetPackage(id string) (*model.StrategyPackage, error) {
	return s.store.GetPackage(id)
}

func (s *StrategyService) ListPackages() ([]*model.StrategyPackage, error) {
	return s.store.ListPackages()
}

func (s *StrategyService) CreateRuleVersion(req *model.CreateRuleVersionRequest) (*model.RuleVersion, error) {
	if _, err := s.store.GetPackage(req.PackageID); err != nil {
		return nil, err
	}
	version := &model.RuleVersion{
		ID:          model.NewID(),
		PackageID:   req.PackageID,
		Version:     req.Version,
		RuleContent: req.RuleContent,
		Status:      model.StatusDraft,
		CreatedAt:   model.Now(),
		UpdatedAt:   model.Now(),
		CreatedBy:   req.CreatedBy,
		Remark:      req.Remark,
	}
	if err := s.store.CreateRuleVersion(version); err != nil {
		return nil, err
	}
	s.logAudit("version", version.ID, "create", nil, store.ToMap(version), req.CreatedBy, "create rule version")
	return version, nil
}

func (s *StrategyService) GetRuleVersion(id string) (*model.RuleVersion, error) {
	return s.store.GetRuleVersion(id)
}

func (s *StrategyService) ListRuleVersions(packageID string) ([]*model.RuleVersion, error) {
	return s.store.ListRuleVersions(packageID)
}

func (s *StrategyService) ValidateRuleContent(content map[string]interface{}) error {
	if content == nil {
		return fmt.Errorf("rule content cannot be nil")
	}
	if _, ok := content["rules"]; !ok {
		return fmt.Errorf("rule content must contain 'rules' field")
	}
	return nil
}

func (s *StrategyService) UpdateStatus(versionID string, req *model.UpdateStatusRequest) (*model.RuleVersion, error) {
	version, err := s.store.GetRuleVersion(versionID)
	if err != nil {
		return nil, err
	}
	oldStatus := version.Status
	if !s.isValidStatusTransition(oldStatus, req.TargetStatus) {
		return nil, store.ErrInvalidStatus
	}
	before := store.ToMap(version)
	version.Status = req.TargetStatus
	version.UpdatedAt = model.Now()
	if req.TargetStatus == model.StatusGray && req.GrayRange != nil {
		version.GrayRange = req.GrayRange
	}
	if req.TargetStatus == model.StatusPublished {
		snapshot, _ := json.Marshal(version)
		rollbackPoint := &model.RollbackPoint{
			VersionID:   versionID,
			Snapshot:    string(snapshot),
			CreatedAt:   model.Now(),
			CreatedBy:   req.Operator,
			Description: fmt.Sprintf("rollback point for version %s", version.Version),
		}
		s.store.CreateRollbackPoint(rollbackPoint)
		version.RollbackPoint = rollbackPoint
	}
	if err := s.store.UpdateRuleVersion(version); err != nil {
		return nil, err
	}
	action := fmt.Sprintf("status_change:%s->%s", oldStatus, req.TargetStatus)
	s.logAudit("version", versionID, action, before, store.ToMap(version), req.Operator, req.Remark)
	return version, nil
}

func (s *StrategyService) isValidStatusTransition(from, to model.Status) bool {
	transitions := map[model.Status][]model.Status{
		model.StatusDraft:     {model.StatusTesting, model.StatusRevoked},
		model.StatusTesting:   {model.StatusGray, model.StatusRevoked},
		model.StatusGray:      {model.StatusPublished, model.StatusRollback, model.StatusRevoked},
		model.StatusPublished: {model.StatusRollback, model.StatusRevoked},
		model.StatusRollback:  {model.StatusPublished, model.StatusGray},
		model.StatusRevoked:   {},
	}
	for _, valid := range transitions[from] {
		if valid == to {
			return true
		}
	}
	return false
}

func (s *StrategyService) Rollback(versionID, operator, remark string) (*model.RuleVersion, error) {
	version, err := s.store.GetRuleVersion(versionID)
	if err != nil {
		return nil, err
	}
	rollbackPoint, err := s.store.GetRollbackPoint(versionID)
	if err != nil || rollbackPoint == nil {
		return nil, fmt.Errorf("rollback point not found")
	}
	before := store.ToMap(version)
	var rollbackVersion model.RuleVersion
	json.Unmarshal([]byte(rollbackPoint.Snapshot), &rollbackVersion)
	version.Status = model.StatusRollback
	version.RuleContent = rollbackVersion.RuleContent
	version.UpdatedAt = model.Now()
	if err := s.store.UpdateRuleVersion(version); err != nil {
		return nil, err
	}
	s.logAudit("version", versionID, "rollback", before, store.ToMap(version), operator, remark)
	return version, nil
}

func (s *StrategyService) Revoke(versionID, operator, remark string) (*model.RuleVersion, error) {
	version, err := s.store.GetRuleVersion(versionID)
	if err != nil {
		return nil, err
	}
	before := store.ToMap(version)
	version.Status = model.StatusRevoked
	version.UpdatedAt = model.Now()
	if err := s.store.UpdateRuleVersion(version); err != nil {
		return nil, err
	}
	s.logAudit("version", versionID, "revoke", before, store.ToMap(version), operator, remark)
	return version, nil
}

func (s *StrategyService) HitCheck(req *model.HitCheckRequest) (*model.HitCheckResponse, error) {
	version, err := s.store.GetLatestPublishedVersion(req.PackageID)
	if err != nil {
		return nil, err
	}
	if version == nil {
		return &model.HitCheckResponse{HitResult: false}, nil
	}
	hitResult, hitRules, explanation := s.evaluateRules(version.RuleContent, req.Input)
	hitRequest := &model.HitRequest{
		ID:          model.NewID(),
		RequestID:   req.RequestID,
		PackageID:   req.PackageID,
		VersionID:   version.ID,
		Input:       req.Input,
		HitResult:   hitResult,
		HitRules:    hitRules,
		Explanation: explanation,
		CreatedAt:   model.Now(),
		UserID:      req.UserID,
	}
	if err := s.store.CreateHitRequest(hitRequest); err != nil {
		if err == store.ErrDuplicateRequestID {
			return nil, err
		}
	}
	return &model.HitCheckResponse{
		HitResult:   hitResult,
		VersionID:   version.ID,
		HitRules:    hitRules,
		Explanation: explanation,
	}, nil
}

func (s *StrategyService) evaluateRules(ruleContent map[string]interface{}, input map[string]interface{}) (bool, []string, *model.ExplanationResult) {
	var hitRules []string
	finalResult := false
	var conditions []model.ConditionResult
	if rules, ok := ruleContent["rules"].([]interface{}); ok {
		for _, r := range rules {
			if rule, ok := r.(map[string]interface{}); ok {
				ruleID, _ := rule["id"].(string)
				ruleName, _ := rule["name"].(string)
				matched := s.evaluateSingleRule(rule, input, &conditions)
				if matched {
					hitRules = append(hitRules, ruleID)
					finalResult = true
				}
				if len(hitRules) == 0 && ruleID != "" {
					return finalResult, hitRules, &model.ExplanationResult{
						RuleID:      ruleID,
						RuleName:    ruleName,
						Conditions:  conditions,
						FinalResult: finalResult,
					}
				}
			}
		}
	}
	return finalResult, hitRules, &model.ExplanationResult{
		Conditions:  conditions,
		FinalResult: finalResult,
	}
}

func (s *StrategyService) evaluateSingleRule(rule map[string]interface{}, input map[string]interface{}, conditions *[]model.ConditionResult) bool {
	if conds, ok := rule["conditions"].([]interface{}); ok {
		for _, c := range conds {
			if cond, ok := c.(map[string]interface{}); ok {
				field, _ := cond["field"].(string)
				operator, _ := cond["operator"].(string)
				expected := cond["expected"]
				actual := input[field]
				matched := s.compareValue(expected, actual, operator)
				*conditions = append(*conditions, model.ConditionResult{
					Field:    field,
					Operator: operator,
					Expected: expected,
					Actual:   actual,
					Matched:  matched,
				})
				if !matched {
					return false
				}
			}
		}
	}
	return true
}

func (s *StrategyService) compareValue(expected, actual interface{}, operator string) bool {
	switch operator {
	case "eq":
		return fmt.Sprintf("%v", expected) == fmt.Sprintf("%v", actual)
	case "ne":
		return fmt.Sprintf("%v", expected) != fmt.Sprintf("%v", actual)
	case "contains":
		return fmt.Sprintf("%v", expected) != "" && contains(fmt.Sprintf("%v", actual), fmt.Sprintf("%v", expected))
	default:
		return false
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && len(substr) > 0 && s[:len(substr)] == substr)
}

func (s *StrategyService) ListHitRequests(packageID string, limit int) ([]*model.HitRequest, error) {
	return s.store.ListHitRequests(packageID, limit)
}

func (s *StrategyService) ListAuditLogs(entityType, entityID string, page, pageSize int) ([]*model.AuditLog, int, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	return s.store.ListAuditLogs(entityType, entityID, page, pageSize)
}

func (s *StrategyService) Export(packageID string) (*model.ExportResult, error) {
	pkg, err := s.store.GetPackage(packageID)
	if err != nil {
		return nil, err
	}
	versions, _ := s.store.ListRuleVersions(packageID)
	hitRequests, _ := s.store.ListHitRequests(packageID, 0)
	auditLogs, _, _ := s.store.ListAuditLogs("package", packageID, 1, 1000)
	versionLogs, _, _ := s.store.ListAuditLogs("version", "", 1, 1000)
	allLogs := append(auditLogs, versionLogs...)
	summary := map[string]int{
		"total_versions":    len(versions),
		"total_hit_requests": len(hitRequests),
		"total_audit_logs":  len(allLogs),
		"published_count":   countByStatus(versions, model.StatusPublished),
	}
	return &model.ExportResult{
		Package:     pkg,
		Versions:    versions,
		HitRequests: hitRequests,
		AuditLogs:   allLogs,
		ExportedAt:  model.Now().Format("2006-01-02 15:04:05"),
		Summary:     summary,
	}, nil
}

func countByStatus(versions []*model.RuleVersion, status model.Status) int {
	count := 0
	for _, v := range versions {
		if v.Status == status {
			count++
		}
	}
	return count
}

func (s *StrategyService) logAudit(entityType, entityID, action string, before, after map[string]interface{}, operator, remark string) {
	log := &model.AuditLog{
		ID:         model.NewID(),
		EntityType: entityType,
		EntityID:   entityID,
		Action:     action,
		Before:     before,
		After:      after,
		Operator:   operator,
		OperatedAt: model.Now(),
		Remark:     remark,
	}
	s.store.CreateAuditLog(log)
}
