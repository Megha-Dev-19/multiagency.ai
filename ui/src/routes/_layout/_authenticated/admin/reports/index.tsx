import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Card, CardContent } from "@/components";
import { Field, selectClass } from "@/components/admin-form";
import { useApiClient } from "@/lib/api";
import { type CsvColumn, csvTimestamp, downloadCsv } from "@/lib/csv";
import { adminClientsListQueryOptions } from "@/lib/queries";

export const Route = createFileRoute("/_layout/_authenticated/admin/reports/")({
  head: () => ({
    meta: [{ title: "Reports | Admin" }],
  }),
  component: AdminReportsPage,
});

function AdminReportsPage() {
  const apiClient = useApiClient();
  const clientsQuery = useQuery(adminClientsListQueryOptions(apiClient));
  const [clientId, setClientId] = useState("");
  const [note, setNote] = useState("");
  const [report, setReport] = useState<Awaited<
    ReturnType<typeof apiClient.agency.reports.generate>
  > | null>(null);

  const generateMutation = useMutation({
    mutationFn: () =>
      apiClient.agency.reports.generate({
        clientId: clientId || undefined,
        note: note.trim() || undefined,
      }),
    onSuccess: (data) => {
      setReport(data);
      toast.success("Report generated");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to generate report"),
  });

  const handleDownload = () => {
    if (!report) return;
    const overviewRows = [
      {
        section: "Overview",
        label: "Projects",
        value: String(report.overview.projectCount),
      },
      {
        section: "Overview",
        label: "Total budget",
        value: report.overview.totalBudget,
      },
      {
        section: "Overview",
        label: "Total billed",
        value: report.overview.totalBilled,
      },
      {
        section: "Overview",
        label: "Period",
        value: report.overview.period,
      },
    ];
    const contributorRows = report.contributorStats.map((s) => ({
      section: "Contributor",
      label: s.name,
      value: `${s.amountBilled} (${s.billingCount} billings)`,
      nearAccount: s.nearAccount,
    }));
    const clientRows = report.clientBreakdown.map((r) => ({
      section: "Client project",
      label: `${r.clientName} / ${r.projectTitle}`,
      value: `allocated: ${r.budgetAllocated}, spent: ${r.budgetSpent}`,
    }));
    const rows = [...overviewRows, ...contributorRows, ...clientRows];
    if (report.notes) {
      rows.push({ section: "Notes", label: "Notes", value: report.notes });
    }
    const columns: CsvColumn<(typeof rows)[number]>[] = [
      { header: "Section", value: (r) => r.section },
      { header: "Label", value: (r) => r.label },
      { header: "Value", value: (r) => r.value },
    ];
    downloadCsv(`report-${csvTimestamp()}.csv`, rows, columns);
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          admin · reports
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-black uppercase leading-none tracking-tight">
          Reports
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Generate a CSV report with overview, contributor stats, and per-client project breakdown.
        </p>
      </header>

      <Card>
        <CardContent className="p-5 grid gap-4 sm:grid-cols-2">
          <Field label="client filter (optional)" htmlFor="report-client">
            <select
              id="report-client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className={selectClass}
            >
              <option value="">all clients</option>
              {(clientsQuery.data?.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="notes (optional)" htmlFor="report-note">
            <textarea
              id="report-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
              {generateMutation.isPending ? "generating..." : "generate report"}
            </Button>
            {report && (
              <Button variant="outline" onClick={handleDownload}>
                download csv
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {report && (
        <div className="space-y-4 text-sm">
          <section className="rounded-sm border border-border p-4 space-y-2">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              overview
            </h2>
            <p>Projects: {report.overview.projectCount}</p>
            <p>Total budget: {report.overview.totalBudget}</p>
            <p>Total billed: {report.overview.totalBilled}</p>
            <p>Period: {report.overview.period}</p>
          </section>
          {report.contributorStats.length > 0 && (
            <section className="rounded-sm border border-border p-4 space-y-2">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                contributors
              </h2>
              <ul className="space-y-1">
                {report.contributorStats.map((s) => (
                  <li key={s.nearAccount}>
                    {s.name}: {s.amountBilled} ({s.billingCount} billings)
                  </li>
                ))}
              </ul>
            </section>
          )}
          {report.clientBreakdown.length > 0 && (
            <section className="rounded-sm border border-border p-4 space-y-2">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                client breakdown
              </h2>
              <ul className="space-y-1">
                {report.clientBreakdown.map((r, i) => (
                  <li key={i}>
                    {r.clientName} · {r.projectTitle}: allocated {r.budgetAllocated}, spent{" "}
                    {r.budgetSpent}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
