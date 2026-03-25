export const isGitHubAuthEnabled = () => import.meta.env.VITE_ENABLE_GITHUB_AUTH === 'true';

export const getGitHubAuthErrorMessage = (message?: string | null) => {
  const normalized = message?.toLowerCase() ?? '';

  if (
    normalized.includes('unsupported provider') ||
    normalized.includes('provider is not enabled')
  ) {
    return 'GitHub 登录暂未启用，请先使用邮箱登录或注册。若要启用，需要先在 Supabase 后台打开 GitHub Provider。';
  }

  if (normalized.includes('redirect')) {
    return 'GitHub 登录跳转地址配置有误，请检查 Supabase 的 Redirect URLs 和 GitHub OAuth 回调地址。';
  }

  if (normalized.includes('oauth')) {
    return 'GitHub 登录暂时不可用，请稍后重试，或先使用邮箱方式登录。';
  }

  return message || 'GitHub 登录暂时不可用，请先使用邮箱方式。';
};
