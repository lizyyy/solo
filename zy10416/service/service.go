package service

import (
	"browser-compat-exemption-api/models"
	"browser-compat-exemption-api/storage"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"time"
)

var (
	validBrowsers = map[string]bool{
		"Chrome":  true,
		"Firefox": true,
		"Safari":  true,
		"Edge":    true,
		"IE":      true,
		"Opera":   true,
	}

	blockedPagePaths = []*regexp.Regexp{
		regexp.MustCompile(`^/login.*`),
		regexp.MustCompile(`^/payment.*`),
		regexp.MustCompile(`^/admin.*`),
	}
)

type CreateResult struct {
	Exemption   *models.Exemption
	Blocked     bool
	BlockReason string
}

func ValidateBrowserMatrix(matrix models.BrowserMatrix) error {
	if matrix.Browser == "" {
		return errors.New("browser is required")
	}
	if matrix.Version == "" {
		return errors.New("version is required")
	}
	if matrix.OS == "" {
		return errors.New("os is required")
	}
	if !validBrowsers[matrix.Browser] {
		return fmt.Errorf("unsupported browser: %s", matrix.Browser)
	}
	return nil
}

func CheckPagePathBlocked(pagePath string) (bool, string) {
	for _, pattern := range blockedPagePaths {
		if pattern.MatchString(pagePath) {
			return true, fmt.Sprintf("页面路径 %s 属于安全敏感路径，不允许豁免", pagePath)
		}
	}
	return false, ""
}

func CheckExistingExemption(pagePath string, matrix models.BrowserMatrix) (*models.Exemption, error) {
	existing, err := storage.GetExemptionByPageAndBrowser(pagePath, matrix)
	if err != nil {
		return nil, err
	}
	return existing, nil
}

func CreateExemption(request models.CreateExemptionRequest, rawInput []byte) (*CreateResult, error) {
	if err := ValidateBrowserMatrix(request.BrowserMatrix); err != nil {
		return nil, err
	}

	if blocked, reason := CheckPagePathBlocked(request.PagePath); blocked {
		return &CreateResult{
			Blocked:     true,
			BlockReason: reason,
		}, nil
	}

	existing, err := CheckExistingExemption(request.PagePath, request.BrowserMatrix)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, fmt.Errorf("该页面路径和浏览器组合已有豁免申请（ID: %d）", existing.ID)
	}

	now := time.Now()
	exemption := &models.Exemption{
		PagePath:               request.PagePath,
		BrowserMatrix:          request.BrowserMatrix,
		Applicant:              request.Applicant,
		ApplicantEmail:         request.ApplicantEmail,
		Reason:                 request.Reason,
		DurationDays:           request.DurationDays,
		ExpireAt:               now.AddDate(0, 0, request.DurationDays),
		Status:                 models.StatusPending,
		CompatibilityConclusion: models.ConclusionFail,
		RawInput:               string(rawInput),
		CreatedAt:              now,
		UpdatedAt:              now,
	}

	if err := storage.CreateExemption(exemption); err != nil {
		return nil, err
	}

	for i := range request.FailedCases {
		request.FailedCases[i].CreatedAt = now
		if err := storage.AddFailedCase(exemption.ID, &request.FailedCases[i]); err != nil {
			return nil, err
		}
	}

	return &CreateResult{
		Exemption: exemption,
		Blocked:   false,
	}, nil
}

func GetExemption(id uint) (*models.Exemption, error) {
	return storage.GetExemptionByID(id)
}

func QueryExemptions(filter models.QueryFilter) (*models.PaginatedResponse, error) {
	return storage.QueryExemptions(filter)
}

func UpdateStatus(id uint, request models.UpdateStatusRequest) error {
	exemption, err := storage.GetExemptionByID(id)
	if err != nil {
		return err
	}
	if exemption == nil {
		return errors.New("exemption not found")
	}

	validTransitions := map[models.ExemptionStatus][]models.ExemptionStatus{
		models.StatusPending:   {models.StatusReviewing, models.StatusApproved, models.StatusRejected},
		models.StatusReviewing: {models.StatusApproved, models.StatusRejected},
		models.StatusApproved:  {models.StatusExpired},
		models.StatusRejected:  {},
		models.StatusExpired:   {},
	}

	valid := false
	for _, allowed := range validTransitions[exemption.Status] {
		if allowed == request.Status {
			valid = true
			break
		}
	}
	if !valid {
		return fmt.Errorf("invalid status transition from %s to %s", exemption.Status, request.Status)
	}

	if request.Status == models.StatusApproved {
		if exemption.ExpireAt.Before(time.Now()) {
			return errors.New("cannot approve expired exemption")
		}
	}

	return storage.UpdateExemptionStatus(id, request)
}

func ManualCorrection(id uint, request models.ManualCorrectionRequest) error {
	exemption, err := storage.GetExemptionByID(id)
	if err != nil {
		return err
	}
	if exemption == nil {
		return errors.New("exemption not found")
	}

	updates := make(map[string]interface{})
	if request.PagePath != "" {
		if blocked, _ := CheckPagePathBlocked(request.PagePath); blocked {
			return errors.New("cannot change to blocked page path")
		}
		updates["page_path"] = request.PagePath
	}
	if request.BrowserMatrix != nil {
		if err := ValidateBrowserMatrix(*request.BrowserMatrix); err != nil {
			return err
		}
		updates["browser"] = request.BrowserMatrix.Browser
		updates["version"] = request.BrowserMatrix.Version
		updates["os"] = request.BrowserMatrix.OS
	}
	if request.Reason != "" {
		updates["reason"] = request.Reason
	}
	if request.DurationDays != nil {
		updates["duration_days"] = *request.DurationDays
		updates["expire_at"] = exemption.CreatedAt.AddDate(0, 0, *request.DurationDays)
	}
	if request.CompatibilityConclusion != nil {
		updates["compatibility_conclusion"] = *request.CompatibilityConclusion
	}

	updates["updated_at"] = time.Now()
	return storage.UpdateExemption(id, updates)
}

func ExportExemptions() ([]byte, error) {
	records, err := storage.GetAllForExport()
	if err != nil {
		return nil, err
	}
	return json.MarshalIndent(records, "", "  ")
}

func ProcessExpiredExemptions() (int64, error) {
	return storage.MarkExpiredExemptions()
}

func HandleException(id uint, exceptionNote string, rawInput []byte) error {
	exemption, err := storage.GetExemptionByID(id)
	if err != nil {
		return err
	}
	if exemption == nil {
		return errors.New("exemption not found")
	}

	updates := map[string]interface{}{
		"exception_note": exceptionNote,
		"raw_input":      string(rawInput),
		"updated_at":     time.Now(),
	}
	return storage.UpdateExemption(id, updates)
}
