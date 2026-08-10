import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ApplicationsAdminSection } from "@/components/admin/applications-section";
import { ContributorsAdminSection } from "@/components/admin/contributors-section";
import { AdminSectionError, AdminSectionSkeleton } from "@/components/admin-section-states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components";
import { adminContributorsListQueryOptions } from "@/lib/queries";

const contributorsSearchSchema = z.object({
  tab: z.enum(["directory", "incoming"]).optional().catch("directory"),
});

export const Route = createFileRoute("/_layout/_authenticated/admin/contributors/")({
  head: () => ({
    meta: [{ title: "Contributors | Admin" }],
  }),
  validateSearch: contributorsSearchSchema,
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(adminContributorsListQueryOptions(context.apiClient)),
  pendingComponent: () => <AdminSectionSkeleton rows={5} />,
  errorComponent: ({ error, reset }) => <AdminSectionError error={error} onRetry={reset} />,
  component: AdminContributorsPage,
});

function AdminContributorsPage() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const activeTab = tab === "incoming" ? "incoming" : "directory";

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          admin · contributors
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-black uppercase leading-none tracking-tight">
          Contributors
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Builders who do project work — profiles, skills, and assignments.
        </p>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          void navigate({
            search: { tab: value === "incoming" ? "incoming" : undefined },
            replace: true,
          });
        }}
      >
        <TabsList variant="line" className="font-mono text-[11px] uppercase tracking-[0.18em]">
          <TabsTrigger value="directory">directory</TabsTrigger>
          <TabsTrigger value="incoming">incoming</TabsTrigger>
        </TabsList>
        <TabsContent value="directory" className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground max-w-2xl">
            People already on the team as builders. Create profiles manually or convert accepted
            applications from Incoming. Assign them to projects from the project detail page.
          </p>
          <ContributorsAdminSection />
        </TabsContent>
        <TabsContent value="incoming" className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground max-w-2xl">
            Applications not yet on the team. Accept contributor applications, then use{" "}
            <span className="font-mono text-[11px]">convert to builder</span> to add them to the
            directory. Founder and client applications are tracked here but follow different paths
            (not converted to builders).
          </p>
          <ApplicationsAdminSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
