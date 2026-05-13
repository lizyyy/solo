package service

import (
	"errors"
	"fmt"
	"time"

	"crl-service/database"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrCertificateAlreadyRevoked = errors.New("证书已被吊销")
	ErrInvalidStatusTransition   = errors.New("无效的状态转换")
	ErrCertificateNotFound       = errors.New("证书未找到")
	ErrInvalidRevocationReason   = errors.New("无效的吊销原因")
	ErrDuplicateRequest          = errors.New("重复请求")
	ErrVersionAlreadyPublished   = errors.New("版本已发布")
)

var validStatusTransitions = map[database.RevocationStatus][]database.RevocationStatus{
	database.StatusRegistered:   {database.StatusDistributed},
	database.StatusDistributed:  {database.StatusCacheConfirm},
	database.StatusCacheConfirm: {database.StatusActive},
	database.StatusActive:       {},
}

var validRevocationReasons = map[database.RevocationReason]bool{
	database.ReasonKeyCompromise:   true,
	database.ReasonCACompromise:    true,
	database.ReasonAffiliationChan: true,
	database.ReasonSuperseded:      true,
	database.ReasonCessation:       true,
	database.ReasonCertificateHold: true,
	database.ReasonRemoveFromCRL:   true,
	database.ReasonPrivilegeWithdr: true,
	database.ReasonAACompromise:    true,
}

type CRLService struct {
	db *gorm.DB
}

func NewCRLService(db *gorm.DB) *CRLService {
	return &CRLService{db: db}
}

type RegisterRevocationRequest struct {
	SerialNumber   string
	Reason         database.RevocationReason
	RevocationTime int64
	EffectiveTime  int64
	RequestID      string
}

func (s *CRLService) RegisterRevocation(req RegisterRevocationRequest) (*database.CertificateRevocation, error) {
	if !validRevocationReasons[req.Reason] {
		return nil, ErrInvalidRevocationReason
	}

	if req.RequestID == "" {
		req.RequestID = uuid.New().String()
	}

	var existing database.CertificateRevocation
	if err := s.db.Where("serial_number = ?", req.SerialNumber).First(&existing).Error; err == nil {
		return &existing, ErrCertificateAlreadyRevoked
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("查询证书失败: %w", err)
	}

	var existingByReqID database.CertificateRevocation
	if err := s.db.Where("request_id = ?", req.RequestID).First(&existingByReqID).Error; err == nil {
		return &existingByReqID, ErrDuplicateRequest
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("查询请求ID失败: %w", err)
	}

	if req.RevocationTime == 0 {
		req.RevocationTime = time.Now().Unix()
	}
	if req.EffectiveTime == 0 {
		req.EffectiveTime = req.RevocationTime
	}

	revocation := &database.CertificateRevocation{
		SerialNumber:       req.SerialNumber,
		Reason:             req.Reason,
		Status:             database.StatusRegistered,
		DistributionVersion: 0,
		ServiceConfirmed:   false,
		CacheStatus:        "PENDING",
		RevocationTime:     req.RevocationTime,
		EffectiveTime:      req.EffectiveTime,
		RequestID:          req.RequestID,
	}

	if err := s.db.Create(revocation).Error; err != nil {
		return nil, fmt.Errorf("创建吊销记录失败: %w", err)
	}

	s.logStatusTransition(revocation.SerialNumber, "", revocation.Status, "SYSTEM", 0)

	return revocation, nil
}

func (s *CRLService) CreateDistributionVersion() (*database.DistributionVersion, error) {
	var lastVersion database.DistributionVersion
	err := s.db.Order("version desc").First(&lastVersion).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("查询最新版本失败: %w", err)
	}

	newVersion := int64(1)
	if err == nil {
		newVersion = lastVersion.Version + 1
	}

	var pendingItems []database.CertificateRevocation
	if err := s.db.Where("status = ?", database.StatusRegistered).Find(&pendingItems).Error; err != nil {
		return nil, fmt.Errorf("查询待分发项失败: %w", err)
	}

	version := &database.DistributionVersion{
		Version:     newVersion,
		PublishedAt: time.Now().Unix(),
		Status:      "PUBLISHED",
		ItemCount:   len(pendingItems),
	}

	if err := s.db.Create(version).Error; err != nil {
		return nil, fmt.Errorf("创建分发版本失败: %w", err)
	}

	if len(pendingItems) > 0 {
		if err := s.db.Model(&database.CertificateRevocation{}).
			Where("status = ?", database.StatusRegistered).
			Updates(map[string]interface{}{
				"status":               database.StatusDistributed,
				"distribution_version": newVersion,
			}).Error; err != nil {
			return nil, fmt.Errorf("更新吊销记录状态失败: %w", err)
		}

		for _, item := range pendingItems {
			s.logStatusTransition(item.SerialNumber, database.StatusRegistered, database.StatusDistributed, "SYSTEM", newVersion)
		}
	}

	return version, nil
}

