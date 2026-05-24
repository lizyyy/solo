package service

import (
	"fmt"
	"time"

	"lab-reagent-api/internal/database"
	"lab-reagent-api/internal/model"
)

type OrderService struct {
	orderRepo    *database.OrderRepo
	judgmentRepo *database.JudgmentRepo
	reagentRepo  *database.ReagentRepo
}

func NewOrderService(orderRepo *database.OrderRepo, judgmentRepo *database.JudgmentRepo, reagentRepo *database.ReagentRepo) *OrderService {
	return &OrderService{
		orderRepo:    orderRepo,
		judgmentRepo: judgmentRepo,
		reagentRepo:  reagentRepo,
	}
}

func (s *OrderService) CreateOrder(orderType string, batchNo string, createdBy string, requestID string, needsReview bool) (*model.ProcessingOrder, *model.APIError) {
	exists, _ := s.orderRepo.CheckDuplicateRequest(requestID)
	if exists {
		orders, _ := s.orderRepo.ListAll()
		for _, o := range orders {
			if o.RequestID == requestID {
				s.loadJudgmentHistory(&o)
				return &o, nil
			}
		}
		return nil, &model.APIError{
			Code:    model.ErrCodeDuplicate,
			Message: "重复请求",
			Details: fmt.Sprintf("请求ID %s 已被处理", requestID),
		}
	}

	reagent, err := s.reagentRepo.GetByBatchNo(batchNo)
	if err != nil {
		return nil, &model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "查询试剂失败",
			Details: err.Error(),
		}
	}
	if reagent == nil {
		return nil, &model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "试剂不存在",
			Details: fmt.Sprintf("批号 %s 未找到", batchNo),
		}
	}

	prefix := fmt.Sprintf("%s-%s", orderType, time.Now().Format("20060102"))
	orderNo, err := s.orderRepo.GetNextOrderNo(prefix)
	if err != nil {
		orderNo = fmt.Sprintf("%s-%d", prefix, time.Now().Unix())
	}

	order := &model.ProcessingOrder{
		OrderNo:     orderNo,
		BatchNo:     batchNo,
		Type:        orderType,
		Status:      "pending",
		CreatedBy:   createdBy,
		NeedsReview: needsReview,
		RequestID:   requestID,
	}

	if needsReview {
		order.Status = "needs_review"
	}

	if err := s.orderRepo.Create(order); err != nil {
		return nil, &model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "创建处理单失败",
			Details: err.Error(),
		}
	}

	return order, nil
}

func (s *OrderService) ProcessJudgment(req *model.JudgmentRequest) (*model.ProcessingOrder, *model.APIError) {
	exists, _ := s.judgmentRepo.CheckDuplicateRequest(req.RequestID)
	if exists {
		history, _ := s.judgmentRepo.GetByOrderNo(req.OrderNo)
		if len(history) > 0 {
			for _, h := range history {
				if h.RequestID == req.RequestID {
					order, _ := s.orderRepo.GetByOrderNo(req.OrderNo)
					if order != nil {
						s.loadJudgmentHistory(order)
						return order, nil
					}
				}
			}
		}
		return nil, &model.APIError{
			Code:    model.ErrCodeDuplicate,
			Message: "重复请求",
			Details: fmt.Sprintf("请求ID %s 已被处理", req.RequestID),
		}
	}

	order, err := s.orderRepo.GetByOrderNo(req.OrderNo)
	if err != nil {
		return nil, &model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "查询处理单失败",
			Details: err.Error(),
		}
	}
	if order == nil {
		return nil, &model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "处理单不存在",
			Details: fmt.Sprintf("处理单号 %s 未找到", req.OrderNo),
		}
	}

	if order.Status == "approved" || order.Status == "rejected" {
		return nil, &model.APIError{
			Code:    model.ErrCodeInvalidStatus,
			Message: "处理单已完成",
			Details: fmt.Sprintf("该处理单已处于 %s 状态，无法再次判定", order.Status),
		}
	}

	if req.Judgment == "approve" && order.NeedsReview {
		s.loadJudgmentHistory(order)
		return order, &model.APIError{
			Code:    model.ErrCodeNeedsReview,
			Message: "需要复核",
			Details: "该处理单设置为需要复核模式，请先完成复核流程",
		}
	}

	now := time.Now()
	history := &model.JudgmentHistory{
		OrderID:   order.ID,
		OrderNo:   req.OrderNo,
		Judgment:  req.Judgment,
		JudgedBy:  req.JudgedBy,
		Notes:     req.Notes,
		RequestID: req.RequestID,
	}

	if err := s.judgmentRepo.Create(history); err != nil {
		return nil, &model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "记录判定历史失败",
			Details: err.Error(),
		}
	}

	order.ReviewedBy = req.JudgedBy
	if order.ReviewNotes == "" {
		order.ReviewNotes = req.Notes
	} else {
		order.ReviewNotes = fmt.Sprintf("%s\n[%s %s]: %s", order.ReviewNotes, req.Judgment, req.JudgedBy, req.Notes)
	}
	order.ReviewedAt = &now

	switch req.Judgment {
	case "approve":
		order.Status = "approved"
		order.NeedsReview = false
	case "reject":
		order.Status = "rejected"
		order.NeedsReview = false
	case "supplement":
		order.Status = "pending_supplement"
		order.NeedsReview = true
	default:
		return nil, &model.APIError{
			Code:    model.ErrCodeInvalidStatus,
			Message: "无效的判定类型",
			Details: "判定类型必须是 approve、reject 或 supplement",
		}
	}

	if err := s.orderRepo.Update(order); err != nil {
		return nil, &model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "更新处理单失败",
			Details: err.Error(),
		}
	}

	s.loadJudgmentHistory(order)
	return order, nil
}

