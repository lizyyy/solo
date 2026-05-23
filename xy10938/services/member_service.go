package services

import (
	"car-wash-queue-api/database"
	"car-wash-queue-api/models"
	"database/sql"
	"fmt"
)

func generateMemberNo() (string, error) {
	var lastMemberNo string
	err := database.DB.QueryRow(`
		SELECT member_no FROM members ORDER BY id DESC LIMIT 1
	`).Scan(&lastMemberNo)
	
	if err == sql.ErrNoRows {
		return "M000001", nil
	}
	if err != nil {
		return "", err
	}

	var seq int
	fmt.Sscanf(lastMemberNo, "M%d", &seq)
	return fmt.Sprintf("M%06d", seq+1), nil
}

func CreateMember(name, phone string, params ...interface{}) (*models.Member, error) {
	if name == "" || phone == "" {
		return nil, fmt.Errorf("姓名和手机号不能为空")
	}

	level := "普通会员"
	balance := 0.0

	if len(params) >= 1 {
		if l, ok := params[0].(string); ok {
			level = l
		}
	}
	if len(params) >= 2 {
		if b, ok := params[1].(float64); ok {
			balance = b
		}
	}

	var existingID int
	err := database.DB.QueryRow(`SELECT id FROM members WHERE phone = ?`, phone).Scan(&existingID)
	if err != sql.ErrNoRows {
		if err == nil {
			return nil, fmt.Errorf("该手机号已注册")
		}
		return nil, err
	}

	memberNo, err := generateMemberNo()
	if err != nil {
		return nil, err
	}

	result, err := database.DB.Exec(`
		INSERT INTO members (member_no, name, phone, level, balance)
		VALUES (?, ?, ?, ?, ?)
	`, memberNo, name, phone, level, balance)
	if err != nil {
		return nil, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}

	return GetMemberByID(int(id))
}

func GetMemberByID(id int) (*models.Member, error) {
	var member models.Member
	err := database.DB.QueryRow(`
		SELECT id, member_no, name, phone, level, balance, created_at, updated_at
		FROM members WHERE id = ?
	`, id).Scan(&member.ID, &member.MemberNo, &member.Name, &member.Phone,
		&member.Level, &member.Balance, &member.CreatedAt, &member.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &member, nil
}

func GetMemberByPhone(phone string) (*models.Member, error) {
	var member models.Member
	err := database.DB.QueryRow(`
		SELECT id, member_no, name, phone, level, balance, created_at, updated_at
		FROM members WHERE phone = ?
	`, phone).Scan(&member.ID, &member.MemberNo, &member.Name, &member.Phone,
		&member.Level, &member.Balance, &member.CreatedAt, &member.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &member, nil
}

func GetMemberList() ([]models.Member, error) {
	rows, err := database.DB.Query(`
		SELECT id, member_no, name, phone, level, balance, created_at, updated_at
		FROM members ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []models.Member
	for rows.Next() {
		var m models.Member
		err := rows.Scan(&m.ID, &m.MemberNo, &m.Name, &m.Phone,
			&m.Level, &m.Balance, &m.CreatedAt, &m.UpdatedAt)
		if err != nil {
			return nil, err
		}
		members = append(members, m)
	}
	return members, nil
}

func UpdateMember(id int, data map[string]interface{}) (*models.Member, error) {
	_, err := GetMemberByID(id)
	if err != nil {
		return nil, fmt.Errorf("会员不存在")
	}

	updates := ""
	params := []interface{}{}
	first := true

	allowedFields := []string{"name", "phone", "level", "balance"}
	for _, field := range allowedFields {
		if val, ok := data[field]; ok {
			if !first {
				updates += ", "
			}
			updates += fmt.Sprintf("%s = ?", field)
			params = append(params, val)
			first = false
		}
	}

	if updates == "" {
		return nil, fmt.Errorf("没有有效更新字段")
	}

	params = append(params, id)
	_, err = database.DB.Exec(`UPDATE members SET `+updates+` WHERE id = ?`, params...)
	if err != nil {
		return nil, err
	}

	return GetMemberByID(id)
}
