package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	pb "github.com/chaos-simulator/chaos-simulator/api/proto"
	"github.com/chaos-simulator/chaos-simulator/internal/config"
	"github.com/chaos-simulator/chaos-simulator/internal/utils"
	"github.com/chaos-simulator/chaos-simulator/pkg/tracer"
	"go.uber.org/zap"
	"google.golang.org/grpc"
)

var (
	configPath = flag.String("config", "./configs/config.yaml", "Path to config file")
)

type CreateOrderHTTPRequest struct {
	UserID        string            `json:"user_id"`
	Items         []OrderItemHTTP   `json:"items"`
	PaymentMethod string            `json:"payment_method"`
	TotalAmount   int64             `json:"total_amount"`
	Metadata      map[string]string `json:"metadata"`
}

type OrderItemHTTP struct {
	ProductID string `json:"product_id"`
	Quantity  int32  `json:"quantity"`
	UnitPrice int64  `json:"unit_price"`
}

type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
	TraceID string      `json:"trace_id"`
}

func main() {
	flag.Parse()

	cfg, err := config.Load(*configPath)
	if err != nil {
		fmt.Printf("Failed to load config: %v\n", err)
		os.Exit(1)
	}

	if err := utils.InitLogger(cfg.Logging.Level, cfg.Logging.Format); err != nil {
		fmt.Printf("Failed to init logger: %v\n", err)
		os.Exit(1)
	}
	defer utils.GetLogger().Sync()

	orderConn, err := grpc.Dial(
		fmt.Sprintf("localhost:%d", cfg.Server.OrderService.Port),
		grpc.WithInsecure(),
	)
	if err != nil {
		utils.GetLogger().Fatal("Failed to connect to order service", zap.Error(err))
	}
	defer orderConn.Close()

	paymentConn, err := grpc.Dial(
		fmt.Sprintf("localhost:%d", cfg.Server.PaymentService.Port),
		grpc.WithInsecure(),
	)
	if err != nil {
		utils.GetLogger().Fatal("Failed to connect to payment service", zap.Error(err))
	}
	defer paymentConn.Close()

	inventoryConn, err := grpc.Dial(
		fmt.Sprintf("localhost:%d", cfg.Server.InventoryService.Port),
		grpc.WithInsecure(),
	)
	if err != nil {
		utils.GetLogger().Fatal("Failed to connect to inventory service", zap.Error(err))
	}
	defer inventoryConn.Close()

	orderClient := pb.NewOrderServiceClient(orderConn)
	paymentClient := pb.NewPaymentServiceClient(paymentConn)
	inventoryClient := pb.NewInventoryServiceClient(inventoryConn)

	http.HandleFunc("/api/v1/orders", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		body, err := ioutil.ReadAll(r.Body)
		if err != nil {
			json.NewEncoder(w).Encode(APIResponse{
				Success: false,
				Error:   "Failed to read request body",
			})
			return
		}

		var req CreateOrderHTTPRequest
		if err := json.Unmarshal(body, &req); err != nil {
			json.NewEncoder(w).Encode(APIResponse{
				Success: false,
				Error:   "Invalid request body",
			})
			return
		}

		traceID := r.Header.Get("X-Trace-ID")
		if traceID == "" {
			traceID = utils.NewTraceID()
		}

		ctx := tracer.ContextWithTraceID(context.Background(), traceID)

		items := make([]*pb.OrderItem, len(req.Items))
		for i, item := range req.Items {
			items[i] = &pb.OrderItem{
				ProductId: item.ProductID,
				Quantity:  item.Quantity,
				UnitPrice: item.UnitPrice,
			}
		}

		grpcReq := &pb.CreateOrderRequest{
			TraceId:       traceID,
			UserId:        req.UserID,
			Items:         items,
			PaymentMethod: req.PaymentMethod,
			TotalAmount:   req.TotalAmount,
			Metadata:      req.Metadata,
		}

		orderResp, err := orderClient.CreateOrder(ctx, grpcReq)
		if err != nil {
			utils.WithTraceID(traceID).Error("Order creation failed", zap.Error(err))
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(APIResponse{
				Success: false,
				Error:   err.Error(),
				TraceID: traceID,
			})
			return
		}

		json.NewEncoder(w).Encode(APIResponse{
			Success: true,
			Data:    orderResp,
			TraceID: traceID,
		})
	})

	http.HandleFunc("/api/v1/payments", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		body, err := ioutil.ReadAll(r.Body)
		if err != nil {
			json.NewEncoder(w).Encode(APIResponse{
				Success: false,
				Error:   "Failed to read request body",
			})
			return
		}

		var req struct {
			OrderID       string            `json:"order_id"`
			UserID        string            `json:"user_id"`
			Amount        int64             `json:"amount"`
			Currency      string            `json:"currency"`
			PaymentMethod string            `json:"payment_method"`
			Metadata      map[string]string `json:"metadata"`
		}

		if err := json.Unmarshal(body, &req); err != nil {
			json.NewEncoder(w).Encode(APIResponse{
				Success: false,
				Error:   "Invalid request body",
			})
			return
		}

		traceID := r.Header.Get("X-Trace-ID")
		if traceID == "" {
			traceID = utils.NewTraceID()
		}

		ctx := tracer.ContextWithTraceID(context.Background(), traceID)

		grpcReq := &pb.ProcessPaymentRequest{
			TraceId:       traceID,
			OrderId:       req.OrderID,
			UserId:        req.UserID,
			Amount:        req.Amount,
			Currency:      req.Currency,
			PaymentMethod: req.PaymentMethod,
			Metadata:      req.Metadata,
		}

		paymentResp, err := paymentClient.ProcessPayment(ctx, grpcReq)
		if err != nil {
			utils.WithTraceID(traceID).Error("Payment processing failed", zap.Error(err))
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(APIResponse{
				Success: false,
				Error:   err.Error(),
				TraceID: traceID,
			})
			return
		}

		json.NewEncoder(w).Encode(APIResponse{
			Success: true,
			Data:    paymentResp,
			TraceID: traceID,
		})
	})

	http.HandleFunc("/api/v1/inventory/deduct", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		body, err := ioutil.ReadAll(r.Body)
		if err != nil {
			json.NewEncoder(w).Encode(APIResponse{
				Success: false,
				Error:   "Failed to read request body",
			})
			return
		}

		var req struct {
			OrderID     string          `json:"order_id"`
			OperationID string          `json:"operation_id"`
			Items       []*pb.StockItem `json:"items"`
		}

		if err := json.Unmarshal(body, &req); err != nil {
			json.NewEncoder(w).Encode(APIResponse{
				Success: false,
				Error:   "Invalid request body",
			})
			return
		}

		traceID := r.Header.Get("X-Trace-ID")
		if traceID == "" {
			traceID = utils.NewTraceID()
		}

		ctx := tracer.ContextWithTraceID(context.Background(), traceID)

		grpcReq := &pb.DeductStockRequest{
			TraceId:     traceID,
			OrderId:     req.OrderID,
			OperationId: req.OperationID,
			Items:       req.Items,
		}

		inventoryResp, err := inventoryClient.DeductStock(ctx, grpcReq)
		if err != nil {
			utils.WithTraceID(traceID).Error("Stock deduction failed", zap.Error(err))
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(APIResponse{
				Success: false,
				Error:   err.Error(),
				TraceID: traceID,
			})
			return
		}

		json.NewEncoder(w).Encode(APIResponse{
			Success: true,
			Data:    inventoryResp,
			TraceID: traceID,
		})
	})

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":    "healthy",
			"timestamp": time.Now().Unix(),
		})
	})

	utils.GetLogger().Info("Gateway starting",
		zap.Int("http_port", cfg.Server.Gateway.Port),
		zap.Int("grpc_port", cfg.Server.Gateway.GRPCPort))

	server := &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.Server.Gateway.Port),
		Handler: nil,
	}

	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
		<-sigChan
		utils.GetLogger().Info("Shutting down gateway...")
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		server.Shutdown(ctx)
	}()

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		utils.GetLogger().Fatal("Failed to start gateway", zap.Error(err))
	}
}
