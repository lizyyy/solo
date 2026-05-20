package services

import (
	"qa-tracking-system/config"
	"qa-tracking-system/models"
	"qa-tracking-system/utils"
	"time"
)

func CreateException(eventType models.ExceptionType, batchID *uint, sampleID *uint, chamberID *string, sampleNodeID *string, severity, description, reason, handler string, resolution *string) (*models.ExceptionEvent, error) {
	exception := &models.ExceptionEvent{
		ExceptionID:  utils.GenerateID(),
		BatchID:      batchID,
		SampleID:     sampleID,
		ChamberID:    chamberID,
		SampleNodeID: sampleNodeID,
		EventType:    eventType,
		Severity:     severity,
		Description:  description,
		Reason:       reason,
		Handler:      handler,
		HandledAt:    time.Now(),
		Resolution:   resolution,
	}

	if err := config.DB.Create(exception).Error; err != nil {
		return nil, err
	}

	return exception, nil
}

func ListExceptions(eventType, batchID string, offset, limit int) ([]models.ExceptionEvent, int64, error) {
	var exceptions []models.ExceptionEvent
	var total int64

	query := config.DB.Model(&models.ExceptionEvent{})

	if eventType != "" {
		query = query.Where("event_type = ?", eventType)
	}
	if batchID != "" {
		query = query.Where("batch_id = ?", batchID)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := query.Offset(offset).Limit(limit).
		Order("created_at DESC").
		Find(&exceptions).Error; err != nil {
		return nil, 0, err
	}

	return exceptions, total, nil
}

func QueryByBatchNo(batchNo string) (*models.Batch, error) {
	var batch models.Batch
	err := config.DB.Where("batch_no = ?", batchNo).
		Preload("Samples").
		Preload("Samples.SampleNodes").
		Preload("Samples.ChamberRecords").
		Preload("TestProtocols").
		Preload("TrackingLogs").
		First(&batch).Error
	if err != nil {
		return nil, err
	}
	return &batch, nil
}

func QueryByChamber(chamberID string, startTime, endTime time.Time) ([]models.ChamberRecord, error) {
	var records []models.ChamberRecord
	query := config.DB.Where("chamber_id = ?", chamberID)
	
	if !startTime.IsZero() && !endTime.IsZero() {
		query = query.Where("timestamp BETWEEN ? AND ?", startTime, endTime)
	}
	
	err := query.Order("timestamp DESC").Find(&records).Error
	return records, err
}

func QueryBySampleNode(nodeID string) (*models.SampleNode, error) {
	var node models.SampleNode
	err := config.DB.Where("node_id = ?", nodeID).
		Preload("Children").
		First(&node).Error
	if err != nil {
		return nil, err
	}
	return &node, nil
}

func GetSampleNodeTrace(nodeID string) ([]map[string]interface{}, error) {
	var trace []map[string]interface{}
	var currentNode models.SampleNode

	err := config.DB.Where("node_id = ?", nodeID).First(&currentNode).Error
	if err != nil {
		return nil, err
	}

	for {
		trace = append([]map[string]interface{}{{
			"node_id":   currentNode.NodeID,
			"node_name": currentNode.NodeName,
			"node_type": currentNode.NodeType,
			"operator":  currentNode.Operator,
			"status":    currentNode.Status,
			"time":      currentNode.CreatedAt,
		}}, trace...)

		if currentNode.ParentNodeID == nil || *currentNode.ParentNodeID == "" {
			break
		}

		var parentNode models.SampleNode
		err := config.DB.Where("node_id = ?", *currentNode.ParentNodeID).First(&parentNode).Error
		if err != nil {
			break
		}
		currentNode = parentNode
	}

	return trace, nil
}

func ListSampleNodes(sampleID uint, offset, limit int) ([]models.SampleNode, int64, error) {
	var nodes []models.SampleNode
	var total int64

	query := config.DB.Model(&models.SampleNode{})
	if sampleID > 0 {
		query = query.Where("sample_id = ?", sampleID)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := query.Offset(offset).Limit(limit).
		Order("created_at DESC").
		Preload("Children").
		Find(&nodes).Error; err != nil {
		return nil, 0, err
	}

	return nodes, total, nil
}

func CreateSampleNode(sampleID uint, nodeID, parentNodeID, nodeName, nodeType, status, operator string, samplingWindow, actualTime *time.Time, remark *string) (*models.SampleNode, error) {
	node := &models.SampleNode{
		SampleID:      sampleID,
		NodeID:        nodeID,
		ParentNodeID:  &parentNodeID,
		NodeName:      nodeName,
		NodeType:      nodeType,
		Status:        status,
		Operator:      operator,
		SamplingWindow: samplingWindow,
		ActualTime:    actualTime,
		Remark:        remark,
	}

	if parentNodeID == "" {
		node.ParentNodeID = nil
	}

	if err := config.DB.Create(node).Error; err != nil {
		return nil, err
	}

	return node, nil
}
