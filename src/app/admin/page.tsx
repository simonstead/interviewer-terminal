'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Session {
  id: string;
  candidateName: string;
  candidateEmail: string;
  seniority: string;
  status: string;
  currentLevel: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  integrityScore: number | null;
}

export default function AdminDashboard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, []);

  async function fetchSessions() {
    try {
      const res = await fetch('/api/sessions');
      const data = await res.json();
      setSessions(data.data || []);
    } catch {
      console.error('Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  }

  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    active: 'bg-green-500/20 text-green-400',
    completed: 'bg-blue-500/20 text-blue-400',
    expired: 'bg-red-500/20 text-red-400',
  };

  return (
    <div className="min-h-screen bg-[#1a1b26] text-gray-200">
      <header className="border-b border-[#33467c] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-cyan-400 font-bold text-xl">FleetCore</Link>
            <span className="text-gray-500">|</span>
            <span className="text-gray-400">Admin Dashboard</span>
          </div>
          <Link
            href="/admin/sessions/new"
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors text-sm"
          >
            + New Session
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Sessions" value={sessions.length} />
          <StatCard label="Active" value={sessions.filter(s => s.status === 'active').length} color="text-green-400" />
          <StatCard label="Completed" value={sessions.filter(s => s.status === 'completed').length} color="text-blue-400" />
          <StatCard label="Pending" value={sessions.filter(s => s.status === 'pending').length} color="text-yellow-400" />
        </div>

        <div className="bg-[#16161e] border border-[#33467c] rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-[#33467c]">
            <h2 className="text-lg font-semibold text-white">Sessions</h2>
          </div>

          {loading ? (
            <div className="px-6 py-12 text-center text-gray-500">Loading sessions...</div>
          ) : sessions.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              No sessions yet.{' '}
              <Link href="/admin/sessions/new" className="text-cyan-400 hover:underline">
                Create one
              </Link>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 text-sm">
                  <th className="px-6 py-3">Candidate</th>
                  <th className="px-6 py-3">Seniority</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Level</th>
                  <th className="px-6 py-3">Integrity</th>
                  <th className="px-6 py-3">Created</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(session => (
                  <tr key={session.id} className="border-t border-[#33467c] hover:bg-[#1e1f2e]">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{session.candidateName}</div>
                      <div className="text-sm text-gray-500">{session.candidateEmail}</div>
                    </td>
                    <td className="px-6 py-4 capitalize">{session.seniority}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${statusColor[session.status] || 'text-gray-400'}`}>
                        {session.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">{session.currentLevel}/4</td>
                    <td className="px-6 py-4">
                      {session.integrityScore !== null ? (
                        <span className={session.integrityScore >= 80 ? 'text-green-400' : session.integrityScore >= 50 ? 'text-yellow-400' : 'text-red-400'}>
                          {session.integrityScore}/100
                        </span>
                      ) : (
                        <span className="text-gray-500">--</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {new Date(session.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {session.status === 'active' && (
                          <Link
                            href={`/admin/sessions/${session.id}/live`}
                            className="px-3 py-1 bg-green-600/20 text-green-400 rounded text-xs hover:bg-green-600/30"
                          >
                            Live
                          </Link>
                        )}
                        <Link
                          href={`/admin/sessions/${session.id}`}
                          className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded text-xs hover:bg-blue-600/30"
                        >
                          Review
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, color = 'text-white' }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-[#16161e] border border-[#33467c] rounded-lg p-4">
      <div className="text-sm text-gray-400">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
