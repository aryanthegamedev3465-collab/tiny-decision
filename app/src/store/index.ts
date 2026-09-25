import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type {
  Model,
  DecisionTemplate,
  DecisionRun,
  Question,
  DecisionState,
  Pipeline,
  BatchJob,
  CalibrationProfile,
  EvalSet,
  AppSettings,
  AppNotification,
  ServerConfig,
  ServerStatus,
  ObservabilitySnapshot,
  TeamMember,
  GitConfig,
  AuditLogEntry,
  PageId,
  DriftAlert,
  AlertRule,
} from "@/types";

// ── Slice types ────────────────────────────────────────────────────────────────

interface ModelsSlice {
  models: Model[];
  searchQuery: string;
  searchResults: Model[];
  isSearching: boolean;
  selectedModelId: string | null;
  // Actions
  fetchLocalModels: () => Promise<void>;
  searchHuggingFace: (query: string) => Promise<void>;
  setSearchQuery: (q: string) => void;
  selectModel: (id: string | null) => void;
  downloadModel: (modelId: string, quant: string) => Promise<void>;
  pauseDownload: (modelId: string) => Promise<void>;
  resumeDownload: (modelId: string) => Promise<void>;
  cancelDownload: (modelId: string) => Promise<void>;
  loadModel: (modelId: string) => Promise<void>;
  unloadModel: (modelId: string) => Promise<void>;
  probeCapabilities: (modelId: string) => Promise<void>;
  updateModelDownloadProgress: (modelId: string, progress: number, speedMbps: number, etaSecs: number) => void;
}

interface PlaygroundSlice {
  state: DecisionState;
  stateJson: string;
  stateJsonError: string | null;
  questions: Question[];
  lastRun: DecisionRun | null;
  isRunning: boolean;
  elapsedMs: number;
  tokenCount: number;
  selectedModelId: string | null;
  // Actions
  setStateJson: (json: string) => void;
  addQuestion: (q: Question) => void;
  removeQuestion: (id: string) => void;
  updateQuestion: (q: Question) => void;
  reorderQuestions: (from: number, to: number) => void;
  setSelectedModel: (id: string) => void;
  runDecision: () => Promise<void>;
  markLastRunWrong: () => Promise<void>;
  clearRun: () => void;
  setElapsedMs: (ms: number) => void;
}

interface BatchSlice {
  jobs: BatchJob[];
  activeJobId: string | null;
  // Actions
  createJob: (job: Omit<BatchJob, "id" | "processedRows" | "status">) => Promise<void>;
  startJob: (jobId: string) => Promise<void>;
  cancelJob: (jobId: string) => Promise<void>;
  deleteJob: (jobId: string) => void;
  rerunJob: (jobId: string) => Promise<void>;
  exportResults: (jobId: string, format: "csv" | "jsonl") => Promise<void>;
  updateJobProgress: (jobId: string, processed: number, rowsPerSec: number) => void;
  setActiveJob: (jobId: string | null) => void;
}

interface PipelinesSlice {
  pipelines: Pipeline[];
  activePipelineId: string | null;
  // Actions
  fetchPipelines: () => Promise<void>;
  createPipeline: (name: string, description: string) => Promise<void>;
  savePipeline: (pipeline: Pipeline) => Promise<void>;
  deletePipeline: (id: string) => Promise<void>;
  setActivePipeline: (id: string | null) => void;
  exportPipelineAsCode: (id: string, lang: "python" | "node") => Promise<string>;
  promotePipeline: (id: string) => Promise<void>;
}

interface CalibrationSlice {
  profiles: CalibrationProfile[];
  evalSets: EvalSet[];
  selectedProfileId: string | null;
  isFitting: boolean;
  // Actions
  fetchProfiles: () => Promise<void>;
  fitCalibration: (modelId: string, evalSetId: string, method: string) => Promise<void>;
  selectProfile: (id: string | null) => void;
  fetchEvalSets: () => Promise<void>;
  createEvalSet: (name: string, description: string) => Promise<void>;
  generateAdversarialProbes: (templateId: string, count: number) => Promise<void>;
}

interface ServerSlice {
  status: ServerStatus;
  config: ServerConfig;
  uptime: number;
  // Actions
  startServer: () => Promise<void>;
  stopServer: () => Promise<void>;
  updateConfig: (config: Partial<ServerConfig>) => Promise<void>;
  fetchStatus: () => Promise<void>;
  exportMcpManifest: (templateId: string) => Promise<string>;
  getCodeSnippet: (lang: "python" | "node" | "curl") => string;
}

