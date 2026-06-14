"use client";

import React, { useState } from "react";
import { Users, Calendar, CheckCircle, AlertTriangle, Save, Edit2, X } from "lucide-react";
import { api } from "~/trpc/react";

interface Member {
  membership_id: string;
  user_id: string;
  username: string;
  joined_at: string;
  left_at: string | null;
}

interface MemberTimelineProps {
  groupId: string;
}

export default function MemberTimeline({ groupId }: MemberTimelineProps) {
  const { data: members = [], refetch } = api.group.getMembers.useQuery({ groupId });
  const updateMembershipMutation = api.group.updateMembership.useMutation();

  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editJoinedAt, setEditJoinedAt] = useState("");
  const [editLeftAt, setEditLeftAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  const handleEditClick = (m: Member) => {
    setEditingMember(m);
    setEditJoinedAt(m.joined_at);
    setEditLeftAt(m.left_at || "");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    setLoading(true);
    setMessage({ text: "", type: "" });

    try {
      await updateMembershipMutation.mutateAsync({
        groupId,
        userId: editingMember.user_id,
        joinedAt: editJoinedAt,
        leftAt: editLeftAt || null,
      });
      setMessage({ text: "Timeline updated successfully!", type: "success" });
      setEditingMember(null);
      void refetch();
    } catch (err: any) {
      setMessage({ text: err.message || "Failed to update membership", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const isCurrentlyActive = (leftAt: string | null) => {
    if (!leftAt) return true;
    const today = new Date().toISOString().substring(0, 10);
    return today <= leftAt;
  };

  return (
    <div className="animate-fade-in" style={{ display: "grid", gridTemplateColumns: "1fr", gap: "32px" }}>
      
      {/* Overview Intro */}
      <div className="glass-panel" style={{ display: "flex", gap: "20px", alignItems: "center", background: "rgba(99, 102, 241, 0.05)" }}>
        <div style={{ padding: "12px", background: "rgba(99, 102, 241, 0.15)", borderRadius: "12px", color: "#6366f1" }}>
          <Users size={28} />
        </div>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-bright)" }}>Temporal Membership Management</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>
            Flatmate memberships change over time. Expenses are only split among members who were active in the group on the expense date.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr md(1fr 320px)", gap: "24px" }}>
        
        {/* Members Table */}
        <div className="glass-panel" style={{ flex: 1 }}>
          <h3 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "20px", color: "var(--text-bright)" }}>Group Roommates</h3>
          
          {message.text && (
            <div className={`alert alert-${message.type}`}>
              {message.text}
            </div>
          )}

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
                  <th style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: "13px", fontWeight: 500 }}>Roommate Name</th>
                  <th style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: "13px", fontWeight: 500 }}>Joined Date</th>
                  <th style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: "13px", fontWeight: 500 }}>Left Date</th>
                  <th style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: "13px", fontWeight: 500 }}>Status</th>
                  <th style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: "13px", fontWeight: 500, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map(m => {
                  const active = isCurrentlyActive(m.left_at);
                  return (
                    <tr key={m.membership_id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)", transition: "background 0.2s" }} className="table-row-hover">
                      <td style={{ padding: "16px", fontWeight: 500 }}>{m.username}</td>
                      <td style={{ padding: "16px", color: "var(--text-bright)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px" }}>
                          <Calendar size={14} style={{ color: "var(--text-muted)" }} />
                          {new Date(m.joined_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                        </div>
                      </td>
                      <td style={{ padding: "16px", color: m.left_at ? "var(--text-bright)" : "var(--text-muted)" }}>
                        {m.left_at ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px" }}>
                            <Calendar size={14} style={{ color: "var(--text-muted)" }} />
                            {new Date(m.left_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                          </div>
                        ) : (
                          "Currently Active"
                        )}
                      </td>
                      <td style={{ padding: "16px" }}>
                        {active ? (
                          <span className="badge badge-active" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <CheckCircle size={10} /> Active
                          </span>
                        ) : (
                          <span className="badge badge-inactive" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <AlertTriangle size={10} /> Inactive / Moved Out
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "16px", textAlign: "right" }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: "6px 12px", fontSize: "12px" }}
                          onClick={() => handleEditClick(m)}
                        >
                          <Edit2 size={12} />
                          Edit Timeline
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Edit Panel Card */}
        {editingMember && (
          <div className="glass-panel animate-fade-in" style={{ height: "fit-content", minWidth: "320px", borderLeft: "3px solid var(--primary)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h4 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-bright)" }}>Edit Timeline: {editingMember.username}</h4>
              <button 
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
                onClick={() => setEditingMember(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div style={{ marginBottom: "16px" }}>
                <label className="input-label">Joined / Moved-in Date</label>
                <input 
                  type="date"
                  className="input-field"
                  required
                  value={editJoinedAt}
                  onChange={(e) => setEditJoinedAt(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label className="input-label">Left / Moved-out Date</label>
                <input 
                  type="date"
                  className="input-field"
                  value={editLeftAt}
                  onChange={(e) => setEditLeftAt(e.target.value)}
                  placeholder="Leave empty if currently active"
                />
                <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginTop: "4px" }}>
                  Leave blank if they are still an active flatmate.
                </span>
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ flex: 1 }}
                  onClick={() => setEditingMember(null)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ flex: 1 }}
                  disabled={loading}
                >
                  <Save size={14} />
                  {loading ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
