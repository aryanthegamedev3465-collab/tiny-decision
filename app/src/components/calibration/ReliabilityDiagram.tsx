import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import type { ReliabilityBin } from "@/types";

interface ReliabilityDiagramProps {
  bins: ReliabilityBin[];
  eceScore?: number;
  height?: number;
}

export function ReliabilityDiagram({
  bins,
  eceScore,
  height = 280,
}: ReliabilityDiagramProps): React.ReactElement {
  const chartData = bins.map((b) => ({
    confidence: `${(b.binLower * 100).toFixed(0)}-${(b.binUpper * 100).toFixed(0)}%`,
    nominalConfidence: (b.binLower + b.binUpper) / 2,
    accuracy: b.accuracy,
    avgConfidence: b.avgConfidence,
    count: b.sampleCount,
    gap: b.gap,
  }));

  return (
    <div className="flex flex-col gap-2 w-full bg-[#141414] border border-[#252525] rounded-xl p-4">
      <div className="flex items-center justify-between pb-2 border-b border-[#222]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-200 tracking-wide">RELIABILITY DIAGRAM</span>
          <span className="text-[10px] text-gray-500 font-mono">Accuracy vs. Confidence</span>
        </div>
        {eceScore !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">ECE:</span>
            <span
              className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                eceScore < 0.05
                  ? "bg-[#00e676]/15 text-[#00e676] border border-[#00e676]/30"
                  : eceScore < 0.12
                  ? "bg-[#ffd600]/15 text-[#ffd600] border border-[#ffd600]/30"
                  : "bg-red-500/15 text-red-400 border border-red-500/30"
              }`}
            >
              {(eceScore * 100).toFixed(2)}%
            </span>
          </div>
        )}
      </div>

      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" />
            <XAxis
              dataKey="confidence"
              stroke="#666"
              fontSize={10}
              tickLine={false}
              label={{ value: "Confidence Bin", position: "insideBottom", offset: -10, fill: "#888", fontSize: 10 }}
            />
            <YAxis
              domain={[0, 1]}
              stroke="#666"
              fontSize={10}
              tickLine={false}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              label={{ value: "Accuracy", angle: -90, position: "insideLeft", offset: 25, fill: "#888", fontSize: 10 }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-[#1c1c1c] border border-[#333] p-2 rounded shadow-lg text-xs font-mono">
                    <p className="text-gray-300 font-bold mb-1">Bin: {d.confidence}</p>
                    <p className="text-[#00e676]">Actual Accuracy: {(d.accuracy * 100).toFixed(1)}%</p>
                    <p className="text-blue-400">Mean Confidence: {(d.avgConfidence * 100).toFixed(1)}%</p>
                    <p className="text-gray-400">Samples: {d.count}</p>
                    <p className="text-red-400">Calibration Gap: {(d.gap * 100).toFixed(1)}%</p>
                  </div>
                );
              }}
            />
            {/* Ideal calibration diagonal */}
            <ReferenceLine y={0.5} stroke="#333" strokeDasharray="4 4" />
            {/* Bar representing empirical accuracy */}
            <Bar dataKey="accuracy" fill="#00e676" opacity={0.8} radius={[4, 4, 0, 0]} />
            {/* Line representing mean confidence */}
            <Line
              type="monotone"
              dataKey="avgConfidence"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 3, fill: "#3b82f6" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-6 pt-1 text-[11px] text-gray-400 font-mono">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-[#00e676]" />
          <span>Empirical Accuracy</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-1 bg-blue-500" />
          <span>Mean Confidence</span>
        </div>
      </div>
    </div>
  );
}
