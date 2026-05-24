package export

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"damage-arbitration/internal/database"
	"damage-arbitration/internal/models"
)

type ExportService struct{}

func NewExportService() *ExportService {
	return &ExportService{}
}

func (s *ExportService) ExportToJSON(query *models.QueryRequest) ([]byte, error) {
	list, _, err := database.QueryArbitrations(query)
	if err != nil {
		return nil, err
	}

	var result []models.ArbitrationDetailResponse
	for _, a := range list {
		detail, err := s.getFullDetail(a.ID)
		if err != nil {
			continue
		}
		result = append(result, *detail)
	}

	return json.MarshalIndent(result, "", "  ")
}

func (s *ExportService) ExportToCSV(query *models.QueryRequest) ([]byte, error) {
	list, _, err := database.QueryArbitrations(query)
	if err != nil {
		return nil, err
	}

	records := [][]string{
		{"仲裁ID", "订单号", "车辆ID", "用户ID", "状态", "取车时间", "还车时间", "处理人", "损伤数量", "是否有申诉", "最终结果", "退款金额", "创建时间", "更新时间"},
	}

	for _, a := range list {
		damages, _ := database.GetDamagesByArbitrationID(a.ID)
		appeal, _ := database.GetAppealByArbitrationID(a.ID)
		conclusion, _ := database.GetConclusionByArbitrationID(a.ID)

		pickupTime := ""
		if a.PickupTime != nil {
			pickupTime = a.PickupTime.Format(time.RFC3339)
		}
		returnTime := ""
		if a.ReturnTime != nil {
			returnTime = a.ReturnTime.Format(time.RFC3339)
		}
		handlerID := ""
		if a.HandlerID != nil {
			handlerID = *a.HandlerID
		}

		finalResult := ""
		refundAmount := ""
		if conclusion != nil {
			finalResult = conclusion.FinalResult
			refundAmount = fmt.Sprintf("%.2f", conclusion.RefundAmount)
		}

		records = append(records, []string{
			strconv.FormatInt(a.ID, 10),
			a.OrderID,
			a.VehicleID,
			a.UserID,
			string(a.Status),
			pickupTime,
			returnTime,
			handlerID,
			strconv.Itoa(len(damages)),
			strconv.FormatBool(appeal != nil),
			finalResult,
			refundAmount,
			a.CreatedAt.Format(time.RFC3339),
			a.UpdatedAt.Format(time.RFC3339),
		})
	}

	buf := &csvBuffer{}
	writer := csv.NewWriter(buf)
	if err := writer.WriteAll(records); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

func (s *ExportService) ExportDamageDetailCSV(arbitrationID int64) ([]byte, error) {
	damages, err := database.GetDamagesByArbitrationID(arbitrationID)
	if err != nil {
		return nil, err
	}

	records := [][]string{
		{"损伤ID", "类型", "位置", "严重程度", "描述", "是否新增", "扣费金额", "是否已扣费", "匹配历史ID", "创建时间"},
	}

	for _, d := range damages {
		matchedDamageID := ""
		if d.MatchedDamageID != nil {
			matchedDamageID = strconv.FormatInt(*d.MatchedDamageID, 10)
		}

		records = append(records, []string{
			strconv.FormatInt(d.ID, 10),
			string(d.DamageType),
			d.Location,
			d.Severity,
			d.Description,
			strconv.FormatBool(d.IsNew),
			fmt.Sprintf("%.2f", d.DeductAmount),
			strconv.FormatBool(d.FeeCharged),
			matchedDamageID,
			d.CreatedAt.Format(time.RFC3339),
		})
	}

	buf := &csvBuffer{}
	writer := csv.NewWriter(buf)
	if err := writer.WriteAll(records); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

func (s *ExportService) ExportLogsCSV(arbitrationID int64) ([]byte, error) {
	logs, err := database.GetLogsByArbitrationID(arbitrationID)
	if err != nil {
		return nil, err
	}

	records := [][]string{
		{"日志ID", "操作", "操作人ID", "操作人姓名", "原状态", "新状态", "备注", "操作时间"},
	}

	for _, l := range logs {
		records = append(records, []string{
			strconv.FormatInt(l.ID, 10),
			l.Action,
			l.OperatorID,
			l.OperatorName,
			l.OldStatus,
			l.NewStatus,
			l.Remark,
			l.CreatedAt.Format(time.RFC3339),
		})
	}

	buf := &csvBuffer{}
	writer := csv.NewWriter(buf)
	if err := writer.WriteAll(records); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

func (s *ExportService) getFullDetail(id int64) (*models.ArbitrationDetailResponse, error) {
	arbitration, err := database.GetArbitrationByID(id)
	if err != nil {
		return nil, err
	}

	damages, err := database.GetDamagesByArbitrationID(id)
	if err != nil {
		return nil, err
	}

	photos, err := database.GetPhotosByArbitrationID(id)
	if err != nil {
		return nil, err
	}

	appeal, err := database.GetAppealByArbitrationID(id)
	if err != nil {
		return nil, err
	}

	logs, err := database.GetLogsByArbitrationID(id)
	if err != nil {
		return nil, err
	}

	conclusion, err := database.GetConclusionByArbitrationID(id)
	if err != nil {
		return nil, err
	}

	return &models.ArbitrationDetailResponse{
		Arbitration: arbitration,
		Damages:     damages,
		Photos:      photos,
		Appeal:      appeal,
		Logs:        logs,
		Conclusion:  conclusion,
	}, nil
}

type csvBuffer struct {
	data []byte
}

func (b *csvBuffer) Write(p []byte) (n int, err error) {
	b.data = append(b.data, p...)
	return len(p), nil
}

func (b *csvBuffer) Bytes() []byte {
	return b.data
}