interface ObservabilitySlice {
  snapshot: ObservabilitySnapshot | null;
  alertRules: AlertRule[];
  isLive: boolean;
  // Actions
  fetchSnapshot: () => Promise<void>;
  toggleLive: () => void;
  fetchAlertRules: () => Promise<void>;
  saveAlertRule: (rule: AlertRule) => Promise<void>;
  deleteAlertRule: (id: string) => Promise<void>;
  acknowledgeDriftAlert: (alertId: string) => Promise<void>;
  resolveDriftAlert: (alertId: string) => Promise<void>;
}

interface HistorySlice {
  runs: DecisionRun[];
  totalCount: number;
  page: number;
  pageSize: number;
  filterQuery: string;
  selectedRunId: string | null;
  // Actions
  fetchRuns: (page?: number) => Promise<void>;
  setFilterQuery: (q: string) => void;
  selectRun: (id: string | null) => void;
  rerunDecision: (runId: string) => Promise<void>;
  deleteRun: (runId: string) => Promise<void>;
}

interface TeamSlice {
  members: TeamMember[];
  gitConfig: GitConfig | null;
  auditLog: AuditLogEntry[];
  // Actions
  fetchMembers: () => Promise<void>;
  inviteMember: (email: string, role: string) => Promise<void>;
  updateMemberRole: (memberId: string, role: string) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  fetchGitConfig: () => Promise<void>;
  saveGitConfig: (config: GitConfig) => Promise<void>;
  fetchAuditLog: () => Promise<void>;
}

