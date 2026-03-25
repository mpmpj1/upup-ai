import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, LogIn, MailCheck } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { getAppPath } from '@/lib/appUrl';
import { BRAND_NAME_ZH, BRAND_SCOPE_HINT } from '@/lib/brand';
import { supabase } from '@/lib/supabase';

const PENDING_REGISTRATION_EMAIL_KEY = 'pending-registration-email';

type SupportedOtpType =
  | 'signup'
  | 'invite'
  | 'recovery'
  | 'magiclink'
  | 'email'
  | 'email_change';

type ConfirmViewState =
  | {
      status: 'loading';
      title: string;
      description: string;
    }
  | {
      status: 'success';
      title: string;
      description: string;
      email?: string;
      autoSignedIn: boolean;
    }
  | {
      status: 'error';
      title: string;
      description: string;
      detail?: string;
      email?: string;
    };

const toOtpType = (value: string | null): SupportedOtpType | null => {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase();
  if (
    normalized === 'signup' ||
    normalized === 'invite' ||
    normalized === 'recovery' ||
    normalized === 'magiclink' ||
    normalized === 'email' ||
    normalized === 'email_change'
  ) {
    return normalized;
  }

  return null;
};

const readFirstParam = (...values: Array<string | null | undefined>) =>
  values.find((value) => typeof value === 'string' && value.trim().length > 0) ?? null;

