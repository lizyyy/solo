package dao

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
	"print-proof-api/internal/database"
	"print-proof-api/internal/model"
)

func CreateOrder(order *model.Order) error {
	order.ID = uuid.New().String()
	order.Status = model.OrderStatusPending
	order.CreatedAt = time.Now()
	order.UpdatedAt = time.Now()

	query := `INSERT INTO orders (id, order_no, customer_name, product_name, quantity, status, created_at, updated_at)
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`

	_, err := database.DB.Exec(query, order.ID, order.OrderNo, order.CustomerName, order.ProductName,
		order.Quantity, order.Status, order.CreatedAt, order.UpdatedAt)
	return err
}

func GetOrderByID(id string) (*model.Order, error) {
	query := `SELECT id, order_no, customer_name, product_name, quantity, status, created_at, updated_at
	          FROM orders WHERE id = ?`

	var order model.Order
	err := database.DB.QueryRow(query, id).Scan(&order.ID, &order.OrderNo, &order.CustomerName,
		&order.ProductName, &order.Quantity, &order.Status, &order.CreatedAt, &order.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &order, err
}

func GetOrderByNo(orderNo string) (*model.Order, error) {
	query := `SELECT id, order_no, customer_name, product_name, quantity, status, created_at, updated_at
	          FROM orders WHERE order_no = ?`

	var order model.Order
	err := database.DB.QueryRow(query, orderNo).Scan(&order.ID, &order.OrderNo, &order.CustomerName,
		&order.ProductName, &order.Quantity, &order.Status, &order.CreatedAt, &order.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &order, err
}

func UpdateOrderStatus(id, status string) error {
	query := `UPDATE orders SET status = ?, updated_at = ? WHERE id = ?`
	_, err := database.DB.Exec(query, status, time.Now(), id)
	return err
}

func ListOrders(limit, offset int) ([]*model.Order, error) {
	query := `SELECT id, order_no, customer_name, product_name, quantity, status, created_at, updated_at
	          FROM orders ORDER BY created_at DESC LIMIT ? OFFSET ?`

	rows, err := database.DB.Query(query, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var orders []*model.Order
	for rows.Next() {
		var order model.Order
		err := rows.Scan(&order.ID, &order.OrderNo, &order.CustomerName, &order.ProductName,
			&order.Quantity, &order.Status, &order.CreatedAt, &order.UpdatedAt)
		if err != nil {
			return nil, err
		}
		orders = append(orders, &order)
	}
	return orders, nil
}
