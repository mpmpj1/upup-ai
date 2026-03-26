import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Archive, ChevronRight, LogIn, LogOut, MessageSquareText, Settings2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import {
  BRAND_POSITIONING_SHORT,
  BRAND_SCOPE_HINT,
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
    <header className="sticky top-0 z-50 border-b border-black/5 bg-white/78 backdrop-blur-xl">
      <div className="page-shell">
        <div className="flex min-h-[84px] items-center justify-between gap-4">
          <Link to={isAuthenticated ? '/workspace' : '/'} className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-slate-900/10 bg-slate-950 text-sm font-black tracking-[0.24em] text-white shadow-[0_18px_38px_-24px_rgba(15,23,42,0.72)]">
              UU
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-lg font-semibold tracking-tight text-slate-950">
                  {BRAND_SHORT_NAME}
                </span>
                <Badge variant="secondary" className="hidden sm:inline-flex">
                  {BRAND_POSITIONING_SHORT}
                </Badge>
              </div>
              <p className="truncate text-sm text-slate-500">{BRAND_TAGLINE}</p>
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
                      variant={isActive ? 'default' : 'ghost'}
                      className={cn(
                        'gap-2',
                        isActive
                          ? 'border-slate-900/10'
                          : 'text-slate-600 hover:bg-accent/70 hover:text-slate-950',
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
                <div className="hidden max-w-[260px] text-right lg:block">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {user?.email || BRAND_SHORT_NAME}
                  </p>
                  <p className="truncate text-xs text-slate-500">{BRAND_SCOPE_HINT}</p>
                </div>
                <Button variant="outline" className="hidden sm:inline-flex" onClick={logout}>
                  <LogOut className="h-4 w-4" />
                  退出
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate('/login')}>
                  <LogIn className="h-4 w-4" />
                  登录
                </Button>
                <Button variant="premium" onClick={() => navigate('/login')}>
                  进入工作台
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {isAuthenticated ? (
        <div className="border-t border-black/5 bg-white/58 xl:hidden">
          <div className="page-shell flex flex-wrap gap-2 py-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link key={item.href} to={item.href}>
                  <Button
                    variant={isActive ? 'default' : 'outline'}
                    size="sm"
                    className={cn(isActive ? '' : 'bg-white/86')}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </header>
  );
}
