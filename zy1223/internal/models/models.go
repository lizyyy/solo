package models

import (
	"time"
)

type AnalysisSession struct {
	ID        int64     `json:"id" db:"id"`
	StartTime time.Time `json:"start_time" db:"start_time"`
	EndTime   time.Time `json:"end_time" db:"end_time"`
	Status    string    `json:"status" db:"status"`
	TotalCases int      `json:"total_cases" db:"total_cases"`
	IssuesFound int      `json:"issues_found" db:"issues_found"`
}

type InterfaceCase struct {
	ID          int64  `json:"id" db:"id"`
	SessionID   int64  `json:"session_id" db:"session_id"`
	CaseName    string `json:"case_name" db:"case_name"`
	Category    string `json:"category" db:"category"`
	Description string `json:"description" db:"description"`
	SourceFile  string `json:"source_file" db:"source_file"`
	LineNumber  int    `json:"line_number" db:"line_number"`
}

type AnalysisIssue struct {
	ID          int64  `json:"id" db:"id"`
	SessionID   int64  `json:"session_id" db:"session_id"`
	CaseID      int64  `json:"case_id" db:"case_id"`
	IssueType   string `json:"issue_type" db:"issue_type"`
	Severity    string `json:"severity" db:"severity"`
	Description string `json:"description" db:"description"`
	Location    string `json:"location" db:"location"`
	Suggestion  string `json:"suggestion" db:"suggestion"`
}

type MethodSetInfo struct {
	ID            int64  `json:"id" db:"id"`
	CaseID        int64  `json:"case_id" db:"case_id"`
	TypeName      string `json:"type_name" db:"type_name"`
	ReceiverType  string `json:"receiver_type" db:"receiver_type"`
	MethodName    string `json:"method_name" db:"method_name"`
	Signature     string `json:"signature" db:"signature"`
	IsValueMethod bool   `json:"is_value_method" db:"is_value_method"`
	IsPtrMethod   bool   `json:"is_ptr_method" db:"is_ptr_method"`
}

type TypeAssertionInfo struct {
	ID           int64  `json:"id" db:"id"`
	CaseID       int64  `json:"case_id" db:"case_id"`
	Location     string `json:"location" db:"location"`
	InterfaceType string `json:"interface_type" db:"interface_type"`
	TargetType   string `json:"target_type" db:"target_type"`
	IsTypeSwitch bool   `json:"is_type_switch" db:"is_type_switch"`
	HasCommaOk   bool   `json:"has_comma_ok" db:"has_comma_ok"`
	RiskLevel    string `json:"risk_level" db:"risk_level"`
}

type AllocationRisk struct {
	ID          int64  `json:"id" db:"id"`
	CaseID      int64  `json:"case_id" db:"case_id"`
	Location    string `json:"location" db:"location"`
	Description string `json:"description" db:"description"`
	RiskType    string `json:"risk_type" db:"risk_type"`
	Example     string `json:"example" db:"example"`
}
