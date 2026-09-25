import React from "react";
import {
  Users,
  GitPullRequest,
  ShieldCheck,
  Key,
  FolderGit2,
  CheckCircle,
  Clock,
  ExternalLink,
} from "lucide-react";
import { useStore } from "@/store";

export function TeamPage(): React.ReactElement {
  const teamMembers = useStore((s) => s.teamMembers);
  const auditLogs = useStore((s) => s.auditLogs);
  const gitConfig = useStore((s) => s.gitConfig);

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d] text-gray-200 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1f1f1f] bg-[#111]">
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide">Team & Enterprise Layer</h1>
          <p className="text-xs text-gray-400">
            RBAC, Git-backed decision reviews, pull request promotions, and compliance audit logs
          </p>
        </div>
      </div>

      <div className="p-6 max-w-6xl flex flex-col gap-6">
        {/* Git-backed Storage Card */}
        <div className="bg-[#141414] border border-[#252525] rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                <FolderGit2 size={18} className="text-orange-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Git-Backed Template & Pipeline Storage</h2>
                <p className="text-xs text-gray-400">
                  Decision contracts are versioned JSON files committed directly to your repository.
                </p>
              </div>
            </div>

            <span className="text-xs font-mono text-[#00e676] bg-[#00e676]/10 px-2.5 py-1 rounded border border-[#00e676]/20">
              Synced with GitHub
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono bg-[#181818] p-3 rounded-lg border border-[#262626]">
            <div>
              <span className="text-gray-500">Repository Remote:</span>
              <p className="text-gray-300 font-bold mt-0.5">https://github.com/aryanthegamedev3465/tiny-decision</p>
            </div>
            <div>
              <span className="text-gray-500">Active Review Branch:</span>
              <p className="text-gray-300 font-bold mt-0.5">main (auto-pr on promotion)</p>
            </div>
          </div>
        </div>

        {/* Workspace Members & RBAC */}
        <div className="bg-[#141414] border border-[#252525] rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-3 border-b border-[#222] bg-[#161616] flex items-center justify-between">
            <h2 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
              Workspace Access Control (RBAC)
            </h2>
            <button className="px-3 py-1 rounded bg-[#00e676] text-black text-xs font-bold hover:bg-[#00c853]">
              + Invite Member
            </button>
          </div>

          <table className="w-full text-xs text-left">
            <thead className="bg-[#181818] text-gray-400 border-b border-[#222]">
              <tr>
                <th className="p-3">Member</th>
                <th className="p-3">Email</th>
                <th className="p-3">Role</th>
                <th className="p-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e1e] text-gray-200">
              {teamMembers.map((m) => (
                <tr key={m.id} className="hover:bg-[#181818]">
                  <td className="p-3 font-bold text-white">{m.name}</td>
                  <td className="p-3 font-mono text-gray-400">{m.email}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#1e1e1e] text-[#00e676] border border-[#333] uppercase">
                      {m.role}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-gray-500">{m.joinedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Audit Log Table */}
        <div className="bg-[#141414] border border-[#252525] rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-3 border-b border-[#222] bg-[#161616]">
            <h2 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
              Compliance Audit Trail
            </h2>
          </div>

          <div className="divide-y divide-[#1e1e1e] text-xs font-mono">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-3.5 flex items-center justify-between hover:bg-[#181818]">
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 text-[11px]">{log.timestamp}</span>
                  <span className="text-white font-bold">{log.actor}</span>
                  <span className="text-gray-400">{log.action}</span>
                  <span className="text-[#00e676]">{log.target}</span>
                </div>
                <span className="text-gray-600 text-[11px]">{log.id}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
