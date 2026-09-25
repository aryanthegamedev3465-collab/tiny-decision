import React, { useCallback, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  Handle,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  Brain,
  GitBranch,
  Split,
  Merge,
  Repeat,
  Users,
  ShieldAlert,
  Cpu,
  Ghost,
  Database,
  CheckCircle,
} from "lucide-react";
import type { PipelineNode as TDNode } from "@/types";

// Custom node rendering component
function PipelineCustomNode({ data, id }: { data: any; id: string }): React.ReactElement {
  const nodeType = data.nodeType || "Decision";

  const iconMap: Record<string, any> = {
    Decision: Brain,
    Branch: GitBranch,
    ParallelFanout: Split,
    FanIn: Merge,
    Loop: Repeat,
    Ensemble: Users,
    HumanEscalation: ShieldAlert,
    ModelEscalation: Cpu,
    Shadow: Ghost,
    Cache: Database,
    Output: CheckCircle,
  };

  const colorMap: Record<string, string> = {
    Decision: "border-[#00e676]/40 bg-[#00e676]/5 text-[#00e676]",
    Branch: "border-blue-500/40 bg-blue-500/5 text-blue-400",
    ParallelFanout: "border-purple-500/40 bg-purple-500/5 text-purple-400",
    FanIn: "border-purple-500/40 bg-purple-500/5 text-purple-400",
    Loop: "border-amber-500/40 bg-amber-500/5 text-amber-400",
    Ensemble: "border-cyan-500/40 bg-cyan-500/5 text-cyan-400",
    HumanEscalation: "border-rose-500/40 bg-rose-500/5 text-rose-400",
    ModelEscalation: "border-orange-500/40 bg-orange-500/5 text-orange-400",
    Shadow: "border-gray-500/40 bg-gray-500/5 text-gray-400",
    Cache: "border-emerald-500/40 bg-emerald-500/5 text-emerald-400",
    Output: "border-green-500/40 bg-green-500/5 text-green-400",
  };

  const Icon = iconMap[nodeType] || Brain;
  const colorClass = colorMap[nodeType] || colorMap.Decision;

  return (
    <div
      className={`px-3 py-2.5 rounded-lg border bg-[#161616] min-w-[160px] shadow-lg flex flex-col gap-1.5 transition-all hover:scale-[1.02] ${colorClass}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-[#444] !w-2 !h-2" />
      <div className="flex items-center gap-2">
        <Icon size={16} />
        <span className="text-xs font-bold text-gray-200 truncate">{data.label || nodeType}</span>
      </div>
      <div className="text-[10px] text-gray-400 font-mono truncate">
        {data.subtext || `Node: ${id}`}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-[#00e676] !w-2 !h-2" />
    </div>
  );
}

interface PipelineCanvasProps {
  initialNodes?: Node[];
  initialEdges?: Edge[];
  onSave?: (nodes: Node[], edges: Edge[]) => void;
}

export function PipelineCanvas({
  initialNodes = [],
  initialEdges = [],
  onSave,
}: PipelineCanvasProps): React.ReactElement {
  const nodeTypes = useMemo(() => ({ pipelineNode: PipelineCustomNode }), []);

  const defaultNodes: Node[] = initialNodes.length
    ? initialNodes
    : [
        {
          id: "1",
          type: "pipelineNode",
          position: { x: 250, y: 50 },
          data: { label: "Refund Validator", nodeType: "Decision", subtext: "Template: refund-v1" },
        },
        {
          id: "2",
          type: "pipelineNode",
          position: { x: 250, y: 180 },
          data: { label: "Confidence Check", nodeType: "Branch", subtext: "Threshold: 0.85" },
        },
        {
          id: "3",
          type: "pipelineNode",
          position: { x: 100, y: 310 },
          data: { label: "Auto-Approve", nodeType: "Output", subtext: "Action: emit_event" },
        },
        {
          id: "4",
          type: "pipelineNode",
          position: { x: 400, y: 310 },
          data: { label: "Human Review", nodeType: "HumanEscalation", subtext: "Queue: tier2-support" },
        },
      ];

  const defaultEdges: Edge[] = initialEdges.length
    ? initialEdges
    : [
        { id: "e1-2", source: "1", target: "2", animated: true },
        { id: "e2-3", source: "2", target: "3", label: "≥ 0.85" },
        { id: "e2-4", source: "2", target: "4", label: "< 0.85" },
      ];

  const [nodes, setNodes, onNodesChange] = useNodesState(defaultNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(defaultEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  return (
    <div className="w-full h-full bg-[#0d0d0d] relative rounded-xl border border-[#222] overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background color="#1f1f1f" gap={16} />
        <Controls className="!bg-[#1a1a1a] !border-[#333] !text-gray-300" />
        <MiniMap
          nodeColor="#00e676"
          maskColor="rgba(0, 0, 0, 0.7)"
          className="!bg-[#141414] !border-[#252525]"
        />
      </ReactFlow>
    </div>
  );
}
