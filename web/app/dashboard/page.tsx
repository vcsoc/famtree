"use client";

import { useMemo, useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";

type MetricData = {
  date: string;
  forests: number;
  trees: number;
  people: number;
  images: number;
};

type TreeStats = {
  id: string;
  name: string;
  people: number;
  males: number;
  females: number;
  relationships: number;
  images: number;
  diskSpaceBytes: number;
  diskSpaceMB: string;
};

type ForestStats = {
  id: string;
  name: string;
  trees: TreeStats[];
  summary: {
    totalTrees: number;
    totalPeople: number;
    totalMales: number;
    totalFemales: number;
    totalRelationships: number;
    totalImages: number;
    totalDiskSpaceBytes: number;
    totalDiskSpaceMB: string;
    largestTree: { name: string; people: number } | null;
    smallestTree: { name: string; people: number } | null;
  };
};

type Statistics = {
  forests: ForestStats[];
  totals: {
    forests: number;
    trees: number;
    people: number;
    males: number;
    females: number;
    relationships: number;
    images: number;
    diskSpaceBytes: number;
    diskSpaceMB: string;
  };
};

export default function DashboardPage() {
  const apiBase = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4001",
    []
  );
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("famtree_token");
      if (!token) {
        window.location.href = "/";
        return;
      }

      const [metricsRes, statsRes] = await Promise.all([
        fetch(`${apiBase}/api/metrics`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${apiBase}/api/statistics`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (!metricsRes.ok || !statsRes.ok) {
        throw new Error("Failed to load dashboard data");
      }

      const metricsData = await metricsRes.json();
      const statsData = await statsRes.json();

      setMetrics(metricsData.metrics || []);
      setStatistics(statsData.statistics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <section className="panel">
          <h2>Dashboard</h2>
          <p className="muted">Loading metrics...</p>
        </section>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingBottom: "48px" }}>
      <section className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2>Dashboard</h2>
            <p className="muted">Telemetry, metrics, and statistics for your family trees.</p>
          </div>
          <div className="actions">
            <a className="primary" href="/forests">
              My Forests
            </a>
            <button className="secondary" onClick={() => {
              localStorage.removeItem("famtree_token");
              window.location.href = "/";
            }}>
              Sign out
            </button>
          </div>
        </div>
        {error && <p className="muted" style={{ color: "#ef4444" }}>{error}</p>}
      </section>

      {/* Overview Stats */}
      {statistics && (
        <section className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "32px" }}>
          <div className="panel" style={{ textAlign: "center" }}>
            <h3 style={{ fontSize: "32px", color: "#8b5cf6" }}>{statistics.totals.forests}</h3>
            <p className="muted">Forests</p>
          </div>
          <div className="panel" style={{ textAlign: "center" }}>
            <h3 style={{ fontSize: "32px", color: "#22d3ee" }}>{statistics.totals.trees}</h3>
            <p className="muted">Trees</p>
          </div>
          <div className="panel" style={{ textAlign: "center" }}>
            <h3 style={{ fontSize: "32px", color: "#10b981" }}>{statistics.totals.people}</h3>
            <p className="muted">People</p>
          </div>
          <div className="panel" style={{ textAlign: "center" }}>
            <h3 style={{ fontSize: "32px", color: "#f59e0b" }}>{statistics.totals.relationships}</h3>
            <p className="muted">Relationships</p>
          </div>
          <div className="panel" style={{ textAlign: "center" }}>
            <h3 style={{ fontSize: "32px", color: "#ec4899" }}>{statistics.totals.images}</h3>
            <p className="muted">Images</p>
          </div>
          <div className="panel" style={{ textAlign: "center" }}>
            <h3 style={{ fontSize: "32px", color: "#6366f1" }}>{statistics.totals.diskSpaceMB} MB</h3>
            <p className="muted">Disk Space</p>
          </div>
        </section>
      )}

      {/* Metrics Charts */}
      <section className="panel" style={{ marginBottom: "32px" }}>
        <h3>Growth Metrics (Last 30 Days)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={metrics}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="date" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip 
              contentStyle={{ background: "#0b1220", border: "1px solid #1f2937", borderRadius: "8px" }}
              labelStyle={{ color: "#f8fafc" }}
            />
            <Legend />
            <Line type="monotone" dataKey="people" stroke="#10b981" name="People" strokeWidth={2} />
            <Line type="monotone" dataKey="trees" stroke="#22d3ee" name="Trees" strokeWidth={2} />
            <Line type="monotone" dataKey="images" stroke="#ec4899" name="Images" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* Gender Distribution */}
      {statistics && statistics.totals.people > 0 && (
        <section className="panel" style={{ marginBottom: "32px" }}>
          <h3>Gender Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={[
              { name: "Males", value: statistics.totals.males },
              { name: "Females", value: statistics.totals.females },
              { name: "Other", value: statistics.totals.people - statistics.totals.males - statistics.totals.females }
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip 
                contentStyle={{ background: "#0b1220", border: "1px solid #1f2937", borderRadius: "8px" }}
                labelStyle={{ color: "#f8fafc" }}
              />
              <Bar dataKey="value" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* Forest Statistics */}
      {statistics && statistics.forests.map((forest) => (
        <section key={forest.id} className="panel" style={{ marginBottom: "32px" }}>
          <h3>{forest.name}</h3>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", marginBottom: "16px" }}>
            <div style={{ padding: "12px", background: "#0f172a", borderRadius: "8px" }}>
              <p className="muted" style={{ fontSize: "12px" }}>Trees</p>
              <p style={{ fontSize: "20px", fontWeight: "600" }}>{forest.summary.totalTrees}</p>
            </div>
            <div style={{ padding: "12px", background: "#0f172a", borderRadius: "8px" }}>
              <p className="muted" style={{ fontSize: "12px" }}>People</p>
              <p style={{ fontSize: "20px", fontWeight: "600" }}>{forest.summary.totalPeople}</p>
            </div>
            <div style={{ padding: "12px", background: "#0f172a", borderRadius: "8px" }}>
              <p className="muted" style={{ fontSize: "12px" }}>Males</p>
              <p style={{ fontSize: "20px", fontWeight: "600", color: "#22d3ee" }}>{forest.summary.totalMales}</p>
            </div>
            <div style={{ padding: "12px", background: "#0f172a", borderRadius: "8px" }}>
              <p className="muted" style={{ fontSize: "12px" }}>Females</p>
              <p style={{ fontSize: "20px", fontWeight: "600", color: "#ec4899" }}>{forest.summary.totalFemales}</p>
            </div>
            <div style={{ padding: "12px", background: "#0f172a", borderRadius: "8px" }}>
              <p className="muted" style={{ fontSize: "12px" }}>Images</p>
              <p style={{ fontSize: "20px", fontWeight: "600" }}>{forest.summary.totalImages}</p>
            </div>
            <div style={{ padding: "12px", background: "#0f172a", borderRadius: "8px" }}>
              <p className="muted" style={{ fontSize: "12px" }}>Disk Space</p>
              <p style={{ fontSize: "20px", fontWeight: "600" }}>{forest.summary.totalDiskSpaceMB} MB</p>
            </div>
          </div>
          
          {forest.summary.largestTree && (
            <div style={{ marginBottom: "12px" }}>
              <p className="muted" style={{ fontSize: "14px" }}>
                <span style={{ color: "#10b981" }}>Largest tree:</span> {forest.summary.largestTree.name} ({forest.summary.largestTree.people} people)
              </p>
            </div>
          )}
          
          {forest.summary.smallestTree && forest.summary.totalTrees > 1 && (
            <div style={{ marginBottom: "12px" }}>
              <p className="muted" style={{ fontSize: "14px" }}>
                <span style={{ color: "#f59e0b" }}>Smallest tree:</span> {forest.summary.smallestTree.name} ({forest.summary.smallestTree.people} people)
              </p>
            </div>
          )}

          {/* Individual Tree Stats */}
          {forest.trees.length > 0 && (
            <div>
              <h4 style={{ marginTop: "16px", marginBottom: "12px", fontSize: "16px" }}>Trees in this forest:</h4>
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "12px" }}>
                {forest.trees.map((tree) => (
                  <div key={tree.id} style={{ padding: "12px", background: "#0f172a", borderRadius: "8px", border: "1px solid #1f2937" }}>
                    <p style={{ fontWeight: "600", marginBottom: "8px" }}>{tree.name}</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", fontSize: "12px" }}>
                      <p className="muted">People: <span style={{ color: "#f8fafc" }}>{tree.people}</span></p>
                      <p className="muted">Males: <span style={{ color: "#22d3ee" }}>{tree.males}</span></p>
                      <p className="muted">Females: <span style={{ color: "#ec4899" }}>{tree.females}</span></p>
                      <p className="muted">Relations: <span style={{ color: "#f8fafc" }}>{tree.relationships}</span></p>
                      <p className="muted">Images: <span style={{ color: "#f8fafc" }}>{tree.images}</span></p>
                      <p className="muted">Size: <span style={{ color: "#f8fafc" }}>{tree.diskSpaceMB} MB</span></p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
