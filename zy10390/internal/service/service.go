package service

import (
	"db-pool-protect-api/internal/model"
	"db-pool-protect-api/internal/store"
	"encoding/csv"
	"fmt"
	"strconv"
	"time"
)

type ProtectService struct {
	store store.DataStore
}

func NewProtectService(s store.DataStore) *ProtectService {
	return &ProtectService{store: s}
}

func (s *ProtectService) CreateRule(req *CreateRuleRequest, operator string) (*model.ProtectionRule, error) {
	if req.RequestID != "" {
		exists := s.store.CheckRequestID(req.RequestID)
		if exists {
			rules, _ := s.store.ListRules()
			for _, r := range rules {
				if r.RequestID == req.RequestID {
					return r, nil
				}
			}
		}
	}

	rule := &model.ProtectionRule{
		ID:          model.NewUUID(),
		Name:        req.Name,
		APIPath:     req.APIPath,
		PoolName:    req.PoolName,
		Description: req.Description,
		Status:      model.RuleStatusActive,
		Thresholds:  req.Thresholds,
		Action:      req.Action,
		ActionParams: req.ActionParams,
		CreatedBy:   operator,
		RequestID:   req.RequestID,
	}

	if err := s.store.CreateRule(rule); err != nil {
		return nil, err
	}

	s.store.AddHistory(&model.HistoryRecord{
		ResourceID:   rule.ID,
		ResourceType: "rule",
		Action:       "create",
		After:        rule,
		Operator:     operator,
		RequestID:    req.RequestID,
	})

	return rule, nil
}

func (s *ProtectService) GetRule(id string) (*model.ProtectionRule, error) {
	return s.store.GetRule(id)
}

func (s *ProtectService) ListRules() ([]*model.ProtectionRule, error) {
	return s.store.ListRules()
}

func (s *ProtectService) UpdateRuleStatus(id string, status model.RuleStatus, operator string) (*model.ProtectionRule, error) {
	rule, err := s.store.GetRule(id)
	if err != nil {
		return nil, err
	}
	if rule == nil {
		return nil, fmt.Errorf("rule not found")
	}

	before := *rule
	rule.Status = status

	if err := s.store.UpdateRule(rule); err != nil {
		return nil, err
	}

	s.store.AddHistory(&model.HistoryRecord{
		ResourceID:   rule.ID,
		ResourceType: "rule",
		Action:       "update_status",
		Before:       before,
		After:        rule,
		Operator:     operator,
	})

	return rule, nil
}

func (s *ProtectService) DeleteRule(id string, operator string) error {
	rule, err := s.store.GetRule(id)
	if err != nil {
		return err
	}
	if rule == nil {
		return fmt.Errorf("rule not found")
	}

	if err := s.store.DeleteRule(id); err != nil {
		return err
	}

	s.store.AddHistory(&model.HistoryRecord{
		ResourceID:   id,
		ResourceType: "rule",
		Action:       "delete",
		Before:       rule,
		Operator:     operator,
	})

	return nil
}

func (s *ProtectService) RecordConnectionStats(stats *model.ConnectionStats) error {
	return s.store.RecordConnectionStats(stats)
}

func (s *ProtectService) RecordSlowQuery(record *model.SlowQueryRecord) error {
	rules, _ := s.store.ListRules()
	for _, rule := range rules {
		if rule.APIPath == record.APIPath && rule.Status == model.RuleStatusActive {
			record.RuleID = rule.ID
			break
		}
	}
	return s.store.RecordSlowQuery(record)
}

