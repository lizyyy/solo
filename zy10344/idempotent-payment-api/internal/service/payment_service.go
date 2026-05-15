package service

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/idempotent-payment-api/internal/model"
	"github.com/idempotent-payment-api/internal/repository"
	"github.com/jmoiron/sqlx"
)

type PaymentService struct {
	db             *repository.Database
	paymentRepo    *repository.PaymentInstructionRepository
	receiverRepo   *repository.ReceiverAccountRepository
	idempotentRepo *repository.IdempotentKeyRepository
	receiptRepo    *repository.ChannelReceiptRepository
	cancelRepo     *repository.CancelApplicationRepository
	timelineRepo   *repository.TimelineEventRepository
	channelService *ChannelService
}

func NewPaymentService(db *repository.Database) *PaymentService {
	return &PaymentService{
		db:             db,
		paymentRepo:    repository.NewPaymentInstructionRepository(db),
		receiverRepo:   repository.NewReceiverAccountRepository(db),
		idempotentRepo: repository.NewIdempotentKeyRepository(db),
		receiptRepo:    repository.NewChannelReceiptRepository(db),
		cancelRepo:     repository.NewCancelApplicationRepository(db),
		timelineRepo:   repository.NewTimelineEventRepository(db),
		channelService: NewChannelService(),
	}
}

func (s *PaymentService) CreatePayment(req *model.CreatePaymentRequest) (*model.CreatePaymentResponse, error) {
	exists, err := s.idempotentRepo.Exists(req.IdempotentKey)
	if err != nil {
		log.Printf("Check idempotent key error: %v", err)
	}
	if exists {
		payment, err := s.paymentRepo.GetByIdempotentKey(req.IdempotentKey)
		if err != nil {
			return nil, fmt.Errorf("get existing payment failed: %w", err)
		}

		_ = s.recordTimeline(payment.ID, payment.PaymentNo, "DUPLICATE_REQUEST", "INFO",
			fmt.Sprintf("重复请求被幂等拦截，当前状态: %s", payment.Status),
			req.Operator, req.IPAddress)

		return &model.CreatePaymentResponse{
			PaymentNo:     payment.PaymentNo,
			IdempotentKey: payment.IdempotentKey,
			Status:        payment.Status,
			IsDuplicate:   true,
			CreatedAt:     payment.CreatedAt.Format(time.RFC3339),
		}, nil
	}

	tx, err := s.db.BeginTx()
	if err != nil {
		return nil, fmt.Errorf("begin transaction failed: %w", err)
	}
	defer func() {
		if p := recover(); p != nil {
			_ = tx.Rollback()
			panic(p)
		}
	}()

	receiverAccount := &model.ReceiverAccount{
		BankName:    req.Receiver.BankName,
		AccountNo:   req.Receiver.AccountNo,
		AccountName: req.Receiver.AccountName,
		BankBranch:  req.Receiver.BankBranch,
		Province:    req.Receiver.Province,
		City:        req.Receiver.City,
	}
	if err := s.receiverRepo.Create(tx, receiverAccount); err != nil {
		_ = tx.Rollback()
		return nil, fmt.Errorf("create receiver account failed: %w", err)
	}

	paymentNo := generatePaymentNo()
	payment := &model.PaymentInstruction{
		PaymentNo:         paymentNo,
		IdempotentKey:     req.IdempotentKey,
		MerchantID:        req.MerchantID,
		Amount:            req.Amount,
		Currency:          req.Currency,
		ReceiverAccountID: receiverAccount.ID,
		Status:            model.StatusPending,
		Channel:           req.Channel,
		Remark:            req.Remark,
		NotifyURL:         req.NotifyURL,
	}
	if err := s.paymentRepo.Create(tx, payment); err != nil {
		_ = tx.Rollback()
		return nil, fmt.Errorf("create payment failed: %w", err)
	}

	idempotentKey := &model.IdempotentKey{
		IdempotentKey: req.IdempotentKey,
		PaymentID:     payment.ID,
		ExpiredAt:     time.Now().Add(24 * 30 * time.Hour),
	}
	if err := s.idempotentRepo.Create(tx, idempotentKey); err != nil {
		_ = tx.Rollback()
		return nil, fmt.Errorf("create idempotent key failed: %w", err)
	}

	if err := s.recordTimelineWithTx(tx, payment.ID, payment.PaymentNo, "CREATE_PAYMENT", "SUCCESS",
		fmt.Sprintf("创建支付指令成功，金额: %d %s", req.Amount, req.Currency),
		req.Operator, req.IPAddress); err != nil {
		_ = tx.Rollback()
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit transaction failed: %w", err)
	}

	go s.processPayment(payment)

	return &model.CreatePaymentResponse{
		PaymentNo:     payment.PaymentNo,
		IdempotentKey: payment.IdempotentKey,
		Status:        payment.Status,
		IsDuplicate:   false,
		CreatedAt:     payment.CreatedAt.Format(time.RFC3339),
	}, nil
}

