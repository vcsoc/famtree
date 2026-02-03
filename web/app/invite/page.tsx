"use client";

import { useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4001";

export default function InvitePage() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Arborist");
  const [forestId, setForestId] = useState("");
  const [treeId, setTreeId] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const sendInvite = async () => {
    if (!email.trim()) {
      setResult("Email is required");
      return;
    }

    try {
      const stored = localStorage.getItem("famtree_token");
      const res = await fetch(`${apiBase}/api/invitations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${stored || token}`
        },
        body: JSON.stringify({
          inviteeEmail: email,
          role,
          forestId: forestId || undefined,
          treeId: treeId || undefined
        })
      });

      const data = await res.json();
      if (res.ok) {
        setResult(`Invitation sent! Share this link: ${window.location.origin}/invite/${data.token}`);
        setEmail("");
      } else {
        setResult(`Error: ${data.error}`);
      }
    } catch (err) {
      setResult(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  return (
    <div className="container">
      <section className="panel">
        <h2>Invite Collaborators</h2>
        <p className="muted">
          Invite family members to collaborate on forests and trees. They'll receive an email with a secure link.
        </p>

        <div className="form-grid">
          <input
            type="email"
            placeholder="Email address *"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="Visitor">Visitor (View only)</option>
            <option value="Arborist">Arborist (Edit trees)</option>
            <option value="Ranger">Ranger (Manage forests)</option>
          </select>

          <input
            placeholder="Forest ID (optional)"
            value={forestId}
            onChange={(e) => setForestId(e.target.value)}
          />

          <input
            placeholder="Tree ID (optional)"
            value={treeId}
            onChange={(e) => setTreeId(e.target.value)}
          />
        </div>

        <button className="primary" onClick={sendInvite}>
          Send invitation
        </button>

        {result && (
          <div className="result-panel panel">
            <p>{result}</p>
          </div>
        )}
      </section>

      <section className="panel">
        <h3>Pending Invitations</h3>
        <p className="muted">Track invitations you've sent.</p>
        <div className="grid">
          <div className="panel">
            <strong>john@example.com</strong>
            <p className="muted">Role: Arborist • Status: Pending</p>
          </div>
        </div>
      </section>
    </div>
  );
}
