package service

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/idempotent-payment-api/internal/model"
)

type ChannelService struct {
}

func NewChannelService() *ChannelService {
	return &ChannelService{}
}

func (s *ChannelService) SubmitPayment(payment *model.PaymentInstruction) (string, error) {
	fmt.Printf("[Channel %s] Submitting payment %s, amount: %d %s\n",
		payment.Channel, payment.PaymentNo, payment.Amount, payment.Currency)

	time.Sleep(100 * time.Millisecond)

	channelOrderNo := fmt.Sprintf("CH%s%s", time.Now().Format("20060102150405"), uuid.New().String()[:6])
	fmt.Printf("[Channel %s] Payment %s submitted successfully, channel order no: %s\n",
		payment.Channel, payment.PaymentNo, channelOrderNo)

	return channelOrderNo, nil
}

func (s *ChannelService) SubmitCancel(payment *model.PaymentInstruction) (string, error) {
	fmt.Printf("[Channel %s] Submitting cancel for payment %s\n",
		payment.Channel, payment.PaymentNo)

	time.Sleep(100 * time.Millisecond)

	channelCancelNo := fmt.Sprintf("CAN%s%s", time.Now().Format("20060102150405"), uuid.New().String()[:6])
	fmt.Printf("[Channel %s] Cancel for payment %s submitted successfully, cancel no: %s\n",
		payment.Channel, payment.PaymentNo, channelCancelNo)

	return channelCancelNo, nil
}

func (s *ChannelService) QueryStatus(payment *model.PaymentInstruction) (status string, isSuccess bool, err error) {
	fmt.Printf("[Channel %s] Querying status for payment %s, channel order: %s\n",
		payment.Channel, payment.PaymentNo, payment.ChannelOrderNo)

	time.Sleep(50 * time.Millisecond)

	duration := time.Since(payment.CreatedAt)

	if duration > 30*time.Second {
		return "SUCCESS", true, nil
	} else if duration > 20*time.Second {
		return "FAILED", false, nil
	}

	return "PROCESSING", false, nil
}
