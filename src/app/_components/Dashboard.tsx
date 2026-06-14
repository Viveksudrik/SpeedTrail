"use client";

import React, { useState, useEffect } from "react";
import { PlusCircle, Receipt, ArrowRight, ClipboardList, DollarSign, Send, Landmark, CheckCircle2 } from "lucide-react";
import { api } from "~/trpc/react";

interface DashboardProps {
  groupId: string;
  currentUser: { id: string; username: string };
}

interface SimplifiedDebt {
  from_id: string;
  from_username: string;
  to_id: string;
  to_username: string;
  amount: number;
}

export default function Dashboard({ groupId, currentUser }: DashboardProps) {
  const { data: balanceData, refetch: refetchBalances } = api.expense.getBalances.useQuery({ groupId });
  const balances = balanceData?.balances || [];
  const simplifiedDebts = balanceData?.simplifiedDebts || [];

  const [selectedAuditUser, setSelectedAuditUser] = useState<string>(currentUser.id);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const { data: auditTrail, refetch: refetchAudit } = api.expense.getUserAuditTrail.useQuery({
    groupId,
    userId: selectedAuditUser,
    searchTerm: debouncedSearch || undefined,
  }, {
    enabled: !!selectedAuditUser,
  });

  const createExpenseMutation = api.expense.createExpense.useMutation();
  const createSettlementMutation = api.expense.createSettlement.useMutation();

  // Modals
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showSettlementModal, setShowSettlementModal] = useState(false);

  // Expense Form State
  const [expDescription, setExpDescription] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expCurrency, setExpCurrency] = useState("INR");
  const [expRate, setExpRate] = useState("1");
  const [expPayer, setExpPayer] = useState(currentUser.id);
  const [expSplitType, setExpSplitType] = useState("equal");
  const [expDate, setExpDate] = useState(new Date().toISOString().split("T")[0]!);
  const [expNotes, setExpNotes] = useState("");
  const [expSplitMembers, setExpSplitMembers] = useState<string[]>([]);
  const [unequalSplits, setUnequalSplits] = useState<Record<string, string>>({});
  const [percentageSplits, setPercentageSplits] = useState<Record<string, string>>({});
  const [shareSplits, setShareSplits] = useState<Record<string, string>>({});

  // Settlement Form State
  const [setFrom, setSetFrom] = useState("");
  const [setTo, setSetTo] = useState("");
  const [setAmount, setSetAmount] = useState("");
  const [setCurrency, setSetCurrency] = useState("INR");
  const [setRate, setSetRate] = useState("1");
  const [setDate, setSetDate] = useState(new Date().toISOString().split("T")[0]!);
  const [setNotes, setSetNotes] = useState("");

  // Status flags
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ text: "", type: "" });

  // Handle currency change in forms to auto-suggest defaults
  useEffect(() => {
    if (expCurrency === "USD") {
      setExpRate("95");
    } else {
      setExpRate("1");
    }
  }, [expCurrency]);

  useEffect(() => {
    if (setCurrency === "USD") {
      setSetRate("95");
    } else {
      setSetRate("1");
    }
  }, [setCurrency]);

  // Re-populate active split members when modal opens or date changes
  useEffect(() => {
    if (balances.length > 0) {
      setExpSplitMembers(balances.map(b => b.id));
      
      const initialSplits: Record<string, string> = {};
      balances.forEach(b => {
        initialSplits[b.id] = "";
      });
      setUnequalSplits({ ...initialSplits });
      setPercentageSplits({ ...initialSplits });
      setShareSplits(Object.keys(initialSplits).reduce((acc, id) => ({ ...acc, [id]: "1" }), {}));
    }
  }, [showExpenseModal, balanceData]);

  const showToast = (text: string, type = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast({ text: "", type: "" }), 4000);
  };

  const handleQuickSettleClick = (debt: SimplifiedDebt) => {
    setSetFrom(debt.from_id);
    setSetTo(debt.to_id);
    setSetAmount(debt.amount.toString());
    setSetCurrency("INR");
    setSetRate("1");
    setSetDate(new Date().toISOString().split("T")[0]!);
    setSetNotes(`Settle debt: ${debt.from_username} paid ${debt.to_username}`);
    setShowSettlementModal(true);
  };

  const handleExportCSV = () => {
    if (!auditTrail || auditTrail.ledger.length === 0) return;
    
    const headers = ["Date", "Description", "Details", "Original Amount", "Currency", "Exchange Rate", "Net Impact (INR)", "Running Balance (INR)"];
    const rows = auditTrail.ledger.map(item => [
      item.date,
      `"${item.description.replace(/"/g, '""')}"`,
      `"${item.details.replace(/"/g, '""')}"`,
      item.original_amount,
      item.currency,
      item.exchange_rate,
      item.impact_inr,
      item.running_balance_inr
    ]);

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${auditTrail.username}_ledger_audit.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("Exported CSV successfully!");
  };

  const handleExportJSON = () => {
    if (!auditTrail) return;
    const jsonContent = JSON.stringify(auditTrail, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${auditTrail.username}_ledger_audit.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("Exported JSON successfully!");
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const amountVal = parseFloat(expAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      showToast("Please enter a valid amount", "error");
      setLoading(false);
      return;
    }

    if (expSplitMembers.length === 0) {
      showToast("Select at least one split member", "error");
      setLoading(false);
      return;
    }

    // Prepare splits list
    const splitsPayload = [];
    const exchangeRateVal = parseFloat(expRate) || 1;

    if (expSplitType === "equal") {
      const share = amountVal / expSplitMembers.length;
      for (const uid of expSplitMembers) {
        splitsPayload.push({ userId: uid, amount: share });
      }
    } else if (expSplitType === "unequal") {
      let sum = 0;
      for (const uid of expSplitMembers) {
        const val = parseFloat(unequalSplits[uid]!) || 0;
        sum += val;
        splitsPayload.push({ userId: uid, amount: val });
      }
      if (Math.abs(sum - amountVal) > 0.05) {
        showToast(`Sum of splits (${sum}) must equal total expense amount (${amountVal})`, "error");
        setLoading(false);
        return;
      }
    } else if (expSplitType === "percentage") {
      let sumPct = 0;
      for (const uid of expSplitMembers) {
        const pct = parseFloat(percentageSplits[uid]!) || 0;
        sumPct += pct;
        const share = (pct / 100) * amountVal;
        splitsPayload.push({ userId: uid, amount: share, percent: pct });
      }
      if (Math.abs(sumPct - 100) > 0.05) {
        showToast(`Sum of percentages (${sumPct}%) must equal 100%`, "error");
        setLoading(false);
        return;
      }
    } else if (expSplitType === "share") {
      let totalShares = 0;
      const shareValues: Record<string, number> = {};
      for (const uid of expSplitMembers) {
        const shares = parseFloat(shareSplits[uid]!) || 0;
        totalShares += shares;
        shareValues[uid] = shares;
      }
      for (const uid of expSplitMembers) {
        const shareAmt = (shareValues[uid]! / totalShares) * amountVal;
        splitsPayload.push({ userId: uid, amount: shareAmt, share: shareValues[uid] });
      }
    }

    try {
      await createExpenseMutation.mutateAsync({
        groupId,
        description: expDescription,
        amount: amountVal,
        currency: expCurrency,
        exchangeRate: exchangeRateVal,
        paidById: expPayer,
        splitType: expSplitType,
        date: expDate,
        notes: expNotes || null,
        splits: splitsPayload,
      });

      showToast("Expense added successfully!");
      setShowExpenseModal(false);
      setExpDescription("");
      setExpAmount("");
      setExpNotes("");
      void refetchBalances();
      void refetchAudit();
    } catch (err: any) {
      showToast(err.message || "Failed to add expense", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSettlementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const amountVal = parseFloat(setAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      showToast("Please enter a valid amount", "error");
      setLoading(false);
      return;
    }

    if (!setFrom || !setTo || setFrom === setTo) {
      showToast("Please select two different roommates", "error");
      setLoading(false);
      return;
    }

    try {
      await createSettlementMutation.mutateAsync({
        groupId,
        fromUserId: setFrom,
        toUserId: setTo,
        amount: amountVal,
        currency: setCurrency,
        exchangeRate: parseFloat(setRate) || 1,
        date: setDate,
        notes: setNotes || null,
      });

      showToast("Settlement payment recorded successfully!");
      setShowSettlementModal(false);
      setSetAmount("");
      setSetNotes("");
      void refetchBalances();
      void refetchAudit();
    } catch (err: any) {
      showToast(err.message || "Failed to add settlement", "error");
    } finally {
      setLoading(false);
    }
  };

  const maxNet = Math.max(...balances.map(b => Math.abs(b.net_balance)), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      
      {toast.text && (
        <div 
          className={`alert alert-${toast.type} animate-fade-in`} 
          style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 1000, boxShadow: "0 8px 30px rgba(0,0,0,0.5)", width: "320px", marginBottom: 0 }}
        >
          {toast.text}
        </div>
      )}

      {/* Action Buttons Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h2 style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "-0.5px" }}>Flat Expenses & Balances</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>Overview of flatmate payments, minimized debts, and audit ledgers.</p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button className="btn btn-secondary" onClick={() => setShowSettlementModal(true)}>
            <Send size={16} />
            Record Payment
          </button>
          <button className="btn btn-primary" onClick={() => setShowExpenseModal(true)}>
            <PlusCircle size={16} />
            Log Split Expense
          </button>
        </div>
      </div>

      {/* Grid: Balances Chart & Aisha's Minimizer */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))", gap: "24px" }}>
        
        {/* Balances Ledger Chart card */}
        <div className="glass-panel animate-fade-in">
          <h3 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Landmark size={18} style={{ color: "var(--primary)" }} />
            Net Roommate Balances (INR)
          </h3>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {balances.map(b => {
              const percentOfMax = (Math.abs(b.net_balance) / maxNet) * 50;
              const isCredit = b.net_balance >= 0;

              return (
                <div key={b.id} style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <span style={{ width: "80px", fontWeight: 500, fontSize: "14px", textOverflow: "ellipsis", overflow: "hidden" }}>{b.username}</span>
                  
                  <div style={{ flex: 1, height: "32px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "8px", position: "relative", display: "flex", alignItems: "center", overflow: "hidden", border: "1px solid rgba(255, 255, 255, 0.03)" }}>
                    <div style={{ position: "absolute", left: "50%", width: "1px", height: "100%", background: "rgba(255,255,255,0.15)", zIndex: 2 }}></div>
                    
                    <div style={{
                      position: "absolute",
                      left: isCredit ? "50%" : `calc(50% - ${percentOfMax}%)`,
                      width: `${percentOfMax}%`,
                      height: "100%",
                      background: isCredit 
                        ? "linear-gradient(90deg, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.6) 100%)" 
                        : "linear-gradient(90deg, rgba(239, 68, 68, 0.6) 0%, rgba(239, 68, 68, 0.2) 100%)",
                      borderRadius: isCredit ? "0 6px 6px 0" : "6px 0 0 6px",
                      transition: "all 0.5s cubic-bezier(0.16, 1, 0.3, 1)"
                    }}></div>

                    <span style={{
                      position: "absolute",
                      left: isCredit ? "calc(50% + 12px)" : "auto",
                      right: !isCredit ? "calc(50% + 12px)" : "auto",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: isCredit ? "#6ee7b7" : "#fca5a5",
                      zIndex: 3
                    }}>
                      {isCredit ? "+" : ""}₹{b.net_balance.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Aisha's Simplified Debts card */}
        <div className="glass-panel animate-fade-in" style={{ borderLeft: "3px solid var(--accent)" }}>
          <h3 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Receipt size={18} style={{ color: "var(--accent)" }} />
            Aisha's Simplified Settlements
          </h3>

          {simplifiedDebts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
              <div style={{ display: "inline-flex", padding: "10px", background: "rgba(16,185,129,0.1)", borderRadius: "50%", color: "var(--success)", marginBottom: "12px" }}>
                <CheckCircle2 size={24} />
              </div>
              <p style={{ fontSize: "14px" }}>All settled up! No payments are currently owed.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "8px" }}>
                Aisha's balance minimizer computed that these {simplifiedDebts.length} cash payments will resolve all flat balances:
              </p>

              {simplifiedDebts.map((debt, idx) => (
                <div key={idx} className="glass-panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", background: "rgba(0,0,0,0.18)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontWeight: 600, color: "#fca5a5" }}>{debt.from_username}</span>
                    <span style={{ color: "var(--text-muted)", fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}>
                      owes <ArrowRight size={14} />
                    </span>
                    <span style={{ fontWeight: 600, color: "#6ee7b7" }}>{debt.to_username}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <strong style={{ fontSize: "16px", color: "var(--text-bright)" }}>₹{debt.amount.toLocaleString("en-IN")}</strong>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: "4px 10px", fontSize: "11px" }}
                      onClick={() => handleQuickSettleClick(debt)}
                    >
                      Record Pay
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Rohan's "No Magic Numbers" Audit Ledger card */}
      <div className="glass-panel animate-fade-in">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "24px" }}>
          <div>
            <h3 style={{ fontSize: "18px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
              <ClipboardList size={18} style={{ color: "var(--primary)" }} />
              Rohan's Expense Ledger Audit
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>
              Verify exact ledger details making up roommate balances.
            </p>
          </div>
 
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            {/* Search Input */}
            <input 
              type="text" 
              placeholder="Search description..." 
              className="input-field" 
              style={{ width: "180px", padding: "6px 12px", fontSize: "13px" }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            {/* Roommate Select */}
            <select 
              className="input-field" 
              style={{ width: "130px", padding: "6px 12px", fontSize: "13px" }}
              value={selectedAuditUser}
              onChange={(e) => setSelectedAuditUser(e.target.value)}
            >
              {balances.map(b => (
                <option key={b.id} value={b.id}>{b.username}</option>
              ))}
            </select>

            {/* Export Actions */}
            <button className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={handleExportCSV} disabled={!auditTrail || auditTrail.ledger.length === 0}>
              Export CSV
            </button>
            <button className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={handleExportJSON} disabled={!auditTrail}>
              Export JSON
            </button>
          </div>
        </div>

        {auditTrail && auditTrail.ledger.length === 0 ? (
          <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "30px 0", fontSize: "14px" }}>No transactions recorded for this roommate.</p>
        ) : (
          auditTrail && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: "800px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <th style={{ padding: "10px 16px", color: "var(--text-muted)", fontSize: "12px", fontWeight: 500, width: "110px" }}>Date</th>
                    <th style={{ padding: "10px 16px", color: "var(--text-muted)", fontSize: "12px", fontWeight: 500 }}>Transaction & Details</th>
                    <th style={{ padding: "10px 16px", color: "var(--text-muted)", fontSize: "12px", fontWeight: 500, textAlign: "right" }}>Original Amount</th>
                    <th style={{ padding: "10px 16px", color: "var(--text-muted)", fontSize: "12px", fontWeight: 500, textAlign: "right" }}>Rate</th>
                    <th style={{ padding: "10px 16px", color: "var(--text-muted)", fontSize: "12px", fontWeight: 500, textAlign: "right" }}>Net Impact (INR)</th>
                    <th style={{ padding: "10px 16px", color: "var(--text-muted)", fontSize: "12px", fontWeight: 500, textAlign: "right" }}>Running Balance (INR)</th>
                  </tr>
                </thead>
                <tbody>
                  {auditTrail.ledger.map((item, idx) => {
                    const isNegImpact = item.impact_inr < 0;
                    return (
                      <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }} className="table-row-hover">
                        <td style={{ padding: "14px 16px", fontSize: "13px" }}>
                          {new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td style={{ padding: "14px 16px", fontSize: "13px" }}>
                          <div style={{ fontWeight: 500, color: "var(--text-bright)" }}>{item.description}</div>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px", display: "block" }}>{item.details}</span>
                        </td>
                        <td style={{ padding: "14px 16px", textTransform: "uppercase", fontSize: "13px", textAlign: "right" }}>
                          {item.currency === "USD" ? "$" : "₹"}{item.original_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: "14px 16px", fontSize: "13px", color: "var(--text-muted)", textAlign: "right" }}>
                          {item.currency === "USD" ? `₹${item.exchange_rate}` : "1.0"}
                        </td>
                        <td style={{ padding: "14px 16px", fontSize: "13px", fontWeight: 600, color: isNegImpact ? "#fca5a5" : "#6ee7b7", textAlign: "right" }}>
                          {isNegImpact ? "-" : "+"}₹{Math.abs(item.impact_inr).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: "14px 16px", fontSize: "13px", fontWeight: 600, color: item.running_balance_inr < 0 ? "#fca5a5" : "#6ee7b7", textAlign: "right" }}>
                          {item.running_balance_inr < 0 ? "-" : ""}₹{Math.abs(item.running_balance_inr).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* 1. Log Expense Modal */}
      {showExpenseModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "20px" }}>
          <div className="glass-panel animate-fade-in" style={{ width: "100%", maxWidth: "600px", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "20px", color: "var(--text-bright)" }}>Log Split Expense</h3>
            
            <form onSubmit={handleExpenseSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px", marginBottom: "16px" }}>
                <div>
                  <label className="input-label">Description / Bill Name</label>
                  <input type="text" required placeholder="e.g. Electricity bill, Pizza dinner" className="input-field" value={expDescription} onChange={e => setExpDescription(e.target.value)} />
                </div>
                <div>
                  <label className="input-label">Date</label>
                  <input type="date" required className="input-field" value={expDate} onChange={e => setExpDate(e.target.value)} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                <div>
                  <label className="input-label">Bill Amount</label>
                  <input type="number" required step="any" placeholder="0.00" className="input-field" value={expAmount} onChange={e => setExpAmount(e.target.value)} />
                </div>
                <div>
                  <label className="input-label">Currency</label>
                  <select className="input-field" value={expCurrency} onChange={e => setExpCurrency(e.target.value)}>
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Exchange Rate</label>
                  <input type="number" required step="any" className="input-field" value={expRate} onChange={e => setExpRate(e.target.value)} disabled={expCurrency === "INR"} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
                <div>
                  <label className="input-label">Paid By</label>
                  <select className="input-field" value={expPayer} onChange={e => setExpPayer(e.target.value)}>
                    {balances.map(b => (
                      <option key={b.id} value={b.id}>{b.username}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="input-label">Split Type</label>
                  <select className="input-field" value={expSplitType} onChange={e => setExpSplitType(e.target.value)}>
                    <option value="equal">Split Equally</option>
                    <option value="unequal">Split Unequally (Amounts)</option>
                    <option value="percentage">Split by Percentage</option>
                    <option value="share">Split by Share counts</option>
                  </select>
                </div>
              </div>

              {/* Split Members Selection Checklist */}
              <div className="glass-panel" style={{ background: "rgba(0,0,0,0.25)", padding: "16px", marginBottom: "24px" }}>
                <label className="input-label" style={{ marginBottom: "12px" }}>Split With (Select Roommates)</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {balances.map(b => {
                    const isChecked = expSplitMembers.includes(b.id);
                    return (
                      <div key={b.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", cursor: "pointer" }}>
                          <input 
                            type="checkbox" 
                            checked={isChecked} 
                            onChange={(e) => {
                              if (e.target.checked) {
                                setExpSplitMembers(prev => [...prev, b.id]);
                              } else {
                                setExpSplitMembers(prev => prev.filter(id => id !== b.id));
                              }
                            }} 
                            style={{ width: "16px", height: "16px", accentColor: "var(--primary)" }}
                          />
                          {b.username}
                        </label>

                        {/* Split values based on SplitType */}
                        {isChecked && (
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {expSplitType === "unequal" && (
                              <>
                                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Amount:</span>
                                <input 
                                  type="number" 
                                  placeholder="INR" 
                                  className="input-field" 
                                  style={{ width: "90px", padding: "4px 8px", fontSize: "13px" }}
                                  value={unequalSplits[b.id] || ""}
                                  onChange={(e) => setUnequalSplits(prev => ({ ...prev, [b.id]: e.target.value }))}
                                />
                              </>
                            )}
                            {expSplitType === "percentage" && (
                              <>
                                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Percent:</span>
                                <input 
                                  type="number" 
                                  placeholder="%" 
                                  className="input-field" 
                                  style={{ width: "80px", padding: "4px 8px", fontSize: "13px" }}
                                  value={percentageSplits[b.id] || ""}
                                  onChange={(e) => setPercentageSplits(prev => ({ ...prev, [b.id]: e.target.value }))}
                                />
                                <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>%</span>
                              </>
                            )}
                            {expSplitType === "share" && (
                              <>
                                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Shares:</span>
                                <input 
                                  type="number" 
                                  className="input-field" 
                                  style={{ width: "80px", padding: "4px 8px", fontSize: "13px" }}
                                  value={shareSplits[b.id] || "1"}
                                  onChange={(e) => setShareSplits(prev => ({ ...prev, [b.id]: e.target.value }))}
                                />
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label className="input-label">Notes (Optional)</label>
                <input type="text" placeholder="Add extra detail..." className="input-field" value={expNotes} onChange={e => setExpNotes(e.target.value)} />
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowExpenseModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={loading}>
                  {loading ? "Recording..." : "Record Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Record Settlement Modal */}
      {showSettlementModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "20px" }}>
          <div className="glass-panel animate-fade-in" style={{ width: "100%", maxWidth: "500px" }}>
            <h3 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "20px", color: "var(--text-bright)" }}>Record Payment / Settlement</h3>
            
            <form onSubmit={handleSettlementSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                <div>
                  <label className="input-label">From (Payer)</label>
                  <select className="input-field" value={setFrom} onChange={e => setSetFrom(e.target.value)}>
                    <option value="">Select Roommate</option>
                    {balances.map(b => (
                      <option key={b.id} value={b.id}>{b.username}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="input-label">To (Receiver)</label>
                  <select className="input-field" value={setTo} onChange={e => setSetTo(e.target.value)}>
                    <option value="">Select Roommate</option>
                    {balances.map(b => (
                      <option key={b.id} value={b.id}>{b.username}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1.2fr", gap: "12px", marginBottom: "16px" }}>
                <div>
                  <label className="input-label">Amount Paid</label>
                  <input type="number" required step="any" placeholder="0.00" className="input-field" value={setAmount} onChange={e => setSetAmount(e.target.value)} />
                </div>
                <div>
                  <label className="input-label">Currency</label>
                  <select className="input-field" value={setCurrency} onChange={e => setSetCurrency(e.target.value)}>
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Ex. Rate</label>
                  <input type="number" required step="any" className="input-field" value={setRate} onChange={e => setSetRate(e.target.value)} disabled={setCurrency === "INR"} />
                </div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label className="input-label">Payment Date</label>
                <input type="date" required className="input-field" value={setDate} onChange={e => setSetDate(e.target.value)} />
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label className="input-label">Notes (Optional)</label>
                <input type="text" placeholder="e.g. UPI, cash transfer" className="input-field" value={setNotes} onChange={e => setSetNotes(e.target.value)} />
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowSettlementModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={loading}>
                  {loading ? "Recording..." : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
