package models

import "errors"

var (
	ErrProductNotFound        = errors.New("product not found")
	ErrCouponNotFound         = errors.New("coupon not found")
	ErrMembershipNotFound     = errors.New("membership not found")
	ErrCartNotFound           = errors.New("cart not found")
	
	ErrInvalidAmount          = errors.New("invalid amount: cannot be negative")
	ErrInvalidQuantity        = errors.New("invalid quantity: must be positive")
	ErrInvalidDiscount        = errors.New("invalid discount: discount rate must be between 0 and 1")
	ErrInvalidThreshold       = errors.New("invalid threshold: must be non-negative")
	
	ErrCouponInactive         = errors.New("coupon is inactive")
	ErrThresholdNotMet        = errors.New("order amount does not meet coupon threshold")
	ErrCategoryMismatch       = errors.New("cart contains no products in coupon's applicable category")
	ErrMutexConflict          = errors.New("coupon conflicts with another in the same mutex group")
	ErrStackOrderConflict     = errors.New("coupon stack order conflict detected")
	
	ErrMissingCostPrice       = errors.New("product is missing cost price, cannot calculate margin")
	ErrEmptyCart              = errors.New("cart is empty")
	ErrNoApplicableCoupons    = errors.New("no applicable coupons found")
	ErrNegativeMargin         = errors.New("calculation results in negative gross margin")
	
	ErrJSONUnmarshal          = errors.New("failed to unmarshal JSON")
	ErrJSONMarshal            = errors.New("failed to marshal JSON")
	ErrDatabase               = errors.New("database operation failed")
	ErrValidation             = errors.New("validation failed")
)

type AppError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}

func (e *AppError) Error() string {
	return e.Message
}

func NewAppError(code int, message string, details ...string) *AppError {
	err := &AppError{
		Code:    code,
		Message: message,
	}
	if len(details) > 0 {
		err.Details = details[0]
	}
	return err
}

const (
	ErrCodeBadRequest          = 400
	ErrCodeUnauthorized        = 401
	ErrCodeNotFound            = 404
	ErrCodeConflict            = 409
	ErrCodeUnprocessableEntity = 422
	ErrCodeInternalServer      = 500
)
