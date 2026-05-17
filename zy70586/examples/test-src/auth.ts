// 认证流程示例代码
export function login(username: string, password: string) {
  if (FEATURE_OLD_LOGIN) {
    return legacyLogin(username, password);
  } else {
    return modernLogin(username, password);
  }
}

export function getTheme() {
  return FEATURE_DARK_MODE ? 'dark' : 'light';
}

export function renderLoginButton() {
  const label = FEATURE_OLD_LOGIN ? '旧版登录' : '新版登录';
  return `<button>${label}</button>`;
}

function legacyLogin(username: string, password: string) {
  console.log('使用旧版认证 - 这是死代码！');
  return { success: true, token: 'legacy-token' };
}

function modernLogin(username: string, password: string) {
  console.log('使用新版认证');
  return { success: true, token: 'modern-token' };
}