const parseNestedCallbackParams = (value: string | null) => {
  if (!value) {
    return {
      query: null as URLSearchParams | null,
      hash: null as URLSearchParams | null,
    };
  }

  try {
    const nestedUrl = new URL(value);
    return {
      query: nestedUrl.searchParams,
      hash: new URLSearchParams(nestedUrl.hash.replace(/^#/, '')),
    };
  } catch {
    return {
      query: null,
      hash: null,
    };
  }
};

const isPkceSessionRecoveryError = (rawMessage?: string | null) => {
  const lower = rawMessage?.toLowerCase() ?? '';
  return (
    lower.includes('code verifier') ||
    lower.includes('auth code') ||
    lower.includes('flow state') ||
    lower.includes('code challenge') ||
    lower.includes('both auth code and code verifier should be non-empty')
  );
};

const getFriendlyError = (rawMessage?: string | null) => {
  const message = rawMessage?.trim();
  if (!message) {
    return '这次确认没有拿到完整凭证，请重新点击最新一封确认邮件中的原始链接。';
  }

  const lower = message.toLowerCase();

  if (lower.includes('expired')) {
    return '这次确认链接已经过期，请重新注册或让系统重新发送确认邮件。';
  }

  if (lower.includes('otp') || lower.includes('token')) {
    return '确认链接里的认证信息已经失效，通常是链接过期、被重复使用，或复制时不完整。';
  }

  if (isPkceSessionRecoveryError(message)) {
    return '邮箱大概率已经确认成功，只是当前浏览器没有拿到自动登录凭证。你现在可以直接返回登录页登录。';
  }

  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return '网络连接暂时不稳定，请稍后重试，或重新点击邮件中的链接。';
  }

  return message;
};

export default function AuthConfirmPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [viewState, setViewState] = useState<ConfirmViewState>({
    status: 'loading',
    title: '正在确认邮箱',
    description: '系统正在核对你的注册状态，请稍等片刻。',
  });

  useEffect(() => {
    let isCancelled = false;

    const finalizeSuccess = async (email?: string, autoSignedIn = false) => {
      if (isCancelled) {
        return;
      }

      sessionStorage.removeItem(PENDING_REGISTRATION_EMAIL_KEY);
      window.history.replaceState({}, document.title, getAppPath('/auth/confirm'));
      await useAuth.getState().initialize();

      setViewState({
        status: 'success',
        title: '恭喜你，注册成功',
        description: autoSignedIn
          ? '邮箱已经确认完成，你现在可以直接进入工作台体验。'
          : '邮箱已经确认完成。为了保证登录状态稳定，现在可以直接返回登录页登录。',
        email,
        autoSignedIn,
      });
    };

    const finalizeError = (description: string, detail?: string, email?: string) => {
      if (isCancelled) {
        return;
      }

      setViewState({
        status: 'error',
        title: '确认链接暂时不可用',
        description,
        detail,
        email,
      });
    };

    const handleConfirmation = async () => {
      const currentUrl = new URL(window.location.href);
      const queryParams = currentUrl.searchParams;
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const nestedCallbackUrl = readFirstParam(
        queryParams.get('confirmation_url'),
        queryParams.get('confirmationUrl'),
      );
      const nestedParams = parseNestedCallbackParams(nestedCallbackUrl);

      const type = readFirstParam(
        queryParams.get('type'),
        hashParams.get('type'),
        nestedParams.query?.get('type'),
        nestedParams.hash?.get('type'),
      );
      const code = readFirstParam(
        queryParams.get('code'),
        hashParams.get('code'),
        nestedParams.query?.get('code'),
        nestedParams.hash?.get('code'),
      );
      const tokenHash = readFirstParam(
        queryParams.get('token_hash'),
        hashParams.get('token_hash'),
        nestedParams.query?.get('token_hash'),
        nestedParams.hash?.get('token_hash'),
      );
      const accessToken = readFirstParam(
        hashParams.get('access_token'),
        queryParams.get('access_token'),
        nestedParams.hash?.get('access_token'),
        nestedParams.query?.get('access_token'),
      );
      const refreshToken = readFirstParam(
        hashParams.get('refresh_token'),
        queryParams.get('refresh_token'),
        nestedParams.hash?.get('refresh_token'),
        nestedParams.query?.get('refresh_token'),
      );
      const errorDescription = readFirstParam(
        queryParams.get('error_description'),
        hashParams.get('error_description'),
        nestedParams.query?.get('error_description'),
        nestedParams.hash?.get('error_description'),
      );
      const pendingEmail = sessionStorage.getItem(PENDING_REGISTRATION_EMAIL_KEY) ?? undefined;
      const emailFromCallback = readFirstParam(
        queryParams.get('email'),
        hashParams.get('email'),
        nestedParams.query?.get('email'),
        nestedParams.hash?.get('email'),
      );

      if (type === 'recovery') {
        navigate(`/reset-password${window.location.search}${window.location.hash}`, { replace: true });
        return;
      }

      if (type === 'invite') {
        navigate(`/invitation-setup${window.location.search}${window.location.hash}`, { replace: true });
        return;
      }

      let callbackError: string | null = errorDescription;
      let session = (await supabase.auth.getSession()).data.session ?? null;
      let user = session?.user ?? (await supabase.auth.getUser()).data.user ?? null;

      const hasExplicitCallback =
        Boolean(type) ||
        Boolean(code) ||
        Boolean(tokenHash) ||
        Boolean(accessToken) ||
        Boolean(refreshToken) ||
        Boolean(errorDescription) ||
        Boolean(nestedCallbackUrl);

      try {
        if (!session && code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            throw error;
          }
          session = data.session ?? null;
          user = data.session?.user ?? user;
        } else if (!session && accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            throw error;
          }
          session = data.session ?? null;
          user = data.session?.user ?? user;
        } else if (!session && tokenHash) {
          const otpType = toOtpType(type);
          if (otpType) {
            const { data, error } = await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: otpType,
            });
            if (error) {
              throw error;
            }
            session = data.session ?? null;
            user = data.user ?? data.session?.user ?? user;
          }
        }
      } catch (error) {
        callbackError = error instanceof Error ? error.message : 'Unknown confirmation error';
      }

      session = (await supabase.auth.getSession()).data.session ?? session;
      user = (await supabase.auth.getUser()).data.user ?? session?.user ?? user;

      const confirmedEmail = user?.email ?? emailFromCallback ?? pendingEmail;
      const isConfirmed = Boolean(session?.user) || Boolean(user?.email_confirmed_at);
      const likelyConfirmedWithoutSession =
        Boolean(code) &&
        (type === 'signup' || type === 'email' || type === 'magiclink') &&
        isPkceSessionRecoveryError(callbackError);

      if (isConfirmed || likelyConfirmedWithoutSession) {
        await finalizeSuccess(confirmedEmail, Boolean(session));
        return;
      }

      if (!hasExplicitCallback && useAuth.getState().isAuthenticated) {
        await finalizeSuccess(confirmedEmail, true);
        return;
      }

      window.history.replaceState({}, document.title, getAppPath('/auth/confirm'));
      finalizeError(
        getFriendlyError(callbackError),
        '如果你已经在别的页面确认成功，可以直接返回登录页重新登录；如果还没成功，请重新点击最新一封确认邮件。',
        confirmedEmail,
      );
    };

    handleConfirmation();

    return () => {
      isCancelled = true;
    };
  }, [navigate]);

  const showWorkspaceAction =
    viewState.status === 'success' && (viewState.autoSignedIn || isAuthenticated);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.16),_transparent_38%),linear-gradient(180deg,_rgba(255,251,235,0.96),_rgba(248,250,252,1))] px-4 py-10">
      <div className="mx-auto flex min-h-[80vh] max-w-lg items-center justify-center">
        <Card className="w-full border-border/70 bg-white/95 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.35)]">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/60 bg-white shadow-sm">
              {viewState.status === 'loading' ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              ) : viewState.status === 'success' ? (
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              ) : (
                <AlertCircle className="h-7 w-7 text-amber-600" />
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-primary">{BRAND_NAME_ZH}</p>
              <CardTitle className="text-2xl">{viewState.title}</CardTitle>
              <CardDescription className="text-sm leading-6 text-muted-foreground">
                {viewState.description}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {viewState.email ? (
              <Alert
                className={
                  viewState.status === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-amber-200 bg-amber-50 text-amber-900'
                }
              >
                <MailCheck
                  className={
                    viewState.status === 'success'
                      ? 'h-4 w-4 text-emerald-600'
                      : 'h-4 w-4 text-amber-600'
                  }
                />
                <AlertDescription>邮箱：{viewState.email}</AlertDescription>
              </Alert>
            ) : null}

            {viewState.status === 'error' ? (
              <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription>{viewState.detail ?? '请重新操作一次。'}</AlertDescription>
              </Alert>
            ) : null}

            <div className="rounded-2xl border border-border/70 bg-slate-50/85 p-4 text-sm leading-6 text-slate-700">
              {BRAND_SCOPE_HINT}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            {showWorkspaceAction ? (
              <Button className="w-full" onClick={() => navigate('/workspace')}>
                进入工作台
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button className="w-full" onClick={() => navigate('/login')}>
                去登录
                <LogIn className="ml-2 h-4 w-4" />
              </Button>
            )}

            <Button variant="outline" className="w-full" onClick={() => navigate('/')}>
              返回首页
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
