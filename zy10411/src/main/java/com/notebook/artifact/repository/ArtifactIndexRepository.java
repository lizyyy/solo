package com.notebook.artifact.repository;

import com.notebook.artifact.model.ArtifactIndex;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ArtifactIndexRepository extends JpaRepository<ArtifactIndex, Long> {
    
    Optional<ArtifactIndex> findByIndexId(String indexId);
    
    List<ArtifactIndex> findByNotebookIdentifier(String notebookIdentifier);
    
    List<ArtifactIndex> findByExportedAtIsNotNull();
    
    boolean existsByIndexId(String indexId);
}
