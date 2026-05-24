package service

import (
	"fmt"
	"strconv"
	"time"

	"damage-arbitration/internal/database"
	"damage-arbitration/internal/models"
)

type ArbitrationService struct {
	validationService *ValidationService
}

func NewArbitrationService() *ArbitrationService {
	return &ArbitrationService{
		validationService: NewValidationService(),
	}
}

func (s *ArbitrationService) CreateArbitration(req *models.CreateArbitrationRequest) (*models.Arbitration, error) {
	existing, err := database.GetArbitrationByOrderID(req.OrderID)
	if err != nil {
		return nil, fmt.Errorf("查询订单失败: %w", err)
	}
	if existing != nil {
		return nil, fmt.Errorf("该订单已存在仲裁记录")
	}

	arbitration := &models.Arbitration{
		OrderID:    req.OrderID,
		VehicleID:  req.VehicleID,
		UserID:     req.UserID,
		Status:     models.StatusCreated,
		PickupTime: &req.PickupTime,
		ReturnTime: &req.ReturnTime,
	}

	arbitrationID, err := database.CreateArbitration(arbitration)
	if err != nil {
		return nil, fmt.Errorf("创建仲裁记录失败: %w", err)
	}

	for _, p := range req.PickupPhotos {
		photo := &models.Photo{
			ArbitrationID: arbitrationID,
			PhotoType:     "pickup",
			PhotoURL:      p.PhotoURL,
			PhotoTime:     p.PhotoTime,
			Remark:        p.Remark,
		}
		if _, err := database.CreatePhoto(photo); err != nil {
			return nil, fmt.Errorf("创建取车照片失败: %w", err)
		}
	}

	for _, p := range req.ReturnPhotos {
		photo := &models.Photo{
			ArbitrationID: arbitrationID,
			PhotoType:     "return",
			PhotoURL:      p.PhotoURL,
			PhotoTime:     p.PhotoTime,
			Remark:        p.Remark,
		}
		if _, err := database.CreatePhoto(photo); err != nil {
			return nil, fmt.Errorf("创建还车照片失败: %w", err)
		}
	}

	for _, d := range req.Damages {
		matchResult, err := s.validationService.CheckDuplicateDamage(req.VehicleID, d.DamageType, d.Location)
		if err != nil {
			return nil, fmt.Errorf("检查重复损伤失败: %w", err)
		}

		damage := &models.DamageDetail{
			ArbitrationID: arbitrationID,
			DamageType:    d.DamageType,
			Location:      d.Location,
			Severity:      d.Severity,
			Description:   d.Description,
			IsNew:         !matchResult.IsDuplicate,
			DeductAmount:  d.DeductAmount,
			FeeCharged:    false,
		}
		if matchResult.IsDuplicate {
			damage.MatchedDamageID = &matchResult.MatchedDamageID
		}

		damageID, err := database.CreateDamageDetail(damage)
		if err != nil {
			return nil, fmt.Errorf("创建损伤明细失败: %w", err)
		}

		if err := database.UpsertVehicleDamageHistory(
			req.VehicleID, d.DamageType, d.Location, d.Severity, d.Description,
			req.OrderID, req.ReturnTime,
		); err != nil {
			return nil, fmt.Errorf("更新车辆损伤历史失败: %w", err)
		}

		for _, photoURL := range d.PhotoURLs {
			photo := &models.Photo{
				ArbitrationID: arbitrationID,
				PhotoType:     "damage",
				PhotoURL:      photoURL,
				PhotoTime:     req.ReturnTime,
				DamageID:      &damageID,
			}
			if _, err := database.CreatePhoto(photo); err != nil {
				return nil, fmt.Errorf("创建损伤照片失败: %w", err)
			}
		}
	}

	if err := s.logAction(arbitrationID, "create", req.OperatorID, req.OperatorName, "", string(models.StatusCreated), "创建仲裁记录"); err != nil {
		return nil, err
	}

	if err := s.transitionStatus(arbitrationID, models.StatusValidating, req.OperatorID, req.OperatorName, "进入校验阶段"); err != nil {
		return nil, err
	}

	photos, _ := database.GetPhotosByArbitrationID(arbitrationID)
	validationResult := s.validationService.ValidatePhotos(photos, &req.PickupTime, &req.ReturnTime)

	hasDuplicateDamage := false
	for _, d := range req.Damages {
		matchResult, _ := s.validationService.CheckDuplicateDamage(req.VehicleID, d.DamageType, d.Location)
		if matchResult.IsDuplicate {
			hasDuplicateDamage = true
			break
		}
	}

	if len(validationResult.Warnings) > 0 || hasDuplicateDamage {
		if err := s.transitionStatus(arbitrationID, models.StatusBlocked, req.OperatorID, req.OperatorName, "校验发现问题，需要人工审核"); err != nil {
			return nil, err
		}
	} else {
		if err := s.transitionStatus(arbitrationID, models.StatusProcessing, req.OperatorID, req.OperatorName, "校验通过，进入处理阶段"); err != nil {
			return nil, err
		}
	}

	return database.GetArbitrationByID(arbitrationID)
}

