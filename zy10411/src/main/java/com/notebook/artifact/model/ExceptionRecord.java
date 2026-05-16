package com.notebook.artifact.model;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "exception_records")
public class ExceptionRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String notebookExecutionId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "json", nullable = false)
    private JsonNode originalInput;

    @Column(length = 2000)
    private String errorMessage;

    @Column(length = 4000)
    private String stackTrace;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "json")
    private JsonNode processingConclusion;

    @Column
    private LocalDateTime occurredAt;

    @Column
    private String handledBy;

    @Column
    private Boolean resolved = false;
}
