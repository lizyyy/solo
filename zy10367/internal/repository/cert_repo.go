package repository

import (
	"cert-renewal/internal/model"
	"time"

	"gorm.io/gorm"
)

type CertRepository interface {
	Create(cert *model.ClientCertificate, tx *gorm.DB) error
	GetByID(id string) (*model.ClientCertificate, error)
	GetByFingerprint(fingerprint string) (*model.ClientCertificate, error)
	GetBySerialNumber(serial string) (*model.ClientCertificate, error)
	List(params *model.QueryParams) ([]model.ClientCertificate, int64, error)
	ListByPartner(partnerID string, status ...model.CertStatus) ([]model.ClientCertificate, error)
	GetCurrentCert(partnerID string) (*model.ClientCertificate, error)
	GetRollbackCert(partnerID string) (*model.ClientCertificate, error)
	UpdateStatus(id string, status model.CertStatus, tx *gorm.DB) error
	Update(cert *model.ClientCertificate, tx *gorm.DB) error
	SetCurrentCert(partnerID string, certID string, tx *gorm.DB) error
	ListExpiringSoon(days int) ([]model.ClientCertificate, error)
}

type certRepository struct {
	db *gorm.DB
}

func NewCertRepository() CertRepository {
	return &certRepository{db: GetDB()}
}

func (r *certRepository) getDB(tx *gorm.DB) *gorm.DB {
	if tx != nil {
		return tx
	}
	return r.db
}

func (r *certRepository) Create(cert *model.ClientCertificate, tx *gorm.DB) error {
	cert.BeforeCreate()
	return r.getDB(tx).Create(cert).Error
}

func (r *certRepository) GetByID(id string) (*model.ClientCertificate, error) {
	var cert model.ClientCertificate
	err := r.db.Where("id = ?", id).First(&cert).Error
	if err == gorm.ErrRecordNotFound {
		return nil, model.ErrCertNotFound
	}
	return &cert, err
}

func (r *certRepository) GetByFingerprint(fingerprint string) (*model.ClientCertificate, error) {
	var cert model.ClientCertificate
	err := r.db.Where("fingerprint = ?", fingerprint).First(&cert).Error
	if err == gorm.ErrRecordNotFound {
		return nil, model.ErrCertNotFound
	}
	return &cert, err
}

func (r *certRepository) GetBySerialNumber(serial string) (*model.ClientCertificate, error) {
	var cert model.ClientCertificate
	err := r.db.Where("serial_number = ?", serial).First(&cert).Error
	if err == gorm.ErrRecordNotFound {
		return nil, model.ErrCertNotFound
	}
	return &cert, err
}

func (r *certRepository) List(params *model.QueryParams) ([]model.ClientCertificate, int64, error) {
	var certs []model.ClientCertificate
	var total int64

	query := r.db.Model(&model.ClientCertificate{})

	if params.PartnerID != "" {
		query = query.Where("partner_id = ?", params.PartnerID)
	}
	if params.Status != "" {
		query = query.Where("status = ?", params.Status)
	}

	offset := (params.Page - 1) * params.PageSize
	err := query.Count(&total).Offset(offset).Limit(params.PageSize).Order("created_at DESC").Find(&certs).Error
	return certs, total, err
}

func (r *certRepository) ListByPartner(partnerID string, status ...model.CertStatus) ([]model.ClientCertificate, error) {
	var certs []model.ClientCertificate
	query := r.db.Where("partner_id = ?", partnerID)
	if len(status) > 0 {
		query = query.Where("status IN ?", status)
	}
	err := query.Order("created_at DESC").Find(&certs).Error
	return certs, err
}

func (r *certRepository) GetCurrentCert(partnerID string) (*model.ClientCertificate, error) {
	var cert model.ClientCertificate
	err := r.db.Where("partner_id = ? AND is_current = ?", partnerID, true).First(&cert).Error
	if err == gorm.ErrRecordNotFound {
		return nil, model.ErrCertNotFound
	}
	return &cert, err
}

func (r *certRepository) GetRollbackCert(partnerID string) (*model.ClientCertificate, error) {
	var cert model.ClientCertificate
	err := r.db.Where("partner_id = ? AND is_rollback = ?", partnerID, true).First(&cert).Error
	if err == gorm.ErrRecordNotFound {
		return nil, model.ErrNoRollbackCert
	}
	return &cert, err
}

func (r *certRepository) UpdateStatus(id string, status model.CertStatus, tx *gorm.DB) error {
	return r.getDB(tx).Model(&model.ClientCertificate{}).Where("id = ?", id).Update("status", status).Error
}

func (r *certRepository) Update(cert *model.ClientCertificate, tx *gorm.DB) error {
	return r.getDB(tx).Save(cert).Error
}

func (r *certRepository) SetCurrentCert(partnerID string, certID string, tx *gorm.DB) error {
	dbtx := r.getDB(tx)
	if err := dbtx.Model(&model.ClientCertificate{}).Where("partner_id = ?", partnerID).Update("is_current", false).Error; err != nil {
		return err
	}
	return dbtx.Model(&model.ClientCertificate{}).Where("id = ?", certID).Update("is_current", true).Error
}

func (r *certRepository) ListExpiringSoon(days int) ([]model.ClientCertificate, error) {
	var certs []model.ClientCertificate
	expireDate := time.Now().AddDate(0, 0, days)
	err := r.db.Where("not_after <= ? AND status IN ?", expireDate, []model.CertStatus{model.CertStatusEnabled, model.CertStatusGray}).Find(&certs).Error
	return certs, err
}