func (s *ProtectService) CheckAndTriggerProtection(ruleID string, operator string) (*model.ProtectionEvent, error) {
	rule, err := s.store.GetRule(ruleID)
	if err != nil {
		return nil, err
	}
	if rule == nil {
		return nil, fmt.Errorf("rule not found")
	}
	if rule.Status != model.RuleStatusActive {
		return nil, fmt.Errorf("rule is not active")
	}

	statsList, _ := s.store.ListConnectionStats(ruleID, 10)
	if len(statsList) == 0 {
		return nil, fmt.Errorf("no connection stats available")
	}

	latestStats := statsList[len(statsList)-1]
	var triggerReason string
	triggerData := make(map[string]any)

	if latestStats.ActiveConn > rule.Thresholds.MaxActiveConn {
		triggerReason = fmt.Sprintf("active connections %d exceeds threshold %d", latestStats.ActiveConn, rule.Thresholds.MaxActiveConn)
		triggerData["active_conn"] = latestStats.ActiveConn
		triggerData["threshold"] = rule.Thresholds.MaxActiveConn
	} else if latestStats.WaitTimeAvg > rule.Thresholds.MaxWaitTimeMs {
		triggerReason = fmt.Sprintf("avg wait time %dms exceeds threshold %dms", latestStats.WaitTimeAvg, rule.Thresholds.MaxWaitTimeMs)
		triggerData["wait_time_avg"] = latestStats.WaitTimeAvg
		triggerData["threshold"] = rule.Thresholds.MaxWaitTimeMs
	} else {
		return nil, fmt.Errorf("no threshold exceeded")
	}

	event := &model.ProtectionEvent{
		RuleID:      rule.ID,
		RuleVersion: rule.Version,
		APIPath:     rule.APIPath,
		PoolName:    rule.PoolName,
		Action:      rule.Action,
		Reason:      triggerReason,
		TriggerData: triggerData,
		Operator:    operator,
	}

	if err := s.store.CreateProtectionEvent(event); err != nil {
		return nil, err
	}

	before := *rule
	rule.Status = model.RuleStatusTriggered
	s.store.UpdateRule(rule)

	s.store.AddHistory(&model.HistoryRecord{
		ResourceID:   rule.ID,
		ResourceType: "rule",
		Action:       "trigger_protection",
		Before:       before,
		After:        rule,
		Operator:     operator,
	})

	return event, nil
}

func (s *ProtectService) ConfirmRestore(ruleID string, eventID string, reason string, checkData map[string]any, operator string) (*model.RestoreRecord, error) {
	rule, err := s.store.GetRule(ruleID)
	if err != nil {
		return nil, err
	}
	if rule == nil {
		return nil, fmt.Errorf("rule not found")
	}
	if rule.Status != model.RuleStatusTriggered {
		return nil, fmt.Errorf("rule is not in triggered status")
	}

	record := &model.RestoreRecord{
		RuleID:    ruleID,
		EventID:   eventID,
		Reason:    reason,
		CheckData: checkData,
		Confirmed: true,
		Operator:  operator,
	}

	if err := s.store.CreateRestoreRecord(record); err != nil {
		return nil, err
	}

	before := *rule
	rule.Status = model.RuleStatusRestored
	s.store.UpdateRule(rule)

	s.store.AddHistory(&model.HistoryRecord{
		ResourceID:   rule.ID,
		ResourceType: "rule",
		Action:       "confirm_restore",
		Before:       before,
		After:        rule,
		Operator:     operator,
	})

	return record, nil
}

