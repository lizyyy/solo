package com.promptversion.repository;

import com.promptversion.entity.PromptTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PromptTemplateRepository extends JpaRepository<PromptTemplate, Long> {
    Optional<PromptTemplate> findByTemplateNameAndDeletedFalse(String templateName);
    List<PromptTemplate> findByDeletedFalse();
    boolean existsByTemplateNameAndDeletedFalse(String templateName);
}