func (s *ArbitrationService) BlockArbitration(req *models.BlockRequest) error {
	arbitration, err := database.GetArbitrationByID(req.ArbitrationID)
	if err != nil {
		return fmt.Errorf("查询仲裁记录失败: %w", err)
	}
	if arbitration == nil {
		return fmt.Errorf("仲裁记录不存在")
	}

	validStates := map[models.ArbitrationStatus]bool{
		models.StatusCreated:    true,
		models.StatusValidating: true,
		models.StatusProcessing: true,
	}
	if !validStates[arbitration.Status] {
		return fmt.Errorf("当前状态 %s 不允许拦截", arbitration.Status)
	}

	return s.transitionStatus(req.ArbitrationID, models.StatusBlocked, req.OperatorID, req.OperatorName, req.Reason)
}

func (s *ArbitrationService) ReleaseArbitration(req *models.ReleaseRequest) error {
	arbitration, err := database.GetArbitrationByID(req.ArbitrationID)
	if err != nil {
		return fmt.Errorf("查询仲裁记录失败: %w", err)
	}
	if arbitration == nil {
		return fmt.Errorf("仲裁记录不存在")
	}

	if arbitration.Status != models.StatusBlocked {
		return fmt.Errorf("当前状态 %s 不允许放行", arbitration.Status)
	}

	return s.transitionStatus(req.ArbitrationID, models.StatusProcessing, req.OperatorID, req.OperatorName, req.Reason)
}

func (s *ArbitrationService) SupplementArbitration(req *models.SupplementRequest) error {
	arbitration, err := database.GetArbitrationByID(req.ArbitrationID)
	if err != nil {
		return fmt.Errorf("查询仲裁记录失败: %w", err)
	}
	if arbitration == nil {
		return fmt.Errorf("仲裁记录不存在")
	}

	if arbitration.Status == models.StatusClosed {
		return fmt.Errorf("已结案的仲裁记录不允许补录")
	}

	for _, p := range req.Photos {
		oldPhoto := &models.Photo{
			ArbitrationID: req.ArbitrationID,
			PhotoType:     p.PhotoType,
			PhotoURL:      "",
			PhotoTime:     time.Time{},
		}
		newPhoto := &models.Photo{
			ArbitrationID: req.ArbitrationID,
			PhotoType:     p.PhotoType,
			PhotoURL:      p.PhotoURL,
			PhotoTime:     p.PhotoTime,
		}

		photoID, err := database.CreatePhoto(&models.Photo{
			ArbitrationID: req.ArbitrationID,
			PhotoType:     p.PhotoType,
			PhotoURL:      p.PhotoURL,
			PhotoTime:     p.PhotoTime,
			Remark:        p.Remark,
		})
		if err != nil {
			return fmt.Errorf("补录照片失败: %w", err)
		}

		s.recordDiff(req.ArbitrationID, "photos", photoID, "photo_url", nil, &p.PhotoURL, req.OperatorID)
		_ = oldPhoto
		_ = newPhoto
	}

	for _, d := range req.Damages {
		matchResult, _ := s.validationService.CheckDuplicateDamage(arbitration.VehicleID, d.DamageType, d.Location)

		damage := &models.DamageDetail{
			ArbitrationID: req.ArbitrationID,
			DamageType:    d.DamageType,
			Location:      d.Location,
			Severity:      d.Severity,
			Description:   d.Description,
			IsNew:         !matchResult.IsDuplicate,
			DeductAmount:  d.DeductAmount,
		}
		if matchResult.IsDuplicate {
			damage.MatchedDamageID = &matchResult.MatchedDamageID
		}

		damageID, err := database.CreateDamageDetail(damage)
		if err != nil {
			return fmt.Errorf("补录损伤失败: %w", err)
		}

		s.recordDiff(req.ArbitrationID, "damage_details", damageID, "damage_type", nil, (*string)(&d.DamageType), req.OperatorID)
		s.recordDiff(req.ArbitrationID, "damage_details", damageID, "location", nil, &d.Location, req.OperatorID)

		if err := database.UpsertVehicleDamageHistory(
			arbitration.VehicleID, d.DamageType, d.Location, d.Severity, d.Description,
			arbitration.OrderID, time.Now(),
		); err != nil {
			return fmt.Errorf("更新车辆损伤历史失败: %w", err)
		}
	}

	if err := s.logAction(req.ArbitrationID, "supplement", req.OperatorID, req.OperatorName, string(arbitration.Status), string(arbitration.Status), req.Remark); err != nil {
		return err
	}

	return nil
}

