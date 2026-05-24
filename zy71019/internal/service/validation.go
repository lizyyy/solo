package service

import (
	"sort"
	"time"

	"damage-arbitration/internal/database"
	"damage-arbitration/internal/models"
)

type ValidationService struct{}

func NewValidationService() *ValidationService {
	return &ValidationService{}
}

func (s *ValidationService) ValidatePhotos(photos []models.Photo, pickupTime, returnTime *time.Time) *models.ValidationResult {
	result := &models.ValidationResult{
		Valid:    true,
		Issues:   []string{},
		Warnings: []string{},
	}

	if len(photos) == 0 {
		result.Valid = false
		result.Issues = append(result.Issues, "未提供任何照片")
		return result
	}

	pickupPhotos := filterPhotosByType(photos, "pickup")
	returnPhotos := filterPhotosByType(photos, "return")

	if len(pickupPhotos) == 0 {
		result.Warnings = append(result.Warnings, "缺少取车照片")
	}
	if len(returnPhotos) == 0 {
		result.Warnings = append(result.Warnings, "缺少还车照片")
	}

	if !s.validatePhotoTimeContinuity(pickupPhotos, returnPhotos, pickupTime, returnTime) {
		result.Warnings = append(result.Warnings, "照片时间不连续，部分照片时间超出取还车时间范围")
	}

	if !s.validatePhotoSequence(pickupPhotos, returnPhotos) {
		result.Warnings = append(result.Warnings, "存在还车照片时间早于取车照片的情况")
	}

	return result
}

func (s *ValidationService) validatePhotoTimeContinuity(pickupPhotos, returnPhotos []models.Photo, pickupTime, returnTime *time.Time) bool {
	if pickupTime == nil || returnTime == nil {
		return true
	}

	tolerance := 30 * time.Minute

	for _, p := range pickupPhotos {
		if p.PhotoTime.Before(pickupTime.Add(-tolerance)) || p.PhotoTime.After(pickupTime.Add(tolerance)) {
			return false
		}
	}

	for _, p := range returnPhotos {
		if p.PhotoTime.Before(returnTime.Add(-tolerance)) || p.PhotoTime.After(returnTime.Add(tolerance)) {
			return false
		}
	}

	return true
}

func (s *ValidationService) validatePhotoSequence(pickupPhotos, returnPhotos []models.Photo) bool {
	if len(pickupPhotos) == 0 || len(returnPhotos) == 0 {
		return true
	}

	latestPickup := getLatestPhotoTime(pickupPhotos)
	earliestReturn := getEarliestPhotoTime(returnPhotos)

	return earliestReturn.After(latestPickup)
}

func (s *ValidationService) CheckDuplicateDamage(vehicleID string, damageType models.DamageType, location string) (*models.DamageMatchResult, error) {
	return database.FindVehicleDamageHistory(vehicleID, damageType, location)
}

func filterPhotosByType(photos []models.Photo, photoType string) []models.Photo {
	var result []models.Photo
	for _, p := range photos {
		if p.PhotoType == photoType {
			result = append(result, p)
		}
	}
	return result
}

func getLatestPhotoTime(photos []models.Photo) time.Time {
	if len(photos) == 0 {
		return time.Time{}
	}
	sort.Slice(photos, func(i, j int) bool {
		return photos[i].PhotoTime.After(photos[j].PhotoTime)
	})
	return photos[0].PhotoTime
}

func getEarliestPhotoTime(photos []models.Photo) time.Time {
	if len(photos) == 0 {
		return time.Time{}
	}
	sort.Slice(photos, func(i, j int) bool {
		return photos[i].PhotoTime.Before(photos[j].PhotoTime)
	})
	return photos[0].PhotoTime
}
