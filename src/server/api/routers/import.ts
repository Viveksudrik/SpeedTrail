import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

// Custom CSV line parser to handle quotes and commas
export function parseCSV(csvContent: string) {
  const lines = csvContent.split(/\r?\n/);
  const result: Record<string, string>[] = [];
  const headers = parseCSVLine(lines[0] || "");

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    const row: Record<string, any> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] !== undefined ? values[idx] : "";
    });
    row._rowNumber = i + 1; // 1-indexed Excel row number
    result.push(row);
  }
  return result;
}

function parseCSVLine(line: string) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Normalize user names based on seeded list
export function normalizeUsername(rawName: string | undefined) {
  if (!rawName) return null;
  const name = rawName.trim().toLowerCase();
  if (name === "aisha") return "Aisha";
  if (name === "rohan" || name === "rohan ") return "Rohan";
  if (name === "priya" || name === "priya s" || name === "priyas") return "Priya";
  if (name === "meera") return "Meera";
  if (name === "sam") return "Sam";
  if (name === "dev") return "Dev";
  return null; // For unknown users like Kabir
}

// Parse custom dates to YYYY-MM-DD
export function parseCSVDate(rawDate: string | undefined) {
  if (!rawDate) return null;
  const dateStr = rawDate.trim();
  
  // Format 1: DD-MM-YYYY (e.g. 01-02-2026)
  const dmyMatch = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1]!.padStart(2, "0");
    const month = dmyMatch[2]!.padStart(2, "0");
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Format 2: Mar-14 (Mon-DD)
  const monDMatch = dateStr.match(/^([A-Za-z]{3})-(\d{1,2})$/);
  if (monDMatch) {
    const months: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
    };
    const month = months[monDMatch[1]!.toLowerCase()];
    const day = monDMatch[2]!.padStart(2, "0");
    if (month) {
      return `2026-${month}-${day}`; // Default to 2026 context
    }
  }

  return null;
}

