"use client";

import { useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4001";

export default function AIResearchPage() {
  const [token, setToken] = useState("");
  const [provider, setProvider] = useState("openai");
  const [taskType, setTaskType] = useState("genealogy");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runResearch = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const stored = localStorage.getItem("famtree_token");
      const res = await fetch(`${apiBase}/api/ai/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${stored || token}`
        },
        body: JSON.stringify({ provider, taskType, task: prompt })
      });

      const data = await res.json();
      if (res.ok) {
        setResult(`Task ${data.id} queued. In production, this would integrate with ${provider} for real research.`);
      } else {
        setResult(`Error: ${data.error}`);
      }
    } catch (err) {
      setResult(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <section className="panel">
        <h2>AI-Powered Research Assistant</h2>
        <p className="muted">
          Connect to AI providers for genealogy research, record searching, and family history insights.
        </p>

        <div className="form-grid">
          <select value={provider} onChange={(e) => setProvider(e.target.value)}>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="google">Google AI</option>
            <option value="lmstudio">LM Studio (Local)</option>
            <option value="ollama">Ollama (Local)</option>
          </select>

          <select value={taskType} onChange={(e) => setTaskType(e.target.value)}>
            <option value="genealogy">Genealogy Research</option>
            <option value="records">Historical Records</option>
            <option value="dna">DNA Analysis</option>
            <option value="timeline">Timeline Generation</option>
            <option value="suggestions">Name Suggestions</option>
          </select>
        </div>

        <textarea
          placeholder="Describe your research task... e.g., 'Find census records for John Smith born 1850 in Ohio'"
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />

        <button className="primary" onClick={runResearch} disabled={loading}>
          {loading ? "Processing..." : "Start research"}
        </button>

        {result && (
          <div className="result-panel panel">
            <h4>Result</h4>
            <p>{result}</p>
          </div>
        )}
      </section>

      <section className="grid">
        <div className="panel">
          <h3>Record Search</h3>
          <p className="muted">Search historical census, birth, marriage, and death records.</p>
        </div>
        <div className="panel">
          <h3>DNA Insights</h3>
          <p className="muted">Analyze genetic connections and ethnic origins.</p>
        </div>
        <div className="panel">
          <h3>Smart Hints</h3>
          <p className="muted">Get AI suggestions for missing information and potential relatives.</p>
        </div>
      </section>
    </div>
  );
}