func (s *ArbitrationService) CloseArbitration(req *models.CloseRequest) error {
	arbitration, err := database.GetArbitrationByID(req.ArbitrationID)
	if err != nil {
		return fmt.Errorf("查询仲裁记录失败: %w", err)
	}
	if arbitration == nil {
		return fmt.Errorf("仲裁记录不存在")
	}

	if arbitration.Status == models.StatusClosed {
		return fmt.Errorf("该仲裁记录已结案")
	}

	conclusion := &models.Conclusion{
		ArbitrationID: req.ArbitrationID,
		FinalResult:   req.FinalResult,
		FinalRemark:   req.FinalRemark,
		RefundAmount:  req.RefundAmount,
		HandlerID:     req.HandlerID,
		HandlerName:   req.HandlerName,
		ClosedAt:      time.Now(),
	}
	if _, err := database.CreateConclusion(conclusion); err != nil {
		return fmt.Errorf("创建结论失败: %w", err)
	}

	if err := s.transitionStatus(req.ArbitrationID, models.StatusClosed, req.HandlerID, req.HandlerName, fmt.Sprintf("结案: %s", req.FinalResult)); err != nil {
		return err
	}

	return nil
}

func (s *ArbitrationService) SubmitAppeal(req *models.SubmitAppealRequest) error {
	arbitration, err := database.GetArbitrationByID(req.ArbitrationID)
	if err != nil {
		return fmt.Errorf("查询仲裁记录失败: %w", err)
	}
	if arbitration == nil {
		return fmt.Errorf("仲裁记录不存在")
	}

	existingAppeal, err := database.GetAppealByArbitrationID(req.ArbitrationID)
	if err != nil {
		return fmt.Errorf("查询申诉失败: %w", err)
	}
	if existingAppeal != nil {
		return fmt.Errorf("该仲裁记录已存在申诉")
	}

	appeal := &models.Appeal{
		ArbitrationID: req.ArbitrationID,
		UserID:        req.UserID,
		Content:       req.Content,
		EvidenceURLs:  req.EvidenceURLs,
		SubmittedAt:   time.Now(),
	}
	if _, err := database.CreateAppeal(appeal); err != nil {
		return fmt.Errorf("创建申诉失败: %w", err)
	}

	if err := s.transitionStatus(req.ArbitrationID, models.StatusAppealing, "", "", "用户提交申诉"); err != nil {
		return err
	}

	return nil
}

