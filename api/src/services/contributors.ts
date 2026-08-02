import { Effect } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import type { PluginsClient } from "../lib/plugins-types.gen";

export type BuilderProfile = {
  nearAccount: string;
  name: string | null;
  bio: string | null;
  skills: string[];
  location: string | null;
  links: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
};

function toProfile(data: {
  nearAccount: string;
  name: string | null;
  bio: string | null;
  skills: string[];
  location: string | null;
  links: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
}): BuilderProfile {
  return {
    nearAccount: data.nearAccount,
    name: data.name,
    bio: data.bio,
    skills: data.skills,
    location: data.location,
    links: data.links,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export function createContributorsService(plugins: PluginsClient) {
  return {
    list: (context: Record<string, unknown>) =>
      Effect.gen(function* () {
        const result = yield* Effect.promise(() =>
          plugins.contributors(context).listBuilders({ limit: 100 }),
        );
        return { data: result.data.map(toProfile) };
      }),

    get: (context: Record<string, unknown>, nearAccount: string) =>
      Effect.gen(function* () {
        try {
          const result = yield* Effect.promise(() =>
            plugins.contributors(context).getBuilder({ nearAccount }),
          );
          return { contributor: toProfile(result.data) };
        } catch {
          return yield* Effect.fail(
            new ORPCError("NOT_FOUND", { message: "Contributor not found" }),
          );
        }
      }),

    create: (
      context: Record<string, unknown>,
      input: {
        nearAccount: string;
        name?: string;
        bio?: string;
        skills?: string[];
        location?: string;
        links?: Record<string, string>;
      },
    ) =>
      Effect.gen(function* () {
        if (!input.nearAccount?.trim()) {
          return yield* Effect.fail(
            new ORPCError("BAD_REQUEST", { message: "nearAccount is required" }),
          );
        }
        const result = yield* Effect.promise(() =>
          plugins.contributors(context).createBuilder({
            nearAccount: input.nearAccount.trim(),
            name: input.name,
            bio: input.bio,
            skills: input.skills,
            location: input.location,
            links: input.links,
          }),
        );
        return { contributor: toProfile(result.data) };
      }),

    update: (
      context: Record<string, unknown>,
      input: {
        nearAccount: string;
        name?: string;
        bio?: string;
        skills?: string[];
        location?: string;
        links?: Record<string, string>;
      },
    ) =>
      Effect.gen(function* () {
        try {
          const result = yield* Effect.promise(() =>
            plugins.contributors(context).updateBuilderProfile({
              nearAccount: input.nearAccount,
              name: input.name,
              bio: input.bio,
              skills: input.skills,
              location: input.location,
              links: input.links,
            }),
          );
          return { contributor: toProfile(result.data) };
        } catch {
          return yield* Effect.fail(
            new ORPCError("NOT_FOUND", { message: "Contributor not found" }),
          );
        }
      }),
  };
}

export type ContributorsService = ReturnType<typeof createContributorsService>;
