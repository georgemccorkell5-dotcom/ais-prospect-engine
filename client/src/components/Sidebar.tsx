import { NavLink } from "react-router-dom";
import MonarchLogo from "./MonarchLogo";

const PipelineIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>
);

const ChatIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
  </svg>
);

const SignalIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
  </svg>
);

const links = [
  { to: "/", label: "Pipeline", icon: <PipelineIcon /> },
  { to: "/signals", label: "Signal Intel", icon: <SignalIcon /> },
  { to: "/find", label: "Find Prospects", icon: <SearchIcon /> },
  { to: "/chat", label: "Chat", icon: <ChatIcon /> },
];

export default function Sidebar() {
  return (
    <aside className="w-56 border-r border-gray-700/30 flex flex-col shrink-0 relative overflow-hidden">
      <div className="absolute inset-0 bg-gray-950" />
      <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full blur-3xl" style={{ background: "rgba(59,130,246,0.2)" }} />
      <div className="absolute top-1/3 -right-16 w-56 h-56 rounded-full blur-3xl" style={{ background: "rgba(139,92,246,0.15)" }} />
      <div className="absolute -bottom-16 -left-10 w-64 h-64 rounded-full blur-3xl" style={{ background: "rgba(6,182,212,0.12)" }} />
      <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-cyan-400 to-purple-500" />

      <div className="relative z-10 flex flex-col h-full">
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <MonarchLogo size={32} />
            <div className="min-w-0">
              <h1 className="text-base font-bold text-white leading-tight truncate">AIS Prospects</h1>
              <p className="text-[10px] text-gray-400">Research & Outreach Engine</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1.5">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                  isActive
                    ? "bg-blue-500/20 text-blue-300 shadow-md shadow-blue-500/15 border border-blue-400/20"
                    : "text-gray-400 hover:text-white hover:bg-white/10"
                }`
              }
            >
              <span>{l.icon}</span>
              <span className="font-medium">{l.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-white/10 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            AIS Minnesota
          </div>
        </div>
      </div>
    </aside>
  );
}
