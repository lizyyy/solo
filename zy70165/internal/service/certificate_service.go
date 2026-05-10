package service

import (
	"certificate-renewal-api/internal/config"
	"certificate-renewal-api/internal/models"
	"certificate-renewal-api/internal/repository"
	"certificate-renewal-api/internal/util"
	"time"
)

type CertificateService struct {
	store  repository.Store
	config *config.Config
}

func NewCertificateService(store repository.Store, config *config.Config) *CertificateService {
	return &CertificateService{store: store, config: config}
}

func (s *CertificateService) CreateCertificate(commonName string, sans []string, validFrom, validTo time.Time, autoRenew bool, tags map[string]string) (*models.Certificate, error) {
	cert := &models.Certificate{
		ID:             util.GenerateID("cert"),
		CommonName:     commonName,
		SANs:           sans,
		SerialNumber:   util.GenerateID("sn"),
		Issuer:         "Self-Signed",
		ValidFrom:      validFrom.UTC(),
		ValidTo:        validTo.UTC(),
		Status:         models.CertStatusActive,
		Version:        1,
		CreatedAt:      util.Now(),
		UpdatedAt:      util.Now(),
		AutoRenew:      autoRenew,
		RenewThreshold: 30 * 24 * time.Hour,
		Tags:           tags,
	}
	
	if err := s.store.CreateCertificate(cert); err != nil {
		return nil, err
	}
	
	return cert, nil
}

func (s *CertificateService) GetCertificate(id string) (*models.Certificate, error) {
	return s.store.GetCertificate(id)
}

func (s *CertificateService) ListCertificates() []*models.Certificate {
	return s.store.ListCertificates()
}

func (s *CertificateService) UpdateCertificateStatus(id string, status models.CertificateStatus) error {
	cert, err := s.store.GetCertificate(id)
	if err != nil {
		return err
	}
	
	cert.Status = status
	cert.UpdatedAt = util.Now()
	return s.store.UpdateCertificate(cert)
}

func (s *CertificateService) FindExpiringCertificates(threshold time.Duration) []*models.Certificate {
	all := s.store.ListCertificates()
	var expiring []*models.Certificate
	for _, cert := range all {
		if cert.IsActive() && cert.AutoRenew {
			if util.IsExpiring(cert.ValidTo, threshold) {
				expiring = append(expiring, cert)
			}
		}
	}
	return expiring
}

func (s *CertificateService) RenewCertificate(oldCert *models.Certificate) (*models.Certificate, error) {
	newCert := &models.Certificate{
		ID:              util.GenerateID("cert"),
		CommonName:      oldCert.CommonName,
		SANs:            oldCert.SANs,
		SerialNumber:    util.GenerateID("sn"),
		Issuer:          oldCert.Issuer,
		ValidFrom:       util.Now(),
		ValidTo:         util.Now().Add(365 * 24 * time.Hour),
		Status:          models.CertStatusPendingRenewal,
		Version:         oldCert.Version + 1,
		PreviousVersion: oldCert,
		CreatedAt:       util.Now(),
		UpdatedAt:       util.Now(),
		AutoRenew:       oldCert.AutoRenew,
		RenewThreshold:  oldCert.RenewThreshold,
		Tags:            oldCert.Tags,
	}
	
	if err := s.store.CreateCertificate(newCert); err != nil {
		return nil, err
	}
	
	oldCert.Status = models.CertStatusRenewing
	oldCert.UpdatedAt = util.Now()
	if err := s.store.UpdateCertificate(oldCert); err != nil {
		return nil, err
	}
	
	return newCert, nil
}
