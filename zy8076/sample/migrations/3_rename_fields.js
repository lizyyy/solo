module.exports = {
  up: async (data, context) => {
    if (data.user) {
      data.user.displayName = data.user.displayName || data.user.name;
      data.user.createdAt = data.user.createdAt || (data.metadata && data.metadata.createdAt) || new Date().toISOString();
      delete data.user.name;
    }
    if (data.preferences) {
      data.preferences.smsUpdates = data.preferences.smsUpdates !== undefined ? data.preferences.smsUpdates : false;
    }
    if (data.settings) {
      data.settings.subtitles = data.settings.subtitles !== undefined ? data.settings.subtitles : true;
    }
    if (data.user && !data.profile) {
      data.profile = {
        firstName: data.user.displayName ? data.user.displayName.split(' ')[0] : '',
        lastName: data.user.displayName ? data.user.displayName.split(' ').slice(1).join(' ') : '',
        phone: null
      };
    }
    return data;
  },
  down: async (data, context) => {
    if (data.user && data.user.displayName) {
      data.user.name = data.user.displayName;
      delete data.user.displayName;
      delete data.user.createdAt;
    }
    if (data.preferences) {
      delete data.preferences.smsUpdates;
    }
    if (data.settings) {
      delete data.settings.subtitles;
    }
    if (data.profile) {
      delete data.profile;
    }
    return data;
  }
};