func (s *PaymentService) processPayment(payment *model.PaymentInstruction) {
	_ = s.recordTimeline(payment.ID, payment.PaymentNo, "PROCESS_PAYMENT", "START",
		"开始处理支付，调用渠道接口", "", "")

	channelOrderNo, err := s.channelService.SubmitPayment(payment)
	if err != nil {
		log.Printf("Submit payment to channel failed: %v", err)
		_ = s.paymentRepo.UpdateStatus(nil, payment.ID, model.StatusFailed)
		_ = s.recordTimeline(payment.ID, payment.PaymentNo, "CHANNEL_SUBMIT", "FAILED",
			fmt.Sprintf("提交渠道失败: %v", err), "", "")
		return
	}

	_ = s.paymentRepo.UpdateChannelOrderNo(nil, payment.ID, channelOrderNo)
	_ = s.paymentRepo.UpdateStatus(nil, payment.ID, model.StatusProcessing)
	_ = s.recordTimeline(payment.ID, payment.PaymentNo, "CHANNEL_SUBMIT", "SUCCESS",
		fmt.Sprintf("提交渠道成功，渠道单号: %s", channelOrderNo), "", "")
}

func (s *PaymentService) QueryPayment(paymentNo, idempotentKey string) (*model.QueryPaymentResponse, error) {
	var payment *model.PaymentInstruction
	var err error

	if paymentNo != "" {
		payment, err = s.paymentRepo.GetByPaymentNo(paymentNo)
	} else if idempotentKey != "" {
		payment, err = s.paymentRepo.GetByIdempotentKey(idempotentKey)
	} else {
		return nil, fmt.Errorf("payment_no or idempotent_key is required")
	}

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("payment not found")
		}
		return nil, err
	}

	receiver, err := s.receiverRepo.GetByID(payment.ReceiverAccountID)
	if err != nil {
		log.Printf("Get receiver account failed: %v", err)
	}

	timeline, _ := s.timelineRepo.GetByPaymentID(payment.ID)

	return &model.QueryPaymentResponse{
		PaymentNo:       payment.PaymentNo,
		IdempotentKey:   payment.IdempotentKey,
		MerchantID:      payment.MerchantID,
		Amount:          payment.Amount,
		Currency:        payment.Currency,
		ReceiverAccount: receiver,
		Status:          payment.Status,
		Channel:         payment.Channel,
		ChannelOrderNo:  payment.ChannelOrderNo,
		Remark:          payment.Remark,
		CreatedAt:       payment.CreatedAt.Format(time.RFC3339),
		UpdatedAt:       payment.UpdatedAt.Format(time.RFC3339),
		Timeline:        timeline,
	}, nil
}

func (s *PaymentService) CancelPayment(req *model.CancelPaymentRequest) (*model.CancelPaymentResponse, error) {
	payment, err := s.paymentRepo.GetByPaymentNo(req.PaymentNo)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("payment not found")
		}
		return nil, err
	}

	if payment.Status == model.StatusSuccess {
		return nil, fmt.Errorf("payment already success, cannot cancel")
	}
	if payment.Status == model.StatusCancelled || payment.Status == model.StatusCancelling {
		return nil, fmt.Errorf("payment already cancelled or cancelling")
	}

	tx, err := s.db.BeginTx()
	if err != nil {
		return nil, fmt.Errorf("begin transaction failed: %w", err)
	}
	defer func() {
		if p := recover(); p != nil {
			_ = tx.Rollback()
			panic(p)
		}
	}()

	cancelApp := &model.CancelApplication{
		PaymentID:    payment.ID,
		PaymentNo:    payment.PaymentNo,
		CancelReason: req.Reason,
		CancelStatus: model.StatusCancelling,
	}
	if err := s.cancelRepo.Create(tx, cancelApp); err != nil {
		_ = tx.Rollback()
		return nil, fmt.Errorf("create cancel application failed: %w", err)
	}

	if err := s.paymentRepo.UpdateStatus(tx, payment.ID, model.StatusCancelling); err != nil {
		_ = tx.Rollback()
		return nil, fmt.Errorf("update payment status failed: %w", err)
	}

	_ = s.recordTimelineWithTx(tx, payment.ID, payment.PaymentNo, "CANCEL_REQUEST", "SUCCESS",
		fmt.Sprintf("申请撤销，原因: %s", req.Reason), req.Operator, req.IPAddress)

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit transaction failed: %w", err)
	}

	go s.processCancel(payment, cancelApp)

	return &model.CancelPaymentResponse{
		PaymentNo:    payment.PaymentNo,
		CancelStatus: model.StatusCancelling,
		CreatedAt:    time.Now().Format(time.RFC3339),
	}, nil
}

