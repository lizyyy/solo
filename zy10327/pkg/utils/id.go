package utils

import (
	"github.com/google/uuid"
)

func GenerateID() string {
	return uuid.New().String()
}

func GenerateTaskID() string {
	return "task-" + GenerateID()[:8]
}

func GenerateCheckItemID() string {
	return "check-" + GenerateID()[:8]
}

func GenerateRollbackPointID() string {
	return "rb-" + GenerateID()[:8]
}

func GenerateHistoryID() string {
	return "hist-" + GenerateID()[:8]
}

func GenerateReportID() string {
	return "rpt-" + GenerateID()[:8]
}

func GenerateDualWriteID() string {
	return "dw-" + GenerateID()[:8]
}
