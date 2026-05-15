package service

import (
	"cert-renewal/internal/model"
	"cert-renewal/internal/repository"
	"errors"
	"time"

	"gorm.io/gorm"
)

type CertService interface {
	CreateCert(req *model.CreateCertRequest) (*model.ClientCertificate, error)
	GetCert(id string) (*model.ClientCertificate, error)
	ListCerts(params *model.QueryParams) ([]model.ClientCertificate, int64, error)
	CreateVerification(req *model.CreateVerificationRequest) (*model.VerificationRequest, error)
	VerifyCert(req *model.VerifyRequest) (*model.VerificationRequest, error)
	GrayEnable(req *model.GrayEnableRequest) (*model.ClientCertificate, error)
	FullEnable(req *model.FullEnableRequest) (*model.ClientCertificate, error)
	Rollback(req *model.RollbackRequest) (*model.RollbackRecord, error)
	GetEnablementHistory(params *model.HistoryQueryParams) ([]model.EnablementRecord, int64, error)
	CreateRenewalWindow(req *model.CreateRenewalWindowRequest) (*model.RenewalWindow, error)
	ListVerifications(params *model.QueryParams) ([]model.VerificationRequest, int64, error)
}

type certService struct {
	certRepo         repository.CertRepository
	verificationRepo repository.VerificationRepository
	enablementRepo   repository.EnablementRepository
	rollbackRepo     repository.RollbackRepository
	partnerRepo      repository.PartnerRepository
	renewalRepo      repository.RenewalWindowRepository
}

func NewCertService() CertService {
	return &certService{
		certRepo:         repository.NewCertRepository(),
		verificationRepo: repository.NewVerificationRepository(),
		enablementRepo:   repository.NewEnablementRepository(),
		rollbackRepo:     repository.NewRollbackRepository(),
		partnerRepo:      repository.NewPartnerRepository(),
		renewalRepo:      repository.NewRenewalWindowRepository(),
	}
}

func (s *certService) CreateCert(req *model.CreateCertRequest) (*model.ClientCertificate, error) {
	if _, err := s.partnerRepo.GetByID(req.PartnerID); err != nil {
		return nil, err
	}

	existing, _ := s.certRepo.GetByFingerprint(req.Fingerprint)
	if existing != nil {
		return nil, model.ErrCertAlreadyExists
	}

	cert := &model.ClientCertificate{
		PartnerID:         req.PartnerID,
		SerialNumber:      req.SerialNumber,
		Subject:           req.Subject,
		Issuer:            req.Issuer,
		NotBefore:         req.NotBefore,
		NotAfter:          req.NotAfter,
		Fingerprint:       req.Fingerprint,
		Status:            model.CertStatusPending,
		CertContent:       req.CertContent,
		PrivateKeyContent: req.PrivateKeyContent,
		Remark:            req.Remark,
	}

	if err := s.certRepo.Create(cert, nil); err != nil {
		return nil, err
	}

	return cert, nil
}

func (s *certService) GetCert(id string) (*model.ClientCertificate, error) {
	return s.certRepo.GetByID(id)
}

func (s *certService) ListCerts(params *model.QueryParams) ([]model.ClientCertificate, int64, error) {
	return s.certRepo.List(params)
}

func (s *certService) CreateVerification(req *model.CreateVerificationRequest) (*model.VerificationRequest, error) {
	newCert, err := s.certRepo.GetByID(req.NewCertID)
	if err != nil {
		return nil, err
	}

	if newCert.Status != model.CertStatusPending {
		return nil, model.ErrInvalidCertStatus
	}

	oldCert, err := s.certRepo.GetByID(req.OldCertID)
	if err != nil {
		return nil, err
	}

	if oldCert.PartnerID != newCert.PartnerID {
		return nil, errors.New("certificates belong to different partners")
	}

	verification := &model.VerificationRequest{
		PartnerID:        req.PartnerID,
		NewCertID:        req.NewCertID,
		OldCertID:        req.OldCertID,
		RequestID:        req.RequestID,
		Status:           model.VerificationStatusPending,
		VerificationType: req.VerificationType,
		VerificationData: req.VerificationData,
	}

	if err := repository.WithTransaction(func(tx *gorm.DB) error {
		if err := s.verificationRepo.Create(verification, tx); err != nil {
			return err
		}
		return s.certRepo.UpdateStatus(newCert.ID, model.CertStatusValidating, tx)
	}); err != nil {
		return nil, err
	}

	return verification, nil
}

func (s *certService) VerifyCert(req *model.VerifyRequest) (*model.VerificationRequest, error) {
	verification, err := s.verificationRepo.GetByID(req.VerificationID)
	if err != nil {
		return nil, err
	}

	if verification.Status != model.VerificationStatusPending {
		return nil, model.ErrInvalidStatus
	}

	now := time.Now().UTC()
	verification.Status = model.VerificationStatus(req.Status)
	verification.VerificationResult = req.VerificationResult
	verification.VerifiedAt = &now
	verification.Verifier = req.Verifier

	if err := repository.WithTransaction(func(tx *gorm.DB) error {
		if err := s.verificationRepo.Update(verification, tx); err != nil {
			return err
		}

		if verification.Status == model.VerificationStatusSuccess {
			return s.certRepo.UpdateStatus(verification.NewCertID, model.CertStatusValidationOK, tx)
		}
		return nil
	}); err != nil {
		return nil, err
	}

	return verification, nil
}

