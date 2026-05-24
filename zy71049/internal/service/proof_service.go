package service

import (
	"fmt"

	"print-proof-api/internal/dao"
	"print-proof-api/internal/model"
)

type ProofService struct {
	stateMachine   *StateMachine
	colorValidator *ColorValidator
}

func NewProofService() *ProofService {
	return &ProofService{
		stateMachine:   NewStateMachine(),
		colorValidator: NewColorValidator(),
	}
}

type SubmitMaterialRequest struct {
	OrderID   string
	OrderNo   string
	PaperID   string
	Colors    []*model.ColorValue
	Notes     string
	CreatedBy string
}

func (ps *ProofService) SubmitMaterial(req *SubmitMaterialRequest) (*model.ProofVersion, error) {
	var order *model.Order
	var err error

	if req.OrderID != "" {
		order, err = dao.GetOrderByID(req.OrderID)
	} else if req.OrderNo != "" {
		order, err = dao.GetOrderByNo(req.OrderNo)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to get order: %w", err)
	}

	if order == nil {
		return nil, fmt.Errorf("order not found")
	}

	maxVersionNo, err := dao.GetMaxVersionNo(order.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get max version: %w", err)
	}

	version := &model.ProofVersion{
		OrderID:   order.ID,
		VersionNo: maxVersionNo + 1,
		PaperID:   req.PaperID,
		Notes:     req.Notes,
		CreatedBy: req.CreatedBy,
	}

	if err := dao.CreateProofVersion(version); err != nil {
		return nil, fmt.Errorf("failed to create proof version: %w", err)
	}

	for _, color := range req.Colors {
		color.ProofVersionID = version.ID
		ps.colorValidator.ValidateColorValue(color)
		if err := dao.CreateColorValue(color); err != nil {
			return nil, fmt.Errorf("failed to create color value: %w", err)
		}
	}

	ps.logChange(version.ID, "version", "", fmt.Sprintf("v%d", version.VersionNo), req.CreatedBy, model.ChangeTypeCreate)

	return version, nil
}

func (ps *ProofService) SubmitVersion(versionID, operator string) (*model.ProofVersion, error) {
	version, err := dao.GetProofVersionByID(versionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get version: %w", err)
	}
	if version == nil {
		return nil, fmt.Errorf("version not found")
	}

	toState, err := ps.stateMachine.ValidateTransition(version.Status, "submit")
	if err != nil {
		return nil, err
	}

	if err := dao.UpdateProofVersionStatus(versionID, toState); err != nil {
		return nil, fmt.Errorf("failed to update status: %w", err)
	}

	ps.logChange(versionID, "status", version.Status, toState, operator, model.ChangeTypeUpdate)

	version.Status = toState
	return version, nil
}

type AutoCheckResult struct {
	Passed        bool
	ColorValid    bool
	ColorErrors   []string
	HasOutOfGamut bool
	PaperApproved bool
}

func (ps *ProofService) AutoCheck(versionID string) (*AutoCheckResult, error) {
	version, err := dao.GetProofVersionByID(versionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get version: %w", err)
	}
	if version == nil {
		return nil, fmt.Errorf("version not found")
	}

	result := &AutoCheckResult{
		Passed: true,
	}

	colors, err := dao.GetColorValuesByVersion(versionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get colors: %w", err)
	}

	valid, errors := ps.colorValidator.ValidateColors(colors)
	result.ColorValid = valid
	result.ColorErrors = errors
	if !valid {
		result.Passed = false
	}

	hasOutOfGamut, err := dao.HasOutOfGamutColors(versionID)
	if err != nil {
		return nil, fmt.Errorf("failed to check gamut: %w", err)
	}
	result.HasOutOfGamut = hasOutOfGamut
	if hasOutOfGamut {
		result.Passed = false
	}

	if version.PaperID != "" {
		paper, err := dao.GetPaperByID(version.PaperID)
		if err != nil {
			return nil, fmt.Errorf("failed to get paper: %w", err)
		}
		if paper != nil {
			result.PaperApproved = paper.IsApproved
			if !paper.IsApproved {
				result.Passed = false
			}
		}
	}

	return result, nil
}

