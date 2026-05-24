package service

import (
	"print-proof-api/internal/model"
)

type ColorValidator struct {
	CMYKMin int
	CMYKMax int
}

func NewColorValidator() *ColorValidator {
	return &ColorValidator{
		CMYKMin: 0,
		CMYKMax: 100,
	}
}

func (cv *ColorValidator) ValidateCMYK(c, m, y, k int) (bool, []string) {
	var errors []string

	if c < cv.CMYKMin || c > cv.CMYKMax {
		errors = append(errors, "C value out of range")
	}
	if m < cv.CMYKMin || m > cv.CMYKMax {
		errors = append(errors, "M value out of range")
	}
	if y < cv.CMYKMin || y > cv.CMYKMax {
		errors = append(errors, "Y value out of range")
	}
	if k < cv.CMYKMin || k > cv.CMYKMax {
		errors = append(errors, "K value out of range")
	}

	return len(errors) == 0, errors
}

func (cv *ColorValidator) CheckOutOfGamut(c, m, y, k int) bool {
	total := c + m + y + k
	if total > 280 {
		return true
	}

	if c > 95 && m > 95 && y > 95 && k > 95 {
		return true
	}

	if c < 5 && m < 5 && y < 5 && k < 5 {
		return true
	}

	return false
}

func (cv *ColorValidator) ValidateColorValue(color *model.ColorValue) (bool, []string) {
	if color.ColorType == "cmyk" {
		valid, errors := cv.ValidateCMYK(color.CValue, color.MValue, color.YValue, color.KValue)
		if !valid {
			return false, errors
		}
		color.IsOutOfGamut = cv.CheckOutOfGamut(color.CValue, color.MValue, color.YValue, color.KValue)
	}
	return true, nil
}

func (cv *ColorValidator) ValidateColors(colors []*model.ColorValue) (bool, []string) {
	var allErrors []string
	hasError := false

	for _, color := range colors {
		valid, errors := cv.ValidateColorValue(color)
		if !valid {
			hasError = true
			for _, e := range errors {
				allErrors = append(allErrors, color.ColorName+": "+e)
			}
		}
	}

	return !hasError, allErrors
}