func (s *PaymentService) processCancel(payment *model.PaymentInstruction, cancelApp *model.CancelApplication) {
	channelCancelNo, err := s.channelService.SubmitCancel(payment)
	if err != nil {
		log.Printf("Submit cancel to channel failed: %v", err)
		_ = s.recordTimeline(payment.ID, payment.PaymentNo, "CHANNEL_CANCEL", "FAILED",
			fmt.Sprintf("渠道撤销失败: %v", err), "", "")
		return
	}

	_ = s.paymentRepo.UpdateStatus(nil, payment.ID, model.StatusCancelled)
	_ = s.cancelRepo.UpdateStatus(nil, cancelApp.ID, model.StatusCancelled)
	_ = s.recordTimeline(payment.ID, payment.PaymentNo, "CHANNEL_CANCEL", "SUCCESS",
		fmt.Sprintf("渠道撤销成功，撤销单号: %s", channelCancelNo), "", "")
}

func (s *PaymentService) ProcessChannelCallback(req *model.ChannelCallbackRequest) error {
	payment, err := s.paymentRepo.GetByPaymentNo(req.PaymentNo)
	if err != nil {
		return fmt.Errorf("payment not found: %w", err)
	}

	tx, err := s.db.BeginTx()
	if err != nil {
		return fmt.Errorf("begin transaction failed: %w", err)
	}
	defer func() {
		if p := recover(); p != nil {
			_ = tx.Rollback()
			panic(p)
		}
	}()

	receipt := &model.ChannelReceipt{
		PaymentID:      payment.ID,
		PaymentNo:      payment.PaymentNo,
		Channel:        payment.Channel,
		ChannelOrderNo: req.ChannelOrderNo,
		ChannelStatus:  req.ChannelStatus,
		ReceiptContent: req.ReceiptContent,
		IsSuccess:      req.IsSuccess,
	}
	if err := s.receiptRepo.Create(tx, receipt); err != nil {
		_ = tx.Rollback()
		return fmt.Errorf("create channel receipt failed: %w", err)
	}

	var newStatus model.PaymentStatus
	if req.IsSuccess {
		newStatus = model.StatusSuccess
	} else {
		newStatus = model.StatusFailed
	}

	if payment.Status != newStatus {
		if err := s.paymentRepo.UpdateStatus(tx, payment.ID, newStatus); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("update payment status failed: %w", err)
		}
	}

	_ = s.recordTimelineWithTx(tx, payment.ID, payment.PaymentNo, "CHANNEL_CALLBACK", "SUCCESS",
		fmt.Sprintf("收到渠道回调，状态: %s，是否成功: %v", req.ChannelStatus, req.IsSuccess), "", "")

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit transaction failed: %w", err)
	}

	return nil
}

func (s *PaymentService) PollChannelStatus() error {
	payments, err := s.paymentRepo.GetByStatus(model.StatusProcessing)
	if err != nil {
		return err
	}

	log.Printf("Start polling %d payments status", len(payments))

	for _, payment := range payments {
		go func(p *model.PaymentInstruction) {
			status, isSuccess, err := s.channelService.QueryStatus(p)
			if err != nil {
				log.Printf("Query channel status for payment %s failed: %v", p.PaymentNo, err)
				return
			}

			if status == "PENDING" || status == "PROCESSING" {
				return
			}

			receipt := &model.ChannelReceipt{
				PaymentID:      p.ID,
				PaymentNo:      p.PaymentNo,
				Channel:        p.Channel,
				ChannelOrderNo: p.ChannelOrderNo,
				ChannelStatus:  status,
				IsSuccess:      isSuccess,
			}
			_ = s.receiptRepo.Create(nil, receipt)

			var newStatus model.PaymentStatus
			if isSuccess {
				newStatus = model.StatusSuccess
			} else {
				newStatus = model.StatusFailed
			}

			if p.Status != newStatus {
				_ = s.paymentRepo.UpdateStatus(nil, p.ID, newStatus)
				_ = s.recordTimeline(p.ID, p.PaymentNo, "STATUS_POLL", "SUCCESS",
					fmt.Sprintf("轮询更新状态: %s -> %s", p.Status, newStatus), "", "")
			}
		}(payment)
	}

	return nil
}