func (s *OrderService) ProcessSupplement(req *model.SupplementRequest) (*model.ProcessingOrder, *model.APIError) {
	order, err := s.orderRepo.GetByOrderNo(req.OrderNo)
	if err != nil {
		return nil, &model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "查询处理单失败",
			Details: err.Error(),
		}
	}
	if order == nil {
		return nil, &model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "处理单不存在",
			Details: fmt.Sprintf("处理单号 %s 未找到", req.OrderNo),
		}
	}

	if order.Status != "pending_supplement" {
		s.loadJudgmentHistory(order)
		return order, &model.APIError{
			Code:    model.ErrCodeNeedsReview,
			Message: "状态不允许补证",
			Details: fmt.Sprintf("处理单当前状态为 %s，只有 pending_supplement 状态可以补证", order.Status),
		}
	}

	now := time.Now()
	if order.ReviewNotes == "" {
		order.ReviewNotes = fmt.Sprintf("[补证材料 %s]: %s", req.SubmittedBy, req.Evidence)
	} else {
		order.ReviewNotes = fmt.Sprintf("%s\n[补证材料 %s]: %s", order.ReviewNotes, req.SubmittedBy, req.Evidence)
	}
	order.ReviewedAt = &now
	order.Status = "needs_review"
	order.NeedsReview = true

	if err := s.orderRepo.Update(order); err != nil {
		return nil, &model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "更新处理单失败",
			Details: err.Error(),
		}
	}

	s.loadJudgmentHistory(order)
	return order, nil
}

func (s *OrderService) GetOrder(orderNo string) (*model.ProcessingOrder, *model.APIError) {
	order, err := s.orderRepo.GetByOrderNo(orderNo)
	if err != nil {
		return nil, &model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "查询处理单失败",
			Details: err.Error(),
		}
	}
	if order == nil {
		return nil, &model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "处理单不存在",
			Details: fmt.Sprintf("处理单号 %s 未找到", orderNo),
		}
	}

	s.loadJudgmentHistory(order)

	if order.NeedsReview && (order.Status == "pending" || order.Status == "needs_review") {
		return order, &model.APIError{
			Code:    model.ErrCodeNeedsReview,
			Message: "需要复核",
			Details: "该处理单设置为需要复核，请完成复核后再进行操作",
		}
	}

	return order, nil
}

func (s *OrderService) ListOrders() ([]model.ProcessingOrder, *model.APIError) {
	orders, err := s.orderRepo.ListAll()
	if err != nil {
		return nil, &model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "查询处理单列表失败",
			Details: err.Error(),
		}
	}

	for i := range orders {
		s.loadJudgmentHistory(&orders[i])
	}

	return orders, nil
}

func (s *OrderService) loadJudgmentHistory(order *model.ProcessingOrder) {
	history, err := s.judgmentRepo.GetByOrderID(order.ID)
	if err == nil {
		order.JudgmentHistory = history
	}
}
