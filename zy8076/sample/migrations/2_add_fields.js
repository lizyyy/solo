module.exports = {
  up: async (data, context) => {
    if (data.user) {
      data.user.avatar = data.user.avatar || null;
    }
    if (data.preferences) {
      data.preferences.emailUpdates = data.preferences.emailUpdates !== undefined ? data.preferences.emailUpdates : false;
    }
    if (data.settings) {
      data.settings.autoplay = data.settings.autoplay !== undefined ? data.settings.autoplay : true;
    }
    if (data.user && !data.lastLogin) {
      data.lastLogin = new Date().toISOString();
    }
    return data;
  },
  down: async (data, context) => {
    if (data.user) {
      delete data.user.avatar;
    }
    if (data.preferences) {
      delete data.preferences.emailUpdates;
    }
    if (data.settings) {
      delete data.settings.autoplay;
    }
    delete data.lastLogin;
    return data;
  }
};
