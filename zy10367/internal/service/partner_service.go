package service

import (
	"cert-renewal/internal/model"
	"cert-renewal/internal/repository"
)

type PartnerService interface {
	CreatePartner(req *model.CreatePartnerRequest) (*model.Partner, error)
	GetPartner(id string) (*model.Partner, error)
	ListPartners(params *model.QueryParams) ([]model.Partner, int64, error)
}

type partnerService struct {
	partnerRepo repository.PartnerRepository
}

func NewPartnerService() PartnerService {
	return &partnerService{
		partnerRepo: repository.NewPartnerRepository(),
	}
}

func (s *partnerService) CreatePartner(req *model.CreatePartnerRequest) (*model.Partner, error) {
	existing, _ := s.partnerRepo.GetByCode(req.Code)
	if existing != nil {
		return nil, model.ErrPartnerAlreadyExists
	}

	partner := &model.Partner{
		Name:        req.Name,
		Code:        req.Code,
		Description: req.Description,
		Status:      model.PartnerStatusActive,
		ContactName: req.ContactName,
		ContactEmail: req.ContactEmail,
		ContactPhone: req.ContactPhone,
	}

	if err := s.partnerRepo.Create(partner); err != nil {
		return nil, err
	}

	return partner, nil
}

func (s *partnerService) GetPartner(id string) (*model.Partner, error) {
	return s.partnerRepo.GetByID(id)
}

func (s *partnerService) ListPartners(params *model.QueryParams) ([]model.Partner, int64, error) {
	return s.partnerRepo.List(params)
}
