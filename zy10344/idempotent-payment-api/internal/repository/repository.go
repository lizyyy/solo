package repository

import (
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/idempotent-payment-api/internal/model"
)

type ReceiverAccountRepository struct {
	db *Database
}

func NewReceiverAccountRepository(db *Database) *ReceiverAccountRepository {
	return &ReceiverAccountRepository{db: db}
}

func (r *ReceiverAccountRepository) Create(tx *sqlx.Tx, account *model.ReceiverAccount) error {
	query := `
		INSERT INTO receiver_accounts (bank_name, account_no, account_name, bank_branch, province, city, created_at, updated_at)
		VALUES (:bank_name, :account_no, :account_name, :bank_branch, :province, :city, :created_at, :updated_at)
	`
	account.CreatedAt = time.Now()
	account.UpdatedAt = time.Now()

	var err error
	if tx != nil {
		_, err = tx.NamedExec(query, account)
	} else {
		_, err = r.db.NamedExec(query, account)
	}
	return err
}

func (r *ReceiverAccountRepository) GetByID(id int64) (*model.ReceiverAccount, error) {
	var account model.ReceiverAccount
	err := r.db.Get(&account, "SELECT * FROM receiver_accounts WHERE id = ?", id)
	if err != nil {
		return nil, err
	}
	return &account, nil
}

type PaymentInstructionRepository struct {
	db *Database
}

func NewPaymentInstructionRepository(db *Database) *PaymentInstructionRepository {
	return &PaymentInstructionRepository{db: db}
}

func (r *PaymentInstructionRepository) Create(tx *sqlx.Tx, payment *model.PaymentInstruction) error {
	query := `
		INSERT INTO payment_instructions (payment_no, idempotent_key, merchant_id, amount, currency, receiver_account_id, status, channel, remark, notify_url, created_at, updated_at)
		VALUES (:payment_no, :idempotent_key, :merchant_id, :amount, :currency, :receiver_account_id, :status, :channel, :remark, :notify_url, :created_at, :updated_at)
	`
	payment.CreatedAt = time.Now()
	payment.UpdatedAt = time.Now()

	var err error
	if tx != nil {
		_, err = tx.NamedExec(query, payment)
	} else {
		_, err = r.db.NamedExec(query, payment)
	}
	return err
}

func (r *PaymentInstructionRepository) GetByPaymentNo(paymentNo string) (*model.PaymentInstruction, error) {
	var payment model.PaymentInstruction
	err := r.db.Get(&payment, "SELECT * FROM payment_instructions WHERE payment_no = ?", paymentNo)
	if err != nil {
		return nil, err
	}
	return &payment, nil
}

func (r *PaymentInstructionRepository) GetByIdempotentKey(idempotentKey string) (*model.PaymentInstruction, error) {
	var payment model.PaymentInstruction
	err := r.db.Get(&payment, "SELECT * FROM payment_instructions WHERE idempotent_key = ?", idempotentKey)
	if err != nil {
		return nil, err
	}
	return &payment, nil
}

func (r *PaymentInstructionRepository) UpdateStatus(tx *sqlx.Tx, paymentID int64, status model.PaymentStatus) error {
	query := `UPDATE payment_instructions SET status = ?, updated_at = ? WHERE id = ?`
	now := time.Now()

	var err error
	if tx != nil {
		_, err = tx.Exec(query, status, now, paymentID)
	} else {
		_, err = r.db.Exec(query, status, now, paymentID)
	}
	return err
}

func (r *PaymentInstructionRepository) UpdateChannelOrderNo(tx *sqlx.Tx, paymentID int64, channelOrderNo string) error {
	query := `UPDATE payment_instructions SET channel_order_no = ?, updated_at = ? WHERE id = ?`
	now := time.Now()

	var err error
	if tx != nil {
		_, err = tx.Exec(query, channelOrderNo, now, paymentID)
	} else {
		_, err = r.db.Exec(query, channelOrderNo, now, paymentID)
	}
	return err
}

func (r *PaymentInstructionRepository) GetByStatus(status model.PaymentStatus) ([]*model.PaymentInstruction, error) {
	var payments []*model.PaymentInstruction
	err := r.db.Select(&payments, "SELECT * FROM payment_instructions WHERE status = ?", status)
	return payments, err
}

type IdempotentKeyRepository struct {
	db *Database
}

func NewIdempotentKeyRepository(db *Database) *IdempotentKeyRepository {
	return &IdempotentKeyRepository{db: db}
}

func (r *IdempotentKeyRepository) Create(tx *sqlx.Tx, idk *model.IdempotentKey) error {
	query := `
		INSERT INTO idempotent_keys (idempotent_key, payment_id, created_at, expired_at)
		VALUES (:idempotent_key, :payment_id, :created_at, :expired_at)
	`
	idk.CreatedAt = time.Now()

	var err error
	if tx != nil {
		_, err = tx.NamedExec(query, idk)
	} else {
		_, err = r.db.NamedExec(query, idk)
	}
	return err
}

func (r *IdempotentKeyRepository) GetByKey(key string) (*model.IdempotentKey, error) {
	var idk model.IdempotentKey
	err := r.db.Get(&idk, "SELECT * FROM idempotent_keys WHERE idempotent_key = ?", key)
	if err != nil {
		return nil, err
	}
	return &idk, nil
}

