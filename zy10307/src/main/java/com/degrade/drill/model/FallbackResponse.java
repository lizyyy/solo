package com.degrade.drill.model;

import javax.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "fallback_response")
public class FallbackResponse {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Integer httpStatus;

    @Column(columnDefinition = "TEXT")
    private String responseBody;

    private String contentType = "application/json";

    private Long delayMs = 0L;
}