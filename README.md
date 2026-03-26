# 涨涨AI · UpUp AI

Thesis-first AI financial research workspace.

`UpUp AI` is a research-only product for stocks, funds, earnings, companies, industries, macro, and market events. It is built to give a clear judgment first, then expand into evidence, counterarguments, update conditions, and reusable thesis assets.

## What It Does

- `thesis-first`: answer with a direct judgment before explanation
- `follow-up continuity`: keep refining the same thesis across follow-up questions
- `event update`: update an existing thesis incrementally instead of rewriting from scratch
- `Thesis Card`: turn strong research into reusable assets
- `Archive`: search and reuse conversations, briefings, and thesis cards
- `research-only guardrail`: rewrite buy/sell/position requests into research-safe analysis

## Core Product Surfaces

- `/` landing page for the thesis-first product
- `/workspace` research workspace
- `/analysis-records` archive for conversations, briefings, and thesis cards
- `/settings` provider control center
- `/dashboard` compatibility route mapped to the workspace

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS + Radix UI
- Supabase Auth / Database / Edge Functions
- GitHub Pages or Vercel for frontend hosting

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:8080`.

## Quality Checks

```bash
npm test -- --run
npm run lint
npm run build
```

## Deployment

### Vercel

Already supported and suitable for the production frontend.

Required environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_ENABLE_PUBLIC_REGISTRATION`

### GitHub Pages

This repository includes a GitHub Actions workflow for Pages deployment.

Important:

- repository Pages source must be set to `GitHub Actions`
- project page base path is `/upup-ai/`
- SPA routing uses `404.html` fallback in the workflow

## Backend Notes

The frontend depends on Supabase database changes and Edge Functions, especially:

- `settings-proxy`
- `chat-research`
- `generate-briefing`

If you deploy a new frontend release, make sure the corresponding Supabase SQL patch and function deployments are already applied.

## Product Positioning

UpUp AI is not a trading bot shell and not a personalized investment-advice product.

It is a calm, low-noise, thesis-first research workspace for serious financial analysis.
