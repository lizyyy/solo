package repository

import (
	"database/sql"
	"time"

	"quality-control-system/internal/model"
)

type RuleRepository struct {
	db *sql.DB
}

func NewRuleRepository() *RuleRepository {
	return &RuleRepository{db: DB}
}

func (r *RuleRepository) LogExecution(log *model.RuleExecutionLog) error {
	query := `
		INSERT INTO rule_execution_logs (rule_name, record_type, record_ref_no, store_id,
			execution_time, action_taken, reason, details, operator)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.db.Exec(query,
		log.RuleName, log.RecordType, log.RecordRefNo, log.StoreID,
		time.Now(), log.ActionTaken, log.Reason, log.Details, log.Operator,
	)
	return err
}

func (r *RuleRepository) GetLogsByRecord(recordType, recordRefNo string) ([]*model.RuleExecutionLog, error) {
	query := `
		SELECT id, rule_name, record_type, record_ref_no, store_id, execution_time,
			action_taken, reason, details, operator
		FROM rule_execution_logs WHERE record_type = ? AND record_ref_no = ?
		ORDER BY execution_time DESC
	`
	rows, err := r.db.Query(query, recordType, recordRefNo)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []*model.RuleExecutionLog
	for rows.Next() {
		log := &model.RuleExecutionLog{}
		err := rows.Scan(
			&log.ID, &log.RuleName, &log.RecordType, &log.RecordRefNo, &log.StoreID,
			&log.ExecutionTime, &log.ActionTaken, &log.Reason, &log.Details, &log.Operator,
		)
		if err != nil {
			return nil, err
		}
		logs = append(logs, log)
	}
	return logs, nil
}

func (r *RuleRepository) CreateReminder(reminder *model.Reminder) error {
	query := `
		INSERT INTO reminders (reminder_no, store_id, reminder_type, related_ref_no,
			message, remind_time, is_acknowledged, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`
	now := time.Now()
	_, err := r.db.Exec(query,
		reminder.ReminderNo, reminder.StoreID, reminder.ReminderType,
		reminder.RelatedRefNo, reminder.Message, reminder.RemindTime,
		reminder.IsAcknowledged, now,
	)
	return err
}

func (r *RuleRepository) AcknowledgeReminder(reminderNo string, operator string) error {
	query := `
		UPDATE reminders 
		SET is_acknowledged = 1, acknowledge_time = ?, acknowledged_by = ?
		WHERE reminder_no = ?
	`
	_, err := r.db.Exec(query, time.Now(), operator, reminderNo)
	return err
}

func (r *RuleRepository) GetPendingReminders(storeID string) ([]*model.Reminder, error) {
	query := `
		SELECT id, reminder_no, store_id, reminder_type, related_ref_no, message,
			remind_time, is_acknowledged, acknowledge_time, acknowledged_by, created_at
		FROM reminders 
		WHERE store_id = ? AND is_acknowledged = 0 AND remind_time <= ?
		ORDER BY remind_time DESC
	`
	rows, err := r.db.Query(query, storeID, time.Now())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reminders []*model.Reminder
	for rows.Next() {
		reminder := &model.Reminder{}
		var ackTime sql.NullTime
		var ackBy sql.NullString
		err := rows.Scan(
			&reminder.ID, &reminder.ReminderNo, &reminder.StoreID, &reminder.ReminderType,
			&reminder.RelatedRefNo, &reminder.Message, &reminder.RemindTime,
			&reminder.IsAcknowledged, &ackTime, &ackBy, &reminder.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		if ackTime.Valid {
			reminder.AcknowledgeTime = &ackTime.Time
		}
		reminder.AcknowledgedBy = ackBy.String
		reminders = append(reminders, reminder)
	}
	return reminders, nil
}
