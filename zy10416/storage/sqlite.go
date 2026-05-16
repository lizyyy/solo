package storage

import (
	"browser-compat-exemption-api/models"
	"errors"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDB(dbPath string) error {
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		return err
	}

	err = db.AutoMigrate(&models.Exemption{}, &models.FailedCase{})
	if err != nil {
		return err
	}

	DB = db
	return nil
}

func CreateExemption(exemption *models.Exemption) error {
	return DB.Create(exemption).Error
}

func GetExemptionByID(id uint) (*models.Exemption, error) {
	var exemption models.Exemption
	err := DB.Preload("FailedCases").First(&exemption, id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &exemption, nil
}

func GetExemptionByPageAndBrowser(pagePath string, browserMatrix models.BrowserMatrix) (*models.Exemption, error) {
	var exemption models.Exemption
	err := DB.Where("page_path = ? AND browser = ? AND version = ? AND os = ?",
		pagePath, browserMatrix.Browser, browserMatrix.Version, browserMatrix.OS).
		Preload("FailedCases").
		First(&exemption).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &exemption, nil
}

func QueryExemptions(filter models.QueryFilter) (*models.PaginatedResponse, error) {
	query := DB.Model(&models.Exemption{}).Preload("FailedCases")

	if filter.PagePath != "" {
		query = query.Where("page_path LIKE ?", "%"+filter.PagePath+"%")
	}
	if filter.Browser != "" {
		query = query.Where("browser = ?", filter.Browser)
	}
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.Applicant != "" {
		query = query.Where("applicant LIKE ?", "%"+filter.Applicant+"%")
	}
	if filter.IsExpired != nil {
		if *filter.IsExpired {
			query = query.Where("expire_at < ?", time.Now())
		} else {
			query = query.Where("expire_at >= ?", time.Now())
		}
	}

	var total int64
	query.Count(&total)

	page := filter.Page
	if page <= 0 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize <= 0 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	var exemptions []models.Exemption
	err := query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&exemptions).Error
	if err != nil {
		return nil, err
	}

	totalPages := int(total) / pageSize
	if int(total)%pageSize > 0 {
		totalPages++
	}

	return &models.PaginatedResponse{
		Data:       exemptions,
		Total:      total,
		Page:       page,
		PageSize:   pageSize,
		TotalPages: totalPages,
	}, nil
}

func UpdateExemptionStatus(id uint, request models.UpdateStatusRequest) error {
	updates := map[string]interface{}{
		"status": request.Status,
	}
	if request.Reviewer != "" {
		updates["reviewer"] = request.Reviewer
	}
	if request.ReviewComment != "" {
		updates["review_comment"] = request.ReviewComment
	}
	if request.Status == models.StatusApproved || request.Status == models.StatusRejected {
		now := time.Now()
		updates["reviewed_at"] = &now
	}
	return DB.Model(&models.Exemption{}).Where("id = ?", id).Updates(updates).Error
}

func UpdateExemption(id uint, updates map[string]interface{}) error {
	return DB.Model(&models.Exemption{}).Where("id = ?", id).Updates(updates).Error
}

func AddFailedCase(exemptionID uint, failedCase *models.FailedCase) error {
	failedCase.ExemptionID = exemptionID
	return DB.Create(failedCase).Error
}

func GetAllForExport() ([]models.ExportRecord, error) {
	var exemptions []models.Exemption
	err := DB.Preload("FailedCases").Find(&exemptions).Error
	if err != nil {
		return nil, err
	}

	var records []models.ExportRecord
	for _, e := range exemptions {
		records = append(records, models.ExportRecord{
			ID:                      e.ID,
			PagePath:                e.PagePath,
			Browser:                 e.BrowserMatrix.Browser,
			Version:                 e.BrowserMatrix.Version,
			OS:                      e.BrowserMatrix.OS,
			FailedCaseCount:         len(e.FailedCases),
			Applicant:               e.Applicant,
			Reason:                  e.Reason,
			DurationDays:            e.DurationDays,
			ExpireAt:                e.ExpireAt.Format(time.RFC3339),
			Status:                  e.Status,
			CompatibilityConclusion: e.CompatibilityConclusion,
			CreatedAt:               e.CreatedAt.Format(time.RFC3339),
		})
	}
	return records, nil
}

func MarkExpiredExemptions() (int64, error) {
	result := DB.Model(&models.Exemption{}).
		Where("expire_at < ? AND status = ?", time.Now(), models.StatusApproved).
		Update("status", models.StatusExpired)
	return result.RowsAffected, result.Error
}

func InitSampleData() error {
	count := int64(0)
	DB.Model(&models.Exemption{}).Count(&count)
	if count > 0 {
		return nil
	}

	samples := []models.Exemption{
		{
			PagePath: "/home",
			BrowserMatrix: models.BrowserMatrix{
				Browser: "Chrome",
				Version: "80",
				OS:      "Windows 10",
			},
			Applicant:             "张三",
			ApplicantEmail:        "zhangsan@example.com",
			Reason:                "该页面为遗留系统，暂不支持老浏览器升级",
			DurationDays:          90,
			ExpireAt:              time.Now().AddDate(0, 3, 0),
			Status:                models.StatusApproved,
			Reviewer:              "李四",
			ReviewComment:         "同意豁免，请在下季度前完成兼容改造",
			CompatibilityConclusion: models.ConclusionExempted,
		},
		{
			PagePath: "/dashboard",
			BrowserMatrix: models.BrowserMatrix{
				Browser: "IE",
				Version: "11",
				OS:      "Windows 7",
			},
			Applicant:             "王五",
			ApplicantEmail:        "wangwu@example.com",
			Reason:                "IE11已停止支持，但仍有少量用户使用",
			DurationDays:          30,
			ExpireAt:              time.Now().AddDate(0, 1, 0),
			Status:                models.StatusPending,
			CompatibilityConclusion: models.ConclusionFail,
		},
		{
			PagePath: "/checkout",
			BrowserMatrix: models.BrowserMatrix{
				Browser: "Safari",
				Version: "12",
				OS:      "macOS 10.14",
			},
			Applicant:             "赵六",
			ApplicantEmail:        "zhaoliu@example.com",
			Reason:                "支付流程在Safari 12下存在已知问题",
			DurationDays:          15,
			ExpireAt:              time.Now().AddDate(0, 0, 15),
			Status:                models.StatusReviewing,
			CompatibilityConclusion: models.ConclusionFail,
		},
	}

	for i := range samples {
		samples[i].FailedCases = []models.FailedCase{
			{
				TestCase:    "TC-COMPAT-001",
				Description: "CSS Grid布局不支持",
			},
		}
		if err := CreateExemption(&samples[i]); err != nil {
			return err
		}
	}

	return nil
}
