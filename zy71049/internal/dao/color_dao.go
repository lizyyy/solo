package dao

import (
	"github.com/google/uuid"
	"print-proof-api/internal/database"
	"print-proof-api/internal/model"
)

func CreateColorValue(color *model.ColorValue) error {
	color.ID = uuid.New().String()

	query := `INSERT INTO color_values (id, proof_version_id, color_type, color_name,
	          c_value, m_value, y_value, k_value, hex_value, is_out_of_gamut)
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	_, err := database.DB.Exec(query, color.ID, color.ProofVersionID, color.ColorType, color.ColorName,
		color.CValue, color.MValue, color.YValue, color.KValue, color.HexValue, color.IsOutOfGamut)
	return err
}

func GetColorValuesByVersion(versionID string) ([]*model.ColorValue, error) {
	query := `SELECT id, proof_version_id, color_type, color_name, c_value, m_value,
	          y_value, k_value, hex_value, is_out_of_gamut
	          FROM color_values WHERE proof_version_id = ?`

	rows, err := database.DB.Query(query, versionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var colors []*model.ColorValue
	for rows.Next() {
		var c model.ColorValue
		err := rows.Scan(&c.ID, &c.ProofVersionID, &c.ColorType, &c.ColorName,
			&c.CValue, &c.MValue, &c.YValue, &c.KValue, &c.HexValue, &c.IsOutOfGamut)
		if err != nil {
			return nil, err
		}
		colors = append(colors, &c)
	}
	return colors, nil
}

func DeleteColorValuesByVersion(versionID string) error {
	query := `DELETE FROM color_values WHERE proof_version_id = ?`
	_, err := database.DB.Exec(query, versionID)
	return err
}

func HasOutOfGamutColors(versionID string) (bool, error) {
	query := `SELECT COUNT(*) FROM color_values WHERE proof_version_id = ? AND is_out_of_gamut = 1`
	var count int
	err := database.DB.QueryRow(query, versionID).Scan(&count)
	return count > 0, err
}