func (s *certService) GrayEnable(req *model.GrayEnableRequest) (*model.ClientCertificate, error) {
	cert, err := s.certRepo.GetByID(req.CertID)
	if err != nil {
		return nil, err
	}

	if cert.Status != model.CertStatusValidationOK {
		return nil, model.ErrInvalidCertStatus
	}

	if req.GrayPercent <= 0 || req.GrayPercent >= 100 {
		return nil, model.ErrInvalidGrayPercent
	}

	previousStatus := cert.Status
	cert.Status = model.CertStatusGray
	cert.GrayPercent = req.GrayPercent

	enablementRecord := &model.EnablementRecord{
		PartnerID:      cert.PartnerID,
		CertID:         cert.ID,
		EnablementType: model.EnablementTypeGray,
		GrayPercent:    req.GrayPercent,
		Operator:       req.Operator,
		EnableAt:       time.Now().UTC(),
		PreviousStatus: previousStatus,
		NewStatus:      model.CertStatusGray,
		ChangeReason:   req.Reason,
	}

	if err := repository.WithTransaction(func(tx *gorm.DB) error {
		if err := s.certRepo.Update(cert, tx); err != nil {
			return err
		}
		return s.enablementRepo.Create(enablementRecord, tx)
	}); err != nil {
		return nil, err
	}

	return cert, nil
}

func (s *certService) FullEnable(req *model.FullEnableRequest) (*model.ClientCertificate, error) {
	cert, err := s.certRepo.GetByID(req.CertID)
	if err != nil {
		return nil, err
	}

	if cert.Status != model.CertStatusGray {
		return nil, model.ErrInvalidCertStatus
	}

	previousStatus := cert.Status
	cert.Status = model.CertStatusEnabled
	cert.GrayPercent = 100

	enablementRecord := &model.EnablementRecord{
		PartnerID:      cert.PartnerID,
		CertID:         cert.ID,
		EnablementType: model.EnablementTypeFull,
		GrayPercent:    100,
		Operator:       req.Operator,
		EnableAt:       time.Now().UTC(),
		PreviousStatus: previousStatus,
		NewStatus:      model.CertStatusEnabled,
		ChangeReason:   req.Reason,
	}

	if err := repository.WithTransaction(func(tx *gorm.DB) error {
		if err := s.certRepo.Update(cert, tx); err != nil {
			return err
		}
		if err := s.enablementRepo.Create(enablementRecord, tx); err != nil {
			return err
		}
		return s.certRepo.SetCurrentCert(cert.PartnerID, cert.ID, tx)
	}); err != nil {
		return nil, err
	}

	return cert, nil
}

func (s *certService) Rollback(req *model.RollbackRequest) (*model.RollbackRecord, error) {
	currentCert, err := s.certRepo.GetCurrentCert(req.PartnerID)
	if err != nil {
		return nil, err
	}

	rollbackCert, err := s.certRepo.GetByID(req.CertID)
	if err != nil {
		return nil, err
	}

	rollbackRecord := &model.RollbackRecord{
		PartnerID:        req.PartnerID,
		CurrentCertID:    currentCert.ID,
		RollbackCertID:   rollbackCert.ID,
		RollbackReason:   req.Reason,
		RollbackOperator: req.Operator,
		RollbackAt:       time.Now().UTC(),
		IsSuccess:        true,
	}

	enablementRecord := &model.EnablementRecord{
		PartnerID:      req.PartnerID,
		CertID:         rollbackCert.ID,
		EnablementType: model.EnablementTypeRollback,
		Operator:       req.Operator,
		EnableAt:       time.Now().UTC(),
		PreviousStatus: rollbackCert.Status,
		NewStatus:      model.CertStatusEnabled,
		ChangeReason:   req.Reason,
	}

	if err := repository.WithTransaction(func(tx *gorm.DB) error {
		if err := s.rollbackRepo.Create(rollbackRecord, tx); err != nil {
			return err
		}
		if err := s.enablementRepo.Create(enablementRecord, tx); err != nil {
			return err
		}
		if err := s.certRepo.SetCurrentCert(req.PartnerID, rollbackCert.ID, tx); err != nil {
			return err
		}
		if err := s.certRepo.UpdateStatus(currentCert.ID, model.CertStatusDisabled, tx); err != nil {
			return err
		}
		rollbackCert.Status = model.CertStatusEnabled
		rollbackCert.IsRollback = true
		if err := s.certRepo.Update(rollbackCert, tx); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return nil, err
	}

	return rollbackRecord, nil
}

func (s *certService) GetEnablementHistory(params *model.HistoryQueryParams) ([]model.EnablementRecord, int64, error) {
	return s.enablementRepo.List(params)
}

func (s *certService) ListVerifications(params *model.QueryParams) ([]model.VerificationRequest, int64, error) {
	return s.verificationRepo.List(params)
}

func (s *certService) CreateRenewalWindow(req *model.CreateRenewalWindowRequest) (*model.RenewalWindow, error) {
	window := &model.RenewalWindow{
		PartnerID:   req.PartnerID,
		CertID:      req.CertID,
		WindowStart: req.WindowStart,
		WindowEnd:   req.WindowEnd,
		Status:      model.RenewalWindowStatusOpen,
		Remark:      req.Remark,
	}

	if err := s.renewalRepo.Create(window, nil); err != nil {
		return nil, err
	}

	return window, nil
}
