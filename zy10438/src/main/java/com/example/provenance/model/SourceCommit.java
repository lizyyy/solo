package com.example.provenance.model;

import javax.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Embeddable
public class SourceCommit {
    private String repoUrl;
    private String branch;
    private String commitHash;
    private String commitAuthor;
    private String commitMessage;
    private Long commitTimestamp;
}
