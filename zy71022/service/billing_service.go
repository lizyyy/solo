package service

import (
	"sort"
	"time"
	"watermeter-api/models"
	"watermeter-api/utils"

	"gorm.io/gorm"
)

type BillingService struct {
	db *gorm.DB
}

func NewBillingService(db *gorm.DB) *BillingService {
	return &BillingService{db: db}
}

type TierCalculation struct {
	TierLevel int
	TierName  string
	Usage     float64
	PricePerTon float64
	Amount    float64
}

func (s *BillingService) CalculateTieredUsage(totalUsage float64, queryDate time.Time) ([]TierCalculation, float64) {
	var tiers []models.TierPrice
	s.db.Where("effective_date <= ? AND expire_date >= ? AND is_active = ?", 
		queryDate, queryDate, true).
		Order("tier_level ASC").
		Find(&tiers)

	if len(tiers) == 0 {
		tiers = s.getDefaultTiers()
	}

	results := make([]TierCalculation, 0)
	remainingUsage := totalUsage
	totalAmount := 0.0

	for _, tier := range tiers {
		tierUsage := 0.0
		tierRange := tier.MaxUsage - tier.MinUsage

		if tier.MaxUsage == 0 {
			tierUsage = remainingUsage
		} else if remainingUsage > tierRange {
			tierUsage = tierRange
		} else {
			tierUsage = remainingUsage
		}

		if tierUsage <= 0 {
			tierUsage = remainingUsage
		}

		amount := utils.RoundToTwoDecimals(tierUsage * tier.PricePerTon)
		results = append(results, TierCalculation{
			TierLevel: tier.TierLevel,
			TierName:  tier.TierName,
			Usage:     tierUsage,
			PricePerTon: tier.PricePerTon,
			Amount:    amount,
		})

		totalAmount += amount
		remainingUsage -= tierUsage

		if remainingUsage <= 0 {
			break
		}
	}

	return results, totalAmount
}

func (s *BillingService) getDefaultTiers() []models.TierPrice {
	return []models.TierPrice{
		{TierLevel: 1, TierName: "第一阶梯", MinUsage: 0, MaxUsage: 15, PricePerTon: 2.80},
		{TierLevel: 2, TierName: "第二阶梯", MinUsage: 15, MaxUsage: 30, PricePerTon: 4.20},
		{TierLevel: 3, TierName: "第三阶梯", MinUsage: 30, MaxUsage: 0, PricePerTon: 8.40},
	}
}

func (s *BillingService) CalculateBillWithLeakDeduction(
	meterNo string,
	billCycle string,
	leakRecords []models.LeakRecord,
) (models.BillRecord, error) {
	var bill models.BillRecord
	err := s.db.Where("meter_no = ? AND bill_cycle = ?", meterNo, billCycle).First(&bill).Error
	if err != nil {
		return bill, err
	}

	billStart, billEnd := getBillCycleDates(billCycle)

	totalLeakDays := 0
	totalLeakAmount := 0.0
	for _, leak := range leakRecords {
		overlapDays := utils.OverlapDays(leak.LeakStartDate, leak.LeakEndDate, billStart, billEnd)
		if overlapDays > 0 {
			leakAmount := float64(overlapDays) * leak.DailyLeakAmount
			totalLeakDays += overlapDays
			totalLeakAmount += leakAmount
		}
	}

	adjustedUsage := bill.Usage - totalLeakAmount
	if adjustedUsage < 0 {
		adjustedUsage = 0
	}

	_, adjustedAmount := s.CalculateTieredUsage(adjustedUsage, billStart)

	bill.IsAdjusted = true
	bill.AdjustedAmount = adjustedAmount
	bill.AdjustReason = "漏水核减: 漏水天数 " + string(rune(totalLeakDays)) + " 天, 核减水量 " + floatToStr(totalLeakAmount) + " 吨"

	return bill, nil
}

func (s *BillingService) RecalculateAppealBills(appealNo string) (*models.RecalculateResult, error) {
	var appeal models.Appeal
	err := s.db.Where("appeal_no = ?", appealNo).First(&appeal).Error
	if err != nil {
		return nil, err
	}

	var bills []models.BillRecord
	s.db.Where("meter_no = ? AND bill_cycle >= ? AND bill_cycle <= ?",
		appeal.MeterNo, appeal.StartBillCycle, appeal.EndBillCycle).
		Order("bill_cycle ASC").
		Find(&bills)

	var leaks []models.LeakRecord
	s.db.Where("meter_no = ? AND is_confirmed = ?", appeal.MeterNo, true).
		Find(&leaks)

	result := &models.RecalculateResult{
		BillDetails: make([]models.BillAdjustDetail, 0),
	}

	for _, bill := range bills {
		billStart, _ := getBillCycleDates(bill.BillCycle)

		leakDeduction := 0.0
		for _, leak := range leaks {
			leakEnd := leak.LeakEndDate
			if leakEnd.IsZero() {
				leakEnd = time.Now()
			}
			overlapDays := utils.OverlapDays(leak.LeakStartDate, leakEnd, billStart, billStart.AddDate(0, 1, 0))
			if overlapDays > 0 {
				leakDeduction += float64(overlapDays) * leak.DailyLeakAmount
			}
		}

		adjustedUsage := bill.Usage - leakDeduction
		if adjustedUsage < 0 {
			adjustedUsage = 0
		}

		_, adjustedAmount := s.CalculateTieredUsage(adjustedUsage, billStart)
		difference := bill.TotalAmount - adjustedAmount

		result.OriginalTotal += bill.TotalAmount
		result.AdjustedTotal += adjustedAmount
		if difference > 0 {
			result.RefundAmount += difference
		}

		result.BillDetails = append(result.BillDetails, models.BillAdjustDetail{
			BillCycle:      bill.BillCycle,
			OriginalUsage:  bill.Usage,
			AdjustedUsage:  adjustedUsage,
			LeakDeduction:  leakDeduction,
			OriginalAmount: bill.TotalAmount,
			AdjustedAmount: adjustedAmount,
			Difference:     difference,
		})
	}

	result.RefundAmount = utils.RoundToTwoDecimals(result.RefundAmount)
	result.OriginalTotal = utils.RoundToTwoDecimals(result.OriginalTotal)
	result.AdjustedTotal = utils.RoundToTwoDecimals(result.AdjustedTotal)

	return result, nil
}

func getBillCycleDates(billCycle string) (time.Time, time.Time) {
	start, _ := utils.ParseBillCycle(billCycle)
	end := start.AddDate(0, 1, -1)
	return start, end
}

func (s *BillingService) GetReadingsByBillCycle(meterNo string, startCycle, endCycle string) []models.MeterReading {
	var readings []models.MeterReading
	s.db.Where("meter_no = ? AND bill_cycle >= ? AND bill_cycle <= ?",
		meterNo, startCycle, endCycle).
		Order("reading_date ASC").
		Find(&readings)
	return readings
}

func (s *BillingService) CheckReadingReverse(readings []models.MeterReading) []string {
	anomalies := make([]string, 0)
	sort.Slice(readings, func(i, j int) bool {
		return readings[i].ReadingDate.Before(readings[j].ReadingDate)
	})

	for i := 1; i < len(readings); i++ {
		if readings[i].Reading < readings[i-1].Reading {
			anomalies = append(anomalies, 
				"读数倒挂: "+readings[i].ReadingDate.Format("2006-01-02")+
					" 读数 "+floatToStr(readings[i].Reading)+
					" < 前次 "+floatToStr(readings[i-1].Reading))
		}
	}
	return anomalies
}
