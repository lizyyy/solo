package com.version.adapter.repository;

import com.version.adapter.entity.ResponseTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ResponseTemplateRepository extends JpaRepository<ResponseTemplate, Long> {

    Optional<ResponseTemplate> findByTemplateName(String templateName);

    List<ResponseTemplate> findByApiEndpointAndHttpMethod(String apiEndpoint, String httpMethod);

    List<ResponseTemplate> findByIsActiveTrue();

    boolean existsByTemplateName(String templateName);
}
