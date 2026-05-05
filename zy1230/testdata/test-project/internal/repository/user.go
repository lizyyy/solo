package repository

import (
	"test-project/internal/service"
)

type UserRepository struct {
	userService *service.UserService
}

func NewUserRepository(us *service.UserService) *UserRepository {
	return &UserRepository{userService: us}
}

func (r *UserRepository) FindByID(id string) (*service.User, error) {
	return &service.User{
		ID:   id,
		Name: "Test User",
	}, nil
}
