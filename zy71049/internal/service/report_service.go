package service

import (
	"encoding/csv"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"print-proof-api/internal/dao"
	"print-proof-api/internal/model"
)

type ReportService struct{}

func NewReportService() *ReportService {
	return &ReportService{}
}

type CreateReportRequest struct {
	OrderID        string
	ProofVersionID string
	ProductionDate string
	ActualQuantity int
	Result         string
	GeneratedBy    string
}

func (rs *ReportService) CheckDuplicateProduction(versionID string) (bool, error) {
	return dao.HasProductionReport(versionID)
}

func (rs *ReportService) CheckCanProduce(versionID string) (bool, string, error) {
	version, err := dao.GetProofVersionByID(versionID)
	if err != nil {
		return false, "", fmt.Errorf("failed to get version: %w", err)
	}
	if version == nil {
		return false, "version not found", nil
	}

	if !version.IsFinalVersion {
		return false, "version is not finalized", nil
	}

	if version.Status != model.VersionStatusFinalized {
		return false, "version status is not finalized", nil
	}

	hasReport, err := rs.CheckDuplicateProduction(versionID)
	if err != nil {
		return false, "", err
	}
	if hasReport {
		return false, "duplicate production report exists", nil
	}

	return true, "", nil
}

func (rs *ReportService) CreateReport(req *CreateReportRequest) (*model.ProductionReport, error) {
	canProduce, reason, err := rs.CheckCanProduce(req.ProofVersionID)
	if err != nil {
		return nil, err
	}
	if !canProduce {
		return nil, fmt.Errorf("cannot create report: %s", reason)
	}

	reportNo := fmt.Sprintf("RPT-%s-%d", time.Now().Format("20060102"), time.Now().Unix()%10000)

	report := &model.ProductionReport{
		OrderID:        req.OrderID,
		ProofVersionID: req.ProofVersionID,
		ReportNo:       reportNo,
		ProductionDate: req.ProductionDate,
		ActualQuantity: req.ActualQuantity,
		Result:         req.Result,
		GeneratedBy:    req.GeneratedBy,
	}

	if err := dao.CreateProductionReport(report); err != nil {
		return nil, fmt.Errorf("failed to create report: %w", err)
	}

	if err := dao.UpdateOrderStatus(req.OrderID, model.OrderStatusProducing); err != nil {
		return nil, fmt.Errorf("failed to update order status: %w", err)
	}

	return report, nil
}

type VersionDetail struct {
	Version     *model.ProofVersion  `json:"version"`
	Colors      []*model.ColorValue  `json:"colors"`
	Confirmations []*model.Confirmation `json:"confirmations"`
	ChangeLogs  []*model.ChangeLog   `json:"change_logs"`
	Paper       *model.Paper         `json:"paper"`
}

func (rs *ReportService) GetVersionDetail(versionID string) (*VersionDetail, error) {
	version, err := dao.GetProofVersionByID(versionID)
	if err != nil {
		return nil, err
	}
	if version == nil {
		return nil, fmt.Errorf("version not found")
	}

	colors, err := dao.GetColorValuesByVersion(versionID)
	if err != nil {
		return nil, err
	}

	confirmations, err := dao.GetConfirmationsByVersion(versionID)
	if err != nil {
		return nil, err
	}

	changeLogs, err := dao.GetChangeLogsByVersion(versionID)
	if err != nil {
		return nil, err
	}

	var paper *model.Paper
	if version.PaperID != "" {
		paper, _ = dao.GetPaperByID(version.PaperID)
	}

	return &VersionDetail{
		Version:       version,
		Colors:        colors,
		Confirmations: confirmations,
		ChangeLogs:    changeLogs,
		Paper:         paper,
	}, nil
}

