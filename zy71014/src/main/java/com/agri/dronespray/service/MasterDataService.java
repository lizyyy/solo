package com.agri.dronespray.service;

import com.agri.dronespray.entity.*;
import com.agri.dronespray.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class MasterDataService {

    @Autowired
    private PlotRepository plotRepository;

    @Autowired
    private DroneRepository droneRepository;

    @Autowired
    private PesticideRepository pesticideRepository;

    @Autowired
    private PesticideBatchRepository pesticideBatchRepository;

    @Autowired
    private WeatherWindowRepository weatherWindowRepository;

    @Autowired
    private PilotRepository pilotRepository;

    @Transactional
    public Plot createPlot(Plot plot, String creator) {
        plot.setCreatedBy(creator);
        return plotRepository.save(plot);
    }

    @Transactional
    public Plot approvePlot(Long plotId, String approver) {
        Plot plot = plotRepository.findById(plotId)
                .orElseThrow(() -> new IllegalArgumentException("地块不存在"));
        plot.setApproved(true);
        plot.setApprovedBy(approver);
        plot.setApprovedAt(LocalDateTime.now());
        plot.setUpdatedBy(approver);
        return plotRepository.save(plot);
    }

    public Plot getPlot(Long id) {
        return plotRepository.findById(id).orElse(null);
    }

    public Plot getPlotByCode(String code) {
        return plotRepository.findByPlotCode(code).orElse(null);
    }

    public List<Plot> getAllPlots() {
        return plotRepository.findAll();
    }

    public List<Plot> getApprovedPlots() {
        return plotRepository.findByApproved(true);
    }

    public List<Plot> getUnapprovedPlots() {
        return plotRepository.findByApproved(false);
    }

    @Transactional
    public Drone createDrone(Drone drone, String creator) {
        drone.setCreatedBy(creator);
        return droneRepository.save(drone);
    }

    public Drone getDrone(Long id) {
        return droneRepository.findById(id).orElse(null);
    }

    public Drone getDroneByCode(String code) {
        return droneRepository.findByDroneCode(code).orElse(null);
    }

    public List<Drone> getAllDrones() {
        return droneRepository.findAll();
    }

    public List<Drone> getAvailableDrones() {
        return droneRepository.findByStatus("可用");
    }

    @Transactional
    public Pesticide createPesticide(Pesticide pesticide, String creator) {
        pesticide.setCreatedBy(creator);
        return pesticideRepository.save(pesticide);
    }

    public Pesticide getPesticide(Long id) {
        return pesticideRepository.findById(id).orElse(null);
    }

    public Pesticide getPesticideByCode(String code) {
        return pesticideRepository.findByPesticideCode(code).orElse(null);
    }

    public List<Pesticide> getAllPesticides() {
        return pesticideRepository.findAll();
    }

    @Transactional
    public PesticideBatch createPesticideBatch(PesticideBatch batch, String creator) {
        batch.setCreatedBy(creator);
        return pesticideBatchRepository.save(batch);
    }

    public PesticideBatch getPesticideBatch(Long id) {
        return pesticideBatchRepository.findById(id).orElse(null);
    }

    public PesticideBatch getPesticideBatchByNumber(String batchNumber) {
        return pesticideBatchRepository.findByBatchNumber(batchNumber).orElse(null);
    }

    public List<PesticideBatch> getAllPesticideBatches() {
        return pesticideBatchRepository.findAll();
    }

    @Transactional
    public WeatherWindow createWeatherWindow(WeatherWindow window, String creator) {
        window.setCreatedBy(creator);
        return weatherWindowRepository.save(window);
    }

    public WeatherWindow getWeatherWindow(Long id) {
        return weatherWindowRepository.findById(id).orElse(null);
    }

    public List<WeatherWindow> getAllWeatherWindows() {
        return weatherWindowRepository.findAll();
    }

    public List<WeatherWindow> getWeatherWindowsByArea(String area) {
        return weatherWindowRepository.findByArea(area);
    }

    @Transactional
    public Pilot createPilot(Pilot pilot, String creator) {
        pilot.setCreatedBy(creator);
        return pilotRepository.save(pilot);
    }

    public Pilot getPilot(Long id) {
        return pilotRepository.findById(id).orElse(null);
    }

    public Pilot getPilotByCode(String code) {
        return pilotRepository.findByPilotCode(code).orElse(null);
    }

    public List<Pilot> getAllPilots() {
        return pilotRepository.findAll();
    }

    public List<Pilot> getActivePilots() {
        return pilotRepository.findByStatus("在岗");
    }
}
