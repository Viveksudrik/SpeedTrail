import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

export interface Balance {
  id: string;
  username: string;
  total_paid: number;
  total_split_owed: number;
  settlements_sent: number;
  settlements_received: number;
  net_balance: number;
}

export interface SimplifiedDebt {
  from_id: string;
  from_username: string;
  to_id: string;
  to_username: string;
  amount: number;
}

export const expenseRouter = createTRPCRouter({
  // Gets balances and debt minimization
  getBalances: publicProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const users = await ctx.db.user.findMany({
        orderBy: { username: "asc" },
      });

      const balances: Record<string, Balance> = {};
      for (const u of users) {
        balances[u.id] = {
          id: u.id,
          username: u.username,
          total_paid: 0,
          total_split_owed: 0,
          settlements_sent: 0,
          settlements_received: 0,
          net_balance: 0,
        };
      }

      // 1. Paid expenses (original currency * exchange rate)
      const expenses = await ctx.db.expense.findMany({
        where: { groupId: input.groupId },
        select: {
          paidById: true,
          amount: true,
          exchangeRate: true,
        },
      });

      for (const exp of expenses) {
        const amountINR = Number(exp.amount) * exp.exchangeRate;
        const b = balances[exp.paidById];
        if (b) {
          b.total_paid += amountINR;
        }
      }

      // 2. Split shares
      const splits = await ctx.db.split.findMany({
        where: {
          expense: {
            groupId: input.groupId,
          },
        },
        select: {
          userId: true,
          amount: true,
          expense: {
            select: {
              exchangeRate: true,
            },
          },
        },
      });

      for (const s of splits) {
        const amountINR = Number(s.amount) * s.expense.exchangeRate;
        const b = balances[s.userId];
        if (b) {
          b.total_split_owed += amountINR;
        }
      }

      // 3. Settlements
      const settlements = await ctx.db.settlement.findMany({
        where: { groupId: input.groupId },
        select: {
          fromUserId: true,
          toUserId: true,
          amount: true,
          exchangeRate: true,
        },
      });

      for (const set of settlements) {
        const amountINR = Number(set.amount) * set.exchangeRate;
        const fromBal = balances[set.fromUserId];
        const toBal = balances[set.toUserId];
        if (fromBal) {
          fromBal.settlements_sent += amountINR;
        }
        if (toBal) {
          toBal.settlements_received += amountINR;
        }
      }

      // 4. Calculate Net Balance
      for (const uid in balances) {
        const b = balances[uid]!;
        b.net_balance = b.total_paid - b.total_split_owed + b.settlements_sent - b.settlements_received;

        // Round everything to 2 decimals
        b.total_paid = Math.round(b.total_paid * 100) / 100;
        b.total_split_owed = Math.round(b.total_split_owed * 100) / 100;
        b.settlements_sent = Math.round(b.settlements_sent * 100) / 100;
        b.settlements_received = Math.round(b.settlements_received * 100) / 100;
        b.net_balance = Math.round(b.net_balance * 100) / 100;
      }

      // Aisha's Debt Simplification
      const participants = Object.values(balances).map(b => ({
        id: b.id,
        username: b.username,
        net: b.net_balance
      })).filter(p => Math.abs(p.net) > 0.01);

      const debtors = participants.filter(p => p.net < 0).sort((a, b) => {
        const diff = a.net - b.net;
        if (Math.abs(diff) < 0.001) {
          return a.username.localeCompare(b.username);
        }
        return diff;
      }); // Ascending (most negative first)
      const creditors = participants.filter(p => p.net > 0).sort((a, b) => {
        const diff = b.net - a.net;
        if (Math.abs(diff) < 0.001) {
          return a.username.localeCompare(b.username);
        }
        return diff;
      }); // Descending (most positive first)

      const simplifiedDebts: SimplifiedDebt[] = [];
      let debtorIndex = 0;
      let creditorIndex = 0;

      while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
        const debtor = debtors[debtorIndex]!;
        const creditor = creditors[creditorIndex]!;

        const debtAmount = Math.abs(debtor.net);
        const creditAmount = creditor.net;
        const settledAmount = Math.min(debtAmount, creditAmount);

        simplifiedDebts.push({
          from_id: debtor.id,
          from_username: debtor.username,
          to_id: creditor.id,
          to_username: creditor.username,
          amount: Math.round(settledAmount * 100) / 100,
        });

        debtor.net += settledAmount;
        creditor.net -= settledAmount;

        if (Math.abs(debtor.net) < 0.01) debtorIndex++;
        if (Math.abs(creditor.net) < 0.01) creditorIndex++;
      }

      return {
        balances: Object.values(balances),
        simplifiedDebts,
      };
    }),

  // Rohan's Request: detailed individual running balance audit ledger
  getUserAuditTrail: publicProcedure
    .input(
      z.object({
        groupId: z.string(),
        userId: z.string(),
        searchTerm: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: input.userId },
        select: { username: true },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Roommate not found",
        });
      }

      const ledger: any[] = [];

      // 1. Paid expenses
      const paidExpenses = await ctx.db.expense.findMany({
        where: {
          groupId: input.groupId,
          paidById: input.userId,
        },
        include: {
          splits: {
            where: { userId: input.userId },
            select: { amount: true },
          },
        },
      });

      for (const exp of paidExpenses) {
        const amountINR = Number(exp.amount) * exp.exchangeRate;
        const mySplitShare = exp.splits[0] ? Number(exp.splits[0].amount) : 0;
        const myShareINR = mySplitShare * exp.exchangeRate;
        
        ledger.push({
          id: exp.id,
          type: "expense_paid",
          date: exp.date.toISOString().split("T")[0]!,
          description: exp.description,
          original_amount: Number(exp.amount),
          currency: exp.currency,
          exchange_rate: exp.exchangeRate,
          amount_inr: amountINR,
          my_share_inr: myShareINR,
          impact_inr: amountINR - myShareINR, // Positive impact since they paid but only owe their share
          details: `You paid ${exp.currency === "USD" ? "$" : "₹"}${Number(exp.amount).toFixed(2)}. Your share is ₹${myShareINR.toFixed(2)}. Net credited: +₹${(amountINR - myShareINR).toFixed(2)}`,
        });
      }

      // 2. Splits paid by others
      const splitExpenses = await ctx.db.split.findMany({
        where: {
          userId: input.userId,
          expense: {
            groupId: input.groupId,
            paidById: { not: input.userId },
          },
        },
        include: {
          expense: {
            include: {
              paidBy: { select: { username: true } },
            },
          },
        },
      });

      for (const s of splitExpenses) {
        const myShareINR = Number(s.amount) * s.expense.exchangeRate;
        ledger.push({
          id: s.expense.id,
          type: "expense_split",
          date: s.expense.date.toISOString().split("T")[0]!,
          description: s.expense.description,
          original_amount: Number(s.expense.amount),
          currency: s.expense.currency,
          exchange_rate: s.expense.exchangeRate,
          amount_inr: Number(s.expense.amount) * s.expense.exchangeRate,
          my_share_inr: myShareINR,
          impact_inr: -myShareINR, // Negative impact since they owe their split
          details: `Paid by ${s.expense.paidBy.username}. Your share of ${s.expense.currency === "USD" ? "$" : "₹"}${Number(s.expense.amount).toFixed(2)} is ₹${myShareINR.toFixed(2)}. Net owed: -₹${myShareINR.toFixed(2)}`,
        });
      }

      // 3. Sent settlements
      const sentSettlements = await ctx.db.settlement.findMany({
        where: {
          groupId: input.groupId,
          fromUserId: input.userId,
        },
        include: {
          toUser: { select: { username: true } },
        },
      });

      for (const s of sentSettlements) {
        const amountINR = Number(s.amount) * s.exchangeRate;
        ledger.push({
          id: s.id,
          type: "settlement_sent",
          date: s.date.toISOString().split("T")[0]!,
          description: s.notes ?? `Settled debt to ${s.toUser.username}`,
          original_amount: Number(s.amount),
          currency: s.currency,
          exchange_rate: s.exchangeRate,
          amount_inr: amountINR,
          my_share_inr: 0,
          impact_inr: amountINR, // Positive impact: reduced their debt
          details: `You paid ${s.toUser.username} ${s.currency === "USD" ? "$" : "₹"}${Number(s.amount).toFixed(2)}. Debt reduced: +₹${amountINR.toFixed(2)}`,
        });
      }

      // 4. Received settlements
      const receivedSettlements = await ctx.db.settlement.findMany({
        where: {
          groupId: input.groupId,
          toUserId: input.userId,
        },
        include: {
          fromUser: { select: { username: true } },
        },
      });

      for (const s of receivedSettlements) {
        const amountINR = Number(s.amount) * s.exchangeRate;
        ledger.push({
          id: s.id,
          type: "settlement_received",
          date: s.date.toISOString().split("T")[0]!,
          description: s.notes ?? `Received payment from ${s.fromUser.username}`,
          original_amount: Number(s.amount),
          currency: s.currency,
          exchange_rate: s.exchangeRate,
          amount_inr: amountINR,
          my_share_inr: 0,
          impact_inr: -amountINR, // Negative impact: reduces what they are credited
          details: `Received ${s.currency === "USD" ? "$" : "₹"}${Number(s.amount).toFixed(2)} from ${s.fromUser.username}. Credit reduced: -₹${amountINR.toFixed(2)}`,
        });
      }

      // Chronological sort
      ledger.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Compute running balance
      let runningBalance = 0;
      const ledgerWithRunningBalance = ledger.map(item => {
        runningBalance += item.impact_inr;
        return {
          ...item,
          running_balance_inr: Math.round(runningBalance * 100) / 100,
        };
      });

      let filteredLedger = ledgerWithRunningBalance;
      if (input.searchTerm) {
        const term = input.searchTerm.toLowerCase().trim();
        filteredLedger = ledgerWithRunningBalance.filter(item => 
          item.description.toLowerCase().includes(term) ||
          item.details.toLowerCase().includes(term)
        );
      }

      return {
        username: user.username,
        ledger: filteredLedger,
        final_balance_inr: Math.round(runningBalance * 100) / 100,
      };
    }),

  // Creates manual split expense
  createExpense: publicProcedure
    .input(
      z.object({
        groupId: z.string(),
        description: z.string(),
        amount: z.number(),
        currency: z.string(),
        exchangeRate: z.number(),
        paidById: z.string(),
        splitType: z.string(),
        date: z.string(), // YYYY-MM-DD
        notes: z.string().nullable(),
        splits: z.array(
          z.object({
            userId: z.string(),
            amount: z.number(),
            percent: z.number().nullable().optional(),
            share: z.number().nullable().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.$transaction(async (tx) => {
        const expense = await tx.expense.create({
          data: {
            groupId: input.groupId,
            description: input.description,
            amount: input.amount,
            currency: input.currency,
            exchangeRate: input.exchangeRate,
            paidById: input.paidById,
            splitType: input.splitType,
            date: new Date(input.date),
            notes: input.notes,
          },
        });

        for (const s of input.splits) {
          await tx.split.create({
            data: {
              expenseId: expense.id,
              userId: s.userId,
              amount: s.amount,
              percent: s.percent,
              share: s.share,
            },
          });
        }

        return { success: true };
      });
    }),

  // Record manual payment/settlement
  createSettlement: publicProcedure
    .input(
      z.object({
        groupId: z.string(),
        fromUserId: z.string(),
        toUserId: z.string(),
        amount: z.number(),
        currency: z.string(),
        exchangeRate: z.number(),
        date: z.string(), // YYYY-MM-DD
        notes: z.string().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.settlement.create({
        data: {
          groupId: input.groupId,
          fromUserId: input.fromUserId,
          toUserId: input.toUserId,
          amount: input.amount,
          currency: input.currency,
          exchangeRate: input.exchangeRate,
          date: new Date(input.date),
          notes: input.notes,
        },
      });
    }),
});
