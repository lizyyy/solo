package com.paymentguard.tracing.util;

import com.paymentguard.common.util.IdGenerator;
import org.slf4j.MDC;

public final class TraceContext {

    public static final String TRACE_ID = "traceId";
    public static final String SPAN_ID = "spanId";
    public static final String PARENT_SPAN_ID = "parentSpanId";

    private TraceContext() {}

    public static String getTraceId() {
        return MDC.get(TRACE_ID);
    }

    public static String getSpanId() {
        return MDC.get(SPAN_ID);
    }

    public static void setTraceId(String traceId) {
        MDC.put(TRACE_ID, traceId != null ? traceId : IdGenerator.generateTraceId());
    }

    public static void setSpanId(String spanId) {
        MDC.put(SPAN_ID, spanId != null ? spanId : IdGenerator.generateSpanId());
    }

    public static void setParentSpanId(String parentSpanId) {
        if (parentSpanId != null) {
            MDC.put(PARENT_SPAN_ID, parentSpanId);
        }
    }

    public static void initContext() {
        String traceId = getTraceId();
        if (traceId == null) {
            traceId = IdGenerator.generateTraceId();
        }
        setTraceId(traceId);
        setSpanId(IdGenerator.generateSpanId());
    }

    public static void initContext(String traceId) {
        setTraceId(traceId);
        setSpanId(IdGenerator.generateSpanId());
    }

    public static void initContext(String traceId, String parentSpanId) {
        setTraceId(traceId);
        setParentSpanId(parentSpanId);
        setSpanId(IdGenerator.generateSpanId());
    }

    public static void clearContext() {
        MDC.remove(TRACE_ID);
        MDC.remove(SPAN_ID);
        MDC.remove(PARENT_SPAN_ID);
    }
}