func (rs *ReportService) ExportVersionDetail(versionID, outputDir string) (string, error) {
	detail, err := rs.GetVersionDetail(versionID)
	if err != nil {
		return "", err
	}

	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create output dir: %w", err)
	}

	filename := fmt.Sprintf("version_%s_%s.csv", versionID, time.Now().Format("20060102_150405"))
	filepath := filepath.Join(outputDir, filename)

	file, err := os.Create(filepath)
	if err != nil {
		return "", fmt.Errorf("failed to create file: %w", err)
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	writer.Write([]string{"=== 打样版本信息 ==="})
	writer.Write([]string{"版本号", strconv.Itoa(detail.Version.VersionNo)})
	writer.Write([]string{"状态", detail.Version.Status})
	writer.Write([]string{"颜色已确认", strconv.FormatBool(detail.Version.IsColorApproved)})
	writer.Write([]string{"纸张已确认", strconv.FormatBool(detail.Version.IsPaperApproved)})
	writer.Write([]string{"最终版本", strconv.FormatBool(detail.Version.IsFinalVersion)})
	writer.Write([]string{"创建人", detail.Version.CreatedBy})
	writer.Write([]string{"创建时间", detail.Version.CreatedAt.String()})
	writer.Write([]string{})

	if detail.Paper != nil {
		writer.Write([]string{"=== 纸张信息 ==="})
		writer.Write([]string{"名称", detail.Paper.Name})
		writer.Write([]string{"类型", detail.Paper.Type})
		writer.Write([]string{"克重", strconv.Itoa(detail.Paper.Weight)})
		writer.Write([]string{"尺寸", detail.Paper.Size})
		writer.Write([]string{"已审批", strconv.FormatBool(detail.Paper.IsApproved)})
		writer.Write([]string{})
	}

	writer.Write([]string{"=== 色值信息 ==="})
	writer.Write([]string{"颜色名称", "类型", "C", "M", "Y", "K", "色域外"})
	for _, c := range detail.Colors {
		writer.Write([]string{
			c.ColorName,
			c.ColorType,
			strconv.Itoa(c.CValue),
			strconv.Itoa(c.MValue),
			strconv.Itoa(c.YValue),
			strconv.Itoa(c.KValue),
			strconv.FormatBool(c.IsOutOfGamut),
		})
	}
	writer.Write([]string{})

	writer.Write([]string{"=== 确认记录 ==="})
	writer.Write([]string{"确认人", "类型", "结果", "备注", "时间"})
	for _, conf := range detail.Confirmations {
		writer.Write([]string{
			conf.Confirmer,
			conf.ConfirmType,
			conf.Result,
			conf.Comments,
			conf.ConfirmedAt.String(),
		})
	}
	writer.Write([]string{})

	writer.Write([]string{"=== 变更日志 ==="})
	writer.Write([]string{"字段", "原值", "新值", "变更人", "类型", "时间"})
	for _, log := range detail.ChangeLogs {
		writer.Write([]string{
			log.FieldName,
			log.OldValue,
			log.NewValue,
			log.ChangedBy,
			log.ChangeType,
			log.ChangedAt.String(),
		})
	}

	return filepath, nil
}

type OrderSummary struct {
	Order       *model.Order           `json:"order"`
	Versions    []*model.ProofVersion  `json:"versions"`
	FinalVersion *model.ProofVersion   `json:"final_version"`
	Reports     []*model.ProductionReport `json:"reports"`
}

func (rs *ReportService) GetOrderSummary(orderID string) (*OrderSummary, error) {
	order, err := dao.GetOrderByID(orderID)
	if err != nil {
		return nil, err
	}
	if order == nil {
		return nil, fmt.Errorf("order not found")
	}

	versions, err := dao.GetProofVersionsByOrder(orderID)
	if err != nil {
		return nil, err
	}

	var finalVersion *model.ProofVersion
	for _, v := range versions {
		if v.IsFinalVersion {
			finalVersion = v
			break
		}
	}

	reports, err := dao.GetProductionReportsByOrder(orderID)
	if err != nil {
		return nil, err
	}

	return &OrderSummary{
		Order:        order,
		Versions:     versions,
		FinalVersion: finalVersion,
		Reports:      reports,
	}, nil
}
