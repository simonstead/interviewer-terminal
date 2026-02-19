import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#1a1b26] flex items-center justify-center">
      <div className="max-w-2xl w-full mx-auto px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-cyan-400 mb-2">FleetCore</h1>
          <p className="text-gray-400 text-lg">Technical Interview Platform</p>
        </div>

        <div className="bg-[#16161e] border border-[#33467c] rounded-lg p-8 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Quick Start</h2>
          <p className="text-gray-400 mb-6">
            Launch a demo terminal session to explore the FleetCore interview environment.
          </p>
          <Link
            href="/session/demo"
            className="inline-block px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg transition-colors"
          >
            Launch Demo Session
          </Link>
        </div>

        <div className="bg-[#16161e] border border-[#33467c] rounded-lg p-8">
          <h2 className="text-xl font-semibold text-white mb-4">Admin</h2>
          <p className="text-gray-400 mb-6">
            Create and manage interview sessions, watch candidates live, and review recordings.
          </p>
          <Link
            href="/admin"
            className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg transition-colors"
          >
            Admin Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
