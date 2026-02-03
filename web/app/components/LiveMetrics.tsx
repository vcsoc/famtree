"use client";

import { useEffect, useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4001";

export function LiveMetrics() {
  const [activeUsers, setActiveUsers] = useState(0);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const token = localStorage.getItem("authToken");
        if (!token) return;

        const res = await fetch(`${apiBase}/api/active-users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          setActiveUsers(data.activeUsers || 0);
        }
      } catch (err) {
        console.error("Failed to fetch active users:", err);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="live-metrics">
      <div className="metric">
        <span className="metric-value">{activeUsers}</span>
        <span className="metric-label">Active Users</span>
      </div>
    </div>
  );
}
