import { ReactNode, useEffect } from "react";
import { ArrowUpRight, ShieldCheck } from "lucide-react";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { BRAND_NAME, BRAND_POSITIONING_SHORT, BRAND_SCOPE_HINT } from "@/lib/brand";
import { Button } from "@/components/ui/button";

interface PublicContentLayoutProps {
  eyebrow: string;
  title: string;
  description: string;
  lastUpdated?: string;
  highlights?: string[];
  children: ReactNode;
}

export default function PublicContentLayout({
  eyebrow,
  title,
  description,
  lastUpdated,
  highlights = [],
  children,
}: PublicContentLayoutProps) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pb-16 pt-10 sm:pb-24 sm:pt-14">
        <div className="page-shell-narrow space-y-8">
          <section className="surface-card hero-grid overflow-hidden px-6 py-8 sm:px-10 sm:py-12">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="section-chip">{eyebrow}</span>
                  {lastUpdated ? (
                    <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                      Last updated {lastUpdated}
                    </span>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <h1 className="max-w-4xl text-balance text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                    {title}
                  </h1>
                  <p className="max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
                    {description}
                  </p>
                </div>
              </div>

              <div className="panel-card-muted space-y-4 p-5 sm:p-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <ShieldCheck className="h-4 w-4 text-amber-600" />
                  {BRAND_NAME}
                </div>
                <p className="text-sm leading-6 text-slate-600">{BRAND_POSITIONING_SHORT}</p>
                <p className="text-sm leading-6 text-slate-600">{BRAND_SCOPE_HINT}</p>
                {highlights.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    {highlights.map((highlight) => (
                      <div key={highlight} className="badge-soft w-fit">
                        {highlight}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <div className="space-y-6">{children}</div>

          <section className="panel-card overflow-hidden px-6 py-6 sm:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2">
                <p className="section-kicker">Support</p>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                  还有疑问，或者需要人工支持？
                </h2>
                <p className="max-w-2xl text-sm leading-6 text-slate-600">
                  如果你在 Provider 配置、登录流程、研究归档或合规边界上仍有问题，可以通过官方支持渠道继续沟通。
                </p>
              </div>

              <Button
                className="w-full sm:w-auto"
                onClick={() => window.open("https://discord.gg/wavf5JWhuT", "_blank")}
              >
                联系支持
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
