package export

import (
	"encoding/csv"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"lensrent/internal/models"
)

type Exporter struct{}

func New() *Exporter {
	return &Exporter{}
}

func (e *Exporter) ExportRentalsToCSV(rentals []models.Rental, outputPath string) error {
	if err := ensureDir(outputPath); err != nil {
		return err
	}

	file, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("创建文件失败: %w", err)
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	headers := []string{
		"订单ID", "器材ID", "器材名称", "租客ID", "租客姓名", "租客电话",
		"借出日期", "计划归还", "实际归还", "押金", "日租金",
		"出库配件", "归还配件", "缺失配件",
		"逾期天数", "逾期费用", "缺失扣款", "赔付金额",
		"应退押金", "状态", "创建时间", "更新时间",
	}
	if err := writer.Write(headers); err != nil {
		return fmt.Errorf("写入表头失败: %w", err)
	}

	for _, r := range rentals {
		row := []string{
			r.ID,
			r.EquipmentID,
			r.EquipmentName,
			r.RenterID,
			r.RenterName,
			r.RenterPhone,
			r.RentalStart,
			r.RentalEnd,
			r.ActualReturn,
			fmt.Sprintf("%.2f", r.DepositPaid),
			fmt.Sprintf("%.2f", r.DailyRate),
			strings.Join(r.AccessoriesOut, "; "),
			strings.Join(r.AccessoriesBack, "; "),
			strings.Join(r.MissingAccessories, "; "),
			strconv.Itoa(r.OverdueDays),
			fmt.Sprintf("%.2f", r.OverdueFee),
			fmt.Sprintf("%.2f", r.MissingFee),
			fmt.Sprintf("%.2f", r.CompensationAmount),
			fmt.Sprintf("%.2f", r.RefundAmount),
			r.Status,
			r.CreatedAt,
			r.UpdatedAt,
		}
		if err := writer.Write(row); err != nil {
			return fmt.Errorf("写入行失败: %w", err)
		}
	}

	return nil
}

func (e *Exporter) ExportDisputesToCSV(disputes []models.DisputeRecord, outputPath string) error {
	if err := ensureDir(outputPath); err != nil {
		return err
	}

	file, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("创建文件失败: %w", err)
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	headers := []string{
		"争议ID", "关联订单ID", "器材", "租客",
		"问题类型", "描述", "处理方案", "金额", "时间",
	}
	if err := writer.Write(headers); err != nil {
		return fmt.Errorf("写入表头失败: %w", err)
	}

	for _, d := range disputes {
		row := []string{
			d.ID,
			d.RentalID,
			d.EquipmentName,
			d.RenterName,
			d.IssueType,
			d.Description,
			d.Resolution,
			fmt.Sprintf("%.2f", d.Amount),
			d.Timestamp,
		}
		if err := writer.Write(row); err != nil {
			return fmt.Errorf("写入行失败: %w", err)
		}
	}

	return nil
}

