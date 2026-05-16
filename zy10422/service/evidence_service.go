package service

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"device-evidence-api/database"
	"device-evidence-api/model"
)

type EvidenceService struct{}

func NewEvidenceService() *EvidenceService {
	return &EvidenceService{}
}

func (s *EvidenceService) CreateEvidence(req *model.CreateEvidenceRequest, idempotentKey string, rawInput string) (*model.DeviceEvidence, error) {
	evidence := &model.DeviceEvidence{
		DeviceID:       req.DeviceID,
		FirmwareVersion: req.FirmwareVersion,
		ProofMaterial:  req.ProofMaterial,
		StrategyResult: req.StrategyResult,
		IsolationAction: model.IsolationNone,
	}

	if err := s.validateProofMaterial(evidence.ProofMaterial); err != nil {
		evidence.Status = model.StatusBlocked
		evidence.Conclusion = fmt.Sprintf("证明材料校验失败: %v", err)
		return database.CreateEvidence(evidence, rawInput, idempotentKey)
	}

	if err := s.validateFirmwareVersion(req.DeviceID, req.FirmwareVersion); err != nil {
		evidence.Status = model.StatusPending
		evidence.Conclusion = fmt.Sprintf("固件版本待复核: %v", err)
		return database.CreateEvidence(evidence, rawInput, idempotentKey)
	}

	currentIsolation, _ := database.GetDeviceIsolationStatus(req.DeviceID)
	evidence.IsolationAction = currentIsolation

	if req.StrategyResult != nil {
		if req.StrategyResult.Passed {
			evidence.Status = model.StatusSuccess
			evidence.Conclusion = "策略校验通过"
			if evidence.IsolationAction == model.IsolationQuarantine || evidence.IsolationAction == model.IsolationSuspend {
				evidence.IsolationAction = model.IsolationRelease
			}
		} else {
			evidence.Status = model.StatusBlocked
			evidence.Conclusion = fmt.Sprintf("策略校验未通过，风险等级: %s", req.StrategyResult.RiskLevel)
			if req.StrategyResult.RecommendedAction == "quarantine" {
				evidence.IsolationAction = model.IsolationQuarantine
			} else if req.StrategyResult.RecommendedAction == "suspend" {
				evidence.IsolationAction = model.IsolationSuspend
			}
		}
	} else {
		evidence.Status = model.StatusPending
		evidence.Conclusion = "待策略结果复核"
	}

	return database.CreateEvidence(evidence, rawInput, idempotentKey)
}

func (s *EvidenceService) validateProofMaterial(material *model.ProofMaterial) error {
	if material == nil {
		return fmt.Errorf("证明材料为空")
	}

	if material.Hash == "" {
		return fmt.Errorf("哈希值不能为空")
	}

	if len(material.Signatures) == 0 {
		return fmt.Errorf("签名列表不能为空")
	}

	if material.Certificate == "" {
		return fmt.Errorf("证书不能为空")
	}

	if material.Timestamp == 0 {
		return fmt.Errorf("时间戳不能为空")
	}

	return nil
}

func (s *EvidenceService) generateExpectedHash(material *model.ProofMaterial) string {
	data := fmt.Sprintf("%d:%s:%s", material.Timestamp, material.Certificate, strings.Join(material.Measurements, ","))
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}

func (s *EvidenceService) validateFirmwareVersion(deviceID, version string) error {
	allowedVersions := map[string][]string{
		"device-001": {"v1.2.0", "v1.2.1", "v1.3.0"},
		"device-002": {"v2.0.0", "v2.0.1"},
		"device-003": {"v1.5.0", "v1.5.1", "v1.6.0"},
	}

	if versions, ok := allowedVersions[deviceID]; ok {
		for _, v := range versions {
			if v == version {
				return nil
			}
		}
		return fmt.Errorf("固件版本 %s 不在设备 %s 的允许列表中", version, deviceID)
	}

	return fmt.Errorf("未知设备 %s，需人工确认固件版本", deviceID)
}

func (s *EvidenceService) GetEvidence(id string) (*model.DeviceEvidence, error) {
	return database.GetEvidenceByID(id)
}

func (s *EvidenceService) QueryEvidences(req *model.QueryEvidenceRequest) ([]*model.DeviceEvidence, int, error) {
	return database.QueryEvidences(req)
}

