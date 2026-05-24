package service

import (
	"city-salt-api/internal/database"
	"city-salt-api/internal/models"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
)

type DispatchRequest struct {
	BatchNo        string                   `json:"batch_no" binding:"required"`
	WeatherLevelID uint                     `json:"weather_level_id"`
	CreatedBy      string                   `json:"created_by"`
	Items          []DispatchItemRequest    `json:"items" binding:"required"`
}

type DispatchItemRequest struct {
	SaltDepotID   uint    `json:"salt_depot_id" binding:"required"`
	VehicleID     uint    `json:"vehicle_id" binding:"required"`
	RoadSectionID uint    `json:"road_section_id" binding:"required"`
	SaltAmount    float64 `json:"salt_amount" binding:"required"`
}

type DispatchResponse struct {
	Success      bool                   `json:"success"`
	Message      string                 `json:"message"`
	BatchNo      string                 `json:"batch_no"`
	IsDuplicate  bool                   `json:"is_duplicate"`
	ProcessedBy  string                 `json:"processed_by,omitempty"`
	ProcessedAt  *time.Time             `json:"processed_at,omitempty"`
	Items        []DispatchItemResponse `json:"items,omitempty"`
}

type DispatchItemResponse struct {
	ID           uint   `json:"id"`
	VehicleID    uint   `json:"vehicle_id"`
	RoadSectionID uint  `json:"road_section_id"`
	Status       string `json:"status"`
	HasAnomaly   bool   `json:"has_anomaly"`
	AnomalyType  string `json:"anomaly_type,omitempty"`
	AnomalyDesc  string `json:"anomaly_desc,omitempty"`
}

type AnomalyInfo struct {
	Type        string `json:"type"`
	Description string `json:"description"`
}

func CreateDispatchBatch(req DispatchRequest, ip string) (*DispatchResponse, error) {
	existingBatch, err := database.GetBatchByNo(req.BatchNo)
	if err == nil {
		items, _ := database.GetBatchItems(existingBatch.ID)
		return &DispatchResponse{
			Success:     true,
			Message:     "批次已存在，返回原处理结论",
			BatchNo:     req.BatchNo,
			IsDuplicate: true,
			ProcessedBy: existingBatch.CreatedBy,
			ProcessedAt: &existingBatch.CreatedAt,
			Items:       convertToItemResponses(items),
		}, nil
	}

	var anomalies []AnomalyInfo
	var itemResponses []DispatchItemResponse

	for _, item := range req.Items {
		itemAnomalies := validateDispatchItem(item)
		anomalies = append(anomalies, itemAnomalies...)
	}

	totalSalt := 0.0
	for _, item := range req.Items {
		totalSalt += item.SaltAmount
	}

	batch := models.DispatchBatch{
		BatchNo:         req.BatchNo,
		WeatherLevelID:  req.WeatherLevelID,
		Status:          "created",
		TotalSaltAmount: totalSalt,
		CreatedBy:       req.CreatedBy,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	err = database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&batch).Error; err != nil {
			return err
		}

		for _, itemReq := range req.Items {
			itemAnomalies := validateDispatchItem(itemReq)
			hasAnomaly := len(itemAnomalies) > 0
			anomalyType := ""
			anomalyDesc := ""
			if hasAnomaly {
				anomalyType = itemAnomalies[0].Type
				for _, a := range itemAnomalies {
					anomalyDesc += a.Description + "; "
				}
			}

			item := models.DispatchItem{
				DispatchBatchID: batch.ID,
				SaltDepotID:     itemReq.SaltDepotID,
				VehicleID:       itemReq.VehicleID,
				RoadSectionID:   itemReq.RoadSectionID,
				SaltAmount:      itemReq.SaltAmount,
				Status:          "pending",
				HasAnomaly:      hasAnomaly,
				AnomalyType:     anomalyType,
				AnomalyDesc:     anomalyDesc,
				CreatedAt:       time.Now(),
				UpdatedAt:       time.Now(),
			}
			if err := tx.Create(&item).Error; err != nil {
				return err
			}

			itemResponses = append(itemResponses, DispatchItemResponse{
				ID:            item.ID,
				VehicleID:     item.VehicleID,
				RoadSectionID: item.RoadSectionID,
				Status:        item.Status,
				HasAnomaly:    item.HasAnomaly,
				AnomalyType:   item.AnomalyType,
				AnomalyDesc:   item.AnomalyDesc,
			})

			if err := database.AddRouteStatusLog(item.ID, "pending", "盐库", "任务创建", req.CreatedBy); err != nil {
				return err
			}
		}

		batchData, _ := json.Marshal(batch)
		_ = database.LogOperation(req.CreatedBy, "create_batch", "dispatch", "batch", batch.ID, "", string(batchData), ip)

		return nil
	})

	if err != nil {
		return nil, err
	}

	msg := "批次创建成功"
	if len(anomalies) > 0 {
		msg = fmt.Sprintf("批次创建成功，检测到 %d 个异常", len(anomalies))
	}

	return &DispatchResponse{
		Success:     true,
		Message:     msg,
		BatchNo:     req.BatchNo,
		IsDuplicate: false,
		Items:       itemResponses,
	}, nil
}

