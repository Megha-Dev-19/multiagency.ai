import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { Building2, Check } from "lucide-react";
import { useMemo } from "react";
import { useAuthClient } from "@/app";
import type { AuthClient } from "@/lib/auth";
import { organizationsListQueryKey, sessionQueryOptions } from "@/lib/auth";
import { isAgencyWorkspace } from "@/lib/org-metadata";
import { invalidateWorkspaceQueries } from "@/lib/queries";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

async function activeOrganizationId(auth: AuthClient): Promise<string | null> {
  const { data: session } = await auth.getSession({ query: { disableCookieCache: true } });
  return session?.session?.activeOrganizationId ?? null;
}

async function switchAgency(auth: AuthClient, organizationId: string): Promise<void> {
  const { error } = await auth.organization.setActive({ organizationId });
  if (error) throw new Error(error.message || "Failed to switch agency");

  if ((await activeOrganizationId(auth)) === organizationId) return;

  await auth.organization.setActive({ organizationId });
  if ((await activeOrganizationId(auth)) !== organizationId) {
    throw new Error("Failed to switch agency");
  }
}

export function OrgSwitcher() {
  const auth = useAuthClient();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: session } = useQuery(sessionQueryOptions(auth));
  const activeOrgId = session?.session?.activeOrganizationId ?? null;

  const orgsQuery = useQuery({
    queryKey: organizationsListQueryKey,
    queryFn: async () => {
      const res = await auth.organization.list();
      return res.data ?? [];
    },
  });

  const switchMutation = useMutation({
    mutationFn: (orgId: string) => switchAgency(auth, orgId),
    onSuccess: async () => {
      await queryClient.fetchQuery(
        sessionQueryOptions(auth, undefined, { disableCookieCache: true }),
      );
      await invalidateWorkspaceQueries(queryClient, router);
    },
  });

  const organizations = useMemo(
    () => (orgsQuery.data ?? []).filter((org) => isAgencyWorkspace(org.metadata)),
    [orgsQuery.data],
  );
  const activeOrg = organizations.find((o) => o.id === activeOrgId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground max-w-[180px]"
        >
          <Building2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate min-w-0">{activeOrg?.name ?? "agency"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">agencies</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            className="flex items-center justify-between cursor-pointer"
            onClick={() => switchMutation.mutate(org.id)}
          >
            <span className="truncate min-w-0 flex-1">{org.name}</span>
            {org.id === activeOrgId && <Check className="h-3.5 w-3.5 text-muted-foreground" />}
          </DropdownMenuItem>
        ))}
        {organizations.length === 0 && (
          <DropdownMenuItem disabled className="text-muted-foreground">
            no agencies
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
