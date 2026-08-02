import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Badge, Card, CardContent } from "@/components";
import { BillingsAdminSection } from "@/components/admin/billings-section";
import { useApiClient } from "@/lib/api";
import { adminProjectsListQueryOptions } from "@/lib/queries";

export const Route = createFileRoute("/_layout/_authenticated/client/")({
  component: ClientHome,
});

function ClientHome() {
  const { client, projectIds } = Route.useRouteContext();
  const apiClient = useApiClient();
  const projectsQuery = useQuery(adminProjectsListQueryOptions(apiClient));

  const clientProjects = (projectsQuery.data?.data ?? []).filter((p) => projectIds.includes(p.id));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Projects</div>
            <div className="font-display text-3xl font-black">{clientProjects.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Client</div>
            <div className="text-sm font-medium">{client.name}</div>
            {client.nearAccountId && (
              <div className="font-mono text-[10px] text-muted-foreground mt-1">
                {client.nearAccountId}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Access</div>
            <Badge variant="outline" className="mt-1">
              read-only
            </Badge>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          recent billings
        </h2>
        <BillingsAdminSection readOnly clientId={client.id} />
      </section>
    </div>
  );
}
