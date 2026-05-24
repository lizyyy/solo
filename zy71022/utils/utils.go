package utils

import (
	"fmt"
	"sync/atomic"
	"time"
)

var billCounter uint64

func GenerateAppealNo() string {
	now := time.Now()
	counter := atomic.AddUint64(&billCounter, 1)
	return fmt.Sprintf("AP%s%06d", now.Format("20060102150405"), counter)
}

func GenerateReportNo() string {
	now := time.Now()
	counter := atomic.AddUint64(&billCounter, 1)
	return fmt.Sprintf("RP%s%06d", now.Format("20060102150405"), counter)
}

func GenerateBillNo() string {
	now := time.Now()
	counter := atomic.AddUint64(&billCounter, 1)
	return fmt.Sprintf("BL%s%06d", now.Format("20060102150405"), counter)
}

func GetBillCycle(date time.Time) string {
	return date.Format("2006-01")
}

func ParseBillCycle(billCycle string) (time.Time, error) {
	return time.Parse("2006-01", billCycle)
}

func DaysBetween(start, end time.Time) int {
	start = start.Truncate(24 * time.Hour)
	end = end.Truncate(24 * time.Hour)
	diff := end.Sub(start)
	return int(diff.Hours() / 24)
}

func OverlapDays(start1, end1, start2, end2 time.Time) int {
	latestStart := start1
	if start2.After(latestStart) {
		latestStart = start2
	}
	earliestEnd := end1
	if end2.Before(earliestEnd) {
		earliestEnd = end2
	}
	if latestStart.After(earliestEnd) {
		return 0
	}
	return DaysBetween(latestStart, earliestEnd) + 1
}

func RoundToTwoDecimals(value float64) float64 {
	return float64(int(value*100+0.5)) / 100
}
