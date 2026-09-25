// ─────────────────────────────────────────────────────────────────────────────
// Tiny Decision – Shared TypeScript Types
// ─────────────────────────────────────────────────────────────────────────────

// ── Enumerations ──────────────────────────────────────────────────────────────

export type QuestionType = "Choice" | "Noul" | "Score";
export type ModelSource = "HuggingFace" | "Local" | "Hosted" | "Adapted";
export type QuantizationType = "f16" | "q8_0" | "q4_k_m" | "q4_0" | "q3_k_m" | "q2_k" | "gguf";
export type DownloadStatus = "idle" | "downloading" | "paused" | "complete" | "error";
export type ModelCapability = "classification" | "generation" | "embedding" | "reranking";
export type RecalibrationMethod = "none" | "temperature" | "platt" | "isotonic";
export type NodeType =
  | "Decision"
  | "Branch"
  | "ParallelFanout"
  | "FanIn"
  | "Loop"
  | "Ensemble"
  | "HumanEscalation"
  | "ModelEscalation"
  | "Shadow"
  | "Cache"
  | "Output";
export type WorkflowStatus = "draft" | "review" | "production";
export type MemberRole = "owner" | "admin" | "editor" | "viewer";
export type AlertSeverity = "low" | "medium" | "high" | "critical";
export type AlertStatus = "open" | "acknowledged" | "resolved";
export type JobStatus = "pending" | "running" | "complete" | "failed" | "cancelled";
export type ServerStatus = "stopped" | "starting" | "running" | "error";

// ── State / Context ───────────────────────────────────────────────────────────

/** Arbitrary key-value context passed into a decision run */
export interface DecisionState {
  [key: string]: unknown;
}

// ── Questions ─────────────────────────────────────────────────────────────────

export interface ChoiceOption {
  id: string;
  label: string;
}

export interface ChoiceQuestion {
  type: "Choice";
  id: string;
  text: string;
  options: ChoiceOption[];
  multiSelect: boolean;
}

export interface NoulQuestion {
  type: "Noul";
  id: string;
  text: string;
  /** Natural-language "yes/no" – model returns boolean + confidence */
}

export interface ScoreQuestion {
  type: "Score";
  id: string;
  text: string;
  min: number;
  max: number;
  step: number;
}

export type Question = ChoiceQuestion | NoulQuestion | ScoreQuestion;

// ── Answers ───────────────────────────────────────────────────────────────────

export interface ChoiceAnswer {
  type: "Choice";
  questionId: string;
  selectedIds: string[];
  confidence: number;
  probabilities: Record<string, number>;
}

export interface NoulAnswer {
  type: "Noul";
  questionId: string;
  value: boolean;
  confidence: number;
  probability: number;
}

export interface ScoreAnswer {
  type: "Score";
  questionId: string;
  value: number;
  confidence: number;
  distribution: Array<{ score: number; prob: number }>;
}

export type Answer = ChoiceAnswer | NoulAnswer | ScoreAnswer;

// ── Decision Run ──────────────────────────────────────────────────────────────

export interface DecisionRun {
  id: string;
  templateId?: string;
  modelId: string;
  state: DecisionState;
  questions: Question[];
  answers: Answer[];
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  cost?: number;
  markedWrong: boolean;
  timestamp: string; // ISO 8601
  tags: string[];
}

// ── Decision Template ─────────────────────────────────────────────────────────

