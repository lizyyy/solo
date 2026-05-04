package service

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/xeipuuv/gojsonschema"

	"config-manager/internal/model"
	"config-manager/internal/store"
)

type ConfigService struct {
	store *store.Store
}

func NewConfigService(s *store.Store) *ConfigService {
	return &ConfigService{store: s}
}

func (s *ConfigService) ValidateConfigValue(schemaJSON, valueJSON json.RawMessage) (*model.ValidationResult, error) {
	result := &model.ValidationResult{
		Valid: true,
	}

	schemaLoader := gojsonschema.NewBytesLoader(schemaJSON)
	valueLoader := gojsonschema.NewBytesLoader(valueJSON)

	schema, err := gojsonschema.NewSchema(schemaLoader)
	if err != nil {
		return nil, model.ErrSchemaInvalid
	}

	validationResult, err := schema.Validate(valueLoader)
	if err != nil {
		return nil, fmt.Errorf("validation error: %w", err)
	}

	if !validationResult.Valid() {
		result.Valid = false
		for _, err := range validationResult.Errors() {
			result.Errors = append(result.Errors, model.ValidationError{
				Field:   err.Field(),
				Message: err.Description(),
				Value:   err.Value(),
			})
		}
	}

	return result, nil
}

func (s *ConfigService) ValidateVersion(configID string, value json.RawMessage) (*model.ValidationResult, error) {
	config, err := s.store.GetConfigItemByID(configID)
	if err != nil {
		return nil, err
	}

	result, err := s.ValidateConfigValue(config.Schema, value)
	if err != nil {
		return nil, err
	}
	result.ConfigKey = config.Key

	return result, nil
}

func (s *ConfigService) CreateVersion(configID string, value json.RawMessage, operator string) (*model.ConfigVersion, error) {
	config, err := s.store.GetConfigItemByID(configID)
	if err != nil {
		return nil, err
	}

	validation, err := s.ValidateConfigValue(config.Schema, value)
	if err != nil {
		return nil, err
	}
	if !validation.Valid {
		return nil, &model.AppError{
			Code:    "validation_failed",
			Message: fmt.Sprintf("配置校验失败: %v", validation.Errors),
		}
	}

	latestVersion, err := s.store.GetLatestVersion(configID)
	var nextVersion int
	if err != nil {
		if err != model.ErrVersionNotFound {
			return nil, err
		}
		nextVersion = 1
	} else {
		nextVersion = latestVersion.Version + 1
	}

	version := &model.ConfigVersion{
		ID:        model.NewID(),
		ConfigID:  configID,
		Version:   nextVersion,
		Value:     value,
		Status:    "draft",
		CreatedBy: operator,
	}

	if err := s.store.CreateConfigVersion(version); err != nil {
		return nil, err
	}

	auditDetails, _ := json.Marshal(map[string]interface{}{
		"config_key": config.Key,
		"version":    nextVersion,
	})
	_ = s.store.CreateAuditLog(&model.AuditLog{
		ID:           model.NewID(),
		TenantID:     config.TenantID,
		Action:       model.AuditActionCreateVersion,
		ResourceID:   version.ID,
		ResourceType: "config_version",
		Details:      auditDetails,
		Operator:     operator,
	})

	return version, nil
}

func (s *ConfigService) DiffVersions(oldVersionID, newVersionID string) (*model.DiffResult, error) {
	oldV, err := s.store.GetConfigVersionByID(oldVersionID)
	if err != nil {
		return nil, err
	}

	newV, err := s.store.GetConfigVersionByID(newVersionID)
	if err != nil {
		return nil, err
	}

	if oldV.ConfigID != newV.ConfigID {
		return nil, fmt.Errorf("版本不属于同一个配置项")
	}

	config, err := s.store.GetConfigItemByID(oldV.ConfigID)
	if err != nil {
		return nil, err
	}

	var oldVal, newVal interface{}
	_ = json.Unmarshal(oldV.Value, &oldVal)
	_ = json.Unmarshal(newV.Value, &newVal)

	operation := "update"
	if oldV.Version == 0 {
		operation = "create"
	}

	return &model.DiffResult{
		ConfigKey:  config.Key,
		OldVersion: oldV.Version,
		NewVersion: newV.Version,
		OldValue:   oldVal,
		NewValue:   newVal,
		Operation:  operation,
	}, nil
}

