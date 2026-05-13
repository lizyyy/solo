package repository

import (
	"sampling-rule-api/internal/models"
	"strings"
	"time"
)

func CreateRule(rule *models.SamplingRule) error {
	return DB.Create(rule).Error
}

func GetRuleByRequestID(requestID string) (*models.SamplingRule, error) {
	var rule models.SamplingRule
	err := DB.Where("request_id = ?", requestID).First(&rule).Error
	if err != nil {
		return nil, err
	}
	return &rule, nil
}

func GetRuleByID(id uint) (*models.SamplingRule, error) {
	var rule models.SamplingRule
	err := DB.First(&rule, id).Error
	if err != nil {
		return nil, err
	}
	return &rule, nil
}

func UpdateRule(rule *models.SamplingRule) error {
	return DB.Save(rule).Error
}

func GetAllRules() ([]models.SamplingRule, error) {
	var rules []models.SamplingRule
	err := DB.Find(&rules).Error
	return rules, err
}

func CreateHitRecord(record *models.HitRecord) error {
	return DB.Create(record).Error
}

func GetHitRecordsByRuleID(ruleID uint) ([]models.HitRecord, error) {
	var records []models.HitRecord
	err := DB.Where("rule_id = ?", ruleID).Order("hit_at desc").Find(&records).Error
	return records, err
}

func CreateHistoryRecord(record *models.HistoryRecord) error {
	return DB.Create(record).Error
}

func GetHistoryRecordsByRuleID(ruleID uint) ([]models.HistoryRecord, error) {
	var records []models.HistoryRecord
	err := DB.Where("rule_id = ?", ruleID).Order("operated_at desc").Find(&records).Error
	return records, err
}

func GetExpiredRules() ([]models.SamplingRule, error) {
	var rules []models.SamplingRule
	now := time.Now()
	err := DB.Where("status = ? AND window_end < ?", models.RuleStatusActive, now).Find(&rules).Error
	return rules, err
}

func GetRulesToRecover() ([]models.SamplingRule, error) {
	var rules []models.SamplingRule
	now := time.Now()
	err := DB.Where("status = ? AND auto_recover = ? AND recover_at <= ?", models.RuleStatusExpired, true, now).Find(&rules).Error
	return rules, err
}

func CheckTenantAllowed(rule *models.SamplingRule, tenantTag string) bool {
	if rule.TenantTags == "" {
		return true
	}
	tags := strings.Split(rule.TenantTags, ",")
	for _, tag := range tags {
		if strings.TrimSpace(tag) == tenantTag {
			return true
		}
	}
	return false
}

func CheckPathMatch(rule *models.SamplingRule, path string) bool {
	return strings.Contains(path, rule.PathPattern)
}

func CheckWindowValid(rule *models.SamplingRule, now time.Time) bool {
	return now.After(rule.WindowStart) && now.Before(rule.WindowEnd)
}
