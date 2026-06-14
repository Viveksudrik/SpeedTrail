"use client";

import React, { useState, useEffect } from "react";
import { LogOut, LayoutDashboard, FileUp, Users, Wallet2 } from "lucide-react";
import { api } from "~/trpc/react";
import Dashboard from "./_components/Dashboard";
import ImportWizard from "./_components/ImportWizard";
import MemberTimeline from "./_components/MemberTimeline";

export interface User {
  id: string;
  username: string;
}

export interface Group {
  id: string;
  name: string;
  createdAt: string;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"dashboard" | "importer" | "members">("dashboard");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginUsername, setLoginUsername] = useState("Aisha");
  const [loginError, setLoginError] = useState("");

  const loginMutation = api.auth.login.useMutation();
  const { data: groups = [] } = api.group.list.useQuery(undefined, {
    enabled: !!user,
  });

  // Auto-restore session from localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem("speedtrail_user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // Fetch groups and select first by default
  useEffect(() => {
    if (groups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(groups[0]!.id);
    }
  }, [groups, selectedGroupId]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    try {
      const data = await loginMutation.mutateAsync({
        username: loginUsername,
        password: loginPassword || `${loginUsername.toLowerCase()}123`,
      });
      localStorage.setItem("speedtrail_user", JSON.stringify(data));
      setUser(data);
    } catch (err: any) {
      setLoginError(err.message || "Failed to login");
    }
  };

  const handleQuickLogin = async (name: string) => {
    setLoginError("");
    try {
      const data = await loginMutation.mutateAsync({
        username: name,
        password: `${name.toLowerCase()}123`,
      });
      localStorage.setItem("speedtrail_user", JSON.stringify(data));
      setUser(data);
    } catch (err: any) {
      setLoginError(err.message || "Failed to login");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("speedtrail_user");
    setUser(null);
    setSelectedGroupId("");
    setActiveTab("dashboard");
  };

  if (!user) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", padding: "20px" }}>
        <div className="glass-panel animate-fade-in" style={{ width: "100%", maxWidth: "440px", background: "rgba(20, 15, 45, 0.6)" }}>
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <div style={{ display: "inline-flex", padding: "12px", background: "rgba(99, 102, 241, 0.15)", borderRadius: "16px", color: "#6366f1", marginBottom: "12px" }}>
              <Wallet2 size={36} />
            </div>
            <h1 style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-0.5px", background: "linear-gradient(to right, #6366f1, #d946ef)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              SpeedTrail
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "6px" }}>Shared Expenses, Simplified.</p>
          </div>

          {loginError && (
            <div className="alert alert-error" style={{ marginBottom: "16px" }}>
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: "16px" }}>
              <label className="input-label">Select Roommate Account</label>
              <select 
                className="input-field"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                style={{ appearance: "none", background: 'rgba(0, 0, 0, 0.35) url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2394a3b8\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E") no-repeat right 12px center', backgroundSize: "16px" }}
              >
                {["Aisha", "Rohan", "Priya", "Meera", "Sam", "Dev"].map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label className="input-label">Password</label>
              <input 
                type="password"
                className="input-field"
                placeholder="e.g. aisha123, rohan123..."
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
              />
              <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                Tip: Leave blank to auto-use default password ({loginUsername.toLowerCase()}123)
              </span>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: "100%", padding: "12px" }}>
              Sign In
            </button>
          </form>

          <div style={{ margin: "24px 0 16px 0", display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }}></div>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px" }}>Quick Evaluator Login</span>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }}></div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
            {["Aisha", "Rohan", "Priya", "Meera", "Sam", "Dev"].map(name => (
              <button 
                key={name}
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: "12px", padding: "8px 4px" }}
                onClick={() => handleQuickLogin(name)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Top Header */}
      <header className="glass-panel" style={{ borderBottom: "1px solid var(--panel-border)", borderRadius: 0, padding: "16px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(15, 12, 35, 0.8)", zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ padding: "6px", background: "rgba(99, 102, 241, 0.15)", borderRadius: "10px", color: "#6366f1" }}>
            <Wallet2 size={22} />
          </div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.5px", background: "linear-gradient(to right, #6366f1, #d946ef)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            SpeedTrail
          </h1>
        </div>

        <nav style={{ display: "flex", gap: "16px" }}>
          <button 
            className={`btn ${activeTab === "dashboard" ? "btn-primary" : "btn-secondary"}`}
            style={{ padding: "8px 16px", fontSize: "13px" }}
            onClick={() => setActiveTab("dashboard")}
          >
            <LayoutDashboard size={16} />
            Dashboard
          </button>
          <button 
            className={`btn ${activeTab === "importer" ? "btn-primary" : "btn-secondary"}`}
            style={{ padding: "8px 16px", fontSize: "13px" }}
            onClick={() => setActiveTab("importer")}
          >
            <FileUp size={16} />
            CSV Importer
          </button>
          <button 
            className={`btn ${activeTab === "members" ? "btn-primary" : "btn-secondary"}`}
            style={{ padding: "8px 16px", fontSize: "13px" }}
            onClick={() => setActiveTab("members")}
          >
            <Users size={16} />
            Members Timeline
          </button>
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>
            Logged in as <strong style={{ color: "var(--text-bright)" }}>{user.username}</strong>
          </span>
          <button className="btn btn-danger" style={{ padding: "8px 12px", fontSize: "13px" }} onClick={handleLogout}>
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: "32px", maxWidth: "1400px", width: "100%", margin: "0 auto" }}>
        {selectedGroupId ? (
          <>
            {activeTab === "dashboard" && (
              <Dashboard groupId={selectedGroupId} currentUser={user} />
            )}
            {activeTab === "importer" && (
              <ImportWizard groupId={selectedGroupId} currentUser={user} onImportSuccess={() => setActiveTab("dashboard")} />
            )}
            {activeTab === "members" && (
              <MemberTimeline groupId={selectedGroupId} />
            )}
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <p style={{ color: "var(--text-muted)" }}>Initializing workspace, please wait...</p>
          </div>
        )}
      </main>
    </div>
  );
}
