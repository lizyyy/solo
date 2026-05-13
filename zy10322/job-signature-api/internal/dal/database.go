package dal

import (
	"job-signature-api/internal/model"
	"log"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDB() error {
	var err error
	DB, err = gorm.Open(sqlite.Open("job_signature.db"), &gorm.Config{})
	if err != nil {
		return err
	}

	err = DB.AutoMigrate(
		&model.JobBatch{},
		&model.ResultFile{},
		&model.SignatureDigest{},
		&model.Consumer{},
		&model.VerifyRecord{},
		&model.ExpireStrategy{},
	)
	if err != nil {
		return err
	}

	log.Println("Database initialized successfully")
	return nil
}

func CreateJobBatch(batch *model.JobBatch) error {
	return DB.Create(batch).Error
}

func GetJobBatchByID(id string) (*model.JobBatch, error) {
	var batch model.JobBatch
	err := DB.Where("id = ?", id).First(&batch).Error
	if err != nil {
		return nil, err
	}
	return &batch, nil
}

func GetJobBatchByBatchNo(batchNo string) (*model.JobBatch, error) {
	var batch model.JobBatch
	err := DB.Where("batch_no = ?", batchNo).First(&batch).Error
	if err != nil {
		return nil, err
	}
	return &batch, nil
}

func UpdateJobBatchStatus(id string, status model.JobStatus) error {
	return DB.Model(&model.JobBatch{}).Where("id = ?", id).Update("status", status).Error
}

func CreateResultFiles(files []model.ResultFile) error {
	if len(files) == 0 {
		return nil
	}
	return DB.Create(&files).Error
}

func GetResultFilesByBatchID(batchID string) ([]model.ResultFile, error) {
	var files []model.ResultFile
	err := DB.Where("batch_id = ?", batchID).Find(&files).Error
	return files, err
}

func CreateSignatureDigest(digest *model.SignatureDigest) error {
	return DB.Create(digest).Error
}

func GetSignatureDigestByBatchID(batchID string) (*model.SignatureDigest, error) {
	var digest model.SignatureDigest
	err := DB.Where("batch_id = ?", batchID).First(&digest).Error
	if err != nil {
		return nil, err
	}
	return &digest, nil
}

func CreateConsumer(consumer *model.Consumer) error {
	return DB.Create(consumer).Error
}

func GetConsumerByID(id string) (*model.Consumer, error) {
	var consumer model.Consumer
	err := DB.Where("id = ?", id).First(&consumer).Error
	if err != nil {
		return nil, err
	}
	return &consumer, nil
}

func CreateVerifyRecord(record *model.VerifyRecord) error {
	return DB.Create(record).Error
}

func GetVerifyRecordsByBatchID(batchID string) ([]model.VerifyRecord, error) {
	var records []model.VerifyRecord
	err := DB.Where("batch_id = ?", batchID).Order("verify_at desc").Find(&records).Error
	return records, err
}

func CreateExpireStrategy(strategy *model.ExpireStrategy) error {
	return DB.Create(strategy).Error
}

func GetExpireStrategyByBatchID(batchID string) (*model.ExpireStrategy, error) {
	var strategy model.ExpireStrategy
	err := DB.Where("batch_id = ?", batchID).First(&strategy).Error
	if err != nil {
		return nil, err
	}
	return &strategy, nil
}

func IncrementVerifyCount(batchID string) error {
	return DB.Model(&model.ExpireStrategy{}).Where("batch_id = ?", batchID).
		UpdateColumn("current_verify_count", gorm.Expr("current_verify_count + 1")).Error
}

func ListJobBatches(status model.JobStatus, limit, offset int) ([]model.JobBatch, error) {
	var batches []model.JobBatch
	query := DB.Model(&model.JobBatch{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	err := query.Order("created_at desc").Limit(limit).Offset(offset).Find(&batches).Error
	return batches, err
}