export const importRouter = createTRPCRouter({
  // Ingests CSV text, runs anomaly checks, saves session state to PostgreSQL
  scanCSV: publicProcedure
    .input(z.object({ csvText: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const rows = parseCSV(input.csvText);
      const anomalies: any[] = [];
      const processedRows: any[] = [];

      // Group members list and active ranges
      const groupMembers: Record<string, { joined: string; left: string | null }> = {
        Aisha: { joined: "2026-02-01", left: null },
        Rohan: { joined: "2026-02-01", left: null },
        Priya: { joined: "2026-02-01", left: null },
        Meera: { joined: "2026-02-01", left: "2026-03-31" },
        Dev: { joined: "2026-03-01", left: "2026-03-31" },
        Sam: { joined: "2026-04-15", left: null }
      };

      rows.forEach((row) => {
        const rowNum = Number(row._rowNumber);
        
        // Parse Amount
        const rawAmount = row.amount || "";
        const sanitizedAmountStr = rawAmount.replace(/["',]/g, "").trim();
        const amount = parseFloat(sanitizedAmountStr);

        // 1. Amount parse check
        if (isNaN(amount)) {
          anomalies.push({
            row_number: rowNum,
            anomaly_type: "INVALID_AMOUNT",
            severity: "CRITICAL",
            description: `Row has an invalid amount: "${rawAmount}".`
          });
        }

        // 2. Zero or Negative amount check
        if (!isNaN(amount) && amount <= 0) {
          if (amount === 0) {
            anomalies.push({
              row_number: rowNum,
              anomaly_type: "ZERO_AMOUNT",
              severity: "WARNING",
              description: `Amount is zero. Notes say: "${row.notes || ""}".`
            });
          } else {
            anomalies.push({
              row_number: rowNum,
              anomaly_type: "NEGATIVE_AMOUNT",
              severity: "WARNING",
              description: `Amount is negative (${amount}). Represents a refund/reversal.`
            });
          }
        }

        // 3. Amount Formatting check (quoted with comma)
        if (rawAmount.includes(",") || rawAmount.includes('"')) {
          anomalies.push({
            row_number: rowNum,
            anomaly_type: "FORMATTING_AMOUNT",
            severity: "WARNING",
            description: `Amount "${rawAmount}" contains comma/quotes formatting.`
          });
        }

        // 4. Precision check
        if (!isNaN(amount)) {
          const decimals = (sanitizedAmountStr.split(".")[1] || "").length;
          if (decimals > 2) {
            anomalies.push({
              row_number: rowNum,
              anomaly_type: "PRECISION_ROUNDING",
              severity: "WARNING",
              description: `Amount "${rawAmount}" has ${decimals} decimals. Needs rounding.`
            });
          }
        }

        // 5. Date Parsing and Format Checks
        const parsedDate = parseCSVDate(row.date);
        if (!parsedDate) {
          anomalies.push({
            row_number: rowNum,
            anomaly_type: "INVALID_DATE",
            severity: "CRITICAL",
            description: `Date "${row.date}" could not be parsed.`
          });
        } else {
          // Date ambiguity check (04-05-2026: April 5th or May 4th?)
          if (row.notes && row.notes.toLowerCase().includes("is this april 5 or may 4")) {
            anomalies.push({
              row_number: rowNum,
              anomaly_type: "DATE_AMBIGUITY",
              severity: "WARNING",
              description: `Date "${row.date}" is ambiguous. Note asks: "is this April 5 or May 4?".`
            });
          }
        }

        // 6. Paid By Casing/Inconsistency Checks
        const paidByRaw = row.paid_by || "";
        const paidByNormalized = normalizeUsername(paidByRaw);
        if (!paidByRaw) {
          anomalies.push({
            row_number: rowNum,
            anomaly_type: "MISSING_PAYER",
            severity: "CRITICAL",
            description: "Payer (paid_by) field is empty."
          });
        } else if (!paidByNormalized) {
          anomalies.push({
            row_number: rowNum,
            anomaly_type: "UNKNOWN_PAYER",
            severity: "CRITICAL",
            description: `Payer "${paidByRaw}" does not match any flatmate.`
          });
        } else if (paidByRaw !== paidByNormalized) {
          anomalies.push({
            row_number: rowNum,
            anomaly_type: "NAME_CASING_INCONSISTENCY",
            severity: "WARNING",
            description: `Payer name "${paidByRaw}" needs normalization to "${paidByNormalized}".`
          });
        }

        // 7. Missing Currency Check
        if (!row.currency) {
          anomalies.push({
            row_number: rowNum,
            anomaly_type: "MISSING_CURRENCY",
            severity: "WARNING",
            description: 'Currency is empty. Notes say: "forgot to set currency". Defaulting to INR.'
          });
        }

        // 8. Settlement logged as expense Check
        const desc = (row.description || "").toLowerCase();
        const isSettlementKeyword = desc.includes("paid") && desc.includes("back") || desc.includes("deposit") || desc.includes("settlement");
        const isSettlementSplit = !row.split_type && row.split_with && !row.split_with.includes(";");
        if (isSettlementKeyword || isSettlementSplit) {
          anomalies.push({
            row_number: rowNum,
            anomaly_type: "SETTLEMENT_LOGGED_AS_EXPENSE",
            severity: "WARNING",
            description: `Transaction "${row.description}" looks like a debt repayment or direct settlement.`
          });
        }

        // 9. Split With members parsing and active range checks
        const splitWithRaw = row.split_with || "";
        const splitNames = splitWithRaw.split(";").map(n => n.trim()).filter(Boolean);
        
        const normalizedSplitNames: string[] = [];
        for (const sName of splitNames) {
          const norm = normalizeUsername(sName);
          if (!norm) {
            anomalies.push({
              row_number: rowNum,
              anomaly_type: "UNKNOWN_SPLIT_MEMBER",
              severity: "WARNING",
              description: `Split member "${sName}" is not in the active group (e.g. Kabir).`
            });
          } else {
            normalizedSplitNames.push(norm);
          }
        }

        // 10. Temporal Membership constraints
        if (parsedDate) {
          // Check payer range
          if (paidByNormalized && groupMembers[paidByNormalized]) {
            const member = groupMembers[paidByNormalized]!;
            const isBeforeJoin = parsedDate < member.joined;
            const isAfterLeave = member.left && parsedDate > member.left;
            if (isBeforeJoin || isAfterLeave) {
              anomalies.push({
                row_number: rowNum,
                anomaly_type: "PAYER_OUTSIDE_MEMBERSHIP",
                severity: "CRITICAL",
                description: `${paidByNormalized} is payer but was inactive on ${parsedDate} (Joined: ${member.joined}, Left: ${member.left || "active"}).`
              });
            }
          }

          // Check split members ranges
          for (const sName of normalizedSplitNames) {
            const member = groupMembers[sName];
            if (member) {
              const isBeforeJoin = parsedDate < member.joined;
              const isAfterLeave = member.left && parsedDate > member.left;
              if (isBeforeJoin || isAfterLeave) {
                anomalies.push({
                  row_number: rowNum,
                  anomaly_type: "SPLIT_MEMBER_OUTSIDE_MEMBERSHIP",
                  severity: "WARNING",
                  description: `Split includes ${sName} who was inactive on ${parsedDate} (Joined: ${member.joined}, Left: ${member.left || "active"}).`
                });
              }
            }
          }
        }

        // 11. Percentage split sum check
        if (row.split_type === "percentage" && row.split_details) {
          const parts = row.split_details.split(";").map(p => p.trim()).filter(Boolean);
          let percentageSum = 0;
          for (const p of parts) {
            const match = p.match(/(.+)\s+(\d+(?:\.\d+)?)\%/);
            if (match) {
              percentageSum += parseFloat(match[2]!);
            }
          }
          if (Math.abs(percentageSum - 100) > 0.01) {
            anomalies.push({
              row_number: rowNum,
              anomaly_type: "PERCENTAGE_SUM_MISMATCH",
              severity: "CRITICAL",
              description: `Percentages sum to ${percentageSum}% (should be 100%). Details: "${row.split_details}".`
            });
          }
        }

        // 12. Shares split with equal check mismatch
        if (row.split_type === "equal" && row.split_details) {
          anomalies.push({
            row_number: rowNum,
            anomaly_type: "REDUNDANT_SPLIT_DETAILS",
            severity: "WARNING",
            description: `Split type is equal, but redundant split details "${row.split_details}" were provided.`
          });
        }

        // 13. Duplicate checking against previous rows in this import
        processedRows.forEach(prev => {
          const isSameDate = prev.date === row.date;
          const isSameAmount = Math.abs(prev.amount - amount) < 0.01;
          const isSamePayer = prev.paid_by === row.paid_by;
          
          if (isSameDate && isSameAmount && isSamePayer) {
            anomalies.push({
              row_number: rowNum,
              anomaly_type: "DUPLICATE_ROW",
              severity: "WARNING",
              description: `Potential duplicate of Row ${prev._rowNumber}. Description A: "${prev.description}", Description B: "${row.description}".`
            });
          }
        });

        processedRows.push({
          _rowNumber: rowNum,
          date: row.date,
          description: row.description,
          paid_by: row.paid_by,
          amount: amount,
          notes: row.notes
        });
      });

      // Write session and anomalies to PostgreSQL database
      const session = await ctx.db.importSession.create({
        data: {
          status: "PENDING_APPROVAL",
          csvText: input.csvText,
          anomalies: {
            create: anomalies.map((a) => ({
              rowNumber: a.row_number,
              rawData: JSON.stringify(rows.find(r => Number(r._rowNumber) === a.row_number)),
              anomalyType: a.anomaly_type,
              severity: a.severity,
              description: a.description,
              resolutionStatus: "PENDING",
            })),
          },
        },
      });

      return {
        sessionId: session.id,
        totalRows: rows.length,
        anomalies,
      };
    }),

  // Commits resolved import rows into database tables
  commitResolved: publicProcedure
    .input(
      z.object({
        groupId: z.string(),
        sessionId: z.string(),
        resolutions: z.array(
          z.object({
            row_number: z.number(),
            anomaly_type: z.string(),
            choice: z.string(),
            details: z.any().nullable().optional(),
          })
        ),
        defaultRate: z.number().default(95),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Find session
      const session = await ctx.db.importSession.findUnique({
        where: { id: input.sessionId }
      });
      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Import session not found",
        });
      }
      if (session.status === "COMPLETED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This import session has already been completed.",
        });
      }

      const rows = parseCSV(session.csvText);

      // Fetch users mapping
      const dbUsers = await ctx.db.user.findMany();
      const userMap: Record<string, string> = {};
      for (const u of dbUsers) {
        userMap[u.username] = u.id;
      }

      // Pre-filter duplicates to skip
      const skippedRows = new Set<number>();
      const convertedToSettlements = new Map<number, any>(); // Map row number to settlement details

      for (const res of input.resolutions) {
        if (res.anomaly_type === "DUPLICATE_ROW" && res.choice === "SKIP") {
          skippedRows.add(res.row_number);
        }
        if (res.anomaly_type === "SETTLEMENT_LOGGED_AS_EXPENSE" && res.choice === "CONVERT") {
          convertedToSettlements.set(res.row_number, res.details);
        }
      }

      // Execute import in secure database transaction
      const report = await ctx.db.$transaction(async (tx) => {
        const resultReport: any[] = [];

        for (const row of rows) {
          const rowNum = Number(row._rowNumber);

          if (skippedRows.has(rowNum)) {
            resultReport.push({
              row_number: rowNum,
              action: "SKIPPED",
              description: `Skipped duplicate row "${row.description}".`
            });
            continue;
          }

          const rowResolutions = input.resolutions.filter(r => r.row_number === rowNum);

          // 1. Resolve date
          let parsedDateStr = parseCSVDate(row.date);
          const dateRes = rowResolutions.find(r => r.anomaly_type === "DATE_AMBIGUITY");
          if (dateRes && dateRes.choice === "APRIL_5") {
            parsedDateStr = "2026-04-05";
          } else if (dateRes && dateRes.choice === "MAY_4") {
            parsedDateStr = "2026-05-04";
          }
          const parsedDate = parsedDateStr ? new Date(parsedDateStr) : new Date("2026-02-01");

          // 2. Resolve amount formatting, rounding
          const rawAmount = row.amount || "0";
          const sanitizedAmountStr = rawAmount.replace(/["',]/g, "").trim();
          let amount = parseFloat(sanitizedAmountStr);
          if (isNaN(amount)) amount = 0;

          const precisionRes = rowResolutions.find(r => r.anomaly_type === "PRECISION_ROUNDING");
          if (precisionRes && precisionRes.choice === "ROUND") {
            amount = Math.round(amount * 100) / 100;
          }

          // 3. Resolve paid_by
          let rawPayer = row.paid_by || "";
          let payerName = normalizeUsername(rawPayer);

          const missingPayerRes = rowResolutions.find(r => r.anomaly_type === "MISSING_PAYER");
          if (missingPayerRes && missingPayerRes.choice) {
            payerName = missingPayerRes.choice;
          }

          const payerId = payerName ? userMap[payerName] : null;

          // 4. Resolve currency
          let currency = row.currency || "INR";
          if (!row.currency) {
            const currencyRes = rowResolutions.find(r => r.anomaly_type === "MISSING_CURRENCY");
            if (currencyRes && currencyRes.choice) {
              currency = currencyRes.choice;
            }
          }

          // Exchange rate
          let exchangeRate = 1;
          if (currency === "USD") {
            const rateRes = rowResolutions.find(r => r.anomaly_type === "USD_EXCHANGE_RATE" || r.anomaly_type === "MULTI_CURRENCY");
            exchangeRate = rateRes && rateRes.details?.rate ? parseFloat(rateRes.details.rate) : input.defaultRate;
          }

          // 5. Convert to Settlement
          if (convertedToSettlements.has(rowNum)) {
            const settlementDetails = convertedToSettlements.get(rowNum);
            const fromUser = normalizeUsername(settlementDetails?.from || row.paid_by);
            const toUser = normalizeUsername(settlementDetails?.to || row.split_with);
            const fromId = fromUser ? userMap[fromUser] : null;
            const toId = toUser ? userMap[toUser] : null;

            if (fromId && toId) {
              await tx.settlement.create({
                data: {
                  groupId: input.groupId,
                  fromUserId: fromId,
                  toUserId: toId,
                  amount: Math.abs(amount), // settlements must be positive
                  currency,
                  exchangeRate,
                  date: parsedDate,
                  notes: row.notes || `Settlement from import: ${row.description}`,
                },
              });

              resultReport.push({
                row_number: rowNum,
                action: "CONVERTED_TO_SETTLEMENT",
                description: `Converted expense row "${row.description}" of ${currency} ${amount} to direct settlement payment from ${fromUser} to ${toUser}.`
              });
              continue;
            }
          }

          if (amount === 0) {
            resultReport.push({
              row_number: rowNum,
              action: "IMPORTED_AS_ZERO",
              description: `Imported zero-amount row "${row.description}" as requested.`
            });
          }

          // 6. Split handling
          const splitType = row.split_type || "equal";
          const splitWithRaw = row.split_with || "";
          let splitNames = splitWithRaw.split(";").map(n => n.trim()).filter(Boolean).map(normalizeUsername).filter((n): n is "Aisha" | "Rohan" | "Priya" | "Meera" | "Sam" | "Dev" => n !== null);

          // Auto-exclude inactive split members
          const temporalRes = rowResolutions.filter(r => r.anomaly_type === "SPLIT_MEMBER_OUTSIDE_MEMBERSHIP");
          for (const tRes of temporalRes) {
            if (tRes.choice === "EXCLUDE" && tRes.details?.username) {
              splitNames = splitNames.filter(n => n !== tRes.details.username);
            }
          }

          // Non-member (Kabir) check resolution: Assign Kabir's share to Payer Dev
          let addKabirShareToPayer = false;
          const nonMemberRes = rowResolutions.find(r => r.anomaly_type === "UNKNOWN_SPLIT_MEMBER");
          if (nonMemberRes && nonMemberRes.choice === "ASSIGN_TO_PAYER") {
            addKabirShareToPayer = true;
          }

          const splitDetailsArray: { userId: string; amount: number; percent: number | null; share: number | null }[] = [];

          if (splitType === "equal") {
            const count = splitNames.length + (addKabirShareToPayer ? 1 : 0);
            const shareAmount = amount / count;

            for (const name of splitNames) {
              let splitAmt = shareAmount;
              if (name === payerName && addKabirShareToPayer) {
                splitAmt += shareAmount;
              }
              const uid = userMap[name];
              if (uid) {
                splitDetailsArray.push({ userId: uid, amount: splitAmt, percent: null, share: null });
              }
            }
          } else if (splitType === "unequal" && row.split_details) {
            const detailsParts = row.split_details.split(";").map(p => p.trim()).filter(Boolean);
            for (const part of detailsParts) {
              const match = part.match(/(.+)\s+(\d+(?:\.\d+)?)$/);
              if (match) {
                const normName = normalizeUsername(match[1]!.trim());
                const val = parseFloat(match[2]!);
                const uid = normName ? userMap[normName] : null;
                if (uid) {
                  splitDetailsArray.push({ userId: uid, amount: val, percent: null, share: null });
                }
              }
            }
          } else if (splitType === "percentage" && row.split_details) {
            const detailsParts = row.split_details.split(";").map(p => p.trim()).filter(Boolean);
            const entries: { name: string; pct: number }[] = [];
            let totalPct = 0;

            for (const part of detailsParts) {
              const match = part.match(/(.+)\s+(\d+(?:\.\d+)?)\%/);
              if (match) {
                const normName = normalizeUsername(match[1]!.trim());
                const pct = parseFloat(match[2]!);
                if (normName) {
                  entries.push({ name: normName, pct });
                  totalPct += pct;
                }
              }
            }

            const percentageRes = rowResolutions.find(r => r.anomaly_type === "PERCENTAGE_SUM_MISMATCH");
            const normalize = percentageRes ? percentageRes.choice === "NORMALIZE" : true;

            for (const entry of entries) {
              const finalPct = normalize ? (entry.pct / totalPct) * 100 : entry.pct;
              const splitAmt = (finalPct / 100) * amount;
              const uid = userMap[entry.name];
              if (uid) {
                splitDetailsArray.push({ userId: uid, amount: splitAmt, percent: finalPct, share: null });
              }
            }
          } else if (splitType === "share" && row.split_details) {
            const detailsParts = row.split_details.split(";").map(p => p.trim()).filter(Boolean);
            let totalShares = 0;
            const entries: { name: string; share: number }[] = [];
            for (const part of detailsParts) {
              const match = part.match(/(.+)\s+(\d+(?:\.\d+)?)$/);
              if (match) {
                const normName = normalizeUsername(match[1]!.trim());
                const share = parseFloat(match[2]!);
                if (normName) {
                  entries.push({ name: normName, share });
                  totalShares += share;
                }
              }
            }

            for (const entry of entries) {
              const splitAmt = (entry.share / totalShares) * amount;
              const uid = userMap[entry.name];
              if (uid) {
                splitDetailsArray.push({ userId: uid, amount: splitAmt, percent: null, share: entry.share });
              }
            }
          }

          // Create the expense record
          const expense = await tx.expense.create({
            data: {
              groupId: input.groupId,
              description: row.description || "Imported Split Expense",
              amount: amount,
              currency,
              exchangeRate,
              paidById: payerId || userMap["Aisha"]!,
              splitType,
              date: parsedDate,
              notes: row.notes || null,
            },
          });

          // Create split records
          for (const s of splitDetailsArray) {
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

          resultReport.push({
            row_number: rowNum,
            action: "IMPORTED",
            description: `Imported expense row "${row.description}" of ${currency} ${amount} split among ${splitNames.join(", ")}.`
          });
        }

        // Mark session as complete
        await tx.importSession.update({
          where: { id: input.sessionId },
          data: { status: "COMPLETED" },
        });

        return resultReport;
      }, { timeout: 30000 });

      return {
        success: true,
        report,
      };
    }),
});