func (s *PaymentService) QueryHistory(req *model.HistoryQueryRequest) (*model.HistoryQueryResponse, error) {
	events, total, err := s.timelineRepo.Query(req.PaymentNo, req.EventType, req.StartTime, req.EndTime)
	if err != nil {
		return nil, err
	}

	return &model.HistoryQueryResponse{
		Total:  total,
		Events: events,
	}, nil
}

func (s *PaymentService) GetProblemSummary(req *model.ProblemSummaryRequest) (*model.ProblemSummaryResponse, error) {
	problemStatuses := []model.PaymentStatus{model.StatusProcessing, model.StatusUnknown, model.StatusCancelling}
	var allPayments []*model.PaymentInstruction

	for _, status := range problemStatuses {
		payments, err := s.paymentRepo.GetByStatus(status)
		if err != nil {
			continue
		}
		allPayments = append(allPayments, payments...)
	}

	summaries := make([]*model.ProblemSummary, 0, len(allPayments))
	for _, payment := range allPayments {
		duration := time.Since(payment.CreatedAt)
		isProblematic := duration > 1*time.Hour || payment.Status == model.StatusUnknown

		timeline, _ := s.timelineRepo.GetByPaymentID(payment.ID)
		receipts, _ := s.receiptRepo.GetByPaymentID(payment.ID)
		cancelInfo, _ := s.cancelRepo.GetByPaymentID(payment.ID)

		problemDesc := ""
		if isProblematic {
			if duration > 24*time.Hour {
				problemDesc = fmt.Sprintf("支付处理超时超过24小时，当前状态: %s", payment.Status)
			} else if duration > 1*time.Hour {
				problemDesc = fmt.Sprintf("支付处理超过1小时，当前状态: %s", payment.Status)
			} else if payment.Status == model.StatusUnknown {
				problemDesc = "支付状态异常，需要人工核查"
			}
		}

		summaries = append(summaries, &model.ProblemSummary{
			PaymentNo:       payment.PaymentNo,
			IdempotentKey:   payment.IdempotentKey,
			Status:          payment.Status,
			TotalAmount:     payment.Amount,
			Currency:        payment.Currency,
			Channel:         payment.Channel,
			CreatedAt:       payment.CreatedAt,
			LastUpdatedAt:   payment.UpdatedAt,
			TimelineEvents:  timeline,
			ChannelReceipts: receipts,
			CancelInfo:      cancelInfo,
			DurationSeconds: duration.Seconds(),
			IsProblematic:   isProblematic,
			ProblemDesc:     problemDesc,
		})
	}

	return &model.ProblemSummaryResponse{
		Total:     len(summaries),
		Summaries: summaries,
	}, nil
}

func (s *PaymentService) ExportProblemSummary(req *model.ProblemSummaryRequest) (string, error) {
	resp, err := s.GetProblemSummary(req)
	if err != nil {
		return "", err
	}

	data, err := json.MarshalIndent(resp, "", "  ")
	if err != nil {
		return "", err
	}

	if err := os.MkdirAll("./data/export", 0755); err != nil {
		return "", fmt.Errorf("create export dir failed: %w", err)
	}

	filename := fmt.Sprintf("problem_summary_%s.json", time.Now().Format("20060102_150405"))
	fullpath := "./data/export/" + filename
	if err := os.WriteFile(fullpath, data, 0644); err != nil {
		return "", fmt.Errorf("write export file failed: %w", err)
	}

	return filename, nil
}

func (s *PaymentService) recordTimeline(paymentID int64, paymentNo, eventType, eventStatus, content, operator, ipAddress string) error {
	event := &model.TimelineEvent{
		PaymentID:   paymentID,
		PaymentNo:   paymentNo,
		EventType:   eventType,
		EventStatus: eventStatus,
		Content:     content,
		Operator:    operator,
		IPAddress:   ipAddress,
	}
	return s.timelineRepo.Create(nil, event)
}

func (s *PaymentService) recordTimelineWithTx(tx *sqlx.Tx, paymentID int64, paymentNo, eventType, eventStatus, content, operator, ipAddress string) error {
	event := &model.TimelineEvent{
		PaymentID:   paymentID,
		PaymentNo:   paymentNo,
		EventType:   eventType,
		EventStatus: eventStatus,
		Content:     content,
		Operator:    operator,
		IPAddress:   ipAddress,
	}
	return s.timelineRepo.Create(tx, event)
}

func generatePaymentNo() string {
	return fmt.Sprintf("PAY%s%s", time.Now().Format("20060102150405"), uuid.New().String()[:8])
}
