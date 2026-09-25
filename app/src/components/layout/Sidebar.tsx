import React from "react";
import { useStore } from "@/store";
import type { PageId } from "@/types";
import {
  Brain,
  FlaskConical,
  Layers,
  GitBranch,
  Activity,
  Store,
  Server,
  BarChart3,
  History,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface NavItem {
  id: PageId;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accentColor: string;
  glowClass: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "models",       label: "Models",            icon: Brain,        accentColor: "text-[#00f0ff]", glowClass: "hover:border-[#00f0ff]/40 hover:bg-[#00f0ff]/5" },
  { id: "playground",   label: "Playground",        icon: FlaskConical, accentColor: "text-[#00ff88]", glowClass: "hover:border-[#00ff88]/40 hover:bg-[#00ff88]/5" },
  { id: "batch",        label: "Batch Runner",      icon: Layers,       accentColor: "text-[#ffb703]", glowClass: "hover:border-[#ffb703]/40 hover:bg-[#ffb703]/5" },
  { id: "pipelines",    label: "Pipelines",         icon: GitBranch,    accentColor: "text-[#c77dff]", glowClass: "hover:border-[#c77dff]/40 hover:bg-[#c77dff]/5" },
  { id: "calibration",  label: "Calibration",       icon: Activity,     accentColor: "text-[#00ff88]", glowClass: "hover:border-[#00ff88]/40 hover:bg-[#00ff88]/5" },
  { id: "marketplace",  label: "Marketplace",       icon: Store,        accentColor: "text-[#ff007f]", glowClass: "hover:border-[#ff007f]/40 hover:bg-[#ff007f]/5" },
  { id: "server",       label: "Server & MCP",      icon: Server,       accentColor: "text-[#3a86ff]", glowClass: "hover:border-[#3a86ff]/40 hover:bg-[#3a86ff]/5" },
  { id: "observability",label: "Observability",     icon: BarChart3,    accentColor: "text-[#00f0ff]", glowClass: "hover:border-[#00f0ff]/40 hover:bg-[#00f0ff]/5" },
  { id: "history",      label: "History",           icon: History,      accentColor: "text-[#94a3b8]", glowClass: "hover:border-white/20 hover:bg-white/5" },
  { id: "team",         label: "Team",              icon: Users,        accentColor: "text-[#fb8500]", glowClass: "hover:border-[#fb8500]/40 hover:bg-[#fb8500]/5" },
  { id: "settings",     label: "Settings",          icon: Settings,     accentColor: "text-[#64748b]", glowClass: "hover:border-white/20 hover:bg-white/5" },
];

export function Sidebar(): React.ReactElement {
  const activePage = useStore((s) => s.activePage);
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed);
  const setActivePage = useStore((s) => s.setActivePage);
  const toggleSidebar = useStore((s) => s.toggleSidebar);

  return (
    <aside
      className={`
        relative flex flex-col h-full bg-[#08090d] border-r border-white/[0.06]
        transition-all duration-200 ease-in-out z-20 select-none
        ${sidebarCollapsed ? "w-14" : "w-52"}
      `}
    >
      {/* App Header in Sidebar */}
      <div className="flex items-center gap-3 px-3 py-3 border-b border-white/[0.06]">
        <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 border border-[#00ff88]/40 shadow-[0_0_12px_rgba(0,255,136,0.3)]">
          <img src="/icons/icon.png" alt="Tiny Decision Logo" className="w-full h-full object-cover" />
        </div>
        {!sidebarCollapsed && (
          <div className="flex flex-col overflow-hidden">
            <span className="font-extrabold text-xs tracking-wider gradient-text-cyan font-mono uppercase truncate">
              TINY DECISION
            </span>
            <span className="text-[10px] text-gray-500 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88]" />
              System One v1.0
            </span>
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 flex flex-col gap-1 p-2 overflow-y-auto overflow-x-hidden">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              title={sidebarCollapsed ? item.label : undefined}
              className={`
                group relative flex items-center gap-3 px-2.5 py-2 rounded-lg text-xs font-medium
                transition-all duration-150 border
                ${
                  isActive
                    ? "bg-white/[0.08] text-white border-white/[0.15] shadow-lg shadow-black/40"
                    : "text-gray-400 border-transparent hover:text-gray-200 " + item.glowClass
                }
              `}
            >
              {/* Active neon pill indicator on left edge */}
              {isActive && (
                <div className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-[#00ff88] shadow-[0_0_8px_rgba(0,255,136,0.8)]" />
              )}

              <Icon
                size={17}
                className={`flex-shrink-0 transition-transform group-hover:scale-110 ${
                  isActive ? item.accentColor : "text-gray-400 group-hover:" + item.accentColor
                }`}
              />

              {!sidebarCollapsed && (
                <span className="truncate tracking-wide">{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Collapse Toggle */}
      <div className="p-2 border-t border-white/[0.06] flex items-center justify-between">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-1.5 px-2 text-[11px] text-gray-500 font-mono">
            <Sparkles size={12} className="text-[#00f0ff]" />
            <span>Grok System One</span>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors ml-auto"
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </aside>
  );
}
