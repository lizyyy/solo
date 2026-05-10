package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"device-borrow-system/internal/eventstore"
	"device-borrow-system/internal/models"
	"device-borrow-system/internal/repository"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
)

type UserService struct {
	userRepo   *repository.UserRepository
	eventStore *eventstore.EventStore
	redis      *redis.Client
	jwtSecret  string
}

func NewUserService(userRepo *repository.UserRepository, es *eventstore.EventStore, redis *redis.Client, jwtSecret string) *UserService {
	return &UserService{
		userRepo:   userRepo,
		eventStore: es,
		redis:      redis,
		jwtSecret:  jwtSecret,
	}
}

func (s *UserService) Register(username, email, password, fullName, department string) (*models.User, error) {
	if _, err := s.userRepo.FindByUsername(username); err == nil {
		return nil, errors.New("username already exists")
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	user := &models.User{
		Username:     username,
		Email:        email,
		PasswordHash: string(passwordHash),
		FullName:     fullName,
		Department:   department,
		Role:         "user",
		IsActive:     true,
	}

	if err := s.userRepo.Create(user); err != nil {
		return nil, err
	}

	event := &models.Event{
		AggregateType: "user",
		AggregateID:   user.ID,
		EventType:     "user.created",
		Payload: map[string]interface{}{
			"username":   user.Username,
			"email":      user.Email,
			"full_name":  user.FullName,
			"department": user.Department,
			"role":       user.Role,
		},
		Metadata: map[string]interface{}{
			"timestamp": time.Now().Unix(),
		},
	}
	s.eventStore.AppendEvent(context.Background(), event)

	return user, nil
}

func (s *UserService) Login(username, password string) (string, *models.User, error) {
	user, err := s.userRepo.FindByUsername(username)
	if err != nil {
		return "", nil, errors.New("invalid credentials")
	}

	if !user.IsActive {
		return "", nil, errors.New("account is disabled")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return "", nil, errors.New("invalid credentials")
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": user.ID.String(),
		"username": user.Username,
		"role":     user.Role,
		"exp":      time.Now().Add(24 * time.Hour).Unix(),
	})

	tokenString, err := token.SignedString([]byte(s.jwtSecret))
	if err != nil {
		return "", nil, err
	}

	return tokenString, user, nil
}

func (s *UserService) GetUser(id uuid.UUID) (*models.User, error) {
	cacheKey := fmt.Sprintf("cache:user:%s", id.String())
	if s.redis != nil {
		ctx := context.Background()
		if cached, err := s.redis.Get(ctx, cacheKey).Result(); err == nil {
			var user models.User
			if err := parseJSON(cached, &user); err == nil {
				return &user, nil
			}
		}
	}

	user, err := s.userRepo.FindByID(id)
	if err != nil {
		return nil, err
	}

	if s.redis != nil {
		ctx := context.Background()
		jsonData, _ := toJSON(user)
		s.redis.Set(ctx, cacheKey, jsonData, 5*time.Minute)
	}

	return user, nil
}

func (s *UserService) ListUsers(page, pageSize int) ([]models.User, int64, error) {
	return s.userRepo.FindAll(page, pageSize)
}

func (s *UserService) UpdateUser(id uuid.UUID, updates map[string]interface{}, expectedVersion int64) (*models.User, error) {
	user, err := s.userRepo.FindByID(id)
	if err != nil {
		return nil, err
	}

	if expectedVersion > 0 && user.Version != expectedVersion {
		return nil, errors.New("conflict: resource has been modified")
	}

	beforeState := map[string]interface{}{
		"username":   user.Username,
		"email":      user.Email,
		"full_name":  user.FullName,
		"department": user.Department,
		"role":       user.Role,
		"is_active":  user.IsActive,
	}

	if email, ok := updates["email"].(string); ok {
		user.Email = email
	}
	if fullName, ok := updates["full_name"].(string); ok {
		user.FullName = fullName
	}
	if department, ok := updates["department"].(string); ok {
		user.Department = department
	}
	if role, ok := updates["role"].(string); ok {
		user.Role = role
	}
	if isActive, ok := updates["is_active"].(bool); ok {
		user.IsActive = isActive
	}

	if err := s.userRepo.Update(user); err != nil {
		return nil, err
	}

	event := &models.Event{
		AggregateType: "user",
		AggregateID:   user.ID,
		EventType:     "user.updated",
		Payload: map[string]interface{}{
			"before": beforeState,
			"after": map[string]interface{}{
				"email":      user.Email,
				"full_name":  user.FullName,
				"department": user.Department,
				"role":       user.Role,
				"is_active":  user.IsActive,
			},
		},
		Metadata: map[string]interface{}{
			"timestamp": time.Now().Unix(),
		},
	}
	s.eventStore.AppendEvent(context.Background(), event)

	if s.redis != nil {
		ctx := context.Background()
		cacheKey := fmt.Sprintf("cache:user:%s", id.String())
		s.redis.Del(ctx, cacheKey)
	}

	return user, nil
}

