import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Card, CardContent, DataTable, Input } from "@/components";
import { AdminError } from "@/components/admin-error";
import { Field } from "@/components/admin-form";
import type { ApiClient } from "@/lib/api";
import { useApiClient } from "@/lib/api";
import { isValidNearAccountId } from "@/lib/near-account";
import {
  adminClientsListQueryKey,
  adminClientsListQueryOptions,
  adminProjectsListQueryOptions,
} from "@/lib/queries";

type Client = Awaited<ReturnType<ApiClient["clients"]["list"]>>["data"][number];

export function ClientsAdminSection() {
  const apiClient = useApiClient();
  const clientsQuery = useQuery(adminClientsListQueryOptions(apiClient));
  const [creating, setCreating] = useState(false);

  if (clientsQuery.isError) {
    return <AdminError error={clientsQuery.error} />;
  }

  const columns: ColumnDef<Client>[] = [
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      cell: ({ row }) => (
        <Link
          to="/admin/clients/$clientId"
          params={{ clientId: row.original.id }}
          className="font-display text-sm uppercase tracking-tight font-bold hover:underline"
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      id: "nearAccountId",
      header: "NEAR (portal auth)",
      accessorKey: "nearAccountId",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.nearAccountId ?? "—"}
        </span>
      ),
    },
    {
      id: "updatedAt",
      header: "Updated",
      accessorFn: (row) => new Date(row.updatedAt).toISOString(),
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {new Date(row.original.updatedAt).toISOString().slice(0, 10)}
        </span>
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
          {creating ? "cancel" : "+ new client"}
        </Button>
      </header>

      {creating && <ClientCreateForm onDone={() => setCreating(false)} />}

      <DataTable
        columns={columns}
        data={clientsQuery.data?.data ?? []}
        isLoading={clientsQuery.isLoading}
        error={clientsQuery.error}
        onRetry={() => clientsQuery.refetch()}
        emptyMessage="No clients yet. Create your first one above."
        csvFilename="clients"
        viewId="admin-clients"
        searchPlaceholder="Search clients…"
      />
    </div>
  );
}

function ClientCreateForm({ onDone }: { onDone: () => void }) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const projectsQuery = useQuery(adminProjectsListQueryOptions(apiClient));
  const [name, setName] = useState("");
  const [nearAccountId, setNearAccountId] = useState("");
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  const createMutation = useMutation({
    mutationFn: async () =>
      apiClient.clients.create({
        name: name.trim(),
        nearAccountId: nearAccountId.trim() || undefined,
        projectIds: selectedProjects.length > 0 ? selectedProjects : undefined,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminClientsListQueryKey });
      toast.success("Client created");
      onDone();
    },
    onError: (err: Error) => toast.error(err.message || "Failed to create client"),
  });

  const nearTrimmed = nearAccountId.trim();
  const nearOk = !nearTrimmed || isValidNearAccountId(nearTrimmed);
  const canSubmit = name.trim().length > 0 && nearOk && !createMutation.isPending;
  const projects = projectsQuery.data?.data ?? [];

  return (
    <Card>
      <CardContent className="p-5 grid gap-4">
        <Field label="name" htmlFor="client-name">
          <Input
            id="client-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={createMutation.isPending}
          />
        </Field>
        <Field
          label="near account (portal auth)"
          htmlFor="client-near"
          helper="Clients sign in with this NEAR wallet to access the portal."
        >
          <Input
            id="client-near"
            value={nearAccountId}
            onChange={(e) => setNearAccountId(e.target.value)}
            placeholder="client.near"
            disabled={createMutation.isPending}
          />
          {nearTrimmed && !nearOk && (
            <p className="text-xs text-destructive">Invalid NEAR account id</p>
          )}
        </Field>
        {projects.length > 0 && (
          <Field label="linked projects" htmlFor="client-projects">
            <select
              id="client-projects"
              multiple
              value={selectedProjects}
              onChange={(e) =>
                setSelectedProjects(Array.from(e.target.selectedOptions, (o) => o.value))
              }
              className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={createMutation.isPending}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className="flex gap-2">
          <Button onClick={() => createMutation.mutate()} disabled={!canSubmit}>
            {createMutation.isPending ? "creating..." : "create client"}
          </Button>
          <Button onClick={onDone} variant="outline" disabled={createMutation.isPending}>
            cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ClientDetailSection({ clientId }: { clientId: string }) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const detailQuery = useQuery({
    queryKey: ["admin", "clients", "detail", clientId],
    queryFn: () => apiClient.clients.get({ id: clientId }),
    retry: false,
  });
  const projectsQuery = useQuery(adminProjectsListQueryOptions(apiClient));

  const [name, setName] = useState("");
  const [nearAccountId, setNearAccountId] = useState("");
  const [projectIds, setProjectIds] = useState<string[]>([]);

  useEffect(() => {
    if (detailQuery.data) {
      setName(detailQuery.data.client.name);
      setNearAccountId(detailQuery.data.client.nearAccountId ?? "");
      setProjectIds(detailQuery.data.projectIds);
    }
  }, [detailQuery.data]);

  const updateMutation = useMutation({
    mutationFn: async () =>
      apiClient.clients.update({
        id: clientId,
        name: name.trim(),
        nearAccountId: nearAccountId.trim() || null,
        projectIds,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminClientsListQueryKey });
      await queryClient.invalidateQueries({ queryKey: ["admin", "clients", "detail", clientId] });
      toast.success("Client updated");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to update client"),
  });

  if (detailQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading client…</p>;
  }
  if (detailQuery.isError) {
    return <AdminError error={detailQuery.error} />;
  }

  const projects = projectsQuery.data?.data ?? [];

  return (
    <Card>
      <CardContent className="p-5 grid gap-4">
        <Field label="name" htmlFor="edit-client-name">
          <Input
            id="edit-client-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={updateMutation.isPending}
          />
        </Field>
        <Field label="near account (portal auth)" htmlFor="edit-client-near">
          <Input
            id="edit-client-near"
            value={nearAccountId}
            onChange={(e) => setNearAccountId(e.target.value)}
            disabled={updateMutation.isPending}
          />
        </Field>
        {projects.length > 0 && (
          <Field label="linked projects" htmlFor="edit-client-projects">
            <select
              id="edit-client-projects"
              multiple
              value={projectIds}
              onChange={(e) => setProjectIds(Array.from(e.target.selectedOptions, (o) => o.value))}
              className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={updateMutation.isPending}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Button
          onClick={() => updateMutation.mutate()}
          disabled={!name.trim() || updateMutation.isPending}
          size="sm"
        >
          {updateMutation.isPending ? "saving..." : "save changes"}
        </Button>
      </CardContent>
    </Card>
  );
}