interface SettingsSlice {
  settings: AppSettings;
  isSaving: boolean;
  // Actions
  fetchSettings: () => Promise<void>;
  saveSettings: (settings: Partial<AppSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
}

interface UISlice {
  activePage: PageId;
  notifications: AppNotification[];
  sidebarCollapsed: boolean;
  // Actions
  setActivePage: (page: PageId) => void;
  pushNotification: (n: Omit<AppNotification, "id" | "createdAt">) => void;
  dismissNotification: (id: string) => void;
  toggleSidebar: () => void;
}

// ── Combined store type ────────────────────────────────────────────────────────

export type AppStore = ModelsSlice &
  PlaygroundSlice &
  BatchSlice &
  PipelinesSlice &
  CalibrationSlice &
  ServerSlice &
  ObservabilitySlice &
  HistorySlice &
  TeamSlice &
  SettingsSlice &
  UISlice;

// ── Helpers ────────────────────────────────────────────────────────────────────

let notificationCounter = 0;
function makeNotification(n: Omit<AppNotification, "id" | "createdAt">): AppNotification {
  return {
    ...n,
    id: String(++notificationCounter),
    createdAt: new Date().toISOString(),
  };
}

// ── Store implementation ───────────────────────────────────────────────────────

export const useStore = create<AppStore>()((set, get) => ({
  // ─── Models ────────────────────────────────────────────────────────────────
  models: [],
  searchQuery: "",
  searchResults: [],
  isSearching: false,
  selectedModelId: null,

  fetchLocalModels: async () => {
    try {
      const models = await invoke<Model[]>("list_local_models");
      set({ models });
    } catch (e) {
      get().pushNotification({ type: "error", title: "Failed to fetch models", message: String(e), autoDismiss: true, dismissAfterMs: 5000 });
    }
  },

  searchHuggingFace: async (query: string) => {
    set({ isSearching: true, searchQuery: query });
    try {
      const results = await invoke<Model[]>("search_huggingface", { query });
      set({ searchResults: results });
    } catch (e) {
      get().pushNotification({ type: "error", title: "HF search failed", message: String(e), autoDismiss: true, dismissAfterMs: 5000 });
    } finally {
      set({ isSearching: false });
    }
  },

  setSearchQuery: (q) => set({ searchQuery: q }),

  selectModel: (id) => set({ selectedModelId: id }),

  downloadModel: async (modelId, quant) => {
    try {
      await invoke("download_model", { modelId, quant });
      get().pushNotification({ type: "info", title: "Download started", message: `Downloading ${modelId} (${quant})`, autoDismiss: true, dismissAfterMs: 3000 });
    } catch (e) {
      get().pushNotification({ type: "error", title: "Download failed", message: String(e), autoDismiss: true, dismissAfterMs: 6000 });
    }
  },

  pauseDownload: async (modelId) => {
    await invoke("pause_download", { modelId });
    set((s) => ({
      models: s.models.map((m) => m.id === modelId ? { ...m, downloadStatus: "paused" } : m),
    }));
  },

  resumeDownload: async (modelId) => {
    await invoke("resume_download", { modelId });
    set((s) => ({
      models: s.models.map((m) => m.id === modelId ? { ...m, downloadStatus: "downloading" } : m),
    }));
  },

  cancelDownload: async (modelId) => {
    await invoke("cancel_download", { modelId });
    set((s) => ({
      models: s.models.map((m) => m.id === modelId ? { ...m, downloadStatus: "idle", downloadProgress: 0 } : m),
    }));
  },

  loadModel: async (modelId) => {
    try {
      await invoke("load_model", { modelId });
      set((s) => ({
        models: s.models.map((m) => m.id === modelId ? { ...m, loaded: true } : m),
      }));
      get().pushNotification({ type: "success", title: "Model loaded", message: modelId, autoDismiss: true, dismissAfterMs: 3000 });
    } catch (e) {
      get().pushNotification({ type: "error", title: "Load failed", message: String(e), autoDismiss: true, dismissAfterMs: 5000 });
    }
  },

  unloadModel: async (modelId) => {
    await invoke("unload_model", { modelId });
    set((s) => ({
      models: s.models.map((m) => m.id === modelId ? { ...m, loaded: false, ramUsedGb: undefined } : m),
    }));
  },

  probeCapabilities: async (modelId) => {
    try {
      const caps = await invoke<Model["capabilities"]>("probe_capabilities", { modelId });
      set((s) => ({
        models: s.models.map((m) => m.id === modelId ? { ...m, capabilities: caps } : m),
      }));
    } catch (e) {
      get().pushNotification({ type: "error", title: "Probe failed", message: String(e), autoDismiss: true, dismissAfterMs: 5000 });
    }
  },

  updateModelDownloadProgress: (modelId, progress, speedMbps, etaSecs) => {
    set((s) => ({
      models: s.models.map((m) =>
        m.id === modelId
          ? { ...m, downloadStatus: "downloading", downloadProgress: progress, downloadSpeedMbps: speedMbps, downloadEtaSecs: etaSecs }
          : m
      ),
    }));
  },

  // ─── Playground ────────────────────────────────────────────────────────────
  state: {},
  stateJson: "{}",
  stateJsonError: null,
  questions: [],
  lastRun: null,
  isRunning: false,
  elapsedMs: 0,
  tokenCount: 0,

  setStateJson: (json) => {
    try {
      const parsed = JSON.parse(json) as DecisionState;
      const tokens = Math.ceil(json.length / 4);
      set({ stateJson: json, state: parsed, stateJsonError: null, tokenCount: tokens });
    } catch {
      set({ stateJson: json, stateJsonError: "Invalid JSON" });
    }
  },

  addQuestion: (q) => set((s) => ({ questions: [...s.questions, q] })),
  removeQuestion: (id) => set((s) => ({ questions: s.questions.filter((q) => q.id !== id) })),
  updateQuestion: (q) => set((s) => ({ questions: s.questions.map((existing) => existing.id === q.id ? q : existing) })),
  reorderQuestions: (from, to) => {
    set((s) => {
      const qs = [...s.questions];
      const [item] = qs.splice(from, 1);
      qs.splice(to, 0, item);
      return { questions: qs };
    });
  },
  setSelectedModel: (id) => set({ selectedModelId: id }),

  runDecision: async () => {
    const { state, questions, selectedModelId } = get();
    if (!selectedModelId) return;
    set({ isRunning: true, elapsedMs: 0 });
    try {
      const run = await invoke<DecisionRun>("run_decision", {
        modelId: selectedModelId,
        state,
        questions,
      });
      set({ lastRun: run, isRunning: false });
    } catch (e) {
      set({ isRunning: false });
      get().pushNotification({ type: "error", title: "Decision failed", message: String(e), autoDismiss: true, dismissAfterMs: 5000 });
    }
  },

  markLastRunWrong: async () => {
    const { lastRun } = get();
    if (!lastRun) return;
    await invoke("mark_run_wrong", { runId: lastRun.id });
    set((s) => ({
      lastRun: s.lastRun ? { ...s.lastRun, markedWrong: true } : null,
    }));
  },

  clearRun: () => set({ lastRun: null }),
  setElapsedMs: (ms) => set({ elapsedMs: ms }),

  // ─── Batch ─────────────────────────────────────────────────────────────────
  jobs: [],
  activeJobId: null,

  createJob: async (jobData) => {
    const job = await invoke<BatchJob>("create_batch_job", { jobData });
    set((s) => ({ jobs: [...s.jobs, job] }));
  },

  startJob: async (jobId) => {
    await invoke("start_batch_job", { jobId });
    set((s) => ({
      jobs: s.jobs.map((j) => j.id === jobId ? { ...j, status: "running" } : j),
      activeJobId: jobId,
    }));
  },

  cancelJob: async (jobId) => {
    await invoke("cancel_batch_job", { jobId });
    set((s) => ({
      jobs: s.jobs.map((j) => j.id === jobId ? { ...j, status: "cancelled" } : j),
    }));
  },

  deleteJob: (jobId) => set((s) => ({ jobs: s.jobs.filter((j) => j.id !== jobId) })),

  rerunJob: async (jobId) => {
    const original = get().jobs.find((j) => j.id === jobId);
    if (!original) return;
    await get().createJob({ ...original });
  },

  exportResults: async (jobId, format) => {
    await invoke("export_batch_results", { jobId, format });
    get().pushNotification({ type: "success", title: "Export complete", message: `Results exported as ${format.toUpperCase()}`, autoDismiss: true, dismissAfterMs: 3000 });
  },

  updateJobProgress: (jobId, processed, rowsPerSec) => {
    set((s) => ({
      jobs: s.jobs.map((j) => j.id === jobId ? { ...j, processedRows: processed, rowsPerSec } : j),
    }));
  },

  setActiveJob: (jobId) => set({ activeJobId: jobId }),

  // ─── Pipelines ─────────────────────────────────────────────────────────────
  pipelines: [],
  activePipelineId: null,

  fetchPipelines: async () => {
    const pipelines = await invoke<Pipeline[]>("list_pipelines");
    set({ pipelines });
  },

  createPipeline: async (name, description) => {
    const pipeline = await invoke<Pipeline>("create_pipeline", { name, description });
    set((s) => ({ pipelines: [...s.pipelines, pipeline], activePipelineId: pipeline.id }));
  },

  savePipeline: async (pipeline) => {
    await invoke("save_pipeline", { pipeline });
    set((s) => ({
      pipelines: s.pipelines.map((p) => p.id === pipeline.id ? pipeline : p),
    }));
    get().pushNotification({ type: "success", title: "Pipeline saved", message: pipeline.name, autoDismiss: true, dismissAfterMs: 2000 });
  },

  deletePipeline: async (id) => {
    await invoke("delete_pipeline", { id });
    set((s) => ({
      pipelines: s.pipelines.filter((p) => p.id !== id),
      activePipelineId: s.activePipelineId === id ? null : s.activePipelineId,
    }));
  },

  setActivePipeline: (id) => set({ activePipelineId: id }),

  exportPipelineAsCode: async (id, lang) => {
    return await invoke<string>("export_pipeline_code", { id, lang });
  },

  promotePipeline: async (id) => {
    await invoke("promote_pipeline", { id });
    set((s) => ({
      pipelines: s.pipelines.map((p) => p.id === id ? { ...p, status: "review" } : p),
    }));
  },

  // ─── Calibration ───────────────────────────────────────────────────────────
  profiles: [],
  evalSets: [],
  selectedProfileId: null,
  isFitting: false,

  fetchProfiles: async () => {
    const profiles = await invoke<CalibrationProfile[]>("list_calibration_profiles");
    set({ profiles });
  },

  fitCalibration: async (modelId, evalSetId, method) => {
    set({ isFitting: true });
    try {
      const profile = await invoke<CalibrationProfile>("fit_calibration", { modelId, evalSetId, method });
      set((s) => ({ profiles: [...s.profiles, profile], selectedProfileId: profile.id }));
      get().pushNotification({ type: "success", title: "Calibration fit", message: `ECE: ${profile.ece.toFixed(4)}`, autoDismiss: true, dismissAfterMs: 4000 });
    } catch (e) {
      get().pushNotification({ type: "error", title: "Calibration failed", message: String(e), autoDismiss: true, dismissAfterMs: 5000 });
    } finally {
      set({ isFitting: false });
    }
  },

  selectProfile: (id) => set({ selectedProfileId: id }),

  fetchEvalSets: async () => {
    const evalSets = await invoke<EvalSet[]>("list_eval_sets");
    set({ evalSets });
  },

  createEvalSet: async (name, description) => {
    const evalSet = await invoke<EvalSet>("create_eval_set", { name, description });
    set((s) => ({ evalSets: [...s.evalSets, evalSet] }));
  },

  generateAdversarialProbes: async (templateId, count) => {
    await invoke("generate_adversarial_probes", { templateId, count });
    get().pushNotification({ type: "success", title: "Probes generated", message: `${count} adversarial probes created`, autoDismiss: true, dismissAfterMs: 3000 });
  },

  // ─── Server ────────────────────────────────────────────────────────────────
  status: "stopped",
  config: {
    port: 3000,
    host: "127.0.0.1",
    tlsEnabled: false,
    corsOrigins: ["*"],
  },
  uptime: 0,

  startServer: async () => {
    set({ status: "starting" });
    try {
      await invoke("start_server", { config: get().config });
      set({ status: "running" });
    } catch (e) {
      set({ status: "error" });
      get().pushNotification({ type: "error", title: "Server failed to start", message: String(e), autoDismiss: true, dismissAfterMs: 6000 });
    }
  },

  stopServer: async () => {
    await invoke("stop_server");
    set({ status: "stopped", uptime: 0 });
  },

  updateConfig: async (config) => {
    set((s) => ({ config: { ...s.config, ...config } }));
    await invoke("update_server_config", { config });
  },

  fetchStatus: async () => {
    const { status, uptime } = await invoke<{ status: ServerStatus; uptime: number }>("get_server_status");
    set({ status, uptime });
  },

  exportMcpManifest: async (templateId) => {
    return await invoke<string>("export_mcp_manifest", { templateId });
  },

  getCodeSnippet: (lang) => {
    const { config } = get();
    const base = `http://${config.host}:${config.port}`;
    if (lang === "python") {
      return `import requests\n\nresponse = requests.post(\n  "${base}/decide",\n  headers={"Authorization": "Bearer YOUR_TOKEN"},\n  json={\n    "model_id": "your-model",\n    "state": {"text": "Is this spam?"},\n    "questions": [{"type": "Noul", "id": "q1", "text": "Is this message spam?"}]\n  }\n)\nprint(response.json())`;
    }
    if (lang === "node") {
      return `const response = await fetch("${base}/decide", {\n  method: "POST",\n  headers: {\n    "Content-Type": "application/json",\n    "Authorization": "Bearer YOUR_TOKEN"\n  },\n  body: JSON.stringify({\n    model_id: "your-model",\n    state: { text: "Is this spam?" },\n    questions: [{ type: "Noul", id: "q1", text: "Is this message spam?" }]\n  })\n});\nconst data = await response.json();\nconsole.log(data);`;
    }
    return `curl -X POST "${base}/decide" \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer YOUR_TOKEN" \\\n  -d '{"model_id":"your-model","state":{"text":"Is this spam?"},"questions":[{"type":"Noul","id":"q1","text":"Is this message spam?"}]}'`;
  },

  // ─── Observability ─────────────────────────────────────────────────────────
  snapshot: null,
  alertRules: [],
  isLive: false,

  fetchSnapshot: async () => {
    const snapshot = await invoke<ObservabilitySnapshot>("get_observability_snapshot");
    set({ snapshot });
  },

  toggleLive: () => set((s) => ({ isLive: !s.isLive })),

  fetchAlertRules: async () => {
    const rules = await invoke<AlertRule[]>("list_alert_rules");
    set({ alertRules: rules });
  },

  saveAlertRule: async (rule) => {
    await invoke("save_alert_rule", { rule });
    set((s) => ({
      alertRules: s.alertRules.find((r) => r.id === rule.id)
        ? s.alertRules.map((r) => r.id === rule.id ? rule : r)
        : [...s.alertRules, rule],
    }));
  },

  deleteAlertRule: async (id) => {
    await invoke("delete_alert_rule", { id });
    set((s) => ({ alertRules: s.alertRules.filter((r) => r.id !== id) }));
  },

  acknowledgeDriftAlert: async (alertId) => {
    await invoke("acknowledge_drift_alert", { alertId });
    set((s) => ({
      snapshot: s.snapshot
        ? {
            ...s.snapshot,
            driftAlerts: s.snapshot.driftAlerts.map((a: DriftAlert) =>
              a.id === alertId ? { ...a, status: "acknowledged", acknowledgedAt: new Date().toISOString() } : a
            ),
          }
        : null,
    }));
  },

  resolveDriftAlert: async (alertId) => {
    await invoke("resolve_drift_alert", { alertId });
    set((s) => ({
      snapshot: s.snapshot
        ? {
            ...s.snapshot,
            driftAlerts: s.snapshot.driftAlerts.map((a: DriftAlert) =>
              a.id === alertId ? { ...a, status: "resolved", resolvedAt: new Date().toISOString() } : a
            ),
          }
        : null,
    }));
  },

  // ─── History ───────────────────────────────────────────────────────────────
  runs: [],
  totalCount: 0,
  page: 0,
  pageSize: 50,
  filterQuery: "",
  selectedRunId: null,

  fetchRuns: async (page = 0) => {
    const { pageSize, filterQuery } = get();
    const { runs, total } = await invoke<{ runs: DecisionRun[]; total: number }>("list_runs", {
      page,
      pageSize,
      query: filterQuery,
    });
    set({ runs, totalCount: total, page });
  },

  setFilterQuery: (q) => set({ filterQuery: q }),
  selectRun: (id) => set({ selectedRunId: id }),

  rerunDecision: async (runId) => {
    const run = get().runs.find((r) => r.id === runId);
    if (!run) return;
    set({ state: run.state, stateJson: JSON.stringify(run.state, null, 2), questions: run.questions, selectedModelId: run.modelId });
    get().setActivePage("playground");
  },

  deleteRun: async (runId) => {
    await invoke("delete_run", { runId });
    set((s) => ({ runs: s.runs.filter((r) => r.id !== runId) }));
  },

  // ─── Team ──────────────────────────────────────────────────────────────────
  members: [],
  gitConfig: null,
  auditLog: [],

  fetchMembers: async () => {
    const members = await invoke<TeamMember[]>("list_team_members");
    set({ members });
  },

  inviteMember: async (email, role) => {
    await invoke("invite_member", { email, role });
    await get().fetchMembers();
  },

  updateMemberRole: async (memberId, role) => {
    await invoke("update_member_role", { memberId, role });
    set((s) => ({
      members: s.members.map((m) => m.id === memberId ? { ...m, role: role as TeamMember["role"] } : m),
    }));
  },

  removeMember: async (memberId) => {
    await invoke("remove_member", { memberId });
    set((s) => ({ members: s.members.filter((m) => m.id !== memberId) }));
  },

  fetchGitConfig: async () => {
    const gitConfig = await invoke<GitConfig>("get_git_config");
    set({ gitConfig });
  },

  saveGitConfig: async (config) => {
    await invoke("save_git_config", { config });
    set({ gitConfig: config });
  },

  fetchAuditLog: async () => {
    const auditLog = await invoke<AuditLogEntry[]>("get_audit_log");
    set({ auditLog });
  },

  // ─── Settings ──────────────────────────────────────────────────────────────
  settings: {
    modelDirectory: "",
    serverPort: 3000,
    serverHost: "127.0.0.1",
    theme: "dark",
    launchOnStartup: false,
    minimizeToTray: true,
    bandwidthThrottleMbps: undefined,
    notificationsEnabled: true,
    notifyOnDownloadComplete: true,
    notifyOnBatchComplete: true,
    notifyOnDriftAlert: true,
    logLevel: "info",
    firstLaunch: true,
  },
  isSaving: false,

  fetchSettings: async () => {
    const settings = await invoke<AppSettings>("get_settings");
    set({ settings });
  },

  saveSettings: async (partial) => {
    set({ isSaving: true });
    const merged = { ...get().settings, ...partial };
    await invoke("save_settings", { settings: merged });
    set({ settings: merged, isSaving: false });
    get().pushNotification({ type: "success", title: "Settings saved", message: "", autoDismiss: true, dismissAfterMs: 2000 });
  },

  resetSettings: async () => {
    const settings = await invoke<AppSettings>("reset_settings");
    set({ settings });
  },

  // ─── UI ────────────────────────────────────────────────────────────────────
  activePage: "models",
  notifications: [],
  sidebarCollapsed: false,

  setActivePage: (page) => set({ activePage: page }),

  pushNotification: (n) => {
    const notification = makeNotification(n);
    set((s) => ({ notifications: [...s.notifications, notification] }));
    if (n.autoDismiss && n.dismissAfterMs) {
      setTimeout(() => get().dismissNotification(notification.id), n.dismissAfterMs);
    }
  },

  dismissNotification: (id) => {
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) }));
  },

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));
