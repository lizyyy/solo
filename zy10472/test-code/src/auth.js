function login(username, password) {
  if (getFeatureFlag('old_login_flow')) {
    return legacyLogin(username, password);
  }
  return modernLogin(username, password);
}

function legacyLogin(username, password) {
  if (getFeatureFlag('old_login_flow')) {
    console.log('Using legacy login');
  }
  return { user: username, method: 'legacy' };
}

function modernLogin(username, password) {
  return { user: username, method: 'modern' };
}

function enableExperimentX() {
  return getFeatureFlag('enable_experiment_x');
}

function getFeatureFlag(name) {
  return true;
}

module.exports = { login, enableExperimentX };