type DeviceService struct {
	deviceRepo *repository.DeviceRepository
	eventStore *eventstore.EventStore
	redis      *redis.Client
}

func NewDeviceService(deviceRepo *repository.DeviceRepository, es *eventstore.EventStore, redis *redis.Client) *DeviceService {
	return &DeviceService{
		deviceRepo: deviceRepo,
		eventStore: es,
		redis:      redis,
	}
}

func (s *DeviceService) CreateDevice(code, name, category, description, location string, createdBy uuid.UUID) (*models.Device, error) {
	if _, err := s.deviceRepo.FindByCode(code); err == nil {
		return nil, errors.New("device code already exists")
	}

	device := &models.Device{
		DeviceCode:  code,
		Name:        name,
		Category:    category,
		Description: description,
		Location:    location,
		Status:      "available",
		Condition:   "good",
		CreatedBy:   &createdBy,
	}

	if err := s.deviceRepo.Create(device); err != nil {
		return nil, err
	}

	event := &models.Event{
		AggregateType: "device",
		AggregateID:   device.ID,
		EventType:     "device.created",
		Payload: map[string]interface{}{
			"device_code": device.DeviceCode,
			"name":        device.Name,
			"category":    device.Category,
			"description": device.Description,
			"location":    device.Location,
			"status":      device.Status,
			"condition":   device.Condition,
		},
		Metadata: map[string]interface{}{
			"timestamp": time.Now().Unix(),
			"created_by": createdBy.String(),
		},
		CreatedBy: &createdBy,
	}
	s.eventStore.AppendEvent(context.Background(), event)

	return device, nil
}

func (s *DeviceService) GetDevice(id uuid.UUID) (*models.Device, error) {
	cacheKey := fmt.Sprintf("cache:device:%s", id.String())
	if s.redis != nil {
		ctx := context.Background()
		if cached, err := s.redis.Get(ctx, cacheKey).Result(); err == nil {
			var device models.Device
			if err := parseJSON(cached, &device); err == nil {
				return &device, nil
			}
		}
	}

	device, err := s.deviceRepo.FindByID(id)
	if err != nil {
		return nil, err
	}

	if s.redis != nil {
		ctx := context.Background()
		jsonData, _ := toJSON(device)
		s.redis.Set(ctx, cacheKey, jsonData, 5*time.Minute)
	}

	return device, nil
}

func (s *DeviceService) ListDevices(filters map[string]interface{}, page, pageSize int) ([]models.Device, int64, error) {
	return s.deviceRepo.FindAll(filters, page, pageSize)
}

func (s *DeviceService) UpdateDevice(id uuid.UUID, updates map[string]interface{}, expectedVersion int64, updatedBy uuid.UUID) (*models.Device, error) {
	device, err := s.deviceRepo.FindByID(id)
	if err != nil {
		return nil, err
	}

	if expectedVersion > 0 && device.Version != expectedVersion {
		return nil, errors.New("conflict: resource has been modified by another user")
	}

	beforeState := map[string]interface{}{
		"name":        device.Name,
		"category":    device.Category,
		"description": device.Description,
		"location":    device.Location,
		"condition":   device.Condition,
	}

	if name, ok := updates["name"].(string); ok {
		device.Name = name
	}
	if category, ok := updates["category"].(string); ok {
		device.Category = category
	}
	if description, ok := updates["description"].(string); ok {
		device.Description = description
	}
	if location, ok := updates["location"].(string); ok {
		device.Location = location
	}
	if condition, ok := updates["condition"].(string); ok {
		device.Condition = condition
	}

	if err := s.deviceRepo.UpdateWithVersion(device, expectedVersion); err != nil {
		return nil, err
	}

	event := &models.Event{
		AggregateType: "device",
		AggregateID:   device.ID,
		EventType:     "device.updated",
		Payload: map[string]interface{}{
			"before": beforeState,
			"after": map[string]interface{}{
				"name":        device.Name,
				"category":    device.Category,
				"description": device.Description,
				"location":    device.Location,
				"condition":   device.Condition,
			},
		},
		Metadata: map[string]interface{}{
			"timestamp":     time.Now().Unix(),
			"updated_by":    updatedBy.String(),
			"old_version":   expectedVersion,
			"new_version":   device.Version,
		},
		CreatedBy: &updatedBy,
	}
	s.eventStore.AppendEvent(context.Background(), event)

	if s.redis != nil {
		ctx := context.Background()
		cacheKey := fmt.Sprintf("cache:device:%s", id.String())
		s.redis.Del(ctx, cacheKey)
	}

	return device, nil
}