func (ps *ProofService) ProcessAutoCheck(versionID, operator string) (*model.ProofVersion, *AutoCheckResult, error) {
	version, err := dao.GetProofVersionByID(versionID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get version: %w", err)
	}
	if version == nil {
		return nil, nil, fmt.Errorf("version not found")
	}

	checkResult, err := ps.AutoCheck(versionID)
	if err != nil {
		return nil, nil, err
	}

	action := "auto_pass"
	if !checkResult.Passed {
		action = "auto_fail"
	}

	toState, err := ps.stateMachine.ValidateTransition(version.Status, action)
	if err != nil {
		return nil, checkResult, err
	}

	if err := dao.UpdateProofVersionStatus(versionID, toState); err != nil {
		return nil, checkResult, fmt.Errorf("failed to update status: %w", err)
	}

	version.Status = toState
	version.IsColorApproved = checkResult.ColorValid && !checkResult.HasOutOfGamut
	version.IsPaperApproved = checkResult.PaperApproved

	if err := dao.UpdateProofVersion(version); err != nil {
		return nil, checkResult, fmt.Errorf("failed to update version: %w", err)
	}

	ps.logChange(versionID, "status", version.Status, toState, operator, model.ChangeTypeUpdate)

	return version, checkResult, nil
}

func (ps *ProofService) StartReview(versionID, operator string) (*model.ProofVersion, error) {
	version, err := dao.GetProofVersionByID(versionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get version: %w", err)
	}
	if version == nil {
		return nil, fmt.Errorf("version not found")
	}

	toState, err := ps.stateMachine.ValidateTransition(version.Status, "start_review")
	if err != nil {
		return nil, err
	}

	if err := dao.UpdateProofVersionStatus(versionID, toState); err != nil {
		return nil, fmt.Errorf("failed to update status: %w", err)
	}

	ps.logChange(versionID, "status", version.Status, toState, operator, model.ChangeTypeUpdate)

	version.Status = toState
	return version, nil
}

func (ps *ProofService) Approve(versionID, operator, comments string) (*model.ProofVersion, error) {
	version, err := dao.GetProofVersionByID(versionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get version: %w", err)
	}
	if version == nil {
		return nil, fmt.Errorf("version not found")
	}

	toState, err := ps.stateMachine.ValidateTransition(version.Status, "approve")
	if err != nil {
		return nil, err
	}

	conf := &model.Confirmation{
		ProofVersionID: versionID,
		Confirmer:      operator,
		ConfirmType:    model.ConfirmTypeFinal,
		Result:         model.ConfirmResultApprove,
		Comments:       comments,
	}
	if err := dao.CreateConfirmation(conf); err != nil {
		return nil, fmt.Errorf("failed to create confirmation: %w", err)
	}

	if err := dao.UpdateProofVersionStatus(versionID, toState); err != nil {
		return nil, fmt.Errorf("failed to update status: %w", err)
	}

	ps.logChange(versionID, "status", version.Status, toState, operator, model.ChangeTypeUpdate)

	version.Status = toState
	version.IsColorApproved = true
	version.IsPaperApproved = true
	if err := dao.UpdateProofVersion(version); err != nil {
		return nil, fmt.Errorf("failed to update version: %w", err)
	}

	return version, nil
}

func (ps *ProofService) Reject(versionID, operator, comments string) (*model.ProofVersion, error) {
	version, err := dao.GetProofVersionByID(versionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get version: %w", err)
	}
	if version == nil {
		return nil, fmt.Errorf("version not found")
	}

	toState, err := ps.stateMachine.ValidateTransition(version.Status, "reject")
	if err != nil {
		return nil, err
	}

	conf := &model.Confirmation{
		ProofVersionID: versionID,
		Confirmer:      operator,
		ConfirmType:    model.ConfirmTypeFinal,
		Result:         model.ConfirmResultReject,
		Comments:       comments,
	}
	if err := dao.CreateConfirmation(conf); err != nil {
		return nil, fmt.Errorf("failed to create confirmation: %w", err)
	}

	if err := dao.UpdateProofVersionStatus(versionID, toState); err != nil {
		return nil, fmt.Errorf("failed to update status: %w", err)
	}

	ps.logChange(versionID, "status", version.Status, toState, operator, model.ChangeTypeUpdate)

	version.Status = toState
	return version, nil
}

