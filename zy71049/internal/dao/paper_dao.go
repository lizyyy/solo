package dao

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
	"print-proof-api/internal/database"
	"print-proof-api/internal/model"
)

func CreatePaper(paper *model.Paper) error {
	paper.ID = uuid.New().String()
	paper.CreatedAt = time.Now()

	query := `INSERT INTO papers (id, name, type, weight, size, is_approved, created_at)
	          VALUES (?, ?, ?, ?, ?, ?, ?)`

	_, err := database.DB.Exec(query, paper.ID, paper.Name, paper.Type, paper.Weight,
		paper.Size, paper.IsApproved, paper.CreatedAt)
	return err
}

func GetPaperByID(id string) (*model.Paper, error) {
	query := `SELECT id, name, type, weight, size, is_approved, created_at
	          FROM papers WHERE id = ?`

	var paper model.Paper
	err := database.DB.QueryRow(query, id).Scan(&paper.ID, &paper.Name, &paper.Type, &paper.Weight,
		&paper.Size, &paper.IsApproved, &paper.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &paper, err
}

func ListPapers() ([]*model.Paper, error) {
	query := `SELECT id, name, type, weight, size, is_approved, created_at FROM papers ORDER BY created_at DESC`

	rows, err := database.DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var papers []*model.Paper
	for rows.Next() {
		var paper model.Paper
		err := rows.Scan(&paper.ID, &paper.Name, &paper.Type, &paper.Weight,
			&paper.Size, &paper.IsApproved, &paper.CreatedAt)
		if err != nil {
			return nil, err
		}
		papers = append(papers, &paper)
	}
	return papers, nil
}

func UpdatePaperApproval(id string, isApproved bool) error {
	query := `UPDATE papers SET is_approved = ? WHERE id = ?`
	_, err := database.DB.Exec(query, isApproved, id)
	return err
}
