import { z } from "zod";
import crypto from "crypto";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

export function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export const authRouter = createTRPCRouter({
  login: publicProcedure
    .input(
      z.object({
        username: z.string(),
        password: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const hashedPassword = hashPassword(input.password);
      
      const user = await ctx.db.user.findFirst({
        where: {
          username: input.username,
          passwordHash: hashedPassword,
        },
        select: {
          id: true,
          username: true,
        },
      });

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid username or password",
        });
      }

      return user;
    }),
});
