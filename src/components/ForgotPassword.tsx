import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle, Loader2, Mail } from 'lucide-react';

import AuthLayout from '@/components/auth/AuthLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { buildAppUrl } from '@/lib/appUrl';
import { supabase } from '@/lib/supabase';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const redirectUrl = buildAppUrl('/reset-password');
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        if (error.message?.includes('429') || error.message?.includes('rate limit')) {
          setError('重置密码请求过于频繁，请等待一段时间后再试。');
        } else if (error.message?.includes('not found')) {
          setSuccess(true);
        } else {
          setError(error.message || '发送重置邮件失败，请稍后重试。');
        }
      } else {
        console.log('Password reset email sent successfully:', data);
        setSuccess(true);
      }
    } catch (err) {
      setError('发送重置邮件时出现异常，请稍后重试。');
      console.error('Password reset error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <AuthLayout
        eyebrow="Password recovery"
        title="检查你的邮箱"
        description="如果该邮箱存在账号，我们已经发送了重置密码链接。"
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
          <Alert className="rounded-[22px] border-emerald-200 bg-emerald-50 text-emerald-700">
            <Mail className="h-4 w-4" />
            <AlertDescription>
              请检查 {email} 对应的邮箱收件箱和垃圾邮件箱。链接通常会在 1 小时内有效。
            </AlertDescription>
          </Alert>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow="Password recovery"
      title="找回密码"
      description="输入你的邮箱，我们会发送一封重置密码邮件。"
      footer={
        <Button variant="ghost" className="w-full" onClick={() => navigate('/login')}>
          返回登录页
        </Button>
      }
    >
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-950">重置访问凭证</h2>
        <p className="text-sm leading-7 text-slate-600">
          完成重置后，你可以重新回到研究工作台、档案库和 Thesis Card 资产页继续工作。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">邮箱</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        {error ? (
          <Alert variant="destructive" className="rounded-[22px] border-red-200 bg-red-50 text-red-700">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" className="w-full justify-center" disabled={isLoading || !email}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              发送中
            </>
          ) : (
            <>
              <Mail className="h-4 w-4" />
              发送重置链接
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
