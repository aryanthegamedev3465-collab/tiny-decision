import React, { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TitleBar } from "@/components/layout/TitleBar";
import { NotificationToasts } from "@/components/layout/NotificationToasts";
import { useStore } from "@/store";
import { FirstLaunchDemo } from "@/components/settings/FirstLaunchDemo";

// Lazy page imports
const ModelsPage       = React.lazy(() => import("@/pages/ModelsPage").then(m => ({ default: m.ModelsPage })));
const PlaygroundPage   = React.lazy(() => import("@/pages/PlaygroundPage").then(m => ({ default: m.PlaygroundPage })));
const BatchPage        = React.lazy(() => import("@/pages/BatchPage").then(m => ({ default: m.BatchPage })));
const PipelinePage     = React.lazy(() => import("@/pages/PipelinePage").then(m => ({ default: m.PipelinePage })));
const CalibrationPage  = React.lazy(() => import("@/pages/CalibrationPage").then(m => ({ default: m.CalibrationPage })));
const MarketplacePage  = React.lazy(() => import("@/pages/MarketplacePage").then(m => ({ default: m.MarketplacePage })));
const ServerPage       = React.lazy(() => import("@/pages/ServerPage").then(m => ({ default: m.ServerPage })));
const ObservabilityPage= React.lazy(() => import("@/pages/ObservabilityPage").then(m => ({ default: m.ObservabilityPage })));
const HistoryPage      = React.lazy(() => import("@/pages/HistoryPage").then(m => ({ default: m.HistoryPage })));
const TeamPage         = React.lazy(() => import("@/pages/TeamPage").then(m => ({ default: m.TeamPage })));
const SettingsPage     = React.lazy(() => import("@/pages/SettingsPage").then(m => ({ default: m.SettingsPage })));

function PageLoader(): React.ReactElement {
  return (
    <div className="flex items-center justify-center flex-1 h-full">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        <p className="text-text-muted text-sm">Loading…</p>
      </div>
    </div>
  );
}

export default function App(): React.ReactElement {
  const activePage = useStore((s) => s.activePage);
  const settings = useStore((s) => s.settings);
  const fetchSettings = useStore((s) => s.fetchSettings);
  const fetchLocalModels = useStore((s) => s.fetchLocalModels);
  const [showDemo, setShowDemo] = useState(false);

  useEffect(() => {
    // Bootstrap application data
    fetchSettings().catch(() => { /* handled in store */ });
    fetchLocalModels().catch(() => { /* handled in store */ });
  }, [fetchSettings, fetchLocalModels]);

  useEffect(() => {
    if (settings.firstLaunch) {
      setShowDemo(true);
    }
  }, [settings.firstLaunch]);

  return (
    <div className="flex flex-col w-full h-full bg-bg-base">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden relative">
          <React.Suspense fallback={<PageLoader />}>
            {activePage === "models"        && <ModelsPage />}
            {activePage === "playground"    && <PlaygroundPage />}
            {activePage === "batch"         && <BatchPage />}
            {activePage === "pipelines"     && <PipelinePage />}
            {activePage === "calibration"   && <CalibrationPage />}
            {activePage === "marketplace"   && <MarketplacePage />}
            {activePage === "server"        && <ServerPage />}
            {activePage === "observability" && <ObservabilityPage />}
            {activePage === "history"       && <HistoryPage />}
            {activePage === "team"          && <TeamPage />}
            {activePage === "settings"      && <SettingsPage />}
          </React.Suspense>
        </main>
      </div>
      <NotificationToasts />
      {showDemo && <FirstLaunchDemo onClose={() => setShowDemo(false)} />}
    </div>
  );
}
