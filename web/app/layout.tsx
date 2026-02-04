import "./globals.css";
import type { ReactNode } from "react";
import { NotificationProvider } from "./components/NotificationProvider";
import { UserMenu } from "./components/UserMenu";

export const metadata = {
  title: "FamTree",
  description: "Family Tree Manager"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NotificationProvider>
          <div className="app-shell">
            <header className="app-header">
              <div className="brand">FamTree</div>
              <nav className="nav">
                <a href="/">Home</a>
                <a href="/forests">My Forests</a>
                <a href="/ai-research">AI Research</a>
                <a href="/dashboard">Dashboard</a>
              </nav>
              <UserMenu />
              <div className="copyright">© 2026 FamTree</div>
            </header>
            <main className="app-main">{children}</main>
          </div>
        </NotificationProvider>
      </body>
    </html>
  );
}
