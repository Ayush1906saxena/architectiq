"use client";

import NetworkPartitionSim from "@/components/simulations/NetworkPartitionSim";
import CacheStampedeSim from "@/components/simulations/CacheStampedeSim";

const SIMULATIONS: Record<string, { title: string; description: string; component: React.ComponentType }> = {
  "network-partition": {
    title: "Network Partition Simulator",
    description: "Watch what happens when a network partition separates a Leader from its Follower. Toggle between CP and AP modes to see the trade-offs in action.",
    component: NetworkPartitionSim,
  },
  "cache-stampede": {
    title: "Cache Stampede Simulator",
    description: "See what happens when a cache key expires and all requests simultaneously hit the database. Try different mitigation strategies.",
    component: CacheStampedeSim,
  },
};

interface FailureLabPageProps {
  params: { topicId: string };
}

export default function FailureLabPage({ params }: FailureLabPageProps) {
  const sim = SIMULATIONS[params.topicId];

  if (!sim) {
    return (
      <div className="min-h-screen p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-4">Failure Lab</h1>
        <p className="text-gray-400 mb-8">Choose a simulation:</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {Object.entries(SIMULATIONS).map(([id, s]) => (
            <a
              key={id}
              href={`/failure-lab/${id}`}
              className="bg-gray-900 border border-gray-800 hover:border-red-500/40 rounded-xl p-5 transition-all"
            >
              <h3 className="text-sm font-semibold text-gray-200 mb-1">{s.title}</h3>
              <p className="text-xs text-gray-500">{s.description}</p>
            </a>
          ))}
        </div>
      </div>
    );
  }

  const SimComponent = sim.component;

  return (
    <div className="min-h-screen p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <a href="/failure-lab/index" className="text-gray-400 hover:text-gray-200 text-sm">
            &larr; All Labs
          </a>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-red-500/10 text-red-400 border border-red-500/20">
            FAILURE LAB
          </span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">{sim.title}</h1>
        <p className="text-sm text-gray-400">{sim.description}</p>
      </div>

      <SimComponent />
    </div>
  );
}
