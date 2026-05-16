const API_V1 = '/api/v1';
const API_V2 = '/api/v2';

function getBaseUrl() {
  return getFeatureFlag('enable_v2_api') ? API_V2 : API_V1;
}

function fetchUserData(userId) {
  const base = getBaseUrl();
  return fetch(`${base}/users/${userId}`);
}

function getFeatureFlag(name) {
  const flags = {
    enable_v2_api: false,
    enable_dark_mode: true
  };
  return flags[name] || false;
}

module.exports = { fetchUserData, getBaseUrl };
