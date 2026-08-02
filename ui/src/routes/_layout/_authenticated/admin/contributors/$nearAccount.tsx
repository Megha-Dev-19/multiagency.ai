import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { Badge, Card, CardContent, DataTable } from "@/components";
import { AdminSectionError, AdminSectionSkeleton } from "@/components/admin-section-states";
import { formatTokenAmount } from "@/lib/format-amount";
import {
  adminAssignmentsListQueryOptions,
  adminContributorDetailQueryOptions,
  adminProjectsListQueryOptions,
} from "@/lib/queries";

export const Route = createFileRoute("/_layout/_authenticated/admin/contributors/$nearAccount")({
  head: ({ params }) => ({
    meta: [{ title: `${params.nearAccount} | Admin · Contributors` }],
  }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      adminContributorDetailQueryOptions(context.apiClient, params.nearAccount),
    ),
  pendingComponent: () => <AdminSectionSkeleton rows={6} />,
  errorComponent: ({ error, reset }) => <AdminSectionError error={error} onRetry={reset} />,
  component: ContributorDetailPage,
});

function ContributorDetailPage() {
  const { nearAccount } = Route.useParams();
  const apiClient = Route.useRouteContext().apiClient;
  const contributorQuery = useQuery(adminContributorDetailQueryOptions(apiClient, nearAccount));
  const contributor = contributorQuery.data?.contributor;
  if (contributorQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!contributor) return null;

  const projectsQuery = useQuery(adminProjectsListQueryOptions(apiClient));
  const assignmentsQuery = useQuery(adminAssignmentsListQueryOptions(apiClient));

  const billingsQuery = useInfiniteQuery({
    queryKey: ["admin", "billings", "contributor", nearAccount],
    queryFn: ({ pageParam }) => apiClient.billings.list({ nearAccount, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const projectById = new Map((projectsQuery.data?.data ?? []).map((p) => [p.id, p]));
  const assignments = (assignmentsQuery.data?.data ?? []).filter(
    (a) => a.nearAccount === nearAccount,
  );
  const billings = billingsQuery.data?.pages.flatMap((p) => p.data) ?? [];

  const totalBilled = billings
    .filter((b) => b.status === "Approved")
    .reduce((acc, b) => acc + BigInt(b.amount), 0n);

  const projectColumns: ColumnDef<(typeof assignments)[number]>[] = [
    {
      id: "project",
      header: "Project",
      accessorFn: (row) => projectById.get(row.projectId)?.title ?? row.projectSlug,
      cell: ({ row }) => (
        <Link
          to="/admin/projects/$slug"
          params={{ slug: row.original.projectSlug }}
          className="text-sm underline"
        >
          {row.original.projectTitle}
        </Link>
      ),
    },
    { id: "role", header: "Role", accessorKey: "role" },
    {
      id: "onboarding",
      header: "Onboarding",
      accessorKey: "onboardingStatus",
      cell: ({ row }) => <Badge variant="outline">{row.original.onboardingStatus}</Badge>,
    },
  ];

  const billingColumns: ColumnDef<(typeof billings)[number]>[] = [
    {
      id: "proposal",
      header: "Proposal",
      accessorKey: "proposalId",
      cell: ({ row }) => <span className="font-mono text-xs">#{row.original.proposalId}</span>,
    },
    {
      id: "amount",
      header: "Amount",
      accessorKey: "amount",
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {formatTokenAmount(row.original.amount, row.original.tokenId)}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge>,
    },
  ];

  const skillsDisplay = useMemo(() => contributor.skills.join(", "), [contributor.skills]);

  return (
    <div className="space-y-8">
      <div>
        <Link
          to="/admin/contributors"
          className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground"
        >
          ← all contributors
        </Link>
      </div>

      <header className="space-y-3">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          admin · contributors
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-black uppercase leading-none tracking-tight">
          {contributor.name ?? nearAccount}
        </h1>
        <p className="font-mono text-sm text-muted-foreground">{nearAccount}</p>
        {contributor.bio && <p className="text-sm max-w-2xl">{contributor.bio}</p>}
        {skillsDisplay && (
          <div className="flex flex-wrap gap-1">
            {contributor.skills.map((s: string) => (
              <Badge key={s} variant="outline">
                {s}
              </Badge>
            ))}
          </div>
        )}
        {contributor.location && (
          <p className="text-sm text-muted-foreground">{contributor.location}</p>
        )}
      </header>

      <Card>
        <CardContent className="p-5 grid gap-2 sm:grid-cols-3">
          <div>
            <div className="text-xs uppercase text-muted-foreground">Total billed (approved)</div>
            <div className="font-mono text-lg">{totalBilled.toString()}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">Billing entries</div>
            <div className="font-mono text-lg">{billings.length}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">Projects</div>
            <div className="font-mono text-lg">{assignments.length}</div>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          projects
        </h2>
        <DataTable
          columns={projectColumns}
          data={assignments}
          isLoading={assignmentsQuery.isLoading}
          emptyMessage="Not assigned to any projects."
          csvFilename={`contributor-${nearAccount}-projects`}
          viewId={`contributor-${nearAccount}-projects`}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          billings
        </h2>
        <DataTable
          columns={billingColumns}
          data={billings}
          isLoading={billingsQuery.isLoading}
          emptyMessage="No billings for this contributor."
          csvFilename={`contributor-${nearAccount}-billings`}
          viewId={`contributor-${nearAccount}-billings`}
        />
      </section>
    </div>
  );
}
