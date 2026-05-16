package com.example.provenance.model;

import javax.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Embeddable
public class ProcessingLog {
    private Long timestamp;
    private String step;
    private String action;
    private String input;
    private String result;
    private String message;
    private String operator;
}
