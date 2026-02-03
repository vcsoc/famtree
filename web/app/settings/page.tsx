"use client";

import { useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4001";

export default function SettingsPage() {
  const [theme, setTheme] = useState("modern");
  const [layout, setLayout] = useState("vertical");
  const [saved, setSaved] = useState(false);

  const saveSettings = () => {
    localStorage.setItem("famtree_theme", theme);
    localStorage.setItem("famtree_layout", layout);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="container">
      <section className="panel">
        <h2>Settings & Preferences</h2>
        
        <h3>Tree Visualization</h3>
        <div className="form-grid">
          <div className="field">
            <label>Theme</label>
            <select value={theme} onChange={(e) => setTheme(e.target.value)}>
              <option value="modern">Modern</option>
              <option value="vintage">Vintage</option>
              <option value="minimalist">Minimalist</option>
              <option value="classic">Classic</option>
            </select>
          </div>

          <div className="field">
            <label>Tree Layout</label>
            <select value={layout} onChange={(e) => setLayout(e.target.value)}>
              <option value="vertical">Vertical</option>
              <option value="horizontal">Horizontal</option>
              <option value="radial">Radial</option>
              <option value="freeform">Freeform</option>
            </select>
          </div>
        </div>

        <button className="primary" onClick={saveSettings}>
          Save settings
        </button>
        {saved && <p className="muted">Settings saved successfully!</p>}
      </section>

      <section className="panel">
        <h3>Account</h3>
        <p className="muted">Manage your account settings and preferences.</p>
        <div className="form-grid">
          <div className="field">
            <label>Display Name</label>
            <input placeholder="Your display name" />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" placeholder="your@email.com" disabled />
          </div>
        </div>
      </section>

      <section className="panel">
        <h3>Privacy & Security</h3>
        <p className="muted">Control who can view and edit your family trees.</p>
        <div className="field">
          <label>
            <input type="checkbox" /> Allow public viewing of my trees
          </label>
        </div>
        <div className="field">
          <label>
            <input type="checkbox" defaultChecked /> Require approval for collaboration requests
          </label>
        </div>
      </section>

      <section className="panel">
        <h3>Data Export</h3>
        <p className="muted">Export your family tree data in various formats.</p>
        <div className="actions">
          <button className="secondary">Export as PDF</button>
          <button className="secondary">Export as GEDCOM</button>
          <button className="secondary">Export as JSON</button>
        </div>
      </section>
    </div>
  );
}
