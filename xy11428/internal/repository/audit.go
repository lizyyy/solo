package repository

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
	"visitor-pass/internal/config"
	"visitor-pass/internal/model"
)

func LogAudit(userID, username, role, action, resourceType, resourceID, oldValue, newValue, ip, userAgent string) error {
	id := uuid.NewString()
	now := time.Now()

	_, err := config.DB.Exec(
		`INSERT INTO audit_logs (id, user_id, username, role, action, resource_type, resource_id, old_value, new_value, ip_address, user_agent, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, userID, username, role, action, resourceType, resourceID, oldValue, newValue, ip, userAgent, now,
	)
	return err
}

func ListAuditLogs(offset, limit int) ([]model.AuditLog, int, error) {
	var logs []model.AuditLog
	var total int

	err := config.DB.QueryRow(`SELECT COUNT(*) FROM audit_logs`).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	rows, err := config.DB.Query(
		`SELECT id, user_id, username, role, action, resource_type, resource_id, old_value, new_value, ip_address, user_agent, created_at
		 FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?`,
		limit, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	for rows.Next() {
		var log model.AuditLog
		err := rows.Scan(
			&log.ID, &log.UserID, &log.Username, &log.Role, &log.Action,
			&log.ResourceType, &log.ResourceID, &log.OldValue, &log.NewValue,
			&log.IPAddress, &log.UserAgent, &log.CreatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		logs = append(logs, log)
	}

	return logs, total, nil
}

func GetUserByUsername(username string) (*model.User, error) {
	var user model.User
	err := config.DB.QueryRow(
		`SELECT id, username, password, role, created_at FROM users WHERE username = ?`,
		username,
	).Scan(&user.ID, &user.Username, &user.Password, &user.Role, &user.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func CreateUser(user *model.User) error {
	_, err := config.DB.Exec(
		`INSERT INTO users (id, username, password, role, created_at) VALUES (?, ?, ?, ?, ?)`,
		user.ID, user.Username, user.Password, user.Role, user.CreatedAt,
	)
	return err
}

func ListUsers() ([]model.User, error) {
	rows, err := config.DB.Query(`SELECT id, username, role, created_at FROM users`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []model.User
	for rows.Next() {
		var u model.User
		if err := rows.Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, nil
}
