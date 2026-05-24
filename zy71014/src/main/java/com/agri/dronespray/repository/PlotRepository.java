package com.agri.dronespray.repository;

import com.agri.dronespray.entity.Plot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PlotRepository extends JpaRepository<Plot, Long> {

    Optional<Plot> findByPlotCode(String plotCode);

    List<Plot> findByApproved(Boolean approved);

    List<Plot> findByVillage(String village);

    List<Plot> findByCropType(String cropType);
}
