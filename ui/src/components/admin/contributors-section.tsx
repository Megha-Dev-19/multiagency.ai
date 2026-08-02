import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import { toast } from "sonner";
import { Badge, Button, Card, CardContent, DataTable, Input } from "@/components";
import { AdminError } from "@/components/admin-error";
import { Field } from "@/components/admin-form";
import type { ApiClient } from "@/lib/api";
import { useApiClient } from "@/lib/api";
import { isValidNearAccountId } from "@/lib/near-account";
import { adminContributorsListQueryKey, adminContributorsListQueryOptions } from "@/lib/queries";

type Contributor = Awaited<ReturnType<ApiClient["contributors"]["list"]>>["data"][number];

export function ContributorsAdminSection() {
  const apiClient = useApiClient();
  const contributorsQuery = useQuery(adminContributorsListQueryOptions(apiClient));
  const [creating, setCreating] = useState(false);

  if (contributorsQuery.isError) {
    return <AdminError error={contributorsQuery.error} />;
  }

  const columns: ColumnDef<Contributor>[] = [
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      cell: ({ row }) => (
        <Link
          to="/admin/contributors/$nearAccount"
          params={{ nearAccount: row.original.nearAccount }}
          className="font-display text-sm uppercase tracking-tight font-bold hover:underline"
        >
          {row.original.name ?? row.original.nearAccount}
        </Link>
      ),
    },
    {
      id: "nearAccount",
      header: "NEAR",
      accessorKey: "nearAccount",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.nearAccount}</span>
      ),
    },
    {
      id: "skills",
      header: "Skills",
      accessorFn: (row) => row.skills.join(", "),
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.skills.slice(0, 3).map((s) => (
            <Badge key={s} variant="outline" className="text-[10px]">
              {s}
            </Badge>
          ))}
          {row.original.skills.length > 3 && (
            <span className="text-xs text-muted-foreground">+{row.original.skills.length - 3}</span>
          )}
        </div>
      ),
    },
    {
      id: "location",
      header: "Location",
      accessorKey: "location",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.location ?? "—"}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-end gap-3">
        <Button
          onClick={() => setCreating((v) => !v)}
          variant={creating ? "outline" : "default"}
          className="font-display uppercase tracking-wide"
        >
          {creating ? "cancel" : "+ new contributor"}
        </Button>
      </header>

      {creating && <ContributorCreateForm onDone={() => setCreating(false)} />}

      <DataTable
        columns={columns}
        data={contributorsQuery.data?.data ?? []}
        isLoading={contributorsQuery.isLoading}
        error={contributorsQuery.error}
        onRetry={() => contributorsQuery.refetch()}
        emptyMessage="No contributors yet. Create your first one above."
        csvFilename="contributors"
        viewId="admin-contributors"
        searchPlaceholder="Search contributors…"
      />
    </div>
  );
}

function ContributorCreateForm({ onDone }: { onDone: () => void }) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [nearAccount, setNearAccount] = useState("");

  const createMutation = useMutation({
    mutationFn: async () =>
      apiClient.contributors.create({
        nearAccount: nearAccount.trim(),
        name: name.trim() || undefined,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminContributorsListQueryKey });
      toast.success("Contributor created");
      onDone();
    },
    onError: (err: Error) => toast.error(err.message || "Failed to create contributor"),
  });

  const isPending = createMutation.isPending;
  const nearTrimmed = nearAccount.trim();
  const nearOk = nearTrimmed.length > 0 && isValidNearAccountId(nearTrimmed);
  const canSubmit = nearOk && !isPending;

  return (
    <Card>
      <CardContent className="p-5 grid gap-4">
        <Field
          label="near account"
          htmlFor="new-near"
          helper="Required — builders are keyed by NEAR account."
        >
          <Input
            id="new-near"
            value={nearAccount}
            onChange={(e) => setNearAccount(e.target.value)}
            placeholder="contributor.near"
            disabled={isPending}
          />
          {nearTrimmed && !nearOk && (
            <p className="text-xs text-destructive">Invalid NEAR account id</p>
          )}
        </Field>
        <Field label="name (optional)" htmlFor="new-name">
          <Input
            id="new-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isPending}
          />
        </Field>
        <div className="flex gap-2">
          <Button onClick={() => createMutation.mutate()} disabled={!canSubmit}>
            {isPending ? "creating..." : "create contributor"}
          </Button>
          <Button onClick={onDone} variant="outline" disabled={isPending}>
            cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
