import { desc, eq, inArray } from "drizzle-orm";
import { Effect } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import type { Database } from "../db";
import { clientProjects, clients } from "../db/schema";

export function createClientsService(db: Database) {
  return {
    list: () =>
      Effect.gen(function* () {
        const rows = yield* Effect.promise(() =>
          db.select().from(clients).orderBy(desc(clients.updatedAt)),
        );
        return { data: rows };
      }),

    get: (id: string) =>
      Effect.gen(function* () {
        const rows = yield* Effect.promise(() =>
          db.select().from(clients).where(eq(clients.id, id)).limit(1),
        );
        const row = rows[0];
        if (!row) {
          return yield* Effect.fail(new ORPCError("NOT_FOUND", { message: "Client not found" }));
        }
        const projectRows = yield* Effect.promise(() =>
          db.select().from(clientProjects).where(eq(clientProjects.clientId, id)),
        );
        return { client: row, projectIds: projectRows.map((p) => p.projectId) };
      }),

    lookupByNearAccount: (nearAccountId: string) =>
      Effect.gen(function* () {
        const rows = yield* Effect.promise(() =>
          db.select().from(clients).where(eq(clients.nearAccountId, nearAccountId)).limit(1),
        );
        const row = rows[0];
        if (!row) return null;
        const projectRows = yield* Effect.promise(() =>
          db.select().from(clientProjects).where(eq(clientProjects.clientId, row.id)),
        );
        return { client: row, projectIds: projectRows.map((p) => p.projectId) };
      }),

    create: (
      _context: Record<string, unknown>,
      input: { orgId: string; name: string; nearAccountId?: string; projectIds?: string[] },
    ) =>
      Effect.gen(function* () {
        const id = crypto.randomUUID();
        const now = new Date();

        const [row] = yield* Effect.promise(() =>
          db
            .insert(clients)
            .values({
              id,
              orgId: input.orgId,
              name: input.name.trim(),
              nearAccountId: input.nearAccountId?.trim() || null,
              createdAt: now,
              updatedAt: now,
            })
            .returning(),
        );
        if (!row) {
          return yield* Effect.fail(
            new ORPCError("INTERNAL_SERVER_ERROR", { message: "Insert failed" }),
          );
        }

        if (input.projectIds?.length) {
          yield* Effect.promise(() =>
            db.insert(clientProjects).values(
              input.projectIds!.map((projectId) => ({
                clientId: id,
                projectId,
                createdAt: now,
              })),
            ),
          );
        }

        return { client: row, projectIds: input.projectIds ?? [] };
      }),

    update: (input: {
      id: string;
      name?: string;
      nearAccountId?: string | null;
      projectIds?: string[];
    }) =>
      Effect.gen(function* () {
        const existing = yield* Effect.promise(() =>
          db.select().from(clients).where(eq(clients.id, input.id)).limit(1),
        );
        if (!existing[0]) {
          return yield* Effect.fail(new ORPCError("NOT_FOUND", { message: "Client not found" }));
        }

        const updates: Record<string, unknown> = { updatedAt: new Date() };
        if (input.name !== undefined) updates.name = input.name.trim();
        if (input.nearAccountId !== undefined) updates.nearAccountId = input.nearAccountId;

        const [row] = yield* Effect.promise(() =>
          db.update(clients).set(updates).where(eq(clients.id, input.id)).returning(),
        );

        if (input.projectIds !== undefined) {
          yield* Effect.promise(() =>
            db.delete(clientProjects).where(eq(clientProjects.clientId, input.id)),
          );
          if (input.projectIds.length > 0) {
            const now = new Date();
            yield* Effect.promise(() =>
              db.insert(clientProjects).values(
                input.projectIds!.map((projectId) => ({
                  clientId: input.id,
                  projectId,
                  createdAt: now,
                })),
              ),
            );
          }
        }

        const projectRows = yield* Effect.promise(() =>
          db.select().from(clientProjects).where(eq(clientProjects.clientId, input.id)),
        );

        return { client: row!, projectIds: projectRows.map((p) => p.projectId) };
      }),

    delete: (id: string) =>
      Effect.gen(function* () {
        const existing = yield* Effect.promise(() =>
          db.select().from(clients).where(eq(clients.id, id)).limit(1),
        );
        if (!existing[0]) {
          return yield* Effect.fail(new ORPCError("NOT_FOUND", { message: "Client not found" }));
        }
        yield* Effect.promise(() => db.delete(clients).where(eq(clients.id, id)));
        return { deleted: true as const };
      }),

    getProjectIdsForClient: (clientId: string) =>
      Effect.promise(() =>
        db
          .select({ projectId: clientProjects.projectId })
          .from(clientProjects)
          .where(eq(clientProjects.clientId, clientId))
          .then((rows) => rows.map((r) => r.projectId)),
      ),

    getClientsForProjects: (projectIds: string[]) =>
      Effect.promise(async () => {
        if (projectIds.length === 0) return new Map<string, string>();
        const rows = await db
          .select({
            projectId: clientProjects.projectId,
            clientId: clientProjects.clientId,
            clientName: clients.name,
          })
          .from(clientProjects)
          .innerJoin(clients, eq(clientProjects.clientId, clients.id))
          .where(inArray(clientProjects.projectId, projectIds));
        return new Map(rows.map((r) => [r.projectId, r.clientName]));
      }),
  };
}

export type ClientsService = ReturnType<typeof createClientsService>;
