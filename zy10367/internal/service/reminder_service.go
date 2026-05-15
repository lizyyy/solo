package service

import (
	"cert-renewal/internal/model"
	"cert-renewal/internal/repository"
	"time"
)

type RenewalReminderService interface {
	TriggerReminders(req *model.TriggerReminderRequest) ([]model.RenewalReminder, error)
	ListReminders(params *model.ReminderQueryParams) ([]model.RenewalReminder, int64, error)
	MarkSent(req *model.MarkReminderSentRequest) (*model.RenewalReminder, error)
}

type reminderService struct {
	certRepo     repository.CertRepository
	reminderRepo repository.ReminderRepository
}

func NewRenewalReminderService() RenewalReminderService {
	return &reminderService{
		certRepo:     repository.NewCertRepository(),
		reminderRepo: repository.NewReminderRepository(),
	}
}

func (s *reminderService) TriggerReminders(req *model.TriggerReminderRequest) ([]model.RenewalReminder, error) {
	expireDate := time.Now().AddDate(0, 0, req.DaysAhead)

	certs, err := s.certRepo.ListExpiringCerts(req.PartnerID, expireDate)
	if err != nil {
		return nil, err
	}

	if len(certs) == 0 {
		return []model.RenewalReminder{}, nil
	}

	var reminders []model.RenewalReminder
	now := time.Now().UTC()

	for _, cert := range certs {
		reminder := model.RenewalReminder{
			PartnerID:     cert.PartnerID,
			CertID:        cert.ID,
			CertSubject:   cert.Subject,
			ExpireAt:      cert.NotAfter,
			RemindAt:      now,
			Status:        model.ReminderStatusPending,
			ReminderCount: 1,
			Remark:        "自动触发续租提醒",
		}

		if err := s.reminderRepo.Create(&reminder, nil); err != nil {
			return nil, err
		}
		reminders = append(reminders, reminder)
	}

	return reminders, nil
}

func (s *reminderService) ListReminders(params *model.ReminderQueryParams) ([]model.RenewalReminder, int64, error) {
	return s.reminderRepo.List(params)
}

func (s *reminderService) MarkSent(req *model.MarkReminderSentRequest) (*model.RenewalReminder, error) {
	reminder, err := s.reminderRepo.GetByID(req.ReminderID)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	reminder.Status = model.ReminderStatusSent
	reminder.SentBy = req.SentBy
	reminder.SentAt = &now
	reminder.ReminderCount++

	if err := s.reminderRepo.Update(reminder, nil); err != nil {
		return nil, err
	}

	return reminder, nil
}