func validateDispatchItem(item DispatchItemRequest) []AnomalyInfo {
	var anomalies []AnomalyInfo

	closed, closure, err := database.IsRoadClosed(item.RoadSectionID)
	if err == nil && closed {
		anomalies = append(anomalies, AnomalyInfo{
			Type:        "road_closure",
			Description: fmt.Sprintf("路段已封路: %s，原因: %s", closure.CreatedAt.Format("2006-01-02"), closure.Reason),
		})
	}

	active, activeItem, err := database.CheckVehicleActiveDispatch(item.VehicleID)
	if err == nil && active {
		anomalies = append(anomalies, AnomalyInfo{
			Type:        "vehicle_busy",
			Description: fmt.Sprintf("车辆有进行中的任务: 任务ID %d", activeItem.ID),
		})
	}

	var depot models.SaltDepot
	if err := database.DB.First(&depot, item.SaltDepotID).Error; err == nil {
		if depot.CurrentStock < item.SaltAmount {
			anomalies = append(anomalies, AnomalyInfo{
				Type:        "low_stock",
				Description: fmt.Sprintf("盐库库存不足: 当前 %.2f，需要 %.2f", depot.CurrentStock, item.SaltAmount),
			})
		}
		if depot.CurrentStock <= depot.LowThreshold {
			anomalies = append(anomalies, AnomalyInfo{
				Type:        "stock_warning",
				Description: fmt.Sprintf("盐库库存已低于警戒线: %.2f <= %.2f", depot.CurrentStock, depot.LowThreshold),
			})
		}
	}

	var vehicle models.Vehicle
	if err := database.DB.First(&vehicle, item.VehicleID).Error; err == nil {
		if vehicle.Capacity < item.SaltAmount {
			anomalies = append(anomalies, AnomalyInfo{
				Type:        "vehicle_capacity",
				Description: fmt.Sprintf("车辆载重不足: 容量 %.2f，需要 %.2f", vehicle.Capacity, item.SaltAmount),
			})
		}
	}

	return anomalies
}

func StartDispatch(dispatchItemID uint, operator, ip string) error {
	var item models.DispatchItem
	if err := database.DB.First(&item, dispatchItemID).Error; err != nil {
		return err
	}

	if item.Status != "pending" {
		return fmt.Errorf("当前状态 %s 无法发车", item.Status)
	}

	closed, _, err := database.IsRoadClosed(item.RoadSectionID)
	if err == nil && closed {
		return errors.New("目标路段已封路，无法发车")
	}

	return database.DB.Transaction(func(tx *gorm.DB) error {
		if err := database.DeductStock(item.SaltDepotID, item.SaltAmount, operator, "dispatch_item", item.ID); err != nil {
			return err
		}

		now := time.Now()
		item.Status = "dispatched"
		item.DispatchedAt = &now
		item.UpdatedAt = now

		if err := tx.Save(&item).Error; err != nil {
			return err
		}

		var vehicle models.Vehicle
		if err := tx.First(&vehicle, item.VehicleID).Error; err == nil {
			vehicle.Status = "busy"
			tx.Save(&vehicle)
		}

		if err := database.AddRouteStatusLog(item.ID, "dispatched", "盐库出发", "已出库发车", operator); err != nil {
			return err
		}

		beforeData, _ := json.Marshal(map[string]string{"status": "pending"})
		afterData, _ := json.Marshal(map[string]string{"status": "dispatched"})
		_ = database.LogOperation(operator, "start_dispatch", "dispatch_item", "dispatch_item", item.ID, string(beforeData), string(afterData), ip)

		return nil
	})
}

func UpdateRouteStatus(dispatchItemID uint, status, location, remark, operator, ip string) error {
	validStatuses := map[string]bool{
		"pending":    true,
		"dispatched": true,
		"enroute":    true,
		"arrived":    true,
		"delivering": true,
		"completed":  true,
		"cancelled":  true,
	}
	if !validStatuses[status] {
		return fmt.Errorf("无效状态: %s", status)
	}

	var item models.DispatchItem
	if err := database.DB.First(&item, dispatchItemID).Error; err != nil {
		return err
	}

	return database.DB.Transaction(func(tx *gorm.DB) error {
		oldStatus := item.Status
		item.Status = status
		item.UpdatedAt = time.Now()

		if status == "arrived" {
			now := time.Now()
			item.ArrivedAt = &now
		}

		if err := tx.Save(&item).Error; err != nil {
			return err
		}

		if err := database.AddRouteStatusLog(item.ID, status, location, remark, operator); err != nil {
			return err
		}

		beforeData, _ := json.Marshal(map[string]string{"status": oldStatus})
		afterData, _ := json.Marshal(map[string]string{"status": status})
		_ = database.LogOperation(operator, "update_status", "dispatch_item", "dispatch_item", item.ID, string(beforeData), string(afterData), ip)

		return nil
	})
}

