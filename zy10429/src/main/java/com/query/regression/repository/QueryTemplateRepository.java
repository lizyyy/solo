package com.query.regression.repository;

import com.query.regression.entity.QueryTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface QueryTemplateRepository extends JpaRepository<QueryTemplate, Long> {
    List<QueryTemplate> findByDatabaseType(String databaseType);
    List<QueryTemplate> findByNameContaining(String name);
}
