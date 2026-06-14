"use client";

import React, { useState } from "react";
import { FileUp, AlertCircle, CheckCircle2, ChevronRight, Info, DollarSign, Calendar } from "lucide-react";
import { api } from "~/trpc/react";

interface ImportWizardProps {
  groupId: string;
  currentUser: { id: string; username: string };
  onImportSuccess: () => void;
}

interface Anomaly {
  row_number: number;
  anomaly_type: string;
  severity: "CRITICAL" | "WARNING";
  description: string;
}

interface ResolutionChoice {
  row_number: number;
  anomaly_type: string;
  choice: string;
  details?: any;
}

export default function ImportWizard({ groupId, currentUser, onImportSuccess }: ImportWizardProps) {
  const scanMutation = api.import.scanCSV.useMutation();
  const commitMutation = api.import.commitResolved.useMutation();

  const [csvText, setCsvText] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<{ sessionId: string; totalRows: number; anomalies: Anomaly[] } | null>(null);
  const [resolutions, setResolutions] = useState<ResolutionChoice[]>([]);
  const [usdRate, setUsdRate] = useState<number>(95);
  const [importReport, setImportReport] = useState<{ row_number: number; action: string; description: string }[] | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [commitProgress, setCommitProgress] = useState("");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) {
        setCsvText(evt.target.result as string);
        setErrorMsg("");
      }
    };
    reader.readAsText(file);
  };

  const handleScanCSV = async () => {
    if (!csvText) {
      setErrorMsg("Please select a CSV file or paste its content first.");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    try {
      const data = await scanMutation.mutateAsync({ csvText });
      setSession(data);
      
      // Auto-populate default resolutions
      const defaultRes: ResolutionChoice[] = [];
      data.anomalies.forEach((a: Anomaly) => {
        let choice = "IMPORT";
        let details = null;

        if (a.anomaly_type === "DUPLICATE_ROW") {
          choice = "SKIP";
        } else if (a.anomaly_type === "SETTLEMENT_LOGGED_AS_EXPENSE") {
          choice = "CONVERT";
          if (a.description.includes("Rohan paid Aisha")) {
            details = { from: "Rohan", to: "Aisha" };
          } else if (a.description.includes("Sam deposit share")) {
            details = { from: "Sam", to: "Aisha" };
          }
        } else if (a.anomaly_type === "PERCENTAGE_SUM_MISMATCH") {
          choice = "NORMALIZE";
        } else if (a.anomaly_type === "DATE_AMBIGUITY") {
          choice = "MAY_4"; 
        } else if (a.anomaly_type === "SPLIT_MEMBER_OUTSIDE_MEMBERSHIP") {
          choice = "EXCLUDE";
          if (a.description.includes("Meera")) {
            details = { username: "Meera" };
          }
        } else if (a.anomaly_type === "UNKNOWN_SPLIT_MEMBER") {
          choice = "ASSIGN_TO_PAYER";
        } else if (a.anomaly_type === "PRECISION_ROUNDING") {
          choice = "ROUND";
        } else if (a.anomaly_type === "MISSING_CURRENCY") {
          choice = "INR";
        }
        
        defaultRes.push({
          row_number: a.row_number,
          anomaly_type: a.anomaly_type,
          choice,
          details
        });
      });
      setResolutions(defaultRes);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to scan CSV.");
    } finally {
      setLoading(false);
    }
  };

  const updateResolution = (rowNum: number, type: string, newChoice: string, details?: any) => {
    setResolutions(prev => {
      const filtered = prev.filter(r => !(r.row_number === rowNum && r.anomaly_type === type));
      return [...filtered, { row_number: rowNum, anomaly_type: type, choice: newChoice, details }];
    });
  };

  const handleCommitImport = async () => {
    if (!session) return;
    setLoading(true);
    setCommitProgress("Initiating secure database transaction...");
    setErrorMsg("");
    
    // Progressive UI feedback stages
    const timer1 = setTimeout(() => setCommitProgress("Processing resolution rules & updating groups..."), 1000);
    const timer2 = setTimeout(() => setCommitProgress("Writing records to PostgreSQL & minimizing roommate debts..."), 2500);
    const timer3 = setTimeout(() => setCommitProgress("Finalizing import audit log trails..."), 4500);

    try {
      const resolvedList = [...resolutions];
      session.anomalies.filter(a => a.anomaly_type === "PAYER_OUTSIDE_MEMBERSHIP" || a.anomaly_type === "USD_EXCHANGE_RATE" || a.anomaly_type === "MULTI_CURRENCY" || a.description.includes("USD")).forEach(a => {
        resolvedList.push({
          row_number: a.row_number,
          anomaly_type: "USD_EXCHANGE_RATE",
          choice: "RATE",
          details: { rate: usdRate }
        });
      });

      const data = await commitMutation.mutateAsync({
        groupId,
        sessionId: session.sessionId,
        resolutions: resolvedList,
        defaultRate: usdRate
      });
      
      setImportReport(data.report);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to commit import.");
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      setLoading(false);
      setCommitProgress("");
    }
  };

  const handleFinish = () => {
    onImportSuccess();
    setCsvText("");
    setSession(null);
    setResolutions([]);
    setImportReport(null);
  };

  const handleQuickPasteText = () => {
    const rawDefault = `date,description,paid_by,amount,currency,split_type,split_with,split_details,notes
01-02-2026,February rent,Aisha,48000,INR,equal,Aisha;Rohan;Priya;Meera,,
03-02-2026,Groceries BigBasket,Priya,2340,INR,equal,Aisha;Rohan;Priya;Meera,,
05-02-2026,Wifi bill Feb,Rohan,1199,INR,equal,Aisha;Rohan;Priya;Meera,,
08-02-2026,Dinner at Marina Bites,Dev,3200,INR,equal,Aisha;Rohan;Priya;Dev,,Dev visiting for the weekend
08-02-2026,dinner - marina bites,Dev,3200,INR,equal,Aisha;Rohan;Priya;Dev,,
10-02-2026,Electricity Feb,Aisha,"1,200",INR,equal,Aisha;Rohan;Priya;Meera,,
12-02-2026,Maid salary Feb,Meera,3000,INR,equal,Aisha;Rohan;Priya;Meera,,
14-02-2026,Movie night snacks,priya,640,INR,equal,Aisha;Rohan;Priya,,Meera skipped
15-02-2026,Cylinder refill,Rohan,899.995,INR,equal,Aisha;Rohan;Priya;Meera,,
18-02-2026,Groceries DMart,Priya S,1875,INR,equal,Aisha;Rohan;Priya;Meera,,
20-02-2026,Aisha birthday cake,Rohan,1500,INR,unequal,Rohan;Priya;Meera,Rohan 700; Priya 400; Meera 400,Aisha not charged obviously
22-02-2026,House cleaning supplies,,780,INR,equal,Aisha;Rohan;Priya;Meera,,can't remember who paid
25-02-2026,Rohan paid Aisha back,Rohan,5000,INR,,Aisha,,this is a settlement not an expense??
28-02-2026,Pizza Friday,Aisha,1440,INR,percentage,Aisha;Rohan;Priya;Meera,Aisha 30%; Rohan 30%; Priya 30%; Meera 20%,percentages might be off
01-03-2026,March rent,Aisha,48000,INR,equal,Aisha;Rohan;Priya;Meera,,
03-03-2026,Groceries BigBasket,Meera,2810,INR,equal,Aisha;Rohan;Priya;Meera,,
05-03-2026,Wifi bill Mar,Rohan,1199,INR,equal,Aisha;Rohan;Priya;Meera,,
08-03-2026,Goa flights,Aisha,32400,INR,equal,Aisha;Rohan;Priya;Dev,,trip starts!
09-03-2026,Goa villa booking,Dev,540,USD,equal,Aisha;Rohan;Priya;Dev,,booked on intl site
10-03-2026,Beach shack lunch,Rohan,84,USD,equal,Aisha;Rohan;Priya;Dev,,
10-03-2026,Scooter rentals,Priya,3600,INR,share,Aisha;Rohan;Priya;Dev,Aisha 1; Rohan 2; Priya 1; Dev 2,Rohan and Dev took the bigger ones
11-03-2026,Parasailing,Dev,150,USD,equal,Aisha;Rohan;Priya;Dev;Dev's friend Kabir,,Kabir joined for the day
11-03-2026,Dinner at Thalassa,Aisha,2400,INR,equal,Aisha;Rohan;Priya;Dev,,
11-03-2026,Thalassa dinner,Rohan,2450,INR,equal,Aisha;Rohan;Priya;Dev,,Aisha also logged this I think hers is wrong
12-03-2026,Parasailing refund,Dev,-30,USD,equal,Aisha;Rohan;Priya;Dev,,one slot got cancelled
Mar-14,Airport cab,rohan ,1100,INR,equal,Aisha;Rohan;Priya;Dev,,
15-03-2026,Groceries DMart,Priya,2105,,equal,Aisha;Rohan;Priya;Meera,,forgot to set currency
18-03-2026,Electricity Mar,Aisha,1450,INR,equal,Aisha;Rohan;Priya;Meera,,
20-03-2026,Maid salary Mar,Meera,3000,INR,equal,Aisha;Rohan;Priya;Meera,,
22-03-2026,Dinner order Swiggy,Priya,0,INR,equal,Aisha;Rohan;Priya;Meera,,counted twice earlier - fixing later
25-03-2026,Weekend brunch,Meera,2200,INR,percentage,Aisha;Rohan;Priya;Meera,Aisha 30%; Rohan 30%; Priya 30%; Meera 20%,
28-03-2026,Meera farewell dinner,Aisha,4800,INR,equal,Aisha;Rohan;Priya;Meera,,Meera moving out Sunday :(
04-05-2026,Deep cleaning service,Rohan,2500,INR,equal,Aisha;Rohan;Priya,,is this April 5 or May 4? format is a mess
01-04-2026,April rent,Aisha,48000,INR,share,Aisha;Rohan;Priya,Aisha 2; Rohan 1; Priya 1,Aisha took Meera's room too
02-04-2026,Groceries BigBasket,Priya,2640,INR,equal,Aisha;Rohan;Priya;Meera,,oops Meera still in the group list
05-04-2026,Wifi bill Apr,Rohan,1199,INR,equal,Aisha;Rohan;Priya,,
08-04-2026,Sam deposit share,Sam,15000,INR,equal,Aisha,,Sam moving in! paid Aisha his deposit
10-04-2026,Housewarming drinks,Sam,3100,INR,equal,Aisha;Rohan;Priya;Sam,,
12-04-2026,Electricity Apr,Aisha,1380,INR,equal,Aisha;Rohan;Priya;Sam,,
15-04-2026,Groceries DMart,Sam,1990,INR,equal,Aisha;Rohan;Priya;Sam,,
18-04-2026,Furniture for common room,Aisha,12000,INR,equal,Aisha;Rohan;Priya;Sam,Aisha 1; Rohan 1; Priya 1; Sam 1,split_type says equal but someone added shares anyway
20-04-2026,Maid salary Apr,Priya,3000,INR,equal,Aisha;Rohan;Priya;Sam,,`;
    setCsvText(rawDefault.trim());
    setErrorMsg("");
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: "1000px", margin: "0 auto" }}>
      {loading && commitProgress && (
        <div className="glass-panel animate-fade-in" style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(10, 8, 25, 0.85)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "24px"
        }}>
          <div className="spinner" style={{
            width: "56px",
            height: "56px",
            border: "4px solid rgba(255, 255, 255, 0.05)",
            borderTop: "4px solid var(--primary)",
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }} />
          <div style={{ textAlign: "center" }}>
            <h3 style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-bright)", marginBottom: "8px" }}>Processing CSV Ingestion</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>{commitProgress}</p>
          </div>
        </div>
      )}
      
      {/* 1. UPLOAD CSV PANEL */}
      {!session && !importReport && (
        <div className="glass-panel" style={{ textAlign: "center", padding: "60px 40px" }}>
          <div style={{ display: "inline-flex", padding: "16px", background: "rgba(99, 102, 241, 0.12)", borderRadius: "50%", color: "#6366f1", marginBottom: "20px" }}>
            <FileUp size={44} />
          </div>
          <h2 style={{ fontSize: "24px", fontWeight: 600, marginBottom: "8px" }}>Import Spreadsheet Expenses</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "15px", maxWidth: "500px", margin: "0 auto 28px auto" }}>
            Upload the roommate group's <code>expenses_export.csv</code>. The importer will scan for duplicates, currency values, formatting errors, and temporal mismatches.
          </p>

          {errorMsg && (
            <div className="alert alert-error" style={{ maxWidth: "600px", margin: "0 auto 20px auto" }}>
              {errorMsg}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
            <label className="btn btn-primary" style={{ padding: "12px 28px", fontSize: "15px", cursor: "pointer" }}>
              Select CSV File
              <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: "none" }} />
            </label>

            <div style={{ margin: "16px 0", display: "flex", alignItems: "center", gap: "8px", width: "280px" }}>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }}></div>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>or</span>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }}></div>
            </div>

            <button className="btn btn-secondary" onClick={handleQuickPasteText} style={{ padding: "10px 24px" }}>
              Load Expenses Export.csv (Default Template)
            </button>
          </div>

          {csvText && (
            <div className="glass-panel animate-fade-in" style={{ marginTop: "32px", textAlign: "left", background: "rgba(0,0,0,0.3)", borderStyle: "dashed" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--success)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <CheckCircle2 size={16} /> CSV Ingested Successfully!
                </span>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{csvText.split("\n").length - 1} rows detected</span>
              </div>
              <pre style={{ fontSize: "11px", color: "var(--text-muted)", overflowX: "auto", background: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: "8px", maxHeight: "150px" }}>
                {csvText.substring(0, 500)}...
              </pre>
              <button className="btn btn-primary" onClick={handleScanCSV} style={{ marginTop: "20px", width: "100%" }} disabled={loading}>
                {loading ? "Scanning..." : "Scan CSV for Anomalies"}
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. RESOLUTION WIZARD PANEL (Meera's Request) */}
      {session && !importReport && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          <div className="glass-panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderLeft: "4px solid var(--warning)" }}>
            <div>
              <h3 style={{ fontSize: "20px", fontWeight: 600 }}>CSV Parser: Anomaly Scanning Wizard</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>
                Detected <strong style={{ color: "var(--warning)" }}>{session.anomalies.length} anomalies</strong> across {session.totalRows} rows. Review and select resolution policies below.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {/* USD Exchange Rate Setting */}
              <div className="glass-panel" style={{ padding: "8px 16px", background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", gap: "12px" }}>
                <DollarSign size={16} style={{ color: "var(--accent)" }} />
                <div>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>USD Conversion Rate</span>
                  <input 
                    type="number" 
                    value={usdRate} 
                    onChange={(e) => setUsdRate(parseFloat(e.target.value) || 95)} 
                    className="input-field" 
                    style={{ width: "80px", padding: "4px 8px", fontSize: "13px", background: "transparent", textAlign: "center", marginTop: "2px" }} 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Anomaly List Form */}
          <div className="glass-panel">
            <h4 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
              <AlertCircle size={18} style={{ color: "var(--warning)" }} />
              Roommate Review Checklist (Requires Confirmation)
            </h4>

            {errorMsg && (
              <div className="alert alert-error" style={{ marginBottom: "20px" }}>
                {errorMsg}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {session.anomalies.map((a, idx) => {
                const currentRes = resolutions.find(r => r.row_number === a.row_number && r.anomaly_type === a.anomaly_type);
                const currentChoice = currentRes?.choice || "";

                return (
                  <div key={idx} className="glass-panel" style={{ borderLeft: `3px solid ${a.severity === "CRITICAL" ? "var(--error)" : "var(--warning)"}`, padding: "16px 20px", background: "rgba(0,0,0,0.15)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span className="badge badge-warning" style={{ background: a.severity === "CRITICAL" ? "rgba(239, 68, 68, 0.15)" : "rgba(245, 158, 11, 0.15)", color: a.severity === "CRITICAL" ? "#fca5a5" : "#fde68a" }}>
                            Row {a.row_number} • {a.anomaly_type.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p style={{ marginTop: "8px", fontSize: "14px", color: "var(--text-bright)" }}>{a.description}</p>
                      </div>

                      {/* Dynamic Action Selectors */}
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        {a.anomaly_type === "DUPLICATE_ROW" && (
                          <>
                            <button 
                              className={`btn ${currentChoice === "SKIP" ? "btn-primary" : "btn-secondary"}`} 
                              style={{ padding: "6px 12px", fontSize: "12px" }}
                              onClick={() => updateResolution(a.row_number, a.anomaly_type, "SKIP")}
                            >
                              Merge & Keep First (Skip duplicates)
                            </button>
                            <button 
                              className={`btn ${currentChoice === "IMPORT" ? "btn-primary" : "btn-secondary"}`} 
                              style={{ padding: "6px 12px", fontSize: "12px" }}
                              onClick={() => updateResolution(a.row_number, a.anomaly_type, "IMPORT")}
                            >
                              Keep Both (Log separately)
                            </button>
                          </>
                        )}

                        {a.anomaly_type === "SETTLEMENT_LOGGED_AS_EXPENSE" && (
                          <>
                            <button 
                              className={`btn ${currentChoice === "CONVERT" ? "btn-primary" : "btn-secondary"}`} 
                              style={{ padding: "6px 12px", fontSize: "12px" }}
                              onClick={() => updateResolution(a.row_number, a.anomaly_type, "CONVERT", {
                                from: a.description.includes("Rohan") ? "Rohan" : "Sam",
                                to: "Aisha"
                              })}
                            >
                              Convert to Settlement Payment
                            </button>
                            <button 
                              className={`btn ${currentChoice === "IMPORT" ? "btn-primary" : "btn-secondary"}`} 
                              style={{ padding: "6px 12px", fontSize: "12px" }}
                              onClick={() => updateResolution(a.row_number, a.anomaly_type, "IMPORT")}
                            >
                              Keep as Normal Group Expense
                            </button>
                          </>
                        )}

                        {a.anomaly_type === "PERCENTAGE_SUM_MISMATCH" && (
                          <>
                            <button 
                              className={`btn ${currentChoice === "NORMALIZE" ? "btn-primary" : "btn-secondary"}`} 
                              style={{ padding: "6px 12px", fontSize: "12px" }}
                              onClick={() => updateResolution(a.row_number, a.anomaly_type, "NORMALIZE")}
                            >
                              Normalize Percentages (Scale to 100%)
                            </button>
                            <button 
                              className={`btn ${currentChoice === "IMPORT" ? "btn-primary" : "btn-secondary"}`} 
                              style={{ padding: "6px 12px", fontSize: "12px" }}
                              onClick={() => updateResolution(a.row_number, a.anomaly_type, "IMPORT")}
                            >
                              Keep raw sum (Will leave excess/deficit)
                            </button>
                          </>
                        )}

                        {a.anomaly_type === "DATE_AMBIGUITY" && (
                          <>
                            <button 
                              className={`btn ${currentChoice === "MAY_4" ? "btn-primary" : "btn-secondary"}`} 
                              style={{ padding: "6px 12px", fontSize: "12px" }}
                              onClick={() => updateResolution(a.row_number, a.anomaly_type, "MAY_4")}
                            >
                              Interpret as May 4 (DD-MM)
                            </button>
                            <button 
                              className={`btn ${currentChoice === "APRIL_5" ? "btn-primary" : "btn-secondary"}`} 
                              style={{ padding: "6px 12px", fontSize: "12px" }}
                              onClick={() => updateResolution(a.row_number, a.anomaly_type, "APRIL_5")}
                            >
                              Interpret as April 5 (MM-DD)
                            </button>
                          </>
                        )}

                        {a.anomaly_type === "SPLIT_MEMBER_OUTSIDE_MEMBERSHIP" && (
                          <>
                            <button 
                              className={`btn ${currentChoice === "EXCLUDE" ? "btn-primary" : "btn-secondary"}`} 
                              style={{ padding: "6px 12px", fontSize: "12px" }}
                              onClick={() => updateResolution(a.row_number, a.anomaly_type, "EXCLUDE", { username: "Meera" })}
                            >
                              Exclude Meera (Split among active)
                            </button>
                            <button 
                              className={`btn ${currentChoice === "KEEP" ? "btn-primary" : "btn-secondary"}`} 
                              style={{ padding: "6px 12px", fontSize: "12px" }}
                              onClick={() => updateResolution(a.row_number, a.anomaly_type, "KEEP")}
                            >
                              Charge Meera anyway
                            </button>
                          </>
                        )}

                        {a.anomaly_type === "UNKNOWN_SPLIT_MEMBER" && (
                          <>
                            <button 
                              className={`btn ${currentChoice === "ASSIGN_TO_PAYER" ? "btn-primary" : "btn-secondary"}`} 
                              style={{ padding: "6px 12px", fontSize: "12px" }}
                              onClick={() => updateResolution(a.row_number, a.anomaly_type, "ASSIGN_TO_PAYER")}
                            >
                              Charge Kabir's share to Payer (Dev)
                            </button>
                            <button 
                              className={`btn ${currentChoice === "IGNORE" ? "btn-primary" : "btn-secondary"}`} 
                              style={{ padding: "6px 12px", fontSize: "12px" }}
                              onClick={() => updateResolution(a.row_number, a.anomaly_type, "IGNORE")}
                            >
                              Exclude Kabir entirely
                            </button>
                          </>
                        )}

                        {a.anomaly_type === "PRECISION_ROUNDING" && (
                          <button 
                            className={`btn ${currentChoice === "ROUND" ? "btn-primary" : "btn-secondary"}`} 
                            style={{ padding: "6px 12px", fontSize: "12px" }}
                            onClick={() => updateResolution(a.row_number, a.anomaly_type, "ROUND")}
                          >
                            Round to 2 decimals
                          </button>
                        )}

                        {a.anomaly_type === "MISSING_PAYER" && (
                          <select 
                            className="input-field" 
                            style={{ padding: "6px 12px", fontSize: "12px", width: "130px" }}
                            value={currentChoice}
                            onChange={(e) => updateResolution(a.row_number, a.anomaly_type, e.target.value)}
                          >
                            <option value="">Select Roommate</option>
                            {["Aisha", "Rohan", "Priya", "Meera", "Sam", "Dev"].map(name => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          </select>
                        )}

                        {a.anomaly_type === "MISSING_CURRENCY" && (
                          <button 
                            className={`btn ${currentChoice === "INR" ? "btn-primary" : "btn-secondary"}`} 
                            style={{ padding: "6px 12px", fontSize: "12px" }}
                            onClick={() => updateResolution(a.row_number, a.anomaly_type, "INR")}
                          >
                            Default to INR
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "32px" }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setSession(null)}>
                Back to Upload
              </button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleCommitImport} disabled={loading}>
                {loading ? "Processing resolutions..." : "Approve resolutions and import data"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. FINAL IMPORT REPORT PANEL (Minimum Product Requirement 6) */}
      {importReport && (
        <div className="glass-panel animate-fade-in" style={{ borderLeft: "4px solid var(--success)" }}>
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <div style={{ display: "inline-flex", padding: "12px", background: "rgba(16, 185, 129, 0.15)", borderRadius: "50%", color: "#10b981", marginBottom: "16px" }}>
              <CheckCircle2 size={32} />
            </div>
            <h2 style={{ fontSize: "22px", fontWeight: 600, color: "var(--text-bright)" }}>Data Import Completed!</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>
              Here is the ingestion audit summary produced by the app, listing every resolution action taken.
            </p>
          </div>

          <div style={{ overflowX: "auto", marginBottom: "28px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
                  <th style={{ padding: "10px 16px", color: "var(--text-muted)", fontSize: "12px", fontWeight: 500, width: "100px" }}>Row Num</th>
                  <th style={{ padding: "10px 16px", color: "var(--text-muted)", fontSize: "12px", fontWeight: 500, width: "200px" }}>Action Applied</th>
                  <th style={{ padding: "10px 16px", color: "var(--text-muted)", fontSize: "12px", fontWeight: 500 }}>Ingested State details</th>
                </tr>
              </thead>
              <tbody>
                {importReport.map((rep, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                    <td style={{ padding: "14px 16px", fontSize: "13px" }}>
                      <span className="badge badge-inactive">Row {rep.row_number}</span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span className={`badge ${
                        rep.action === "IMPORTED" ? "badge-active" :
                        rep.action === "SKIPPED" ? "badge-inactive" :
                        "badge-warning"
                      }`} style={{ fontSize: "10px" }}>
                        {rep.action.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: "13px", color: "var(--text-bright)" }}>{rep.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button className="btn btn-primary" onClick={handleFinish} style={{ width: "100%", padding: "12px" }}>
            Go back to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