func ConfirmReceipt(dispatchItemID uint, receivedAmount float64, receiverName, receiverSign, remark, operator, ip string) (*models.Receipt, error) {
	var item models.DispatchItem
	if err := database.DB.First(&item, dispatchItemID).Error; err != nil {
		return nil, err
	}

	if item.Status != "arrived" && item.Status != "delivering" {
		return nil, fmt.Errorf("当前状态 %s 无法签收", item.Status)
	}

	var existingReceipt models.Receipt
	if err := database.DB.Where("dispatch_item_id = ?", dispatchItemID).First(&existingReceipt).Error; err == nil {
		return &existingReceipt, nil
	}

	receiptNo := fmt.Sprintf("RCP-%s-%d", time.Now().Format("20060102"), dispatchItemID)

	receipt := models.Receipt{
		DispatchItemID: dispatchItemID,
		ReceiptNo:      receiptNo,
		ReceivedAmount: receivedAmount,
		ReceiverName:   receiverName,
		ReceiverSign:   receiverSign,
		Remark:         remark,
		CreatedAt:      time.Now(),
	}

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&receipt).Error; err != nil {
			return err
		}

		now := time.Now()
		item.Status = "completed"
		item.ReceivedBy = receiverName
		item.ReceiptTime = &now
		item.UpdatedAt = now
		if err := tx.Save(&item).Error; err != nil {
			return err
		}

		var vehicle models.Vehicle
		if err := tx.First(&vehicle, item.VehicleID).Error; err == nil {
			vehicle.Status = "idle"
			tx.Save(&vehicle)
		}

		if err := database.AddRouteStatusLog(item.ID, "completed", "现场", fmt.Sprintf("已签收，签收人: %s", receiverName), operator); err != nil {
			return err
		}

		checkBatchCompletion(item.DispatchBatchID, tx)

		receiptData, _ := json.Marshal(receipt)
		_ = database.LogOperation(operator, "confirm_receipt", "receipt", "receipt", receipt.ID, "", string(receiptData), ip)

		return nil
	})

	if err != nil {
		return nil, err
	}

	return &receipt, nil
}

func checkBatchCompletion(batchID uint, tx *gorm.DB) {
	var items []models.DispatchItem
	tx.Where("dispatch_batch_id = ?", batchID).Find(&items)

	allCompleted := true
	for _, item := range items {
		if item.Status != "completed" && item.Status != "cancelled" {
			allCompleted = false
			break
		}
	}

	if allCompleted {
		now := time.Now()
		tx.Model(&models.DispatchBatch{}).Where("id = ?", batchID).Updates(map[string]interface{}{
			"status":       "completed",
			"completed_at": now,
			"updated_at":   now,
		})
	}
}

func GetAnomalies(batchID uint) ([]models.DispatchItem, error) {
	var items []models.DispatchItem
	err := database.DB.Preload("Vehicle").Preload("SaltDepot").Preload("RoadSection").
		Where("dispatch_batch_id = ? AND has_anomaly = ?", batchID, true).
		Find(&items).Error
	return items, err
}

func GetAllAnomalies() ([]models.DispatchItem, error) {
	var items []models.DispatchItem
	err := database.DB.Preload("Vehicle").Preload("SaltDepot").Preload("RoadSection").
		Where("has_anomaly = ? AND status NOT IN ('completed', 'cancelled')", true).
		Find(&items).Error
	return items, err
}

func ResolveAnomaly(dispatchItemID uint, resolution, operator, ip string) error {
	var item models.DispatchItem
	if err := database.DB.First(&item, dispatchItemID).Error; err != nil {
		return err
	}

	beforeData, _ := json.Marshal(map[string]interface{}{"has_anomaly": item.HasAnomaly, "anomaly_desc": item.AnomalyDesc})

	item.HasAnomaly = false
	item.AnomalyDesc = item.AnomalyDesc + fmt.Sprintf(" | 已处理: %s", resolution)
	item.UpdatedAt = time.Now()

	if err := database.DB.Save(&item).Error; err != nil {
		return err
	}

	afterData, _ := json.Marshal(map[string]interface{}{"has_anomaly": false, "anomaly_desc": item.AnomalyDesc})
	_ = database.LogOperation(operator, "resolve_anomaly", "dispatch_item", "dispatch_item", item.ID, string(beforeData), string(afterData), ip)

	return nil
}

func convertToItemResponses(items []models.DispatchItem) []DispatchItemResponse {
	var responses []DispatchItemResponse
	for _, item := range items {
		responses = append(responses, DispatchItemResponse{
			ID:            item.ID,
			VehicleID:     item.VehicleID,
			RoadSectionID: item.RoadSectionID,
			Status:        item.Status,
			HasAnomaly:    item.HasAnomaly,
			AnomalyType:   item.AnomalyType,
			AnomalyDesc:   item.AnomalyDesc,
		})
	}
	return responses
}
