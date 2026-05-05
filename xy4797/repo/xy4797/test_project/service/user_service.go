package service

import (
	"errors"

	"test-project/repository"
)

var ErrUserNotFound = errors.New("user not found")

// TODO: 2024-02-15 添加用户验证逻辑

func GetUserByID(id int) (*repository.User, error) {
	user, err := repository.GetUserByID(id)
	if err != nil {
		// 违规：裸返回 error
		return nil, err
	}
	return user, nil
}

func CreateUser(user *repository.User) error {
	// 违规：裸返回 error
	return repository.CreateUser(user)
}

func UpdateUser(user *repository.User) error {
	if user == nil {
		// 违规：裸返回 error
		return errors.New("invalid user")
	}

	// 正确做法：包装错误
	err := repository.UpdateUser(user)
	if err != nil {
		return err
	}
	return nil
}

func DeleteUser(id int) error {
	// 违规：裸返回 error
	return repository.DeleteUser(id)
}
