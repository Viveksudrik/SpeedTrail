import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const groupRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    return await ctx.db.group.findMany({
      orderBy: { createdAt: "asc" },
    });
  }),

  getMembers: publicProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const memberships = await ctx.db.groupMembership.findMany({
        where: { groupId: input.groupId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
        orderBy: { joinedAt: "asc" },
      });

      return memberships.map((m) => ({
        membership_id: m.id,
        user_id: m.user.id,
        username: m.user.username,
        joined_at: m.joinedAt.toISOString().split("T")[0]!,
        left_at: m.leftAt ? m.leftAt.toISOString().split("T")[0]! : null,
      }));
    }),

  updateMembership: publicProcedure
    .input(
      z.object({
        groupId: z.string(),
        userId: z.string(),
        joinedAt: z.string(), // YYYY-MM-DD
        leftAt: z.string().nullable(), // YYYY-MM-DD
      })
    )
    .mutation(async ({ ctx, input }) => {
      const joinedDate = new Date(input.joinedAt);
      const leftDate = input.leftAt ? new Date(input.leftAt) : null;

      // Find existing
      const existing = await ctx.db.groupMembership.findUnique({
        where: {
          groupId_userId: {
            groupId: input.groupId,
            userId: input.userId,
          },
        },
      });

      if (existing) {
        return await ctx.db.groupMembership.update({
          where: { id: existing.id },
          data: {
            joinedAt: joinedDate,
            leftAt: leftDate,
          },
        });
      } else {
        return await ctx.db.groupMembership.create({
          data: {
            groupId: input.groupId,
            userId: input.userId,
            joinedAt: joinedDate,
            leftAt: leftDate,
          },
        });
      }
    }),
});
