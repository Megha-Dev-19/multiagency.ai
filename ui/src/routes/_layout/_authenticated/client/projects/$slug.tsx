import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Badge, Budget } from "@/components";
import { AssignmentsSection } from "@/components/admin/assignments-section";
import { BillingsAdminSection } from "@/components/admin/billings-section";
import { ProjectBudgetPanel } from "@/components/admin/project-budget-panel";
import { useApiClient } from "@/lib/api";
import { adminProjectBudgetQueryOptions, adminProjectDetailQueryOptions } from "@/lib/queries";

export const Route = createFileRoute("/_layout/_authenticated/client/projects/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient
      .ensureQueryData(adminProjectDetailQueryOptions(context.apiClient, params.slug))
      .catch(() => null);
    if (!data) return null;
    await context.queryClient.ensureQueryData(
      adminProjectBudgetQueryOptions(context.apiClient, data.project.id),
    );
    return data;
  },
  component: ClientProjectDetailPage,
});

function ClientProjectDetailPage() {
  const { slug } = Route.useParams();
  const { projectIds, client } = Route.useRouteContext();
  const apiClient = useApiClient();

  const projectQuery = useQuery(adminProjectDetailQueryOptions(apiClient, slug));
  const projectId = projectQuery.data?.project.id;
  const budgetQuery = useQuery({
    ...adminProjectBudgetQueryOptions(apiClient, projectId ?? ""),
    enabled: !!projectId,
  });

  if (projectQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading project…</p>;
  }
  if (!projectQuery.data || !projectIds.includes(projectQuery.data.project.id)) {
    throw notFound();
  }

  const { project } = projectQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/client/projects"
          className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground"
        >
          ← your projects
        </Link>
      </div>

      <header className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{project.status}</Badge>
          <Badge variant="outline">{project.kind}</Badge>
        </div>
        <h1 className="text-2xl font-semibold">{project.title}</h1>
        <div className="font-mono text-xs text-muted-foreground">@{project.slug}</div>
      </header>

      {project.description && (
        <section>
          <h2 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Notes</h2>
          <p className="text-sm whitespace-pre-wrap">{project.description}</p>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-wide text-muted-foreground">Contributors</h2>
        {projectId && <AssignmentsSection projectId={projectId} readOnly />}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-wide text-muted-foreground">Budget</h2>
        {budgetQuery.data && budgetQuery.data.budgets.length > 0 ? (
          <div className="space-y-4">
            {budgetQuery.data.budgets.map((b) => (
              <Budget key={b.tokenId} budget={b} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No budget allocated.</p>
        )}
        {projectId && <ProjectBudgetPanel projectId={projectId} readOnly />}
      </section>

      {projectId && <BillingsAdminSection readOnly clientId={client.id} />}
    </div>
  );
}
