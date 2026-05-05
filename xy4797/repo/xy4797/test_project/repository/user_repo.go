package repository

import (
	"errors"
)

type User struct {
	ID   int
	Name string
	Age  int
}

var users = make(map[int]*User)

// TODO: 添加数据库连接
// FIXME: 2023-12-01 这个实现是模拟的，需要替换为真实数据库

func GetUserByID(id int) (*User, error) {
	user, exists := users[id]
	if !exists {
		return nil, errors.New("user not found")
	}
	return user, nil
}

func CreateUser(user *User) error {
	if user == nil {
		return errors.New("invalid user")
	}
	users[user.ID] = user
	return nil
}

func UpdateUser(user *User) error {
	if user == nil {
		return errors.New("invalid user")
	}
	users[user.ID] = user
	return nil
}

func DeleteUser(id int) error {
	delete(users, id)
	return nil
}

// TODO: 需要添加批量查询功能
func GetAllUsers() ([]*User, error) {
	var result []*User
	for _, user := range users {
		result = append(result, user)
	}
	return result, nil
}
