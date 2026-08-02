import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { clientLookupQueryOptions } from "@/lib/queries";

export const Route = createFileRoute("/_layout/_authenticated/client")({
  beforeLoad: async ({ context }) => {
    const nearAccountId = context.authClient.near.getAccountId();
    if (!nearAccountId) {
      throw redirect({ to: "/", hash: "unauthorized" });
    }
    const lookup = await context.queryClient.ensureQueryData(
      clientLookupQueryOptions(context.apiClient, nearAccountId),
    );
    if (!lookup.client) {
      throw redirect({ to: "/", hash: "not-a-client" });
    }
    return {
      client: lookup.client,
      projectIds: lookup.projectIds,
      nearAccountId,
    };
  },
  component: ClientLayout,
});

const TAB_BASE =
  "font-mono text-[11px] uppercase tracking-[0.18em] px-3 py-1.5 rounded-sm transition-colors";
const TAB_ACTIVE = "bg-foreground text-background";
const TAB_INACTIVE = "text-muted-foreground hover:text-foreground";

function ClientLayout() {
  const { client } = Route.useRouteContext();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          client portal
        </div>
        <h1 className="font-display text-2xl font-black uppercase tracking-tight">{client.name}</h1>
      </header>
      <nav className="flex items-center gap-1 border-b border-border pb-px flex-wrap">
        <Link
          to="/client"
          className={TAB_BASE}
          activeProps={{ className: `${TAB_BASE} ${TAB_ACTIVE}` }}
          inactiveProps={{ className: `${TAB_BASE} ${TAB_INACTIVE}` }}
        >
          dashboard
        </Link>
        <Link
          to="/client/projects"
          className={TAB_BASE}
          activeProps={{ className: `${TAB_BASE} ${TAB_ACTIVE}` }}
          inactiveProps={{ className: `${TAB_BASE} ${TAB_INACTIVE}` }}
        >
          projects
        </Link>
        <Link
          to="/client/reports"
          className={TAB_BASE}
          activeProps={{ className: `${TAB_BASE} ${TAB_ACTIVE}` }}
          inactiveProps={{ className: `${TAB_BASE} ${TAB_INACTIVE}` }}
        >
          reports
        </Link>
      </nav>
      <Outlet />
    </div>
  );
}