func (s *DeviceService) DeleteDevice(id uuid.UUID, deletedBy uuid.UUID) error {
	device, err := s.deviceRepo.FindByID(id)
	if err != nil {
		return err
	}

	if device.Status == "borrowed" {
		return errors.New("cannot delete a borrowed device")
	}

	if err := s.deviceRepo.Delete(id); err != nil {
		return err
	}

	event := &models.Event{
		AggregateType: "device",
		AggregateID:   device.ID,
		EventType:     "device.deleted",
		Payload: map[string]interface{}{
			"device_code": device.DeviceCode,
			"name":        device.Name,
		},
		Metadata: map[string]interface{}{
			"timestamp":  time.Now().Unix(),
			"deleted_by": deletedBy.String(),
		},
		CreatedBy: &deletedBy,
	}
	s.eventStore.AppendEvent(context.Background(), event)

	if s.redis != nil {
		ctx := context.Background()
		cacheKey := fmt.Sprintf("cache:device:%s", id.String())
		s.redis.Del(ctx, cacheKey)
	}

	return nil
}

type BorrowService struct {
	borrowRepo *repository.BorrowRepository
	deviceRepo *repository.DeviceRepository
	eventStore *eventstore.EventStore
	redis      *redis.Client
}

func NewBorrowService(borrowRepo *repository.BorrowRepository, deviceRepo *repository.DeviceRepository, es *eventstore.EventStore, redis *redis.Client) *BorrowService {
	return &BorrowService{
		borrowRepo: borrowRepo,
		deviceRepo: deviceRepo,
		eventStore: es,
		redis:      redis,
	}
}

func (s *BorrowService) BorrowDevice(deviceID, borrowerID uuid.UUID, purpose string, expectedReturnDate *time.Time, createdBy uuid.UUID) (*models.BorrowRecord, error) {
	ctx := context.Background()

	lockKey := fmt.Sprintf("lock:borrow:%s", deviceID.String())
	if s.redis != nil {
		locked, err := s.redis.SetNX(ctx, lockKey, borrowerID.String(), 30*time.Second).Result()
		if err != nil || !locked {
			return nil, errors.New("device is being processed by another request, please try again")
		}
		defer s.redis.Del(ctx, lockKey)
	}

	device, err := s.deviceRepo.FindByID(deviceID)
	if err != nil {
		return nil, errors.New("device not found")
	}

	if device.Status != "available" {
		return nil, errors.New("device is not available for borrowing")
	}

	record := &models.BorrowRecord{
		DeviceID:           deviceID,
		BorrowerID:         borrowerID,
		Purpose:            purpose,
		ExpectedReturnDate: expectedReturnDate,
		Status:             "borrowed",
		CreatedBy:          &createdBy,
	}

	if err := s.borrowRepo.Create(record); err != nil {
		return nil, err
	}

	device.Status = "borrowed"
	device.LastEventID = &record.ID
	if err := s.deviceRepo.Update(device); err != nil {
		return nil, err
	}

	event := &models.Event{
		AggregateType: "device",
		AggregateID:   deviceID,
		EventType:     "device.borrowed",
		Payload: map[string]interface{}{
			"record_id":            record.ID.String(),
			"borrower_id":          borrowerID.String(),
			"purpose":              purpose,
			"expected_return_date": expectedReturnDate,
			"old_status":           "available",
			"new_status":           "borrowed",
		},
		Metadata: map[string]interface{}{
			"timestamp": time.Now().Unix(),
			"action_by": createdBy.String(),
		},
		CreatedBy: &createdBy,
	}
	s.eventStore.AppendEvent(ctx, event)

	borrowEvent := &models.Event{
		AggregateType: "borrow",
		AggregateID:   record.ID,
		EventType:     "borrow.created",
		Payload: map[string]interface{}{
			"device_id":            deviceID.String(),
			"borrower_id":          borrowerID.String(),
			"purpose":              purpose,
			"expected_return_date": expectedReturnDate,
			"status":               "borrowed",
		},
		Metadata: map[string]interface{}{
			"timestamp": time.Now().Unix(),
		},
		CreatedBy: &createdBy,
	}
	s.eventStore.AppendEvent(ctx, borrowEvent)

	if s.redis != nil {
		cacheKey := fmt.Sprintf("cache:device:%s", deviceID.String())
		s.redis.Del(ctx, cacheKey)
	}

	return record, nil
}

