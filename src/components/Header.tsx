import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Archive, LogIn, LogOut, MessageSquareText, Settings2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import {
  BRAND_POSITIONING_SHORT,
  BRAND_SHORT_NAME,
  BRAND_TAGLINE,
} from '@/lib/brand';
import { cn } from '@/lib/utils';

const navItems = [
  {
    href: '/workspace',
    label: '工作台',
    icon: MessageSquareText,
  },
  {
    href: '/analysis-records',
    label: '研究档案',
    icon: Archive,
  },
  {
    href: '/settings',
    label: '模型设置',
    icon: Settings2,
  },
];

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link to={isAuthenticated ? '/workspace' : '/'} className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-extrabold tracking-[0.24em] text-stone-100 shadow-[0_14px_32px_-18px_rgba(15,23,42,0.7)]">
            UU
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-lg font-semibold tracking-tight text-slate-950">
                {BRAND_SHORT_NAME}
              </span>
              <Badge variant="outline" className="hidden border-slate-300/80 text-[11px] text-slate-600 sm:inline-flex">
                金融专用
              </Badge>
            </div>
            <p className="truncate text-xs text-slate-500">{BRAND_TAGLINE}</p>
          </div>
        </Link>

        <div className="hidden items-center gap-2 xl:flex">
          {isAuthenticated &&
            navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link key={item.href} to={item.href}>
                  <Button
                    variant="ghost"
                    className={cn(
                      'gap-2 rounded-full px-4 text-slate-600 hover:bg-stone-100 hover:text-slate-950',
                      isActive && 'bg-slate-950 text-stone-100 hover:bg-slate-950 hover:text-stone-100'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
        </div>

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-slate-900">{user?.email || BRAND_SHORT_NAME}</p>
                <p className="text-xs text-slate-500">{BRAND_POSITIONING_SHORT}</p>
              </div>
              <Button variant="outline" className="border-slate-200 bg-white" onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" />
                退出
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" className="text-slate-600 hover:text-slate-950" onClick={() => navigate('/login')}>
                <LogIn className="mr-2 h-4 w-4" />
                登录
              </Button>
              <Button variant="premium" onClick={() => navigate('/login')}>
                进入 {BRAND_SHORT_NAME}
              </Button>
            </>
          )}
        </div>
      </div>

      {isAuthenticated && (
        <div className="border-t border-black/5 bg-stone-50/90 px-4 py-2 text-center text-xs text-slate-500 sm:px-6 xl:hidden">
          工作台 / 研究档案 / 模型设置
        </div>
      )}
    </header>
  );
}
