package service

import (
	"fmt"
	"sort"
	"time"
	"watermeter-api/models"
)

type ReadingValidationResult struct {
	IsValid       bool
	Anomalies   []string
	ReverseInfo []ReverseReading
}

type ReverseReading struct {
	Date     time.Time
	PrevReading float64
	CurrReading float64
	Difference float64
}

func ValidateReadings(readings []models.MeterReading) ReadingValidationResult {
	result := ReadingValidationResult{
		IsValid:     true,
		Anomalies:   []string{},
		ReverseInfo: []ReverseReading{},
	}

	if len(readings) < 2 {
		return result
	}

	sort.Slice(readings, func(i, j int) bool {
		return readings[i].ReadingDate.Before(readings[j].ReadingDate)
	})

	for i := 1; i < len(readings); i++ {
		prev := readings[i-1]
		curr := readings[i]

		if curr.Reading < prev.Reading {
			result.IsValid = false
			diff := prev.Reading - curr.Reading
			result.Anomalies = append(result.Anomalies, 
				"读数倒挂: "+curr.ReadingDate.Format("2006-01-02")+
					" 读数 "+floatToStr(curr.Reading)+" 小于前次 "+floatToStr(prev.Reading))
			result.ReverseInfo = append(result.ReverseInfo, ReverseReading{
				Date:     curr.ReadingDate,
				PrevReading: prev.Reading,
				CurrReading: curr.Reading,
				Difference: diff,
			})
		}
	}

	return result
}

func floatToStr(f float64) string {
	return fmt.Sprintf("%.2f", f)
}
