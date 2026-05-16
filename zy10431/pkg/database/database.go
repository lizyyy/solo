package database

import (
	"consumer-ownership-api/internal/model"
	"errors"
	"os"
	"path/filepath"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func Init() error {
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "data/consumer_ownership.db"
	}

	dir := filepath.Dir(dbPath)
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return err
		}
	}

	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		return err
	}

	err = db.AutoMigrate(
		&model.Consumer{},
		&model.TransferRecord{},
		&model.OwnershipReport{},
		&model.ErrorRecord{},
	)
	if err != nil {
		return err
	}

	DB = db
	return nil
}

func GetDB() *gorm.DB {
	return DB
}

func RecordError(path, method, rawInput, errorMsg, conclusion string) error {
	errRecord := &model.ErrorRecord{
		RequestPath:   path,
		RequestMethod: method,
		RawInput:      rawInput,
		ErrorMsg:      errorMsg,
		Conclusion:    conclusion,
		CreatedAt:     time.Now(),
	}
	return DB.Create(errRecord).Error
}

func FindConsumerByQueueAndGroup(queueName, consumerGroup string) (*model.Consumer, error) {
	var consumer model.Consumer
	err := DB.Where("queue_name = ? AND consumer_group = ?", queueName, consumerGroup).
		First(&consumer).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &consumer, err
}

func FindConsumersByScope(queueName, processScope string) ([]model.Consumer, error) {
	var consumers []model.Consumer
	err := DB.Where("queue_name = ? AND process_scope LIKE ? AND status = ?",
		queueName, "%"+processScope+"%", model.StatusActive).
		Find(&consumers).Error
	return consumers, err
}

func CreateConsumer(consumer *model.Consumer) error {
	return DB.Create(consumer).Error
}

func GetConsumerByID(id uint) (*model.Consumer, error) {
	var consumer model.Consumer
	err := DB.First(&consumer, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &consumer, err
}

func UpdateConsumer(consumer *model.Consumer) error {
	return DB.Save(consumer).Error
}

func QueryConsumers(req *model.QueryConsumerRequest) ([]model.Consumer, int64, error) {
	var consumers []model.Consumer
	var total int64

	query := DB.Model(&model.Consumer{})

	if req.QueueName != "" {
		query = query.Where("queue_name = ?", req.QueueName)
	}
	if req.ConsumerGroup != "" {
		query = query.Where("consumer_group = ?", req.ConsumerGroup)
	}
	if req.Owner != "" {
		query = query.Where("owner = ?", req.Owner)
	}
	if req.Status != "" {
		query = query.Where("status = ?", req.Status)
	}

	query.Count(&total)

	offset := (req.Page - 1) * req.PageSize
	err := query.Offset(offset).Limit(req.PageSize).Find(&consumers).Error
	return consumers, total, err
}

func CreateTransferRecord(record *model.TransferRecord) error {
	return DB.Create(record).Error
}

func GetTransferRecordsByConsumerID(consumerID uint) ([]model.TransferRecord, error) {
	var records []model.TransferRecord
	err := DB.Where("consumer_id = ?", consumerID).Order("transferred_at DESC").Find(&records).Error
	return records, err
}

func CreateReport(report *model.OwnershipReport) error {
	return DB.Create(report).Error
}

func GetReports(queueName string, limit int) ([]model.OwnershipReport, error) {
	var reports []model.OwnershipReport
	query := DB.Model(&model.OwnershipReport{})
	if queueName != "" {
		query = query.Where("queue_name = ?", queueName)
	}
	err := query.Order("generated_at DESC").Limit(limit).Find(&reports).Error
	return reports, err
}

func GetErrorRecords(handled *bool, limit int) ([]model.ErrorRecord, error) {
	var records []model.ErrorRecord
	query := DB.Model(&model.ErrorRecord{})
	if handled != nil {
		query = query.Where("handled = ?", *handled)
	}
	err := query.Order("created_at DESC").Limit(limit).Find(&records).Error
	return records, err
}

func ResolveErrorRecord(id uint, conclusion string, handled bool) error {
	return DB.Model(&model.ErrorRecord{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"conclusion": conclusion,
			"handled":    handled,
		}).Error
}

func GetAllConsumers() ([]model.Consumer, error) {
	var consumers []model.Consumer
	err := DB.Find(&consumers).Error
	return consumers, err
}
