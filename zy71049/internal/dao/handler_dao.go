package dao

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
	"print-proof-api/internal/database"
	"print-proof-api/internal/model"
)

func CreateHandler(handler *model.Handler) error {
	handler.ID = uuid.New().String()
	handler.CreatedAt = time.Now()

	query := `INSERT INTO handlers (id, name, role, created_at) VALUES (?, ?, ?, ?)`
	_, err := database.DB.Exec(query, handler.ID, handler.Name, handler.Role, handler.CreatedAt)
	return err
}

func GetHandlerByID(id string) (*model.Handler, error) {
	query := `SELECT id, name, role, created_at FROM handlers WHERE id = ?`
	var h model.Handler
	err := database.DB.QueryRow(query, id).Scan(&h.ID, &h.Name, &h.Role, &h.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &h, err
}

func ListHandlers() ([]*model.Handler, error) {
	query := `SELECT id, name, role, created_at FROM handlers ORDER BY created_at DESC`
	rows, err := database.DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var handlers []*model.Handler
	for rows.Next() {
		var h model.Handler
		err := rows.Scan(&h.ID, &h.Name, &h.Role, &h.CreatedAt)
		if err != nil {
			return nil, err
		}
		handlers = append(handlers, &h)
	}
	return handlers, nil
}
