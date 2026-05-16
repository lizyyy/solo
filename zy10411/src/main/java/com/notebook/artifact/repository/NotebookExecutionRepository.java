package com.notebook.artifact.repository;

import com.notebook.artifact.model.ExecutionStatus;
import com.notebook.artifact.model.NotebookExecution;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface NotebookExecutionRepository extends JpaRepository<NotebookExecution, Long> {
    
    Optional<NotebookExecution> findByExecutionId(String executionId);
    
    List<NotebookExecution> findByNotebookIdentifier(String notebookIdentifier);
    
    List<NotebookExecution> findByStatus(ExecutionStatus status);
    
    List<NotebookExecution> findByArchivedFalse();
    
    List<NotebookExecution> findByArchivedTrue();
    
    @Query("SELECT n FROM NotebookExecution n WHERE n.notebookIdentifier = :notebookId ORDER BY n.version DESC")
    List<NotebookExecution> findVersionsByNotebookId(@Param("notebookId") String notebookId);
    
    @Query("SELECT MAX(n.version) FROM NotebookExecution n WHERE n.notebookIdentifier = :notebookId")
    Integer findMaxVersionByNotebookId(@Param("notebookId") String notebookId);
    
    boolean existsByExecutionId(String executionId);
}
