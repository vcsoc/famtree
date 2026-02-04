"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4001";

export function UserMenu() {
  const [userName, setUserName] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem("famtree_token");
        if (!token) return;

        const res = await fetch(`${apiBase}/api/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          setUserName(data.name || data.email);
        }
      } catch (err) {
        console.error("Failed to fetch user:", err);
      }
    };

    fetchUser();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("famtree_token");
    router.push("/login");
  };

  if (!userName) return null;

  return (
    <div className="user-menu">
      <button 
        className="user-menu-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        {userName}
        <span className="dropdown-arrow">▼</span>
      </button>
      {isOpen && (
        <div className="user-menu-dropdown">
          <a href="/profile" className="menu-item">Profile</a>
          <button onClick={handleLogout} className="menu-item logout">Logout</button>
        </div>
      )}
    </div>
  );
}
