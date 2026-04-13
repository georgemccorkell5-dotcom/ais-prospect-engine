import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function Layout() {
  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      <Sidebar />
      <main className="flex-1 min-w-0 min-h-0 overflow-hidden bg-gray-950">
        <Outlet />
      </main>
    </div>
  );
}
