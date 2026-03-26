import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  UserPlus,
} from 'lucide-react';

import AuthLayout from '@/components/auth/AuthLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';
import { getGitHubAuthErrorMessage, isGitHubAuthEnabled } from '@/lib/authProviders';
import { buildAppUrl } from '@/lib/appUrl';
import { BRAND_SHORT_NAME } from '@/lib/brand';
import { supabase } from '@/lib/supabase';

declare global {
  interface Window {
    twq?: (...args: unknown[]) => void;
  }
}

const PENDING_REGISTRATION_EMAIL_KEY = 'pending-registration-email';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [lastRegisteredEmail, setLastRegisteredEmail] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const publicRegistrationEnabled = import.meta.env.VITE_ENABLE_PUBLIC_REGISTRATION !== 'false';
  const githubAuthEnabled = isGitHubAuthEnabled();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (!successMessage || !lastRegisteredEmail) {
      return;
    }

    if (typeof window === 'undefined' || typeof window.twq !== 'function') {
      return;
    }

    const normalizedEmail = lastRegisteredEmail.trim().toLowerCase();

    try {
      window.twq('event', 'tw-ql07b-ql0xk', {
        email_address: normalizedEmail || null,
      });
    } catch (conversionError) {
      console.warn('Twitter conversion event failed, sending fallback payload', conversionError);
      window.twq('event', 'tw-ql07b-ql0xk', {});
    }
  }, [successMessage, lastRegisteredEmail]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!publicRegistrationEnabled) {
      setError('当前不开放公开注册，请联系管理员或使用邀请链接。');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致。');
      return;
    }

    if (password.length < 8) {
      setError('密码至少需要 8 位。');
      return;
    }

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setError('请填写用户名。');
      return;
    }

    setIsLoading(true);

    try {
      const result = await register(email, password, trimmedUsername);

      setIsLoading(false);

      if (result.success) {
        sessionStorage.setItem(PENDING_REGISTRATION_EMAIL_KEY, email.trim());
        setSuccessMessage('注册成功，请前往邮箱完成验证。');
        setLastRegisteredEmail(email);
        setUsername('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        return;
      }

      setError(result.error || '注册失败，请重试。');
    } catch (err) {
      setIsLoading(false);
      setError('注册时出现异常，请稍后再试。');
      console.error('Registration error:', err);
    }
  };

  const handleGitHubSignUp = async () => {
    setError('');

    if (!githubAuthEnabled) {
      setError('GitHub 注册当前未开启，请先使用邮箱注册。');
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

  if (successMessage) {
    return (
      <AuthLayout
        eyebrow="Registration complete"
        title="检查你的邮箱"
        description="我们已经创建好账号，现在只差最后一步邮箱确认。"
        compact
        footer={
          <Button variant="outline" className="w-full" onClick={() => navigate('/login')}>
            返回登录页
          </Button>
        }
      >
        <div className="space-y-5">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600">
            <CheckCircle className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950">注册成功</h2>
            <p className="text-sm leading-7 text-slate-600">
              请前往 {lastRegisteredEmail || '你的邮箱'} 点击验证链接。验证完成后即可进入 {BRAND_SHORT_NAME} 工作台。
            </p>
          </div>
          <Alert className="rounded-[22px] border-emerald-200 bg-emerald-50 text-emerald-700">
            <Mail className="h-4 w-4" />
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        </div>
      </AuthLayout>
    );
  }

  if (!publicRegistrationEnabled) {
    return (
      <AuthLayout
        eyebrow="Closed access"
        title="当前站点处于邀请制 / 内测模式"
        description="公开注册已关闭。你仍然可以通过邀请链接或管理员分配的账号进入工作台。"
        compact
        footer={
          <div className="flex flex-col gap-3">
            <Button variant="outline" className="w-full" onClick={() => navigate('/login')}>
              前往登录
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => navigate('/')}>
              返回首页
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <Alert className="rounded-[22px] border-amber-200 bg-amber-50 text-amber-700">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              如需体验完整研究工作台，请联系管理员开通账号，或使用定向邀请邮件中的专属链接。
            </AlertDescription>
          </Alert>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow="Create account"
      title={`创建 ${BRAND_SHORT_NAME} 账号，开始 thesis-first 研究`}
      description="注册后可以进入结构化研究工作台，连续追踪对话、简报和 Thesis Card 资产。"
      footer={
        <p className="text-sm text-slate-500">
          已有账号？
          <Link to="/login" className="ml-2 font-medium text-slate-950 hover:text-amber-700">
            去登录
          </Link>
        </p>
      }
    >
      <div className="space-y-2">
        <p className="section-kicker">Member onboarding</p>
        <h2 className="text-3xl font-semibold tracking-tight text-slate-950">开始使用</h2>
        <p className="text-sm leading-7 text-slate-600">
          你的账号会用于保存会话、简报、Thesis Card 和 Provider 配置，不会把研究流程退回成普通聊天壳。
        </p>
      </div>

      <form onSubmit={handleRegister} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="username">用户名</Label>
          <Input
            id="username"
            type="text"
            autoComplete="username"
            placeholder="例如：研究工作台主理人"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

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
          <Label htmlFor="password">密码</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="至少 8 位"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              minLength={8}
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

        <div className="space-y-2">
          <Label htmlFor="confirm-password">确认密码</Label>
          <div className="relative">
            <Input
              id="confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="再次输入密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isLoading}
              className="pr-12"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2"
              onClick={() => setShowConfirmPassword((current) => !current)}
              disabled={isLoading}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              <span className="sr-only">{showConfirmPassword ? '隐藏密码' : '显示密码'}</span>
            </Button>
          </div>
        </div>

        {error ? (
          <Alert variant="destructive" className="rounded-[22px] border-red-200 bg-red-50 text-red-700">
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
                  or sign up with
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full justify-center"
              onClick={handleGitHubSignUp}
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
              正在创建账号
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4" />
              创建账号
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