func (s *CRLService) ConfirmCache(serialNumber string) (*database.CertificateRevocation, error) {
	var revocation database.CertificateRevocation
	if err := s.db.Where("serial_number = ?", serialNumber).First(&revocation).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrCertificateNotFound
		}
		return nil, fmt.Errorf("查询证书失败: %w", err)
	}

	if revocation.Status != database.StatusDistributed {
		return nil, fmt.Errorf("%w: 只能在 DISTRIBUTED 状态确认缓存", ErrInvalidStatusTransition)
	}

	revocation.Status = database.StatusCacheConfirm
	revocation.CacheStatus = "CONFIRMED"
	revocation.ServiceConfirmed = true

	if err := s.db.Save(&revocation).Error; err != nil {
		return nil, fmt.Errorf("更新缓存确认状态失败: %w", err)
	}

	s.logStatusTransition(serialNumber, database.StatusDistributed, database.StatusCacheConfirm, "SYSTEM", revocation.DistributionVersion)

	return &revocation, nil
}

func (s *CRLService) ActivateRevocation(serialNumber string) (*database.CertificateRevocation, error) {
	var revocation database.CertificateRevocation
	if err := s.db.Where("serial_number = ?", serialNumber).First(&revocation).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrCertificateNotFound
		}
		return nil, fmt.Errorf("查询证书失败: %w", err)
	}

	if revocation.Status != database.StatusCacheConfirm {
		return nil, fmt.Errorf("%w: 只能在 CACHE_CONFIRMED 状态激活", ErrInvalidStatusTransition)
	}

	revocation.Status = database.StatusActive

	if err := s.db.Save(&revocation).Error; err != nil {
		return nil, fmt.Errorf("更新激活状态失败: %w", err)
	}

	s.logStatusTransition(serialNumber, database.StatusCacheConfirm, database.StatusActive, "SYSTEM", revocation.DistributionVersion)

	return &revocation, nil
}

func (s *CRLService) CheckRevocation(serialNumber string, clientIP string, userAgent string) (bool, *database.CertificateRevocation, error) {
	var revocation database.CertificateRevocation
	err := s.db.Where("serial_number = ?", serialNumber).First(&revocation).Error

	result := "NOT_REVOKED"
	if err == nil {
		if revocation.Status == database.StatusActive {
			result = "REVOKED"
		} else {
			result = "REVOKED_PENDING"
		}
	} else if errors.Is(err, gorm.ErrRecordNotFound) {
		result = "NOT_FOUND"
	}

	s.logQuery(serialNumber, clientIP, result, userAgent)

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, nil, nil
		}
		return false, nil, fmt.Errorf("查询失败: %w", err)
	}

	isRevoked := revocation.Status == database.StatusActive
	return isRevoked, &revocation, nil
}

func (s *CRLService) GetRevocationHistory(serialNumber string) ([]database.StatusTransitionLog, error) {
	var logs []database.StatusTransitionLog
	if err := s.db.Where("serial_number = ?", serialNumber).Order("transition_time asc").Find(&logs).Error; err != nil {
		return nil, fmt.Errorf("查询历史失败: %w", err)
	}
	return logs, nil
}

func (s *CRLService) GetAllRevocations(status database.RevocationStatus) ([]database.CertificateRevocation, error) {
	var revocations []database.CertificateRevocation
	query := s.db
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if err := query.Find(&revocations).Error; err != nil {
		return nil, fmt.Errorf("查询吊销列表失败: %w", err)
	}
	return revocations, nil
}

func (s *CRLService) GetDistributionVersions() ([]database.DistributionVersion, error) {
	var versions []database.DistributionVersion
	if err := s.db.Order("version desc").Find(&versions).Error; err != nil {
		return nil, fmt.Errorf("查询版本列表失败: %w", err)
	}
	return versions, nil
}

func (s *CRLService) GetRefreshReport() (map[string]interface{}, error) {
	var total int64
	if err := s.db.Model(&database.CertificateRevocation{}).Count(&total).Error; err != nil {
		return nil, err
	}

	var statusCounts []struct {
		Status string `json:"status"`
		Count  int64  `json:"count"`
	}
	if err := s.db.Model(&database.CertificateRevocation{}).
		Select("status, count(*) as count").
		Group("status").
		Scan(&statusCounts).Error; err != nil {
		return nil, err
	}

	var latestVersion database.DistributionVersion
	s.db.Order("version desc").First(&latestVersion)

	var queryCount int64
	s.db.Model(&database.QueryLog{}).Count(&queryCount)

	return map[string]interface{}{
		"total_revocations":  total,
		"status_distribution": statusCounts,
		"latest_version":     latestVersion,
		"total_queries":      queryCount,
	}, nil
}

func (s *CRLService) logStatusTransition(serialNumber string, from, to database.RevocationStatus, operator string, version int64) {
	log := database.StatusTransitionLog{
		SerialNumber:        serialNumber,
		FromStatus:          from,
		ToStatus:            to,
		Operator:            operator,
		DistributionVersion: version,
	}
	s.db.Create(&log)
}

func (s *CRLService) logQuery(serialNumber, clientIP, result, userAgent string) {
	log := database.QueryLog{
		SerialNumber: serialNumber,
		ClientIP:     clientIP,
		Result:       result,
		UserAgent:    userAgent,
	}
	s.db.Create(&log)
}

func (s *CRLService) GetByRequestID(requestID string) (*database.CertificateRevocation, error) {
	var revocation database.CertificateRevocation
	if err := s.db.Where("request_id = ?", requestID).First(&revocation).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrCertificateNotFound
		}
		return nil, err
	}
	return &revocation, nil
}