func (e *Exporter) ExportSingleRentalDetail(rental *models.Rental, outputPath string) error {
	if err := ensureDir(outputPath); err != nil {
		return err
	}

	file, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("创建文件失败: %w", err)
	}
	defer file.Close()

	lines := []string{
		"========== 订单详情 ==========",
		fmt.Sprintf("订单ID:   %s", rental.ID),
		fmt.Sprintf("状态:     %s", rental.Status),
		"",
		"---------- 器材信息 ----------",
		fmt.Sprintf("器材:     %s (%s)", rental.EquipmentName, rental.EquipmentID),
		"",
		"---------- 租客信息 ----------",
		fmt.Sprintf("姓名:     %s", rental.RenterName),
		fmt.Sprintf("电话:     %s", rental.RenterPhone),
		"",
		"---------- 租期信息 ----------",
		fmt.Sprintf("借出日期: %s", rental.RentalStart),
		fmt.Sprintf("计划归还: %s", rental.RentalEnd),
		fmt.Sprintf("实际归还: %s", rental.ActualReturn),
		"",
		"---------- 配件清单 ----------",
		fmt.Sprintf("出库配件: %v", rental.AccessoriesOut),
		fmt.Sprintf("归还配件: %v", rental.AccessoriesBack),
		"",
		"---------- 费用明细 ----------",
		fmt.Sprintf("押金已付: %.2f 元", rental.DepositPaid),
		fmt.Sprintf("日租金:   %.2f 元", rental.DailyRate),
		"",
	}

	if rental.IsReturned {
		lines = append(lines, "---------- 结算明细 ----------")
		if rental.OverdueDays > 0 {
			lines = append(lines, fmt.Sprintf("逾期天数: %d 天", rental.OverdueDays))
			lines = append(lines, fmt.Sprintf("逾期费用: %.2f 元", rental.OverdueFee))
		}
		if len(rental.MissingAccessories) > 0 {
			lines = append(lines, fmt.Sprintf("缺失配件: %v", rental.MissingAccessories))
			lines = append(lines, fmt.Sprintf("缺失扣款: %.2f 元", rental.MissingFee))
		}
		if rental.IsCompensated {
			lines = append(lines, fmt.Sprintf("赔付金额: %.2f 元", rental.CompensationAmount))
			lines = append(lines, fmt.Sprintf("赔付说明: %s", rental.CompensationNote))
		}
		lines = append(lines, "---------- 最终结算 ----------")
		lines = append(lines, fmt.Sprintf("应退押金: %.2f 元", rental.RefundAmount))
	}

	lines = append(lines, "========== 订单详情结束 ==========")

	for _, line := range lines {
		if _, err := file.WriteString(line + "\n"); err != nil {
			return fmt.Errorf("写入内容失败: %w", err)
		}
	}

	return nil
}

func (e *Exporter) ExportDisputeSummary(db *models.Database, outputPath string) error {
	if err := ensureDir(outputPath); err != nil {
		return err
	}

	file, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("创建文件失败: %w", err)
	}
	defer file.Close()

	totalDisputes := len(db.Disputes)
	totalAmount := 0.0
	for _, d := range db.Disputes {
		totalAmount += d.Amount
	}

	lines := []string{
		"========== 争议处理汇总报告 ==========",
		"",
		fmt.Sprintf("生成时间: %s", db.LastModified),
		fmt.Sprintf("总争议数: %d", totalDisputes),
		fmt.Sprintf("争议总金额: %.2f 元", totalAmount),
		"",
		"---------- 详细记录 ----------",
		"",
	}

	for _, d := range db.Disputes {
		lines = append(lines, fmt.Sprintf("【%s】订单 %s - %s", d.ID, d.RentalID, d.IssueType))
		lines = append(lines, fmt.Sprintf("  器材: %s | 租客: %s", d.EquipmentName, d.RenterName))
		lines = append(lines, fmt.Sprintf("  描述: %s", d.Description))
		lines = append(lines, fmt.Sprintf("  处理: %s", d.Resolution))
		lines = append(lines, fmt.Sprintf("  金额: %.2f 元", d.Amount))
		lines = append(lines, "")
	}

	lines = append(lines, "========== 报告结束 ==========")

	for _, line := range lines {
		if _, err := file.WriteString(line + "\n"); err != nil {
			return fmt.Errorf("写入内容失败: %w", err)
		}
	}

	return nil
}

func ensureDir(path string) error {
	dir := filepath.Dir(path)
	if dir != "." && dir != "" {
		return os.MkdirAll(dir, 0755)
	}
	return nil
}

type ImportResult struct {
	TotalRows     int
	Imported      int
	Skipped       int
	Failed        int
	SkippedIDs    []string
	FailedDetails []string
}