func (ps *ProofService) RequestSupplement(versionID, operator, comments string) (*model.ProofVersion, error) {
	version, err := dao.GetProofVersionByID(versionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get version: %w", err)
	}
	if version == nil {
		return nil, fmt.Errorf("version not found")
	}

	toState, err := ps.stateMachine.ValidateTransition(version.Status, "need_supplement")
	if err != nil {
		return nil, err
	}

	if err := dao.UpdateProofVersionStatus(versionID, toState); err != nil {
		return nil, fmt.Errorf("failed to update status: %w", err)
	}

	ps.logChange(versionID, "status", version.Status, toState, operator, model.ChangeTypeUpdate)
	ps.logChange(versionID, "supplement_notes", "", comments, operator, model.ChangeTypeSupplement)

	version.Status = toState
	return version, nil
}

type SupplementRequest struct {
	VersionID string
	PaperID   string
	Colors    []*model.ColorValue
	Notes     string
	Operator  string
}

func (ps *ProofService) Supplement(req *SupplementRequest) (*model.ProofVersion, error) {
	version, err := dao.GetProofVersionByID(req.VersionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get version: %w", err)
	}
	if version == nil {
		return nil, fmt.Errorf("version not found")
	}

	if req.PaperID != "" && req.PaperID != version.PaperID {
		ps.logChange(req.VersionID, "paper_id", version.PaperID, req.PaperID, req.Operator, model.ChangeTypeSupplement)
		version.PaperID = req.PaperID
	}

	if len(req.Colors) > 0 {
		if err := dao.DeleteColorValuesByVersion(req.VersionID); err != nil {
			return nil, fmt.Errorf("failed to delete old colors: %w", err)
		}
		ps.logChange(req.VersionID, "colors", "updated", "new values", req.Operator, model.ChangeTypeSupplement)

		for _, color := range req.Colors {
			color.ProofVersionID = req.VersionID
			ps.colorValidator.ValidateColorValue(color)
			if err := dao.CreateColorValue(color); err != nil {
				return nil, fmt.Errorf("failed to create color: %w", err)
			}
		}
	}

	if req.Notes != "" {
		ps.logChange(req.VersionID, "notes", version.Notes, req.Notes, req.Operator, model.ChangeTypeSupplement)
		version.Notes = req.Notes
	}

	toState, err := ps.stateMachine.ValidateTransition(version.Status, "resubmit")
	if err != nil {
		return nil, err
	}

	version.Status = toState
	if err := dao.UpdateProofVersion(version); err != nil {
		return nil, fmt.Errorf("failed to update version: %w", err)
	}

	return version, nil
}

func (ps *ProofService) Finalize(versionID, operator string) (*model.ProofVersion, error) {
	version, err := dao.GetProofVersionByID(versionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get version: %w", err)
	}
	if version == nil {
		return nil, fmt.Errorf("version not found")
	}

	toState, err := ps.stateMachine.ValidateTransition(version.Status, "finalize")
	if err != nil {
		return nil, err
	}

	if err := dao.SetFinalVersion(versionID); err != nil {
		return nil, fmt.Errorf("failed to set final version: %w", err)
	}

	ps.logChange(versionID, "status", version.Status, toState, operator, model.ChangeTypeUpdate)
	ps.logChange(versionID, "is_final_version", "false", "true", operator, model.ChangeTypeUpdate)

	if err := dao.UpdateOrderStatus(version.OrderID, model.OrderStatusApproved); err != nil {
		return nil, fmt.Errorf("failed to update order status: %w", err)
	}

	version.Status = toState
	version.IsFinalVersion = true
	return version, nil
}

func (ps *ProofService) logChange(versionID, field, oldValue, newValue, changedBy, changeType string) {
	log := &model.ChangeLog{
		ProofVersionID: versionID,
		FieldName:      field,
		OldValue:       oldValue,
		NewValue:       newValue,
		ChangedBy:      changedBy,
		ChangeType:     changeType,
	}
	dao.CreateChangeLog(log)
}
