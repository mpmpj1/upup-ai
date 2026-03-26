import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, LogIn } from 'lucide-react';

import AuthLayout from '@/components/auth/AuthLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';
import { getGitHubAuthErrorMessage, isGitHubAuthEnabled } from '@/lib/authProviders';
import { buildAppUrl } from '@/lib/appUrl';
import { BRAND_LOGIN_SUBTITLE, BRAND_SHORT_NAME } from '@/lib/brand';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const publicRegistrationEnabled = import.meta.env.VITE_ENABLE_PUBLIC_REGISTRATION !== 'false';
  const githubAuthEnabled = isGitHubAuthEnabled();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(email, password);

    if (result.success) {
      navigate('/dashboard');
      return;
    }

    setError(result.error || '邮箱或密码错误，请重试。');
    setIsLoading(false);
  };

  const handleGitHubLogin = async () => {
    setError('');

    if (!githubAuthEnabled) {
      setError('GitHub 登录当前未开启，请先使用邮箱密码登录。');
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: buildAppUrl('/'),
      },
    });

    if (error) {
      setError(getGitHubAuthErrorMessage(error.message));
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Member access"
      title={`登录 ${BRAND_SHORT_NAME}，继续你的 thesis-first 研究`}
      description={BRAND_LOGIN_SUBTITLE}
      footer={
        <div className="flex flex-col gap-3 text-sm text-slate-500">
          {publicRegistrationEnabled ? (
            <p>
              还没有账号？
              <Link to="/register" className="ml-2 font-medium text-slate-950 hover:text-amber-700">
                创建一个
              </Link>
            </p>
          ) : (
            <p>当前站点为邀请制或内测模式，请使用已有账号登录。</p>
          )}
        </div>
      }
    >
      <div className="space-y-2">
        <p className="section-kicker">Workspace access</p>
        <h2 className="text-3xl font-semibold tracking-tight text-slate-950">欢迎回来</h2>
        <p className="text-sm leading-7 text-slate-600">
          登录后可以继续对话、查看历史研究档案、生成简报并管理 Thesis Card。
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">邮箱</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="password">密码</Label>
            <Link to="/forgot-password" className="text-sm font-medium text-slate-600 hover:text-slate-950">
              忘记密码？
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              className="pr-12"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2"
              onClick={() => setShowPassword((current) => !current)}
              disabled={isLoading}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              <span className="sr-only">{showPassword ? '隐藏密码' : '显示密码'}</span>
            </Button>
          </div>
        </div>

        {error ? (
          <Alert variant="destructive" className="rounded-[20px] border-red-200 bg-red-50 text-red-700">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {githubAuthEnabled ? (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/70" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs uppercase tracking-[0.22em] text-slate-400">
                  or continue with
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full justify-center"
              onClick={handleGitHubLogin}
              disabled={isLoading}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              GitHub
            </Button>
          </>
        ) : null}

        <Button type="submit" className="w-full justify-center" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              正在登录
            </>
          ) : (
            <>
              <LogIn className="h-4 w-4" />
              登录并进入工作台
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
