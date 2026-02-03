"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useNotification } from "../../components/NotificationProvider";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4001";

export default function ForestDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { showAlert, showConfirm } = useNotification();
  const forestId = params?.id as string;

  const [token, setToken] = useState("");
  const [trees, setTrees] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [forestName, setForestName] = useState("");
  const [editingTreeId, setEditingTreeId] = useState<string | null>(null);
  const [editingTreeName, setEditingTreeName] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("famtree_token");
    if (stored) {
      setToken(stored);
      loadForest(stored);
      loadTrees(stored);
    }
  }, [forestId]);

  const loadForest = async (authToken: string) => {
    try {
      const res = await fetch(`${apiBase}/api/forests`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const forest = data.forests?.find((f: any) => f.id === forestId);
      if (forest) setForestName(forest.name || "");
    } catch (err) {
      console.error(err);
    }
  };

  const updateForestName = async () => {
    if (!forestName.trim()) return;
    try {
      await fetch(`${apiBase}/api/forests/${forestId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: forestName })
      });
    } catch (err) {
      console.error(err);
      showAlert('Failed to update forest name', 'error');
    }
  };

  const updateTreeName = async (treeId: string, newName: string) => {
    if (!newName.trim()) return;
    try {
      await fetch(`${apiBase}/api/trees/${treeId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: newName })
      });
      loadTrees(token);
      setEditingTreeId(null);
    } catch (err) {
      console.error(err);
      showAlert('Failed to update tree name', 'error');
    }
  };

  const deleteTree = async (treeId: string) => {
    const confirmed = await showConfirm(
      'Are you sure you want to delete this tree? This will permanently delete all people, relationships, and images in this tree.',
      'Delete Tree'
    );
    
    if (!confirmed) return;

    try {
      const res = await fetch(`${apiBase}/api/trees/${treeId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        showAlert('Tree deleted successfully', 'success');
        loadTrees(token);
      } else {
        showAlert('Failed to delete tree', 'error');
      }
    } catch (err) {
      console.error(err);
      showAlert('Failed to delete tree', 'error');
    }
  };

  const loadTrees = async (authToken: string) => {
    try {
      const res = await fetch(`${apiBase}/api/trees?forestId=${forestId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTrees(data.trees || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  };

  const createTree = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Tree name is required");
      return;
    }
    try {
      const res = await fetch(`${apiBase}/api/trees`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ forestId, name, description })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setName("");
      setDescription("");
      loadTrees(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    }
  };

  const exportForest = async () => {
    try {
      const res = await fetch(`${apiBase}/api/forests/${forestId}/export?includeImages=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      
      // Convert to YAML - simple version, can be enhanced
      const yaml = JSON.stringify(data, null, 2);
      
      const blob = new Blob([yaml], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `forest-${forestName || forestId}-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      showAlert('Failed to export forest', 'error');
    }
  };

  const importForest = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.yaml,.yml';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        // Add datetime suffix to forest name
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        data.forest.name = `${data.forest.name} (${timestamp})`;
        
        const res = await fetch(`${apiBase}/api/forests/import`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ forestData: data })
        });
        
        if (res.ok) {
          const result = await res.json();
          showAlert('Forest imported successfully!', 'success');
          router.push(`/forests/${result.id}`);
        } else {
          showAlert('Failed to import forest', 'error');
        }
      } catch (err) {
        console.error(err);
        showAlert('Failed to import forest', 'error');
      }
    };
    input.click();
  };

  return (
    <div className="container">
      <section className="panel">
        <h2>Forest Settings</h2>
        <div className="field">
          <label>Forest Name</label>
          <input
            placeholder="Forest name"
            value={forestName}
            onChange={(e) => setForestName(e.target.value)}
            onBlur={updateForestName}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button className="secondary" onClick={exportForest}>
            ↓ Export Forest
          </button>
          <button className="secondary" onClick={importForest}>
            ↑ Import Forest
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Trees in this Forest</h2>
        <p className="muted">Manage family trees within this collection.</p>

        <div className="field">
          <label>Tree name</label>
          <input
            placeholder="Johnson Family Tree"
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
        <button className="primary" onClick={createTree}>
          Create tree
        </button>
        {error && <p className="muted">{error}</p>}
      </section>

      <section className="grid">
        {trees.map((tree) => (
          <div
            key={tree.id}
            className="panel"
            style={{ position: 'relative', display: 'flex', flexDirection: 'column', minHeight: '150px' }}
          >
            {editingTreeId === tree.id ? (
              <div style={{ marginBottom: '8px', flex: 1 }}>
                <input
                  type="text"
                  value={editingTreeName}
                  onChange={(e) => setEditingTreeName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      updateTreeName(tree.id, editingTreeName);
                    } else if (e.key === 'Escape') {
                      setEditingTreeId(null);
                    }
                  }}
                  autoFocus
                  style={{ width: '100%', marginBottom: '4px' }}
                />
                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', marginTop: 'auto' }}>
                  <button className="secondary" style={{ fontSize: '12px', padding: '4px 8px' }} onClick={() => updateTreeName(tree.id, editingTreeName)}>
                    Save
                  </button>
                  <button className="secondary" style={{ fontSize: '12px', padding: '4px 8px' }} onClick={() => setEditingTreeId(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => router.push(`/trees/${tree.id}`)}>
                  <h3 style={{ margin: 0, marginBottom: '8px' }}>{tree.name}</h3>
                  <p className="muted" style={{ margin: 0 }}>{tree.description || "No description"}</p>
                </div>
                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <button 
                    className="secondary" 
                    style={{ fontSize: '12px', padding: '4px 8px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingTreeId(tree.id);
                      setEditingTreeName(tree.name);
                    }}
                  >
                    Rename
                  </button>
                  <button 
                    className="secondary" 
                    style={{ fontSize: '12px', padding: '4px 8px', color: '#dc3545' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTree(tree.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {trees.length === 0 && (
          <p className="muted">No trees yet. Create your first one above.</p>
        )}
      </section>
    </div>
  );
}