func (s *ConfigService) CreateRelease(tenantID, serviceID, name string, configChanges []string, grayRule *model.GrayRule, operator string) (*model.Release, error) {
	if grayRule != nil {
		if err := grayRule.Validate(); err != nil {
			return nil, err
		}
	}

	for _, versionID := range configChanges {
		version, err := s.store.GetConfigVersionByID(versionID)
		if err != nil {
			return nil, err
		}
		if version.Status != "draft" {
			return nil, fmt.Errorf("版本 %s 不是草稿状态，无法发布", versionID)
		}
	}

	changesJSON, _ := json.Marshal(configChanges)
	ruleJSON := json.RawMessage("{}")
	if grayRule != nil {
		ruleJSON, _ = json.Marshal(grayRule)
	}

	release := &model.Release{
		ID:            model.NewID(),
		TenantID:      tenantID,
		ServiceID:     serviceID,
		Name:          name,
		ConfigChanges: changesJSON,
		GrayRule:      ruleJSON,
		Status:        model.ReleaseStatusPending,
		CreatedBy:     operator,
	}

	if err := s.store.CreateRelease(release); err != nil {
		return nil, err
	}

	auditDetails, _ := json.Marshal(map[string]interface{}{
		"release_name":   name,
		"config_changes": configChanges,
		"gray_rule":      grayRule,
	})
	_ = s.store.CreateAuditLog(&model.AuditLog{
		ID:           model.NewID(),
		TenantID:     tenantID,
		Action:       model.AuditActionCreateRelease,
		ResourceID:   release.ID,
		ResourceType: "release",
		Details:      auditDetails,
		Operator:     operator,
	})

	return release, nil
}

func (s *ConfigService) StartRelease(releaseID, operator string) error {
	release, err := s.store.GetReleaseByID(releaseID)
	if err != nil {
		return err
	}

	if release.Status != model.ReleaseStatusPending {
		return model.ErrInvalidReleaseStatus
	}

	now := time.Now()
	tx, err := s.store.DB().Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var versionIDs []string
	_ = json.Unmarshal(release.ConfigChanges, &versionIDs)

	for _, vid := range versionIDs {
		query := `UPDATE config_versions SET status = 'published', published_at = ? WHERE id = ?`
		if _, err := tx.Exec(query, now, vid); err != nil {
			return err
		}
	}

	updateQuery := `UPDATE releases SET status = ?, started_at = ? WHERE id = ?`
	if _, err := tx.Exec(updateQuery, model.ReleaseStatusRolling, now, releaseID); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	auditDetails, _ := json.Marshal(map[string]interface{}{
		"release_id":    releaseID,
		"previous_status": release.Status,
		"new_status":    model.ReleaseStatusRolling,
	})
	_ = s.store.CreateAuditLog(&model.AuditLog{
		ID:           model.NewID(),
		TenantID:     release.TenantID,
		Action:       model.AuditActionStartRelease,
		ResourceID:   releaseID,
		ResourceType: "release",
		Details:      auditDetails,
		Operator:     operator,
	})

	return nil
}

func (s *ConfigService) PauseRelease(releaseID, operator string) error {
	release, err := s.store.GetReleaseByID(releaseID)
	if err != nil {
		return err
	}

	if release.Status != model.ReleaseStatusRolling {
		return model.ErrInvalidReleaseStatus
	}

	now := time.Now()
	query := `UPDATE releases SET status = ?, paused_at = ? WHERE id = ?`
	_, err = s.store.DB().Exec(query, model.ReleaseStatusPaused, now, releaseID)
	if err != nil {
		return err
	}

	auditDetails, _ := json.Marshal(map[string]interface{}{
		"release_id":     releaseID,
		"previous_status": model.ReleaseStatusRolling,
		"new_status":     model.ReleaseStatusPaused,
	})
	_ = s.store.CreateAuditLog(&model.AuditLog{
		ID:           model.NewID(),
		TenantID:     release.TenantID,
		Action:       model.AuditActionPauseRelease,
		ResourceID:   releaseID,
		ResourceType: "release",
		Details:      auditDetails,
		Operator:     operator,
	})

	return nil
}

func (s *ConfigService) ResumeRelease(releaseID, operator string) error {
	release, err := s.store.GetReleaseByID(releaseID)
	if err != nil {
		return err
	}

	if release.Status != model.ReleaseStatusPaused {
		return model.ErrInvalidReleaseStatus
	}

	query := `UPDATE releases SET status = ? WHERE id = ?`
	_, err = s.store.DB().Exec(query, model.ReleaseStatusRolling, releaseID)
	if err != nil {
		return err
	}

	auditDetails, _ := json.Marshal(map[string]interface{}{
		"release_id":     releaseID,
		"previous_status": model.ReleaseStatusPaused,
		"new_status":     model.ReleaseStatusRolling,
	})
	_ = s.store.CreateAuditLog(&model.AuditLog{
		ID:           model.NewID(),
		TenantID:     release.TenantID,
		Action:       model.AuditActionResumeRelease,
		ResourceID:   releaseID,
		ResourceType: "release",
		Details:      auditDetails,
		Operator:     operator,
	})

	return nil
}

