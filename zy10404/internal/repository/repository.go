package repository

import (
	"grayscale-backfill/internal/model"
	"time"

	"gorm.io/gorm"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) AutoMigrate() error {
	return r.db.AutoMigrate(
		&model.GrayscaleBatch{},
		&model.MetricWindow{},
		&model.GapSegment{},
		&model.BackfillSource{},
		&model.AuditRecord{},
		&model.ResultSnapshot{},
		&model.BackfillTask{},
	)
}

func (r *Repository) CreateBackfillTask(task *model.BackfillTask) error {
	return r.db.Create(task).Error
}

func (r *Repository) GetBackfillTaskByID(backfillID string) (*model.BackfillTask, error) {
	var task model.BackfillTask
	err := r.db.Where("backfill_id = ?", backfillID).First(&task).Error
	return &task, err
}

func (r *Repository) ListBackfillTasks(batchID, status string, offset, limit int) ([]*model.BackfillTask, int64, error) {
	var tasks []*model.BackfillTask
	var total int64

	query := r.db.Model(&model.BackfillTask{})
	if batchID != "" {
		query = query.Where("batch_id = ?", batchID)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&tasks).Error
	return tasks, total, err
}

func (r *Repository) UpdateBackfillTaskStatus(backfillID string, fromStatus, toStatus model.BackfillStatus) error {
	result := r.db.Model(&model.BackfillTask{}).
		Where("backfill_id = ? AND status = ?", backfillID, fromStatus).
		Updates(map[string]interface{}{
			"status":     toStatus,
			"updated_at": time.Now(),
		})
	return result.Error
}

func (r *Repository) UpdateBackfillTask(task *model.BackfillTask) error {
	return r.db.Save(task).Error
}

func (r *Repository) CheckDuplicate(deduplicationKey string) (bool, error) {
	var count int64
	err := r.db.Model(&model.BackfillTask{}).
		Where("deduplication_key = ?", deduplicationKey).
		Count(&count).Error
	return count > 0, err
}

func (r *Repository) GetBackfillTaskByDedupeKey(deduplicationKey string) (*model.BackfillTask, error) {
	var task model.BackfillTask
	err := r.db.Where("deduplication_key = ?", deduplicationKey).First(&task).Error
	return &task, err
}

func (r *Repository) CreateAuditRecord(record *model.AuditRecord) error {
	return r.db.Create(record).Error
}

func (r *Repository) ListAuditRecords(backfillID string) ([]*model.AuditRecord, error) {
	var records []*model.AuditRecord
	err := r.db.Where("backfill_id = ?", backfillID).Order("audit_time ASC").Find(&records).Error
	return records, err
}

func (r *Repository) CreateResultSnapshot(snapshot *model.ResultSnapshot) error {
	return r.db.Create(snapshot).Error
}

func (r *Repository) GetResultSnapshot(snapshotID string) (*model.ResultSnapshot, error) {
	var snapshot model.ResultSnapshot
	err := r.db.Where("snapshot_id = ?", snapshotID).First(&snapshot).Error
	return &snapshot, err
}

func (r *Repository) ListResultSnapshots(backfillID string) ([]*model.ResultSnapshot, error) {
	var snapshots []*model.ResultSnapshot
	err := r.db.Where("backfill_id = ?", backfillID).Order("created_at DESC").Find(&snapshots).Error
	return snapshots, err
}

func (r *Repository) CreateGrayscaleBatch(batch *model.GrayscaleBatch) error {
	return r.db.Create(batch).Error
}

func (r *Repository) GetGrayscaleBatch(batchID string) (*model.GrayscaleBatch, error) {
	var batch model.GrayscaleBatch
	err := r.db.Where("batch_id = ?", batchID).First(&batch).Error
	return &batch, err
}

func (r *Repository) CreateMetricWindow(window *model.MetricWindow) error {
	return r.db.Create(window).Error
}

func (r *Repository) GetMetricWindow(windowID string) (*model.MetricWindow, error) {
	var window model.MetricWindow
	err := r.db.Where("window_id = ?", windowID).First(&window).Error
	return &window, err
}

func (r *Repository) GetMetricWindowsByBatch(batchID string) ([]*model.MetricWindow, error) {
	var windows []*model.MetricWindow
	err := r.db.Where("batch_id = ?", batchID).Find(&windows).Error
	return windows, err
}

func (r *Repository) CheckWindowOverlap(batchID string, startTime, endTime time.Time) (bool, error) {
	var count int64
	err := r.db.Model(&model.MetricWindow{}).
		Where("batch_id = ? AND start_time < ? AND end_time > ?", batchID, endTime, startTime).
		Count(&count).Error
	return count > 0, err
}

func (r *Repository) CreateGapSegment(segment *model.GapSegment) error {
	return r.db.Create(segment).Error
}

func (r *Repository) ListGapSegments(backfillID string) ([]*model.GapSegment, error) {
	var segments []*model.GapSegment
	err := r.db.Where("backfill_id = ?", backfillID).Find(&segments).Error
	return segments, err
}

func (r *Repository) CreateBackfillSource(source *model.BackfillSource) error {
	return r.db.Create(source).Error
}

func (r *Repository) GetBackfillSources(backfillID string) ([]*model.BackfillSource, error) {
	var sources []*model.BackfillSource
	err := r.db.Where("backfill_id = ?", backfillID).Find(&sources).Error
	return sources, err
}
