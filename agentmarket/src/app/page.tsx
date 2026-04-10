import { redirect } from "next/navigation";

function getFrontendUrl() {
  const value = process.env.AGENTMARKET_FRONTEND_URL?.trim();
  return value ? value.replace(/\/$/, "") : null;
}

export default function Home() {
  const frontendUrl = getFrontendUrl();

  if (frontendUrl) {
    redirect(frontendUrl);
  }

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">AgentMarket backend</h1>
      <p className="text-muted-foreground">
        This host serves the marketplace API. Set <code>AGENTMARKET_FRONTEND_URL</code> to
        redirect browser traffic to the public frontend.
      </p>
      <p className="text-muted-foreground">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        API status check: <a className="underline underline-offset-4" href="/api/marketplace">/api/marketplace</a>
      </p>
    </main>
  );
}