func (s *ConfigService) CompleteRelease(releaseID, operator string) error {
	release, err := s.store.GetReleaseByID(releaseID)
	if err != nil {
		return err
	}

	if release.Status != model.ReleaseStatusRolling {
		return model.ErrInvalidReleaseStatus
	}

	now := time.Now()
	query := `UPDATE releases SET status = ?, completed_at = ? WHERE id = ?`
	_, err = s.store.DB().Exec(query, model.ReleaseStatusCompleted, now, releaseID)
	if err != nil {
		return err
	}

	auditDetails, _ := json.Marshal(map[string]interface{}{
		"release_id":     releaseID,
		"previous_status": model.ReleaseStatusRolling,
		"new_status":     model.ReleaseStatusCompleted,
	})
	_ = s.store.CreateAuditLog(&model.AuditLog{
		ID:           model.NewID(),
		TenantID:     release.TenantID,
		Action:       model.AuditActionCompleteRelease,
		ResourceID:   releaseID,
		ResourceType: "release",
		Details:      auditDetails,
		Operator:     operator,
	})

	return nil
}

func (s *ConfigService) RollbackRelease(releaseID, reason, operator string) error {
	release, err := s.store.GetReleaseByID(releaseID)
	if err != nil {
		return err
	}

	if release.Status != model.ReleaseStatusRolling && release.Status != model.ReleaseStatusPaused {
		return model.ErrInvalidReleaseStatus
	}

	var versionIDs []string
	_ = json.Unmarshal(release.ConfigChanges, &versionIDs)

	var fromVersions []int
	var toVersions []int
	var configIDs []string

	for _, vid := range versionIDs {
		currentV, err := s.store.GetConfigVersionByID(vid)
		if err != nil {
			return err
		}

		configIDs = append(configIDs, currentV.ConfigID)
		fromVersions = append(fromVersions, currentV.Version)

		targetVersion := currentV.Version - 1
		var prevV *model.ConfigVersion
		for v := targetVersion; v >= 1; v-- {
			query := `SELECT id, config_id, version, value, status, published_at, created_at, created_by 
			          FROM config_versions WHERE config_id = ? AND version = ?`
			var version model.ConfigVersion
			var valueBytes []byte
			err := s.store.DB().QueryRow(query, currentV.ConfigID, v).Scan(
				&version.ID, &version.ConfigID, &version.Version, &valueBytes,
				&version.Status, &version.PublishedAt, &version.CreatedAt, &version.CreatedBy)
			if err == nil {
				version.Value = json.RawMessage(valueBytes)
				if version.Status == "published" {
					prevV = &version
					toVersions = append(toVersions, version.Version)
					break
				}
			}
		}

		if prevV != nil {
			query := `UPDATE config_versions SET status = 'published' WHERE id = ?`
			if _, err := s.store.DB().Exec(query, prevV.ID); err != nil {
				return err
			}
		}

		query := `UPDATE config_versions SET status = 'rolled_back' WHERE id = ?`
		if _, err := s.store.DB().Exec(query, currentV.ID); err != nil {
			return err
		}
	}

	now := time.Now()
	updateQuery := `UPDATE releases SET status = ?, rolled_back_at = ? WHERE id = ?`
	_, err = s.store.DB().Exec(updateQuery, model.ReleaseStatusRolledBack, now, releaseID)
	if err != nil {
		return err
	}

	affectedClients := 0
	pulls, err := s.store.GetPullsByRelease(releaseID)
	if err == nil {
		affectedClients = len(pulls)
	}

	for i, configID := range configIDs {
		fromV := 0
		toV := 0
		if i < len(fromVersions) {
			fromV = fromVersions[i]
		}
		if i < len(toVersions) {
			toV = toVersions[i]
		}
		rollbackDetails, _ := json.Marshal(map[string]interface{}{
			"release_id":      releaseID,
			"config_id":       configID,
			"from_version":    fromV,
			"to_version":      toV,
			"reason":          reason,
			"affected_clients": affectedClients,
		})
		_ = s.store.CreateAuditLog(&model.AuditLog{
			ID:           model.NewID(),
			TenantID:     release.TenantID,
			Action:       model.AuditActionRollbackRelease,
			ResourceID:   releaseID,
			ResourceType: "release",
			Details:      rollbackDetails,
			Operator:     operator,
		})
	}

	return nil
}

