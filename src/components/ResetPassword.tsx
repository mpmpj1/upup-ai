import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, Eye, EyeOff, Loader2, Lock } from 'lucide-react';

import AuthLayout from '@/components/auth/AuthLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const handlePasswordRecovery = async () => {
      try {
        const queryParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token') ?? queryParams.get('access_token');
        const type = queryParams.get('type') ?? hashParams.get('type');
        const tokenHash = queryParams.get('token_hash') ?? hashParams.get('token_hash');
        const code = queryParams.get('code');
        const errorCode = queryParams.get('error_code') ?? hashParams.get('error_code');
        const errorDescription =
          queryParams.get('error_description') ?? hashParams.get('error_description');

        if (errorCode === 'otp_expired' || errorDescription?.includes('expired')) {
          setError('重置链接已过期，请重新申请新的密码重置邮件。');
          setCheckingSession(false);
          setTimeout(() => {
            navigate('/forgot-password');
          }, 3000);
          return;
        }

        if (errorCode || errorDescription) {
          setError(errorDescription || '重置链接无效，请重新申请。');
          setCheckingSession(false);
          setTimeout(() => {
            navigate('/forgot-password');
          }, 3000);
          return;
        }

        if (type === 'recovery' && accessToken) {
          setCheckingSession(false);
          return;
        }

        if (!accessToken && code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            throw error;
          }
        } else if (!accessToken && tokenHash && type === 'recovery') {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery',
          });

          if (error) {
            throw error;
          }
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          setError('未检测到有效的密码重置会话，请重新申请链接。');
          setTimeout(() => {
            navigate('/forgot-password');
          }, 3000);
        }
      } catch (recoveryError) {
        console.error('Error checking recovery session:', recoveryError);
        setError('验证重置链接时出现异常，请重新申请。');
        setTimeout(() => {
          navigate('/forgot-password');
        }, 3000);
      } finally {
        setCheckingSession(false);
      }
    };

    void handlePasswordRecovery();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

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
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      setSuccess(true);
      await supabase.auth.signOut();
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (updateError) {
      setError('更新密码时出现异常，请稍后重试。');
      console.error('Password update error:', updateError);
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingSession || error) {
    return (
      <AuthLayout
        eyebrow="Password reset"
        title={error ? '重置链接暂不可用' : '正在验证重置链接'}
        description={
          error
            ? '系统没有拿到可用的重置凭证，请重新申请新的密码重置邮件。'
            : '请稍等，我们正在确认当前链接是否仍然有效。'
        }
        compact
      >
        <div className="space-y-5">
          {error ? (
            <Alert className="rounded-[22px] border-red-200 bg-red-50 text-red-700">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : (
            <div className="flex items-center gap-3 rounded-[22px] border border-border/70 bg-slate-50/82 px-4 py-4 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
              正在验证...
            </div>
          )}
        </div>
      </AuthLayout>
    );
  }

  if (success) {
    return (
      <AuthLayout
        eyebrow="Password reset"
        title="密码重置成功"
        description="你的密码已经更新完成，现在可以使用新密码重新登录。"
        compact
      >
        <Alert className="rounded-[22px] border-emerald-200 bg-emerald-50 text-emerald-700">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>系统即将跳转回登录页。</AlertDescription>
        </Alert>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow="Password reset"
      title="设置新的登录密码"
      description="重置完成后，你可以继续回到工作台、归档页和 Provider 控制中心。"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="password">新密码</Label>
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
          <Label htmlFor="confirm-password">确认新密码</Label>
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
          disabled={isLoading || !password || !confirmPassword}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              更新中
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" />
              更新密码
            </>
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
