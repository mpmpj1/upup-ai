import { Link } from 'react-router-dom';

import { BRAND_NAME, BRAND_POSITIONING_SHORT, BRAND_SHORT_NAME, BRAND_TAGLINE } from '@/lib/brand';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-black/5 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-base font-semibold text-slate-950">{BRAND_NAME}</p>
            <p className="text-sm text-slate-600">{BRAND_TAGLINE}</p>
            <p className="text-xs text-slate-500">{BRAND_POSITIONING_SHORT}</p>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-slate-500">
            <Link to="/faq" className="transition-colors hover:text-slate-950">
              FAQ
            </Link>
            <Link to="/privacy" className="transition-colors hover:text-slate-950">
              隐私
            </Link>
            <Link to="/terms-of-service" className="transition-colors hover:text-slate-950">
              条款
            </Link>
          </div>
        </div>

        <div className="mt-6 border-t border-black/5 pt-4 text-xs leading-6 text-slate-500">
          © {currentYear} {BRAND_SHORT_NAME}。仅提供研究型输出，不执行交易，也不提供个性化投资建议。
        </div>
      </div>
    </footer>
  );
}