func (s *ArbitrationService) HandleAppeal(req *models.HandleAppealRequest) error {
	arbitration, err := database.GetArbitrationByID(req.ArbitrationID)
	if err != nil {
		return fmt.Errorf("查询仲裁记录失败: %w", err)
	}
	if arbitration == nil {
		return fmt.Errorf("仲裁记录不存在")
	}

	if arbitration.Status != models.StatusAppealing {
		return fmt.Errorf("当前状态 %s 不允许处理申诉", arbitration.Status)
	}

	appeal, err := database.GetAppealByArbitrationID(req.ArbitrationID)
	if err != nil {
		return fmt.Errorf("查询申诉失败: %w", err)
	}
	if appeal == nil {
		return fmt.Errorf("申诉不存在")
	}

	if err := database.UpdateAppeal(req.ArbitrationID, req.HandlerID, req.HandlerRemark, time.Now()); err != nil {
		return fmt.Errorf("更新申诉失败: %w", err)
	}

	newStatus := models.StatusProcessing
	if req.Approve {
		newStatus = models.StatusProcessing
	}

	if err := s.transitionStatus(req.ArbitrationID, newStatus, req.HandlerID, req.HandlerName, fmt.Sprintf("申诉处理完成: %s", req.HandlerRemark)); err != nil {
		return err
	}

	return nil
}

func (s *ArbitrationService) GetArbitrationDetail(id int64) (*models.ArbitrationDetailResponse, error) {
	arbitration, err := database.GetArbitrationByID(id)
	if err != nil {
		return nil, err
	}
	if arbitration == nil {
		return nil, fmt.Errorf("仲裁记录不存在")
	}

	damages, err := database.GetDamagesByArbitrationID(id)
	if err != nil {
		return nil, err
	}

	photos, err := database.GetPhotosByArbitrationID(id)
	if err != nil {
		return nil, err
	}

	appeal, err := database.GetAppealByArbitrationID(id)
	if err != nil {
		return nil, err
	}

	logs, err := database.GetLogsByArbitrationID(id)
	if err != nil {
		return nil, err
	}

	conclusion, err := database.GetConclusionByArbitrationID(id)
	if err != nil {
		return nil, err
	}

	return &models.ArbitrationDetailResponse{
		Arbitration: arbitration,
		Damages:     damages,
		Photos:      photos,
		Appeal:      appeal,
		Logs:        logs,
		Conclusion:  conclusion,
	}, nil
}

func (s *ArbitrationService) ListArbitrations(query *models.QueryRequest) (*models.ListResponse, error) {
	list, total, err := database.QueryArbitrations(query)
	if err != nil {
		return nil, err
	}

	return &models.ListResponse{
		Total:    total,
		List:     list,
		Page:     query.Page,
		PageSize: query.PageSize,
	}, nil
}

func (s *ArbitrationService) transitionStatus(arbitrationID int64, newStatus models.ArbitrationStatus, operatorID, operatorName, remark string) error {
	arbitration, err := database.GetArbitrationByID(arbitrationID)
	if err != nil {
		return err
	}

	oldStatus := arbitration.Status

	if err := database.UpdateArbitrationStatus(arbitrationID, newStatus, operatorID, operatorName); err != nil {
		return err
	}

	return s.logAction(arbitrationID, "status_change", operatorID, operatorName, string(oldStatus), string(newStatus), remark)
}

func (s *ArbitrationService) logAction(arbitrationID int64, action, operatorID, operatorName, oldStatus, newStatus, remark string) error {
	log := &models.ProcessingLog{
		ArbitrationID: arbitrationID,
		Action:        action,
		OperatorID:    operatorID,
		OperatorName:  operatorName,
		OldStatus:     oldStatus,
		NewStatus:     newStatus,
		Remark:        remark,
	}
	_, err := database.CreateProcessingLog(log)
	return err
}

func (s *ArbitrationService) recordDiff(arbitrationID int64, tableName string, recordID int64, fieldName string, oldValue, newValue *string, operatorID string) error {
	diff := &models.ChangeDiff{
		ArbitrationID: arbitrationID,
		TableName:     tableName,
		RecordID:      recordID,
		FieldName:     fieldName,
		OldValue:      oldValue,
		NewValue:      newValue,
		OperatorID:    operatorID,
	}
	_, err := database.CreateChangeDiff(diff)
	return err
}

func (s *ArbitrationService) RecordDamageFee(arbitrationID, damageID int64) error {
	damages, err := database.GetDamagesByArbitrationID(arbitrationID)
	if err != nil {
		return err
	}

	for _, d := range damages {
		if d.ID == damageID {
			oldValue := strconv.FormatBool(d.FeeCharged)
			newValue := "true"
			s.recordDiff(arbitrationID, "damage_details", damageID, "fee_charged", &oldValue, &newValue, "system")
			break
		}
	}

	return nil
}