func (s *BorrowService) ReturnDevice(recordID uuid.UUID, notes string, returnedBy uuid.UUID) (*models.BorrowRecord, error) {
	ctx := context.Background()

	record, err := s.borrowRepo.FindByID(recordID)
	if err != nil {
		return nil, errors.New("borrow record not found")
	}

	if record.Status != "borrowed" {
		return nil, errors.New("this device is already returned")
	}

	device, err := s.deviceRepo.FindByID(record.DeviceID)
	if err != nil {
		return nil, errors.New("device not found")
	}

	now := time.Now()
	record.ActualReturnDate = &now
	record.Status = "returned"
	record.Notes = notes

	if err := s.borrowRepo.Update(record); err != nil {
		return nil, err
	}

	device.Status = "available"
	device.LastEventID = &record.ID
	if err := s.deviceRepo.Update(device); err != nil {
		return nil, err
	}

	event := &models.Event{
		AggregateType: "device",
		AggregateID:   record.DeviceID,
		EventType:     "device.returned",
		Payload: map[string]interface{}{
			"record_id":          record.ID.String(),
			"actual_return_date": now,
			"notes":              notes,
			"old_status":         "borrowed",
			"new_status":         "available",
		},
		Metadata: map[string]interface{}{
			"timestamp": time.Now().Unix(),
			"action_by": returnedBy.String(),
		},
		CreatedBy: &returnedBy,
	}
	s.eventStore.AppendEvent(ctx, event)

	borrowEvent := &models.Event{
		AggregateType: "borrow",
		AggregateID:   record.ID,
		EventType:     "borrow.completed",
		Payload: map[string]interface{}{
			"actual_return_date": now,
			"notes":              notes,
			"old_status":         "borrowed",
			"new_status":         "returned",
		},
		Metadata: map[string]interface{}{
			"timestamp": time.Now().Unix(),
		},
		CreatedBy: &returnedBy,
	}
	s.eventStore.AppendEvent(ctx, borrowEvent)

	if s.redis != nil {
		cacheKey := fmt.Sprintf("cache:device:%s", record.DeviceID.String())
		s.redis.Del(ctx, cacheKey)
	}

	return record, nil
}

func (s *BorrowService) GetBorrowRecord(id uuid.UUID) (*models.BorrowRecord, error) {
	return s.borrowRepo.FindByID(id)
}

func (s *BorrowService) ListBorrowRecords(filters map[string]interface{}, page, pageSize int) ([]models.BorrowRecord, int64, error) {
	return s.borrowRepo.FindAll(filters, page, pageSize)
}

func (s *BorrowService) GetUserBorrowHistory(userID uuid.UUID, page, pageSize int) ([]models.BorrowRecord, int64, error) {
	return s.borrowRepo.FindByUser(userID, page, pageSize)
}

func (s *BorrowService) GetActiveBorrow(deviceID uuid.UUID) (*models.BorrowRecord, error) {
	return s.borrowRepo.FindActiveByDevice(deviceID)
}

func generateIdempotencyKey(userID, action string, data []byte) string {
	h := sha256.New()
	h.Write([]byte(userID))
	h.Write([]byte(action))
	h.Write(data)
	return hex.EncodeToString(h.Sum(nil))
}

func toJSON(v interface{}) (string, error) {
	data, err := jsonMarshal(v)
	return string(data), err
}

func parseJSON(data string, v interface{}) error {
	return jsonUnmarshal([]byte(data), v)
}

func jsonMarshal(v interface{}) ([]byte, error) {
	return json.Marshal(v)
}

func jsonUnmarshal(data []byte, v interface{}) error {
	return json.Unmarshal(data, v)
}
