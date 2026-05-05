package service

import (
	"test-project/internal/repository"
)

type UserService struct {
	repo *repository.UserRepository
}

func NewUserService(repo *repository.UserRepository) *UserService {
	return &UserService{repo: repo}
}

func (s *UserService) GetUser(id string) (*User, error) {
	return s.repo.FindByID(id)
}

type User struct {
	ID   string
	Name string
}
