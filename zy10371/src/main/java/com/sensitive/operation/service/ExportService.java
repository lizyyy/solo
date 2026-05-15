package com.sensitive.operation.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.sensitive.operation.model.SensitiveOperation;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExportService {

    private final SensitiveOperationService operationService;
    private final ObjectMapper objectMapper = createObjectMapper();

    private ObjectMapper createObjectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        return mapper;
    }

    public byte[] exportToJson() throws JsonProcessingException {
        List<SensitiveOperation> operations = operationService.listAll();
        return objectMapper.writerWithDefaultPrettyPrinter()
                .writeValueAsBytes(operations);
    }

    public byte[] exportToCsv() {
        List<SensitiveOperation> operations = operationService.listAll();
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        PrintWriter writer = new PrintWriter(new OutputStreamWriter(baos, StandardCharsets.UTF_8));

        writer.println("操作ID,操作类型,申请人ID,申请人姓名,风险等级,状态,创建时间,过期时间,执行时间,拒绝原因");

        for (SensitiveOperation op : operations) {
            writer.printf("%s,%s,%s,%s,%s,%s,%s,%s,%s,%s%n",
                    escapeCsv(op.getId()),
                    escapeCsv(op.getOperationType()),
                    escapeCsv(op.getRequesterId()),
                    escapeCsv(op.getRequesterName()),
                    op.getRiskLevel(),
                    op.getStatus(),
                    op.getCreatedAt(),
                    op.getExpireTime(),
                    op.getExecutedAt() != null ? op.getExecutedAt() : "",
                    escapeCsv(op.getRejectReason() != null ? op.getRejectReason() : "")
            );
        }

        writer.flush();
        return baos.toByteArray();
    }

    private String escapeCsv(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}
