import { Link } from 'react-router-dom';

import {
  BRAND_NAME,
  BRAND_POSITIONING_SHORT,
  BRAND_SCOPE_HINT,
  BRAND_SHORT_NAME,
  BRAND_TAGLINE,
} from '@/lib/brand';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-black/5 bg-white/76 backdrop-blur-sm">
      <div className="page-shell py-10">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-base font-semibold text-slate-950">{BRAND_NAME}</p>
              <p className="text-sm text-slate-600">{BRAND_TAGLINE}</p>
              <p className="text-sm leading-6 text-slate-500">{BRAND_SCOPE_HINT}</p>
            </div>
            <div className="inline-flex rounded-full border border-border/70 bg-white/80 px-3 py-1 text-xs font-medium text-slate-500">
              {BRAND_POSITIONING_SHORT}
            </div>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm text-slate-500 lg:justify-end">
            <Link to="/faq" className="hover:text-slate-950">
              FAQ
            </Link>
            <Link to="/privacy" className="hover:text-slate-950">
              隐私政策
            </Link>
            <Link to="/terms-of-service" className="hover:text-slate-950">
              服务条款
            </Link>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-black/5 pt-5 text-xs leading-6 text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {currentYear} {BRAND_SHORT_NAME}. 仅提供研究型输出，不执行交易，也不提供个性化投资建议。
          </p>
          <p>Thesis-first · Research-only · Archive-ready</p>
        </div>
      </div>
    </footer>
  );
}
