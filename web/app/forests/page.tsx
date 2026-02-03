"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useNotification } from "../components/NotificationProvider";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4001";

export default function ForestsPage() {
  const router = useRouter();
  const { showAlert } = useNotification();
  const [token, setToken] = useState("");
  const [forests, setForests] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editingForestId, setEditingForestId] = useState<string | null>(null);
  const [editingForestName, setEditingForestName] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("famtree_token");
    if (stored) {
      setToken(stored);
      loadForests(stored);
    }
  }, []);

  const loadForests = async (authToken: string) => {
    try {
      const res = await fetch(`${apiBase}/api/forests`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForests(data.forests || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  };

  const createForest = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Forest name is required");
      return;
    }
    try {
      const res = await fetch(`${apiBase}/api/forests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name, description })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setName("");
      setDescription("");
      loadForests(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    }
  };

  const updateForestName = async (forestId: string, newName: string) => {
    if (!newName.trim()) return;
    try {
      await fetch(`${apiBase}/api/forests/${forestId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: newName })
      });
      loadForests(token);
      setEditingForestId(null);
    } catch (err) {
      console.error(err);
      showAlert('Failed to update forest name', 'error');
    }
  };

  return (
    <div className="container">
      <section className="panel">
        <h2>My Forests</h2>
        <p className="muted">Create and manage your forest collections.</p>

        <div className="field">
          <label>Forest name</label>
          <input
            placeholder="Smith Family Collection"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Description</label>
          <input
            placeholder="Optional description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <button className="primary" onClick={createForest}>
          Create forest
        </button>
        {error && <p className="muted">{error}</p>}
      </section>

      <section className="grid">
        {forests.map((forest) => (
          <div
            key={forest.id}
            className="panel"
            style={{ position: 'relative' }}
          >
            {editingForestId === forest.id ? (
              <div style={{ marginBottom: '8px' }}>
                <input
                  type="text"
                  value={editingForestName}
                  onChange={(e) => setEditingForestName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      updateForestName(forest.id, editingForestName);
                    } else if (e.key === 'Escape') {
                      setEditingForestId(null);
                    }
                  }}
                  autoFocus
                  style={{ width: '100%', marginBottom: '4px' }}
                />
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="secondary" style={{ fontSize: '12px', padding: '4px 8px' }} onClick={() => updateForestName(forest.id, editingForestName)}>
                    Save
                  </button>
                  <button className="secondary" style={{ fontSize: '12px', padding: '4px 8px' }} onClick={() => setEditingForestId(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ margin: 0, cursor: 'pointer' }} onClick={() => router.push(`/forests/${forest.id}`)}>{forest.name}</h3>
                <button 
                  className="secondary" 
                  style={{ fontSize: '12px', padding: '4px 8px' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingForestId(forest.id);
                    setEditingForestName(forest.name);
                  }}
                >
                  Rename
                </button>
              </div>
            )}
            <p className="muted" style={{ cursor: 'pointer' }} onClick={() => router.push(`/forests/${forest.id}`)}>{forest.description || "No description"}</p>
          </div>
        ))}
        {forests.length === 0 && (
          <p className="muted">No forests yet. Create your first one above.</p>
        )}
      </section>
    </div>
  );
}