func (r *IdempotentKeyRepository) Exists(key string) (bool, error) {
	var count int
	err := r.db.Get(&count, "SELECT COUNT(*) FROM idempotent_keys WHERE idempotent_key = ?", key)
	return count > 0, err
}

type ChannelReceiptRepository struct {
	db *Database
}

func NewChannelReceiptRepository(db *Database) *ChannelReceiptRepository {
	return &ChannelReceiptRepository{db: db}
}

func (r *ChannelReceiptRepository) Create(tx *sqlx.Tx, receipt *model.ChannelReceipt) error {
	query := `
		INSERT INTO channel_receipts (payment_id, payment_no, channel, channel_order_no, channel_status, receipt_content, is_success, response_time, created_at)
		VALUES (:payment_id, :payment_no, :channel, :channel_order_no, :channel_status, :receipt_content, :is_success, :response_time, :created_at)
	`
	receipt.CreatedAt = time.Now()
	receipt.ResponseTime = time.Now()

	var err error
	if tx != nil {
		_, err = tx.NamedExec(query, receipt)
	} else {
		_, err = r.db.NamedExec(query, receipt)
	}
	return err
}

func (r *ChannelReceiptRepository) GetByPaymentID(paymentID int64) ([]*model.ChannelReceipt, error) {
	var receipts []*model.ChannelReceipt
	err := r.db.Select(&receipts, "SELECT * FROM channel_receipts WHERE payment_id = ? ORDER BY created_at DESC", paymentID)
	return receipts, err
}

type CancelApplicationRepository struct {
	db *Database
}

func NewCancelApplicationRepository(db *Database) *CancelApplicationRepository {
	return &CancelApplicationRepository{db: db}
}

func (r *CancelApplicationRepository) Create(tx *sqlx.Tx, app *model.CancelApplication) error {
	query := `
		INSERT INTO cancel_applications (payment_id, payment_no, cancel_reason, cancel_status, created_at, updated_at)
		VALUES (:payment_id, :payment_no, :cancel_reason, :cancel_status, :created_at, :updated_at)
	`
	app.CreatedAt = time.Now()
	app.UpdatedAt = time.Now()

	var err error
	if tx != nil {
		_, err = tx.NamedExec(query, app)
	} else {
		_, err = r.db.NamedExec(query, app)
	}
	return err
}

func (r *CancelApplicationRepository) GetByPaymentID(paymentID int64) (*model.CancelApplication, error) {
	var app model.CancelApplication
	err := r.db.Get(&app, "SELECT * FROM cancel_applications WHERE payment_id = ?", paymentID)
	if err != nil {
		return nil, err
	}
	return &app, nil
}

func (r *CancelApplicationRepository) UpdateStatus(tx *sqlx.Tx, id int64, status model.PaymentStatus) error {
	query := `UPDATE cancel_applications SET cancel_status = ?, updated_at = ? WHERE id = ?`
	now := time.Now()

	var err error
	if tx != nil {
		_, err = tx.Exec(query, status, now, id)
	} else {
		_, err = r.db.Exec(query, status, now, id)
	}
	return err
}

type TimelineEventRepository struct {
	db *Database
}

func NewTimelineEventRepository(db *Database) *TimelineEventRepository {
	return &TimelineEventRepository{db: db}
}

func (r *TimelineEventRepository) Create(tx *sqlx.Tx, event *model.TimelineEvent) error {
	query := `
		INSERT INTO timeline_events (payment_id, payment_no, event_type, event_status, content, operator, ip_address, created_at)
		VALUES (:payment_id, :payment_no, :event_type, :event_status, :content, :operator, :ip_address, :created_at)
	`
	event.CreatedAt = time.Now()

	var err error
	if tx != nil {
		_, err = tx.NamedExec(query, event)
	} else {
		_, err = r.db.NamedExec(query, event)
	}
	return err
}

func (r *TimelineEventRepository) GetByPaymentID(paymentID int64) ([]*model.TimelineEvent, error) {
	var events []*model.TimelineEvent
	err := r.db.Select(&events, "SELECT * FROM timeline_events WHERE payment_id = ? ORDER BY created_at ASC", paymentID)
	return events, err
}

func (r *TimelineEventRepository) Query(paymentNo, eventType, startTime, endTime string) ([]*model.TimelineEvent, int64, error) {
	query := `SELECT * FROM timeline_events WHERE 1=1`
	args := []interface{}{}

	if paymentNo != "" {
		query += " AND payment_no = ?"
		args = append(args, paymentNo)
	}
	if eventType != "" {
		query += " AND event_type = ?"
		args = append(args, eventType)
	}
	if startTime != "" {
		query += " AND created_at >= ?"
		args = append(args, startTime)
	}
	if endTime != "" {
		query += " AND created_at <= ?"
		args = append(args, endTime)
	}

	query += " ORDER BY created_at DESC"

	var events []*model.TimelineEvent
	err := r.db.Select(&events, query, args...)
	if err != nil {
		return nil, 0, err
	}

	var count int64
	countQuery := `SELECT COUNT(*) FROM (` + query + `)`
	err = r.db.Get(&count, countQuery, args...)
	return events, count, err
}