export interface DecisionTemplate {
  id: string;
  name: string;
  description: string;
  questions: Question[];
  defaultState?: DecisionState;
  version: string;
  author: string;
  stars: number;
  downloads: number;
  calibrationEce?: number;
  calibrationMethod: RecalibrationMethod;
  source: "local" | "marketplace";
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// ── Model ─────────────────────────────────────────────────────────────────────

export interface ModelCapabilityProbe {
  capability: ModelCapability;
  supported: boolean;
  score?: number;
  probeLatencyMs?: number;
}

export interface ModelQuantOption {
  quant: QuantizationType;
  sizeGb: number;
  ramRequiredGb: number;
  qualityScore?: number;
}

export interface Model {
  id: string;
  name: string;
  displayName: string;
  source: ModelSource;
  author: string;
  description: string;
  quantOptions: ModelQuantOption[];
  selectedQuant: QuantizationType;
  downloadedQuants: QuantizationType[];
  capabilities: ModelCapabilityProbe[];
  loaded: boolean;
  ramUsedGb?: number;
  contextLength: number;
  downloadStatus: DownloadStatus;
  downloadProgress?: number; // 0-100
  downloadSpeedMbps?: number;
  downloadEtaSecs?: number;
  localPath?: string;
  hfRepoId?: string;
  lastUsed?: string;
  tags: string[];
}

// ── Calibration ───────────────────────────────────────────────────────────────

export interface CalibrationBin {
  binMidpoint: number;
  avgConfidence: number;
  accuracy: number;
  count: number;
}

export interface CalibrationProfile {
  id: string;
  modelId: string;
  templateId?: string;
  method: RecalibrationMethod;
  temperature?: number;
  plattA?: number;
  plattB?: number;
  isotonicPoints?: Array<{ x: number; y: number }>;
  ece: number;
  mce: number;
  bins: CalibrationBin[];
  evalSetId: string;
  fittedAt: string;
}

export interface EvalSample {
  id: string;
  state: DecisionState;
  questions: Question[];
  groundTruth: Answer[];
  tags: string[];
}

export interface EvalSet {
  id: string;
  name: string;
  description: string;
  samples: EvalSample[];
  createdAt: string;
}

export interface AdversarialProbe {
  id: string;
  description: string;
  state: DecisionState;
  expectedAnswer: Answer;
  expectedConfidenceRange: [number, number];
}

export interface CostMatrixConfig {
  falsePositiveCost: number;
  falseNegativeCost: number;
  threshold: number;
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

export interface PipelineNodeData {
  label: string;
  nodeType: NodeType;
  modelId?: string;
  templateId?: string;
  condition?: string;
  maxIterations?: number;
  aggregationMethod?: "majority" | "weighted" | "first_wins";
  cacheKey?: string;
  cacheTtlSecs?: number;
  humanEscalationQueue?: string;
  escalationThreshold?: number;
  shadowFraction?: number;
  outputFormat?: "json" | "csv" | "text";
  config: Record<string, unknown>;
}

export interface PipelineEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  conditionValue?: string;
}

export interface PipelineVersion {
  version: string;
  createdAt: string;
  author: string;
  changelog: string;
  snapshot: unknown;
}

export interface Pipeline {
  id: string;
  name: string;
  description: string;
  nodes: Array<{ id: string; type: string; position: { x: number; y: number }; data: PipelineNodeData }>;
  edges: PipelineEdge[];
  version: string;
  versions: PipelineVersion[];
  status: WorkflowStatus;
  prUrl?: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

// ── Batch ─────────────────────────────────────────────────────────────────────

export interface BatchJob {
  id: string;
  name: string;
  templateId: string;
  modelId: string;
  inputFile: string;
  inputFormat: "csv" | "jsonl";
  rowCount: number;
  processedRows: number;
  concurrency: number;
  status: JobStatus;
  rowsPerSec?: number;
  avgConfidence?: number;
  avgLatencyMs?: number;
  estimatedCost?: number;
  outputFile?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

// ── Server & MCP ──────────────────────────────────────────────────────────────

export interface ServerConfig {
  port: number;
  host: string;
  tlsEnabled: boolean;
  authToken?: string;
  corsOrigins: string[];
  rateLimit?: number;
}

export interface McpToolManifest {
  name: string;
  description: string;
  version: string;
  endpoint: string;
  schema: Record<string, unknown>;
}

// ── Observability ─────────────────────────────────────────────────────────────

export interface MetricPoint {
  timestamp: string;
  value: number;
}

export interface LatencyPercentiles {
  timestamp: string;
  p50: number;
  p95: number;
  p99: number;
}

export interface DriftAlert {
  id: string;
  severity: AlertSeverity;
  status: AlertStatus;
  metric: string;
  message: string;
  threshold: number;
  currentValue: number;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  threshold: number;
  comparator: "gt" | "lt" | "gte" | "lte";
  severity: AlertSeverity;
  enabled: boolean;
  notifySlack?: string;
  notifyEmail?: string;
}

export interface ConfidenceHistogramBin {
  bucket: string; // e.g. "0.0–0.1"
  count: number;
}

export interface ClassDistributionPoint {
  timestamp: string;
  distributions: Record<string, number>;
}

export interface ObservabilitySnapshot {
  reqPerSec: MetricPoint[];
  latencyPercentiles: LatencyPercentiles[];
  confidenceHistogram: ConfidenceHistogramBin[];
  classDistribution: ClassDistributionPoint[];
  errorRate: MetricPoint[];
  driftAlerts: DriftAlert[];
}

// ── Team & Workspace ──────────────────────────────────────────────────────────

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  avatarUrl?: string;
  joinedAt: string;
  lastActive?: string;
}

export interface GitConfig {
  repoUrl: string;
  branch: string;
  autoCommit: boolean;
  commitPrefix: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

// ── Settings ──────────────────────────────────────────────────────────────────

export interface AppSettings {
  modelDirectory: string;
  serverPort: number;
  serverHost: string;
  theme: "dark" | "light" | "system";
  launchOnStartup: boolean;
  minimizeToTray: boolean;
  hfToken?: string;
  bandwidthThrottleMbps?: number;
  notificationsEnabled: boolean;
  notifyOnDownloadComplete: boolean;
  notifyOnBatchComplete: boolean;
  notifyOnDriftAlert: boolean;
  logLevel: "error" | "warn" | "info" | "debug";
  firstLaunch: boolean;
}

// ── Notifications ─────────────────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  autoDismiss: boolean;
  dismissAfterMs?: number;
  createdAt: string;
}

// ── Navigation ────────────────────────────────────────────────────────────────

export type PageId =
  | "models"
  | "playground"
  | "batch"
  | "pipelines"
  | "calibration"
  | "marketplace"
  | "server"
  | "observability"
  | "history"
  | "team"
  | "settings";

// ── Utility helpers ───────────────────────────────────────────────────────────

export function confidenceColor(confidence: number): string {
  if (confidence >= 0.8) return "#00ff88"; // Grok Neon Emerald
  if (confidence >= 0.5) return "#ffb703"; // Cyber Amber
  return "#ff0055"; // Neon Crimson
}

export function confidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return "High";
  if (confidence >= 0.5) return "Mid";
  return "Low";
}

export function confidenceBgClass(confidence: number): string {
  if (confidence >= 0.8) return "bg-confidence-high";
  if (confidence >= 0.5) return "bg-confidence-mid";
  return "bg-confidence-low";
}

export function confidenceTextClass(confidence: number): string {
  if (confidence >= 0.8) return "text-confidence-high";
  if (confidence >= 0.5) return "text-confidence-mid";
  return "text-confidence-low";
}

