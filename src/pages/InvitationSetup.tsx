import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, Eye, EyeOff, Loader2, Lock, User } from 'lucide-react';

import AuthLayout from '@/components/auth/AuthLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';
import { BRAND_SHORT_NAME } from '@/lib/brand';
import { supabase } from '@/lib/supabase';

export default function InvitationSetup() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const handleInvitation = async () => {
      const queryParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token') ?? queryParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token') ?? queryParams.get('refresh_token');
      const type = queryParams.get('type') ?? hashParams.get('type');
      const code = queryParams.get('code');
      const tokenHash = queryParams.get('token_hash') ?? hashParams.get('token_hash');

      if (type !== 'invite') {
        setError('这不是一个有效的邀请链接。');
        setIsProcessing(false);
        setTimeout(() => navigate('/login'), 4000);
        return;
      }

      try {
        let establishedSession = null;

        if (code && !accessToken && !refreshToken) {
          const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            throw new Error(`Failed to authenticate: ${exchangeError.message}`);
          }

          if (!exchangeData.session || !exchangeData.session.user) {
            throw new Error('Session was not established properly');
          }

          establishedSession = exchangeData.session;
        } else if (tokenHash && !accessToken && !refreshToken) {
          const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'invite',
          });

          if (verifyError) {
            throw new Error(`Failed to authenticate: ${verifyError.message}`);
          }

          if (!verifyData.session || !verifyData.session.user) {
            throw new Error('Session was not established properly');
          }

          establishedSession = verifyData.session;
        } else {
          if (!accessToken || !refreshToken) {
            throw new Error('Missing authentication tokens. Please request a new invitation.');
          }

          window.history.replaceState(null, '', window.location.pathname + window.location.search);

          const { data: sessionData, error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (setSessionError) {
            throw new Error(`Failed to authenticate: ${setSessionError.message}`);
          }

          if (!sessionData.session || !sessionData.session.user) {
            throw new Error('Session was not established properly');
          }

          establishedSession = sessionData.session;
        }

        if (!establishedSession?.user) {
          throw new Error('Session was not established properly');
        }

        const currentUser = establishedSession.user;
        setUserEmail(currentUser.email || '');

        if (
          currentUser.user_metadata?.username ||
          currentUser.user_metadata?.name ||
          currentUser.user_metadata?.full_name
        ) {
          navigate('/dashboard');
          return;
        }

        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', currentUser.id)
            .single();

          if (!profileError && profile && profile.name) {
            navigate('/dashboard');
            return;
          }
        } catch {
          // ignore and continue setup
        }

        useAuth.setState({
          session: establishedSession,
          user: currentUser,
          isAuthenticated: true,
          isLoading: false,
        });

        setIsProcessing(false);
      } catch (invitationError: unknown) {
        console.error('Invitation processing error:', invitationError);

        const errorMessage =
          invitationError instanceof Error ? invitationError.message : '处理邀请时出现异常，请稍后重试。';

        if (errorMessage.includes('expired')) {
          setError('邀请链接已过期，请联系管理员重新发送。');
        } else if (errorMessage.includes('invalid')) {
          setError('邀请链接无效或已被使用，请联系管理员。');
        } else if (errorMessage.includes('JWT')) {
          setError('邀请令牌格式异常，请重新申请邀请。');
        } else {
          setError(errorMessage);
        }

        setIsProcessing(false);
        setTimeout(() => navigate('/login'), 5000);
      }
    };

    void handleInvitation();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedUsername = username.trim();

    if (!trimmedUsername) {
      setError('请填写用户名。');
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

    setIsLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: {
          name: trimmedUsername,
          username: trimmedUsername,
        },
      });

      if (updateError) {
        setError(updateError.message);
        setIsLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: user.id,
          email: user.email,
          name: trimmedUsername,
          updated_at: new Date().toISOString(),
        });

        if (profileError) {
          console.error('Profile update error:', profileError);
        }

        const invitationId = user.user_metadata?.invitation_id;
        if (invitationId) {
          await supabase
            .from('invitations')
            .update({
              status: 'confirmed',
              confirmed_at: new Date().toISOString(),
              confirmed_user_id: user.id,
            })
            .eq('id', invitationId);
        }
      }

      setSuccess(true);
      await useAuth.getState().initialize();

      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (setupError) {
      setError('账户初始化时出现异常，请稍后重试。');
      console.error('Setup error:', setupError);
      setIsLoading(false);
    }
  };

  if (isProcessing) {
    return (
      <AuthLayout
        eyebrow="Invitation access"
        title="正在处理邀请"
        description="系统正在为你建立受邀账号的登录上下文，请稍候。"
        compact
      >
        <div className="flex items-center gap-3 rounded-[22px] border border-border/70 bg-slate-50/82 px-4 py-4 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
          正在验证邀请凭证...
        </div>
      </AuthLayout>
    );
  }

  if (error && !userEmail) {
    return (
      <AuthLayout
        eyebrow="Invitation access"
        title="邀请链接暂不可用"
        description="系统没有完成邀请鉴权，请稍后重新尝试或联系管理员。"
        compact
      >
        <Alert className="rounded-[22px] border-red-200 bg-red-50 text-red-700">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </AuthLayout>
    );
  }

  if (success) {
    return (
      <AuthLayout
        eyebrow="Invitation access"
        title={`欢迎来到 ${BRAND_SHORT_NAME}`}
        description="你的受邀账号已经设置完成，系统即将跳转到工作台。"
        compact
      >
        <Alert className="rounded-[22px] border-emerald-200 bg-emerald-50 text-emerald-700">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>账户设置成功，正在进入工作台...</AlertDescription>
        </Alert>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow="Invitation access"
      title="完成你的受邀账号设置"
      description="这是最后一步：设置用户名和密码，之后即可进入 thesis-first 研究工作台。"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {userEmail ? (
          <div className="space-y-2">
            <Label>邀请邮箱</Label>
            <Input type="email" value={userEmail} disabled className="bg-slate-50/82" />
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="username">用户名</Label>
          <div className="relative">
            <Input
              id="username"
              type="text"
              autoComplete="username"
              placeholder="设置你的用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={isLoading}
              className="pr-12"
            />
            <User className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
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

        <Button
          type="submit"
          className="w-full justify-center"
          disabled={isLoading || !username || !password || !confirmPassword}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              设置中
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" />
              完成设置
            </>
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
