package tracer

import (
	"context"
	"strings"
	"time"

	"github.com/chaos-simulator/chaos-simulator/internal/utils"
	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

type TraceInterceptor struct {
	tracer       *HybridTracer
	serviceName  string
}

func NewTraceInterceptor(tracer *HybridTracer, serviceName string) *TraceInterceptor {
	return &TraceInterceptor{
		tracer:      tracer,
		serviceName: serviceName,
	}
}

func (i *TraceInterceptor) UnaryServerInterceptor() grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		traceID := i.extractTraceID(ctx)
		if traceID == "" {
			traceID = utils.NewTraceID()
		}

		service, method := i.splitMethod(info.FullMethod)

		ctx = ContextWithTraceID(ctx, traceID)
		ctx, span := i.tracer.StartSpan(ctx, service, method, traceID, 1, 1)

		resp, err := handler(ctx, req)

		if err != nil {
			span.SetError(err)
			span.End("ERROR")
		} else {
			span.End("SUCCESS")
		}

		return resp, err
	}
}

func (i *TraceInterceptor) UnaryClientInterceptor() grpc.UnaryClientInterceptor {
	return func(ctx context.Context, method string, req, reply interface{}, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
		traceID := TraceIDFromContext(ctx)
		if traceID == "" {
			traceID = utils.NewTraceID()
			ctx = ContextWithTraceID(ctx, traceID)
		}

		service, m := i.splitMethod(method)

		ctx = metadata.AppendToOutgoingContext(ctx, "x-trace-id", traceID)

		startTime := time.Now()
		utils.GetLogger().Info("Client call started",
			zap.String("trace_id", traceID),
			zap.String("service", service),
			zap.String("method", m))

		err := invoker(ctx, method, req, reply, cc, opts...)

		duration := time.Since(startTime).Milliseconds()

		if err != nil {
			st, _ := status.FromError(err)
			utils.GetLogger().Warn("Client call failed",
				zap.String("trace_id", traceID),
				zap.String("service", service),
				zap.String("method", m),
				zap.String("grpc_code", st.Code().String()),
				zap.Int64("duration_ms", duration),
				zap.Error(err))
		} else {
			utils.GetLogger().Info("Client call completed",
				zap.String("trace_id", traceID),
				zap.String("service", service),
				zap.String("method", m),
				zap.Int64("duration_ms", duration))
		}

		return err
	}
}

func (i *TraceInterceptor) extractTraceID(ctx context.Context) string {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return ""
	}

	vals := md.Get("x-trace-id")
	if len(vals) > 0 {
		return vals[0]
	}

	vals = md.Get("traceparent")
	if len(vals) > 0 {
		parts := strings.Split(vals[0], "-")
		if len(parts) >= 2 {
			return parts[1]
		}
	}

	return ""
}

func (i *TraceInterceptor) splitMethod(fullMethod string) (string, string) {
	if fullMethod == "" {
		return i.serviceName, "unknown"
	}

	parts := strings.Split(strings.TrimPrefix(fullMethod, "/"), "/")
	if len(parts) >= 2 {
		return parts[0], parts[1]
	}

	return i.serviceName, fullMethod
}