func (s *ProtectService) GetOverview() (*model.OverviewStats, error) {
	rules, _ := s.store.ListRules()

	stats := &model.OverviewStats{
		TotalRules:     len(rules),
	}

	today := time.Now().Truncate(24 * time.Hour)
	slowAPIMap := make(map[string]*model.SlowAPIInfo)
	poolMap := make(map[string]*model.PoolStatus)

	for _, rule := range rules {
		if rule.Status == model.RuleStatusActive {
			stats.ActiveRules++
		}
		if rule.Status == model.RuleStatusTriggered {
			stats.TriggeredRules++
		}

		events, _ := s.store.ListProtectionEvents(rule.ID, 0)
		for _, e := range events {
			if e.Timestamp.After(today) {
				stats.TodayProtection++
			}
		}

		restores, _ := s.store.ListRestoreRecords(rule.ID, 0)
		for _, r := range restores {
			if r.Timestamp.After(today) {
				stats.TodayRestore++
			}
		}

		slowQueries, _ := s.store.ListSlowQueries(rule.ID, 100)
		for _, sq := range slowQueries {
			if _, ok := slowAPIMap[sq.APIPath]; !ok {
				slowAPIMap[sq.APIPath] = &model.SlowAPIInfo{APIPath: sq.APIPath}
			}
			info := slowAPIMap[sq.APIPath]
			info.Count++
			info.AvgDuration = (info.AvgDuration*(info.Count-1) + sq.DurationMs) / info.Count
		}

		connStats, _ := s.store.ListConnectionStats(rule.ID, 1)
		if len(connStats) > 0 {
			if _, ok := poolMap[rule.PoolName]; !ok {
				poolMap[rule.PoolName] = &model.PoolStatus{PoolName: rule.PoolName}
			}
			pool := poolMap[rule.PoolName]
			pool.ActiveConn = connStats[0].ActiveConn
			total := connStats[0].ActiveConn + connStats[0].IdleConn
			if total > 0 {
				pool.UsageRate = float64(connStats[0].ActiveConn) / float64(total)
			}
		}
	}

	for _, info := range slowAPIMap {
		stats.TopSlowAPIs = append(stats.TopSlowAPIs, *info)
	}
	for _, pool := range poolMap {
		stats.PoolStatusList = append(stats.PoolStatusList, *pool)
	}

	return stats, nil
}

func (s *ProtectService) ListHistory(resourceID string, limit int) ([]*model.HistoryRecord, error) {
	return s.store.ListHistory(resourceID, limit)
}

func (s *ProtectService) ExportReport() ([][]string, error) {
	var records [][]string

	records = append(records, []string{
		"Report Type", "Rule ID", "Rule Name", "API Path", "Pool Name", "Status", "Action", "Reason", "Timestamp", "Operator",
	})

	rules, _ := s.store.ListRules()
	for _, rule := range rules {
		events, _ := s.store.ListProtectionEvents(rule.ID, 0)
		for _, e := range events {
			records = append(records, []string{
				"Protection Event",
				e.RuleID,
				rule.Name,
				e.APIPath,
				e.PoolName,
				string(rule.Status),
				string(e.Action),
				e.Reason,
				e.Timestamp.Format(time.RFC3339),
				e.Operator,
			})
		}

		restores, _ := s.store.ListRestoreRecords(rule.ID, 0)
		for _, r := range restores {
			records = append(records, []string{
				"Restore Record",
				r.RuleID,
				rule.Name,
				rule.APIPath,
				rule.PoolName,
				string(rule.Status),
				"restore",
				r.Reason,
				r.Timestamp.Format(time.RFC3339),
				r.Operator,
			})
		}
	}

	records = append(records, []string{})
	records = append(records, []string{"Slow Query Report"})
	records = append(records, []string{"API Path", "SQL", "Duration(ms)", "Trace ID", "Timestamp"})

	for _, rule := range rules {
		slowQueries, _ := s.store.ListSlowQueries(rule.ID, 0)
		for _, sq := range slowQueries {
			records = append(records, []string{
				sq.APIPath,
				sq.SQL,
				strconv.Itoa(sq.DurationMs),
				sq.TraceID,
				sq.Timestamp.Format(time.RFC3339),
			})
		}
	}

	return records, nil
}

func (s *ProtectService) WriteCSV(records [][]string, w *csv.Writer) error {
	return w.WriteAll(records)
}

type CreateRuleRequest struct {
	Name          string                 `json:"name"`
	APIPath       string                 `json:"api_path"`
	PoolName      string                 `json:"pool_name"`
	Description   string                 `json:"description"`
	Thresholds    model.ThresholdConfig  `json:"thresholds"`
	Action        model.ProtectionAction `json:"action"`
	ActionParams  map[string]any         `json:"action_params"`
	RequestID     string                 `json:"request_id"`
}
