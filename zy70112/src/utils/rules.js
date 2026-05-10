const config = require('../config');

const businessRules = {
    canTransition(fromStatus, toStatus) {
        const { statusTransitions } = config.business;
        const allowed = statusTransitions[fromStatus];
        return allowed && allowed.includes(toStatus);
    },

    getRequiredPhotosForSubmit(report) {
        const requiredTypes = config.business.photoTypes;
        return requiredTypes;
    },

    isReportReadyForSubmit(report, photos) {
        const hasPlot = report && report.plotCount > 0;
        const hasWeather = report && report.weatherCount > 0;
        const requiredPhotos = ['灾害全景', '作物特写'];
        const hasRequiredPhotos = requiredPhotos.every(type => 
            photos.some(p => p.photo_type === type && p.is_active)
        );
        return {
            ready: hasPlot && hasWeather && hasRequiredPhotos,
            missing: {
                plot: !hasPlot,
                weather: !hasWeather,
                photos: requiredPhotos.filter(type => 
                    !photos.some(p => p.photo_type === type && p.is_active)
                )
            }
        };
    },

    isReportReadyForApproval(report) {
        return report.dispatchStatus === 'COMPLETED' && report.claimEstimated;
    },

    calculateDamageCost(areaSqm, damageRatio, unitPrice) {
        const cost = areaSqm * (damageRatio / 100) * unitPrice;
        return Math.round(cost * 100) / 100;
    },

    validateReportStatus(status) {
        return Object.keys(config.business.reportStatuses).includes(status);
    },

    validateCropType(cropType) {
        return config.business.validCropTypes.includes(cropType);
    },

    validateDisasterType(disasterType) {
        return config.business.validDisasterTypes.includes(disasterType);
    },

    validatePhotoType(photoType) {
        return config.business.photoTypes.includes(photoType);
    }
};

module.exports = businessRules;
