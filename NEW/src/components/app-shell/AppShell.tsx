import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1600px] gap-4 p-4">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <TopBar />
        <main className="min-w-0 flex-1 pb-8">{children}</main>
      </div>
    </div>
  );
}