func (e *Exporter) ImportRentalsFromCSV(csvPath string) (*[]models.Rental, *ImportResult, error) {
	file, err := os.Open(csvPath)
	if err != nil {
		return nil, nil, fmt.Errorf("打开文件失败: %w", err)
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.TrimLeadingSpace = true

	records, err := reader.ReadAll()
	if err != nil {
		return nil, nil, fmt.Errorf("读取CSV失败: %w", err)
	}

	if len(records) < 2 {
		return nil, nil, fmt.Errorf("CSV文件为空或只有表头")
	}

	result := &ImportResult{
		TotalRows:     len(records) - 1,
		Imported:      0,
		Skipped:       0,
		Failed:        0,
		SkippedIDs:    []string{},
		FailedDetails: []string{},
	}

	headerMap := make(map[string]int)
	for i, h := range records[0] {
		headerMap[strings.TrimSpace(h)] = i
	}

	rentals := []models.Rental{}

	for rowIdx, row := range records[1:] {
		if len(row) < 3 {
			result.Failed++
			result.FailedDetails = append(result.FailedDetails, fmt.Sprintf("第%d行: 列数不足", rowIdx+2))
			continue
		}

		getCol := func(name string) string {
			if idx, ok := headerMap[name]; ok && idx < len(row) {
				return strings.TrimSpace(row[idx])
			}
			return ""
		}

		rentalID := getCol("订单ID")
		equipmentID := getCol("器材ID")
		equipmentName := getCol("器材名称")
		renterID := getCol("租客ID")
		renterName := getCol("租客姓名")
		renterPhone := getCol("租客电话")
		rentalStart := getCol("借出日期")
		rentalEnd := getCol("计划归还")
		actualReturn := getCol("实际归还")
		depositPaidStr := getCol("押金")
		dailyRateStr := getCol("日租金")
		accessoriesOutStr := getCol("出库配件")
		accessoriesBackStr := getCol("归还配件")
		missingAccessoriesStr := getCol("缺失配件")
		overdueDaysStr := getCol("逾期天数")
		overdueFeeStr := getCol("逾期费用")
		missingFeeStr := getCol("缺失扣款")
		compensationAmountStr := getCol("赔付金额")
		refundAmountStr := getCol("应退押金")
		status := getCol("状态")

		depositPaid, _ := strconv.ParseFloat(depositPaidStr, 64)
		dailyRate, _ := strconv.ParseFloat(dailyRateStr, 64)
		overdueDays, _ := strconv.Atoi(overdueDaysStr)
		overdueFee, _ := strconv.ParseFloat(overdueFeeStr, 64)
		missingFee, _ := strconv.ParseFloat(missingFeeStr, 64)
		compensationAmount, _ := strconv.ParseFloat(compensationAmountStr, 64)
		refundAmount, _ := strconv.ParseFloat(refundAmountStr, 64)

		parseAccessories := func(s string) []string {
			if s == "" {
				return []string{}
			}
			parts := strings.Split(s, ";")
			result := []string{}
			for _, p := range parts {
				p = strings.TrimSpace(p)
				if p != "" {
					result = append(result, p)
				}
			}
			return result
		}

		if rentalID == "" {
			result.Failed++
			result.FailedDetails = append(result.FailedDetails, fmt.Sprintf("第%d行: 订单ID为空", rowIdx+2))
			continue
		}

		if equipmentID == "" || equipmentName == "" {
			result.Failed++
			result.FailedDetails = append(result.FailedDetails, fmt.Sprintf("第%d行: 器材信息不完整", rowIdx+2))
			continue
		}

		isReturned := strings.ToUpper(status) == "RETURNED" || strings.Contains(strings.ToUpper(status), "归还")
		isCompensated := compensationAmount > 0

		if actualReturn == "" && isReturned {
			actualReturn = rentalEnd
		}

		rental := models.Rental{
			ID:                 rentalID,
			EquipmentID:        equipmentID,
			EquipmentName:      equipmentName,
			RenterID:           renterID,
			RenterName:         renterName,
			RenterPhone:        renterPhone,
			RentalStart:        rentalStart,
			RentalEnd:          rentalEnd,
			ActualReturn:       actualReturn,
			DepositPaid:        depositPaid,
			DailyRate:          dailyRate,
			AccessoriesOut:     parseAccessories(accessoriesOutStr),
			OutChecklist:       []models.CheckItem{},
			OutVerified:        true,
			AccessoriesBack:    parseAccessories(accessoriesBackStr),
			InChecklist:        []models.CheckItem{},
			InVerified:         isReturned,
			IsReturned:         isReturned,
			IsCompensated:      isCompensated,
			CompensationAmount: compensationAmount,
			CompensationNote:   "",
			OverdueDays:        overdueDays,
			OverdueFee:         overdueFee,
			MissingAccessories: parseAccessories(missingAccessoriesStr),
			MissingFee:         missingFee,
			RefundAmount:       refundAmount,
			FinalBalance:       refundAmount,
			Status:             status,
			CreatedAt:          "",
			UpdatedAt:          "",
		}

		rentals = append(rentals, rental)
	}

	return &rentals, result, nil
}