func (s *EvidenceService) UpdateStatus(id string, req *model.StatusUpdateRequest) error {
	evidence, err := database.GetEvidenceByID(id)
	if err != nil {
		return err
	}

	if req.IsolationAction == "" {
		req.IsolationAction = evidence.IsolationAction
	}

	return database.UpdateEvidenceStatus(id, req)
}

func (s *EvidenceService) ManualCorrection(id string, req *model.ManualCorrectionRequest) error {
	_, err := database.GetEvidenceByID(id)
	if err != nil {
		return err
	}

	return database.ManualCorrection(id, req)
}

func (s *EvidenceService) ExportEvidences() (string, error) {
	evidences, err := database.GetAllEvidencesForExport()
	if err != nil {
		return "", err
	}

	data, err := json.MarshalIndent(evidences, "", "  ")
	if err != nil {
		return "", err
	}

	return string(data), nil
}

func (s *EvidenceService) GenerateReport(evidenceID, reportType string) (*model.EvidenceReport, error) {
	evidence, err := database.GetEvidenceByID(evidenceID)
	if err != nil {
		return nil, err
	}

	content := s.generateReportContent(evidence, reportType)

	report := &model.EvidenceReport{
		EvidenceID: evidenceID,
		DeviceID:   evidence.DeviceID,
		ReportType: reportType,
		Content:    content,
	}

	err = database.CreateReport(report)
	if err != nil {
		return nil, err
	}

	return report, nil
}

func (s *EvidenceService) generateReportContent(evidence *model.DeviceEvidence, reportType string) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("设备可信证据报告 [%s]\n", reportType))
	sb.WriteString(fmt.Sprintf("生成时间: %s\n", time.Now().Format(time.RFC3339)))
	sb.WriteString(fmt.Sprintf("证据ID: %s\n", evidence.ID))
	sb.WriteString(fmt.Sprintf("设备ID: %s\n", evidence.DeviceID))
	sb.WriteString(fmt.Sprintf("固件版本: %s\n", evidence.FirmwareVersion))
	sb.WriteString(fmt.Sprintf("当前状态: %s\n", evidence.Status))
	sb.WriteString(fmt.Sprintf("隔离动作: %s\n", evidence.IsolationAction))
	sb.WriteString(fmt.Sprintf("处理结论: %s\n", evidence.Conclusion))
	sb.WriteString(fmt.Sprintf("创建时间: %s\n", evidence.CreatedAt.Format(time.RFC3339)))

	if evidence.Operator != "" {
		sb.WriteString(fmt.Sprintf("操作人: %s\n", evidence.Operator))
	}

	if evidence.Remark != "" {
		sb.WriteString(fmt.Sprintf("备注: %s\n", evidence.Remark))
	}

	if reportType == "full" && evidence.ProofMaterial != nil {
		sb.WriteString("\n=== 证明材料详情 ===\n")
		sb.WriteString(fmt.Sprintf("哈希: %s\n", evidence.ProofMaterial.Hash))
		sb.WriteString(fmt.Sprintf("签名数: %d\n", len(evidence.ProofMaterial.Signatures)))
		sb.WriteString(fmt.Sprintf("证书: %s\n", evidence.ProofMaterial.Certificate[:20]+"..."))
		sb.WriteString(fmt.Sprintf("时间戳: %d\n", evidence.ProofMaterial.Timestamp))
		sb.WriteString(fmt.Sprintf("测量值数: %d\n", len(evidence.ProofMaterial.Measurements)))
	}

	if reportType == "full" && evidence.StrategyResult != nil {
		sb.WriteString("\n=== 策略判定结果 ===\n")
		sb.WriteString(fmt.Sprintf("是否通过: %v\n", evidence.StrategyResult.Passed))
		sb.WriteString(fmt.Sprintf("风险等级: %s\n", evidence.StrategyResult.RiskLevel))
		sb.WriteString(fmt.Sprintf("建议动作: %s\n", evidence.StrategyResult.RecommendedAction))
		sb.WriteString("规则详情:\n")
		for _, rule := range evidence.StrategyResult.Rules {
			status := "通过"
			if !rule.Passed {
				status = "不通过"
			}
			sb.WriteString(fmt.Sprintf("  - %s [%s]: %s\n", rule.RuleName, status, rule.Details))
		}
	}

	return sb.String()
}
