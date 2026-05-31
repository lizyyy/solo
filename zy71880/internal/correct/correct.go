package correct

import (
	"fmt"

	"freefall-grading/internal/db"
	"freefall-grading/internal/model"
)

type Corrector struct {
	db *db.Database
}

func NewCorrector(db *db.Database) *Corrector {
	return &Corrector{db: db}
}

func (c *Corrector) ApproveRecord(recordID int64, modifiedBy, reason string) error {
	record, err := c.db.GetRecordByID(recordID)
	if err != nil {
		return err
	}

	if record.Status == model.StatusExported {
		return fmt.Errorf("记录已导出，不可修改")
	}

	return c.db.UpdateRecordStatus(recordID, model.StatusApproved, modifiedBy, reason, "人工审核通过")
}

func (c *Corrector) RejectRecord(recordID int64, modifiedBy, reason string) error {
	record, err := c.db.GetRecordByID(recordID)
	if err != nil {
		return err
	}

	if record.Status == model.StatusExported {
		return fmt.Errorf("记录已导出，不可修改")
	}

	return c.db.UpdateRecordStatus(recordID, model.StatusRejected, modifiedBy, reason, "人工审核驳回")
}

func (c *Corrector) UpdateGravity(recordID int64, gravity float64, modifiedBy, reason string) error {
	record, err := c.db.GetRecordByID(recordID)
	if err != nil {
		return err
	}

	if record.Status == model.StatusExported {
		return fmt.Errorf("记录已导出，不可修改")
	}

	return c.db.UpdateRecordGravity(recordID, gravity, modifiedBy, reason)
}

func (c *Corrector) ResetToPending(recordID int64, modifiedBy, reason string) error {
	record, err := c.db.GetRecordByID(recordID)
	if err != nil {
		return err
	}

	if record.Status == model.StatusExported {
		return fmt.Errorf("记录已导出，不可修改")
	}

	return c.db.UpdateRecordStatus(recordID, model.StatusPending, modifiedBy, reason, "重置为待处理状态")
}

func (c *Corrector) BatchApprove(modifiedBy, reason string) (int, error) {
	records, err := c.db.ListRecordsByStatus(model.StatusReviewed)
	if err != nil {
		return 0, err
	}

	count := 0
	for _, record := range records {
		if err := c.ApproveRecord(record.ID, modifiedBy, reason); err == nil {
			count++
		}
	}

	return count, nil
}

func (c *Corrector) BatchApproveByIDs(recordIDs []int64, modifiedBy, reason string) (int, []int64, error) {
	success := 0
	var failed []int64

	for _, id := range recordIDs {
		if err := c.ApproveRecord(id, modifiedBy, reason); err != nil {
			failed = append(failed, id)
		} else {
			success++
		}
	}

	return success, failed, nil
}

func (c *Corrector) BatchUpdateGravity(records map[int64]float64, modifiedBy, reason string) (int, []int64, error) {
	success := 0
	var failed []int64

	for id, gravity := range records {
		if err := c.UpdateGravity(id, gravity, modifiedBy, reason); err != nil {
			failed = append(failed, id)
		} else {
			success++
		}
	}

	return success, failed, nil
}

func (c *Corrector) MarkAsExported(recordIDs []int64, modifiedBy string) (int, error) {
	count := 0
	for _, id := range recordIDs {
		record, err := c.db.GetRecordByID(id)
		if err != nil {
			continue
		}
		if record.Status != model.StatusApproved {
			continue
		}

		err = c.db.UpdateRecordStatus(id, model.StatusExported, modifiedBy,
			"导出实验批改表", "已导出")
		if err == nil {
			count++
		}
	}
	return count, nil
}

func GetValidStatusTransitions() map[model.RecordStatus][]model.RecordStatus {
	return map[model.RecordStatus][]model.RecordStatus{
		model.StatusImported:  {model.StatusPending, model.StatusReviewed, model.StatusRejected},
		model.StatusPending:   {model.StatusReviewed, model.StatusCorrected, model.StatusApproved, model.StatusRejected},
		model.StatusReviewed:  {model.StatusPending, model.StatusCorrected, model.StatusApproved, model.StatusRejected},
		model.StatusCorrected: {model.StatusReviewed, model.StatusApproved, model.StatusRejected},
		model.StatusApproved:  {model.StatusExported, model.StatusPending},
		model.StatusRejected:  {model.StatusPending, model.StatusImported},
		model.StatusExported:  {},
	}
}

func CanTransition(from, to model.RecordStatus) bool {
	transitions, ok := GetValidStatusTransitions()[from]
	if !ok {
		return false
	}
	for _, t := range transitions {
		if t == to {
			return true
		}
	}
	return false
}