func (s *ConfigService) GetClientConfig(tenantID, serviceID, clientID, region, ifNoneMatch string) (map[string]interface{}, string, bool, error) {
	client, err := s.store.GetOrCreateClient(&model.Client{
		TenantID:  tenantID,
		ServiceID: serviceID,
		ClientID:  clientID,
		Region:    region,
	})
	if err != nil {
		return nil, "", false, err
	}

	activeRelease, err := s.store.GetActiveRelease(serviceID)
	if err != nil {
		return nil, "", false, err
	}

	var isGrayHit bool
	var grayRule *model.GrayRule
	if activeRelease != nil {
		var rule model.GrayRule
		_ = json.Unmarshal(activeRelease.GrayRule, &rule)
		grayRule = &rule

		isGrayHit = s.MatchesGrayRule(client, grayRule)
	}

	configs, err := s.getAllServiceConfigs(serviceID)
	if err != nil {
		return nil, "", false, err
	}

	result := make(map[string]interface{})
	versionIDs := make(map[string]string)
	configVersions := make(map[string]int)

	for key, config := range configs {
		var version *model.ConfigVersion

		if isGrayHit && activeRelease != nil {
			var versionIDsInRelease []string
			_ = json.Unmarshal(activeRelease.ConfigChanges, &versionIDsInRelease)
			for _, vid := range versionIDsInRelease {
				v, err := s.store.GetConfigVersionByID(vid)
				if err == nil && v.ConfigID == config.ID {
					version = v
					break
				}
			}
		}

		if version == nil {
			version, err = s.store.GetPublishedVersion(config.ID)
			if err != nil && err != model.ErrVersionNotFound {
				return nil, "", false, err
			}
		}

		if version != nil {
			var val interface{}
			_ = json.Unmarshal(version.Value, &val)
			result[key] = val
			versionIDs[key] = version.ID
			configVersions[key] = version.Version

			pull := &model.ClientPull{
				ID:           model.NewID(),
				TenantID:     tenantID,
				ServiceID:    serviceID,
				ClientID:     clientID,
				ConfigID:     config.ID,
				VersionID:    version.ID,
				Version:      version.Version,
				IsGrayHit:    isGrayHit && activeRelease != nil && s.isInRelease(activeRelease, version.ID),
				ClientRegion: region,
			}
			if activeRelease != nil && pull.IsGrayHit {
				pull.ReleaseID = activeRelease.ID
			}
			etag := generateETag(config.Key, version.Version, version.ID)
			pull.ETag = etag

			_ = s.store.CreateClientPull(pull)
		}
	}

	etag := generateCompositeETag(versionIDs)
	notModified := ifNoneMatch == etag

	return result, etag, notModified, nil
}

func (s *ConfigService) getAllServiceConfigs(serviceID string) (map[string]*model.ConfigItem, error) {
	query := `SELECT id, tenant_id, service_id, key, description, schema, created_at, updated_at FROM config_items WHERE service_id = ?`
	rows, err := s.store.DB().Query(query, serviceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[string]*model.ConfigItem)
	for rows.Next() {
		var config model.ConfigItem
		var schemaBytes []byte
		if err := rows.Scan(&config.ID, &config.TenantID, &config.ServiceID, &config.Key, &config.Description, &schemaBytes, &config.CreatedAt, &config.UpdatedAt); err != nil {
			return nil, err
		}
		config.Schema = json.RawMessage(schemaBytes)
		result[config.Key] = &config
	}
	return result, nil
}

