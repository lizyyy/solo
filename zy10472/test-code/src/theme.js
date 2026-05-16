function applyTheme() {
  if (getFeatureFlag('enable_dark_mode')) {
    document.body.classList.add('dark-mode');
  }
}

function toggleTheme() {
  if (!getFeatureFlag('enable_dark_mode')) {
    console.log('Dark mode feature not enabled');
    return;
  }
  document.body.classList.toggle('dark-mode');
}

function getFeatureFlag(name) {
  return name === 'enable_dark_mode';
}

function highRiskFeature() {
  if (getFeatureFlag('high_risk_flag')) {
    for (let i = 0; i < 100; i++) {
      if (!getFeatureFlag('high_risk_flag')) {
        break;
      }
      console.log('Processing:', i);
    }
  }
  if (getFeatureFlag('high_risk_flag') && getFeatureFlag('another_old_flag')) {
    return 'combined';
  }
  return 'normal';
}

module.exports = { applyTheme, toggleTheme, highRiskFeature };
