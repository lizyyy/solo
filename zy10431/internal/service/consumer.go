package service

import (
	"consumer-ownership-api/internal/model"
	"consumer-ownership-api/pkg/database"
	"encoding/csv"
	"fmt"
	"os"
	"strings"
	"time"
)

type ConsumerService struct{}

func NewConsumerService() *ConsumerService {
	return &ConsumerService{}
}

func (s *ConsumerService) RegisterConsumer(req *model.RegisterConsumerRequest) (*model.Consumer, error) {
	existing, err := database.FindConsumerByQueueAndGroup(req.QueueName, req.ConsumerGroup)
	if err != nil {
		return nil, err
	}

	if existing != nil {
		if existing.Status == model.StatusActive &&
			existing.ProcessScope == req.ProcessScope &&
			existing.Owner == req.Owner {
			return existing, nil
		}
	}

	conflicts, err := database.FindConsumersByScope(req.QueueName, req.ProcessScope)
	if err != nil {
		return nil, err
	}

	if len(conflicts) > 0 {
		var conflictOwners []string
		for _, c := range conflicts {
			if c.ConsumerGroup != req.ConsumerGroup {
				conflictOwners = append(conflictOwners, fmt.Sprintf("%s(%s)", c.Owner, c.ConsumerGroup))
			}
		}
		if len(conflictOwners) > 0 {
			return nil, fmt.Errorf("处理范围冲突: %s 已由 %s 负责", req.ProcessScope, strings.Join(conflictOwners, ", "))
		}
	}

	consumer := &model.Consumer{
		QueueName:     req.QueueName,
		ConsumerGroup: req.ConsumerGroup,
		ProcessScope:  req.ProcessScope,
		Owner:         req.Owner,
		OwnerEmail:    req.OwnerEmail,
		Status:        model.StatusActive,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	if existing != nil {
		existing.ProcessScope = req.ProcessScope
		existing.Owner = req.Owner
		existing.OwnerEmail = req.OwnerEmail
		existing.Status = model.StatusActive
		existing.UpdatedAt = time.Now()
		err = database.UpdateConsumer(existing)
		return existing, err
	}

	err = database.CreateConsumer(consumer)
	return consumer, err
}

func (s *ConsumerService) TransferOwner(req *model.TransferOwnerRequest) error {
	consumer, err := database.GetConsumerByID(req.ConsumerID)
	if err != nil {
		return err
	}
	if consumer == nil {
		return fmt.Errorf("consumer not found")
	}

	transferRecord := &model.TransferRecord{
		ConsumerID:     req.ConsumerID,
		FromOwner:      consumer.Owner,
		FromEmail:      consumer.OwnerEmail,
		ToOwner:        req.ToOwner,
		ToEmail:        req.ToEmail,
		TransferReason: req.TransferReason,
		TransferredAt:  time.Now(),
		CreatedAt:      time.Now(),
	}

	consumer.Owner = req.ToOwner
	consumer.OwnerEmail = req.ToEmail
	consumer.UpdatedAt = time.Now()

	err = database.CreateTransferRecord(transferRecord)
	if err != nil {
		return err
	}

	return database.UpdateConsumer(consumer)
}

func (s *ConsumerService) UpdateStatus(req *model.UpdateStatusRequest) error {
	consumer, err := database.GetConsumerByID(req.ConsumerID)
	if err != nil {
		return err
	}
	if consumer == nil {
		return fmt.Errorf("consumer not found")
	}

	consumer.Status = req.Status
	consumer.UpdatedAt = time.Now()
	return database.UpdateConsumer(consumer)
}

func (s *ConsumerService) ManualFix(req *model.ManualFixRequest) error {
	consumer, err := database.GetConsumerByID(req.ConsumerID)
	if err != nil {
		return err
	}
	if consumer == nil {
		return fmt.Errorf("consumer not found")
	}

	if req.QueueName != "" {
		consumer.QueueName = req.QueueName
	}
	if req.ConsumerGroup != "" {
		consumer.ConsumerGroup = req.ConsumerGroup
	}
	if req.ProcessScope != "" {
		consumer.ProcessScope = req.ProcessScope
	}
	if req.Owner != "" {
		consumer.Owner = req.Owner
	}
	if req.OwnerEmail != "" {
		consumer.OwnerEmail = req.OwnerEmail
	}
	if req.Status != "" {
		consumer.Status = req.Status
	}
	consumer.UpdatedAt = time.Now()

	return database.UpdateConsumer(consumer)
}

func (s *ConsumerService) QueryConsumers(req *model.QueryConsumerRequest) ([]model.Consumer, int64, error) {
	return database.QueryConsumers(req)
}

func (s *ConsumerService) GetConsumerByID(id uint) (*model.Consumer, error) {
	return database.GetConsumerByID(id)
}

func (s *ConsumerService) GetTransferRecords(consumerID uint) ([]model.TransferRecord, error) {
	return database.GetTransferRecordsByConsumerID(consumerID)
}

func (s *ConsumerService) GenerateReport(req *model.GenerateReportRequest) (*model.OwnershipReport, error) {
	queryReq := &model.QueryConsumerRequest{
		QueueName: req.QueueName,
		Page:      1,
		PageSize:  10000,
	}

	consumers, _, err := database.QueryConsumers(queryReq)
	if err != nil {
		return nil, err
	}

	ownerMap := make(map[string]bool)
	activeCount := 0
	for _, c := range consumers {
		ownerMap[c.Owner] = true
		if c.Status == model.StatusActive {
			activeCount++
		}
	}

	report := &model.OwnershipReport{
		ReportDate:      time.Now(),
		QueueName:       req.QueueName,
		TotalConsumers:  len(consumers),
		ActiveConsumers: activeCount,
		OwnerCount:      len(ownerMap),
		ConflictCount:   0,
		GeneratedAt:     time.Now(),
	}

	err = database.CreateReport(report)
	return report, err
}

func (s *ConsumerService) GetReports(queueName string, limit int) ([]model.OwnershipReport, error) {
	return database.GetReports(queueName, limit)
}

func (s *ConsumerService) ExportToCSV(filePath string) error {
	consumers, err := database.GetAllConsumers()
	if err != nil {
		return err
	}

	file, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	header := []string{"ID", "QueueName", "ConsumerGroup", "ProcessScope", "Owner", "OwnerEmail", "Status", "CreatedAt", "UpdatedAt"}
	if err := writer.Write(header); err != nil {
		return err
	}

	for _, c := range consumers {
		row := []string{
			fmt.Sprintf("%d", c.ID),
			c.QueueName,
			c.ConsumerGroup,
			c.ProcessScope,
			c.Owner,
			c.OwnerEmail,
			string(c.Status),
			c.CreatedAt.Format(time.RFC3339),
			c.UpdatedAt.Format(time.RFC3339),
		}
		if err := writer.Write(row); err != nil {
			return err
		}
	}

	return nil
}

func (s *ConsumerService) GetErrorRecords(handled *bool, limit int) ([]model.ErrorRecord, error) {
	return database.GetErrorRecords(handled, limit)
}

func (s *ConsumerService) ResolveErrorRecord(req *model.ErrorRecordResolveRequest) error {
	return database.ResolveErrorRecord(req.ErrorRecordID, req.Conclusion, req.Handled)
}
