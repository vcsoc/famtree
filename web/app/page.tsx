"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const roles = [
  "Admin",
  "Warden",
  "Ranger",
  "Arborist",
  "Visitor"
];

export default function HomePage() {
  const router = useRouter();
  const apiBase = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4001",
    []
  );
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [tenantCreateName, setTenantCreateName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"signin" | "tenant">("signin");

  const handleAuth = async () => {
    setError(null);
    setStatus(null);
    try {
      if (!email || !email.includes("@")) {
        throw new Error("Enter a valid email address");
      }
      if (!password || password.length < 8) {
        throw new Error("Password must be at least 8 characters");
      }
      const url = `${apiBase}/api/auth/${authMode}`;
      const payload: Record<string, string> = { email, password };
      if (authMode === "register" && tenantName) {
        payload.tenantName = tenantName;
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      setToken(data.token);
      localStorage.setItem("famtree_token", data.token);
      setStatus(`Signed in as ${data.role}`);
      router.push("/forests");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const handleCreateTenant = async () => {
    setError(null);
    setStatus(null);
    try {
      if (!token) {
        throw new Error("Sign in as an Admin first");
      }
      if (!tenantCreateName || tenantCreateName.trim().length < 2) {
        throw new Error("Tenant name must be at least 2 characters");
      }
      const res = await fetch(`${apiBase}/api/tenants`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: tenantCreateName })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to create tenant");
      }

      setStatus(`Tenant created: ${data.name}`);
      router.push("/forests");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  return (
    <div className="container">
      <section className="hero">
        <div>
          <p className="eyebrow">Family Tree Manager</p>
          <h1>Build, research, and preserve your family legacy.</h1>
          <p className="lead">
            Create forests and trees, collaborate with your family, and let AI
            assist your genealogy research.
          </p>
          <div className="actions">
            <button className="primary" onClick={() => router.push("/demo")}>
              Explore demo
            </button>
          </div>
          {status ? <p className="muted">{status}</p> : null}
          {error ? <p className="muted">{error}</p> : null}
        </div>
        <div className="card">
          <div className="tabs">
            <button
              className={`tab ${activeTab === "signin" ? "active" : ""}`}
              onClick={() => setActiveTab("signin")}
            >
              Sign In
            </button>
            <button
              className={`tab ${activeTab === "tenant" ? "active" : ""}`}
              onClick={() => setActiveTab("tenant")}
            >
              Create Tenant
            </button>
          </div>

          {activeTab === "signin" ? (
            <>
              <h3>{authMode === "login" ? "Quick sign in" : "Register"}</h3>
              <div className="field">
                <label>Email</label>
                <input
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="field">
                <label>Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              {authMode === "register" ? (
                <div className="field">
                  <label>Tenant name (first admin only)</label>
                  <input
                    placeholder="Acme Genealogy"
                    value={tenantName}
                    onChange={(event) => setTenantName(event.target.value)}
                  />
                </div>
              ) : null}
              <button className="primary" id="auth" onClick={handleAuth}>
                {authMode === "login" ? "Sign in" : "Register"}
              </button>
              <button
                className="secondary"
                onClick={() =>
                  setAuthMode((mode) => (mode === "login" ? "register" : "login"))
                }
              >
                {authMode === "login" ? "Need an account?" : "Have an account?"}
              </button>
            </>
          ) : (
            <>
              <h3>Create new tenant</h3>
              <div className="field">
                <label>Tenant name</label>
                <input
                  placeholder="New tenant name"
                  value={tenantCreateName}
                  onChange={(event) => setTenantCreateName(event.target.value)}
                />
              </div>
              <p className="muted">RBAC secured access and tenant isolation.</p>
              <button className="primary" onClick={handleCreateTenant}>
                Create tenant
              </button>
            </>
          )}
        </div>
      </section>

      <section id="features" className="grid">
        <div className="panel">
          <h3>Interactive trees</h3>
          <p>Custom layouts, drag-and-drop, and zoomable navigation.</p>
        </div>
        <div className="panel">
          <h3>AI research</h3>
          <p>Provider-agnostic AI tasks for hints, records, and insights.</p>
        </div>
        <div className="panel">
          <h3>Collaboration</h3>
          <p>Invite roles by forest and tree with audit-friendly controls.</p>
        </div>
      </section>

      <section id="roles" className="roles">
        <h2>Role hierarchy</h2>
        <div className="role-list">
          {roles.map((role) => (
            <div key={role} className="role-chip">
              {role}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
