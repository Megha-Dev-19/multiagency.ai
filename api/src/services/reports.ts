import { and, desc, eq, inArray } from "drizzle-orm";
import { Effect } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import type { Database } from "../db";
import { billings, budgets, clientProjects, clients, projectContributors } from "../db/schema";
import type { PluginsClient } from "../lib/plugins-types.gen";
import type { AgencyService } from "./agency";
import { enrichWithChainStatus } from "./sputnik";

export function createReportsService(db: Database, agency: AgencyService, plugins: PluginsClient) {
  return {
    generate: (
      context: Record<string, unknown>,
      orgAccountId: string,
      input: { clientId?: string; note?: string },
    ) =>
      Effect.gen(function* () {
        let projectIds: string[];

        if (input.clientId) {
          const clientRows = yield* Effect.promise(() =>
            db.select().from(clients).where(eq(clients.id, input.clientId!)).limit(1),
          );
          if (!clientRows[0]) {
            return yield* Effect.fail(new ORPCError("NOT_FOUND", { message: "Client not found" }));
          }
          const links = yield* Effect.promise(() =>
            db
              .select({ projectId: clientProjects.projectId })
              .from(clientProjects)
              .where(eq(clientProjects.clientId, input.clientId!)),
          );
          projectIds = links.map((l) => l.projectId);
        } else {
          const projects = yield* Effect.promise(() =>
            agency.fetchOrgProjects(orgAccountId, context),
          );
          projectIds = projects.map((p) => p.id);
        }

        const allProjects = yield* Effect.promise(() =>
          agency.fetchOrgProjects(orgAccountId, context),
        );
        const projectById = new Map(allProjects.map((p) => [p.id, p]));

        const [budgetRows, billingRowsRaw, _assignmentRows, clientRows, clientLinkRows] =
          yield* Effect.promise(() =>
            Promise.all([
              projectIds.length > 0
                ? db
                    .select()
                    .from(budgets)
                    .where(
                      and(
                        inArray(budgets.projectId, projectIds),
                        input.clientId ? eq(budgets.clientId, input.clientId) : undefined,
                      ),
                    )
                : Promise.resolve([]),
              projectIds.length > 0
                ? db
                    .select()
                    .from(billings)
                    .where(
                      and(
                        inArray(billings.projectId, projectIds),
                        input.clientId ? eq(billings.clientId, input.clientId) : undefined,
                      ),
                    )
                    .orderBy(desc(billings.createdAt))
                : Promise.resolve([]),
              projectIds.length > 0
                ? db
                    .select()
                    .from(projectContributors)
                    .where(inArray(projectContributors.projectId, projectIds))
                : Promise.resolve([]),
              db.select().from(clients).orderBy(desc(clients.name)),
              projectIds.length > 0
                ? db
                    .select()
                    .from(clientProjects)
                    .where(inArray(clientProjects.projectId, projectIds))
                : Promise.resolve([]),
            ]),
          );

        const billingRows = yield* Effect.promise(() =>
          Promise.all(billingRowsRaw.map((b) => enrichWithChainStatus(db, b as any, orgAccountId))),
        );

        const buildersResult = yield* Effect.promise(() =>
          plugins.builders(context).listBuilders({ limit: 100 }),
        );
        const builderByNear = new Map(
          buildersResult.data.map((b) => [b.nearAccount, b.name ?? b.nearAccount]),
        );

        const totalBudget = budgetRows.reduce((acc, b) => acc + BigInt(b.amount), 0n);
        const paidBillings = billingRows.filter((b) => b.status === "Approved");
        const totalBilled = paidBillings.reduce((acc, b) => acc + BigInt(b.amount), 0n);

        const contributorStats = new Map<
          string,
          { nearAccount: string; name: string; billed: bigint; count: number }
        >();
        for (const b of paidBillings) {
          if (!b.nearAccount) continue;
          const existing = contributorStats.get(b.nearAccount) ?? {
            nearAccount: b.nearAccount,
            name: builderByNear.get(b.nearAccount) ?? b.nearAccount,
            billed: 0n,
            count: 0,
          };
          existing.billed += BigInt(b.amount);
          existing.count += 1;
          contributorStats.set(b.nearAccount, existing);
        }

        const clientById = new Map(clientRows.map((c) => [c.id, c]));
        const projectsByClient = new Map<string, string[]>();
        for (const link of clientLinkRows) {
          const list = projectsByClient.get(link.clientId) ?? [];
          list.push(link.projectId);
          projectsByClient.set(link.clientId, list);
        }

        const clientBreakdown: Array<{
          clientName: string;
          projectTitle: string;
          projectSlug: string;
          budgetAllocated: string;
          budgetSpent: string;
        }> = [];

        const relevantClientIds = input.clientId
          ? [input.clientId]
          : [...new Set(clientLinkRows.map((l) => l.clientId))];

        for (const clientId of relevantClientIds) {
          const client = clientById.get(clientId);
          if (!client) continue;
          const pids = (projectsByClient.get(clientId) ?? []).filter((pid) =>
            projectIds.includes(pid),
          );
          for (const pid of pids) {
            const project = projectById.get(pid);
            const allocated = budgetRows
              .filter((b) => b.projectId === pid && (!input.clientId || b.clientId === clientId))
              .reduce((acc, b) => acc + BigInt(b.amount), 0n);
            const spent = paidBillings
              .filter((b) => b.projectId === pid && (!input.clientId || b.clientId === clientId))
              .reduce((acc, b) => acc + BigInt(b.amount), 0n);
            clientBreakdown.push({
              clientName: client.name,
              projectTitle: project?.title ?? pid,
              projectSlug: project?.slug ?? pid,
              budgetAllocated: allocated.toString(),
              budgetSpent: spent.toString(),
            });
          }
        }

        const period = new Date().toISOString().slice(0, 10);

        return {
          overview: {
            projectCount: projectIds.length,
            totalBudget: totalBudget.toString(),
            totalBilled: totalBilled.toString(),
            period,
          },
          contributorStats: [...contributorStats.values()].map((s) => ({
            nearAccount: s.nearAccount,
            name: s.name,
            amountBilled: s.billed.toString(),
            billingCount: s.count,
          })),
          clientBreakdown,
          notes: input.note ?? "",
          generatedAt: new Date().toISOString(),
        };
      }),
  };
}

export type ReportsService = ReturnType<typeof createReportsService>;