func (s *ConfigService) MatchesGrayRule(client *model.Client, rule *model.GrayRule) bool {
	if rule == nil {
		return true
	}

	if len(rule.TenantIDs) > 0 {
		found := false
		for _, t := range rule.TenantIDs {
			if t == client.TenantID {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}

	if len(rule.Regions) > 0 {
		found := false
		for _, r := range rule.Regions {
			if r == client.Region {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}

	if rule.Percentage < 100 {
		hash := sha256.Sum256([]byte(client.ClientID))
		hashInt := int(hash[0]) + int(hash[1])<<8
		percentage := hashInt % 100
		if percentage >= rule.Percentage {
			return false
		}
	}

	return true
}

func (s *ConfigService) isInRelease(release *model.Release, versionID string) bool {
	var versionIDs []string
	_ = json.Unmarshal(release.ConfigChanges, &versionIDs)
	for _, vid := range versionIDs {
		if vid == versionID {
			return true
		}
	}
	return false
}

func generateETag(key string, version int, versionID string) string {
	h := sha256.New()
	h.Write([]byte(fmt.Sprintf("%s:%d:%s", key, version, versionID)))
	return hex.EncodeToString(h.Sum(nil))[:16]
}

func generateCompositeETag(versionIDs map[string]string) string {
	keys := make([]string, 0, len(versionIDs))
	for k := range versionIDs {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var buf bytes.Buffer
	for _, k := range keys {
		buf.WriteString(fmt.Sprintf("%s=%s;", k, versionIDs[k]))
	}

	h := sha256.New()
	h.Write(buf.Bytes())
	return "\"" + hex.EncodeToString(h.Sum(nil))[:32] + "\""
}

func (s *ConfigService) GenerateReleaseReport(releaseID string) (*model.ReleaseReport, error) {
	release, err := s.store.GetReleaseByID(releaseID)
	if err != nil {
		return nil, err
	}

	var versionIDs []string
	_ = json.Unmarshal(release.ConfigChanges, &versionIDs)

	var grayRule model.GrayRule
	_ = json.Unmarshal(release.GrayRule, &grayRule)

	report := &model.ReleaseReport{
		ReleaseID:   release.ID,
		ReleaseName: release.Name,
		TenantID:    release.TenantID,
		ServiceID:   release.ServiceID,
		Status:      string(release.Status),
		GrayRule:    &grayRule,
		CreatedAt:   release.CreatedAt,
		CreatedBy:   release.CreatedBy,
	}

	if release.StartedAt.Valid {
		t := release.StartedAt.Time
		report.StartedAt = &t
	}
	if release.CompletedAt.Valid {
		t := release.CompletedAt.Time
		report.CompletedAt = &t
	}
	if release.RolledBackAt.Valid {
		t := release.RolledBackAt.Time
		report.RolledBackAt = &t
	}

	clients, _ := s.store.GetClientsByService(release.ServiceID)
	allClientCount := len(clients)

	pulls, _ := s.store.GetPullsByRelease(releaseID)
	hitClientMap := make(map[string]bool)
	for _, p := range pulls {
		hitClientMap[p.ClientID] = true
	}
	hitClientCount := len(hitClientMap)

	for _, vid := range versionIDs {
		version, err := s.store.GetConfigVersionByID(vid)
		if err != nil {
			continue
		}

		config, err := s.store.GetConfigItemByID(version.ConfigID)
		if err != nil {
			continue
		}

		oldVersion := version.Version - 1
		item := model.ReportItem{
			ConfigKey:    config.Key,
			Status:       version.Status,
			OldVersion:   oldVersion,
			NewVersion:   version.Version,
			HitClients:   hitClientCount,
			TotalClients: allClientCount,
		}
		if allClientCount > 0 {
			item.HitPercentage = float64(hitClientCount) / float64(allClientCount) * 100
		}
		report.ChangeSummary = append(report.ChangeSummary, item)
	}

	auditLogs, _ := s.store.GetAuditLogsByResource(releaseID, 100)
	for _, log := range auditLogs {
		if log.Action == model.AuditActionRollbackRelease {
			var details struct {
				FromVersion     int    `json:"from_version"`
				ToVersion       int    `json:"to_version"`
				Reason          string `json:"reason"`
				AffectedClients int    `json:"affected_clients"`
			}
			_ = json.Unmarshal(log.Details, &details)

			report.RollbackRecords = append(report.RollbackRecords, model.RollbackRecord{
				FromVersion:     details.FromVersion,
				ToVersion:       details.ToVersion,
				Operator:        log.Operator,
				Timestamp:       log.CreatedAt,
				AffectedClients: details.AffectedClients,
				Reason:          details.Reason,
			})
		}
	}

	if release.Status == model.ReleaseStatusRolling || release.Status == model.ReleaseStatusPaused {
		if grayRule.Percentage < 100 && hitClientCount < allClientCount {
			report.PendingRisks = append(report.PendingRisks, model.RiskItem{
				Level:       "medium",
				Description: "灰度发布尚未覆盖所有客户端",
			})
		}
	}

	if release.Status == model.ReleaseStatusRolledBack {
		report.PendingRisks = append(report.PendingRisks, model.RiskItem{
			Level:       "high",
			Description: "发布已回滚，需要检查回滚原因并修复问题",
		})
	}

	return report, nil
}

func (s *ConfigService) ExportReportJSON(report *model.ReleaseReport) (string, error) {
	data, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (s *ConfigService) ExportReportMarkdown(report *model.ReleaseReport) (string, error) {
	var builder strings.Builder

	builder.WriteString(fmt.Sprintf("# 发布报告: %s\n\n", report.ReleaseName))
	builder.WriteString(fmt.Sprintf("**发布ID:** %s  \n", report.ReleaseID))
	builder.WriteString(fmt.Sprintf("**状态:** %s  \n", report.Status))
	builder.WriteString(fmt.Sprintf("**创建者:** %s  \n", report.CreatedBy))
	builder.WriteString(fmt.Sprintf("**创建时间:** %s  \n", report.CreatedAt.Format(time.RFC3339)))
	if report.StartedAt != nil {
		builder.WriteString(fmt.Sprintf("**启动时间:** %s  \n", report.StartedAt.Format(time.RFC3339)))
	}
	if report.CompletedAt != nil {
		builder.WriteString(fmt.Sprintf("**完成时间:** %s  \n", report.CompletedAt.Format(time.RFC3339)))
	}
	if report.RolledBackAt != nil {
		builder.WriteString(fmt.Sprintf("**回滚时间:** %s  \n", report.RolledBackAt.Format(time.RFC3339)))
	}
	builder.WriteString("\n")

	builder.WriteString("## 灰度规则\n\n")
	if report.GrayRule != nil {
		builder.WriteString("- **灰度百分比:** " + strconv.Itoa(report.GrayRule.Percentage) + "%\n")
		if len(report.GrayRule.Regions) > 0 {
			builder.WriteString("- **指定地区:** " + strings.Join(report.GrayRule.Regions, ", ") + "\n")
		}
		if len(report.GrayRule.TenantIDs) > 0 {
			builder.WriteString("- **指定租户:** " + strings.Join(report.GrayRule.TenantIDs, ", ") + "\n")
		}
	}
	builder.WriteString("\n")

	builder.WriteString("## 变更摘要\n\n")
	builder.WriteString("| 配置项 | 状态 | 旧版本 | 新版本 | 命中客户端 | 总客户端 | 命中率 |\n")
	builder.WriteString("|--------|------|--------|--------|-----------|----------|--------|\n")
	for _, item := range report.ChangeSummary {
		builder.WriteString(fmt.Sprintf("| %s | %s | %d | %d | %d | %d | %.2f%% |\n",
			item.ConfigKey, item.Status, item.OldVersion, item.NewVersion,
			item.HitClients, item.TotalClients, item.HitPercentage))
	}
	builder.WriteString("\n")

	if len(report.ValidationErrors) > 0 {
		builder.WriteString("## 校验失败项\n\n")
		for _, ve := range report.ValidationErrors {
			builder.WriteString(fmt.Sprintf("### %s\n\n", ve.ConfigKey))
			for _, e := range ve.Errors {
				builder.WriteString(fmt.Sprintf("- **%s**: %s\n", e.Field, e.Message))
			}
			builder.WriteString("\n")
		}
	}

	if len(report.RollbackRecords) > 0 {
		builder.WriteString("## 回滚记录\n\n")
		for i, rr := range report.RollbackRecords {
			builder.WriteString(fmt.Sprintf("### 回滚 %d\n\n", i+1))
			builder.WriteString(fmt.Sprintf("- **从版本:** %d\n", rr.FromVersion))
			builder.WriteString(fmt.Sprintf("- **到版本:** %d\n", rr.ToVersion))
			builder.WriteString(fmt.Sprintf("- **操作人:** %s\n", rr.Operator))
			builder.WriteString(fmt.Sprintf("- **时间:** %s\n", rr.Timestamp.Format(time.RFC3339)))
			builder.WriteString(fmt.Sprintf("- **影响客户端:** %d\n", rr.AffectedClients))
			builder.WriteString(fmt.Sprintf("- **原因:** %s\n", rr.Reason))
			builder.WriteString("\n")
		}
	}

	if len(report.PendingRisks) > 0 {
		builder.WriteString("## 待处理风险\n\n")
		for _, risk := range report.PendingRisks {
			builder.WriteString(fmt.Sprintf("- **[%s]** %s\n", strings.ToUpper(risk.Level), risk.Description))
		}
	}

	return builder.String(), nil
}
