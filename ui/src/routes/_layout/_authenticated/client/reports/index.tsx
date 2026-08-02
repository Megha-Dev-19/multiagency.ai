import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Card, CardContent } from "@/components";
import { Field } from "@/components/admin-form";
import { useApiClient } from "@/lib/api";
import { type CsvColumn, csvTimestamp, downloadCsv } from "@/lib/csv";

export const Route = createFileRoute("/_layout/_authenticated/client/reports/")({
  component: ClientReportsPage,
});

function ClientReportsPage() {
  const { client } = Route.useRouteContext();
  const apiClient = useApiClient();
  const [note, setNote] = useState("");
  const [report, setReport] = useState<Awaited<
    ReturnType<typeof apiClient.agency.reports.generate>
  > | null>(null);

  const generateMutation = useMutation({
    mutationFn: () =>
      apiClient.agency.reports.generate({
        clientId: client.id,
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
    const rows = [
      ...report.clientBreakdown.map((r) => ({
        section: "Project",
        label: r.projectTitle,
        value: `allocated: ${r.budgetAllocated}, spent: ${r.budgetSpent}`,
      })),
      {
        section: "Overview",
        label: "Total billed",
        value: report.overview.totalBilled,
      },
    ];
    if (report.notes) rows.push({ section: "Notes", label: "Notes", value: report.notes });
    const columns: CsvColumn<(typeof rows)[number]>[] = [
      { header: "Section", value: (r) => r.section },
      { header: "Label", value: (r) => r.label },
      { header: "Value", value: (r) => r.value },
    ];
    downloadCsv(`client-report-${csvTimestamp()}.csv`, rows, columns);
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Download a CSV report scoped to your projects and billings.
      </p>
      <Card>
        <CardContent className="p-5 grid gap-4">
          <Field label="notes (optional)" htmlFor="client-report-note">
            <textarea
              id="client-report-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
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
    </div>
  );
}
