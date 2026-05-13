package com.api.inspection.entity;

import lombok.Data;

import javax.persistence.*;

@Data
@Entity
@Table(name = "variable_extract")
public class VariableExtract {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "step_id", nullable = false)
    private TransactionStep step;

    @Column(nullable = false)
    private String variableName;

    @Column(nullable = false)
    private String extractExpression;

    @Column(nullable = false)
    private String sourceType;
}
