'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  Bot,
  Loader2,
  Trophy,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { formatAddress, formatMON } from '@/lib/utils';

interface AgentSubmission {
  id: string;
  content: string;
  status: string;
  createdAt: string;
  bounty: {
    id: string;
    title: string;
    amount: string;
    status: string;
  };
}

interface AgentData {
  id: string;
  walletAddress: string;
  displayName: string | null;
  isAgent: boolean;
  bio: string | null;
  reputation: {
    bountiesCompleted: number;
    totalEarned: string;
  } | null;
  submissions: AgentSubmission[];
}

export default function AgentPage() {
  const [agent, setAgent] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgent();
  }, []);

  async function fetchAgent() {
    try {
      const res = await fetch('/api/ai/agent');
      if (res.ok) {
        const data = await res.json();
        setAgent(data);
      }
    } catch (err) {
      console.error('Failed to fetch agent:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="w-12 h-12 bg-primary-soft rounded-xl flex items-center justify-center mx-auto">
          <Loader2 size={24} className="animate-spin text-primary-text" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-indigo-500/30 rounded-xl flex items-center justify-center">
            <Bot size={20} className="text-primary-text" />
          </div>
          AI Agent
        </h1>
        <p className="text-text-muted mt-2 text-sm">
          Autonomous AI agent that automatically submits to new bounties on Monexus
        </p>
      </div>

      {/* Agent Profile Card */}
      {agent && (
        <Card className="mb-4 border-indigo-500/20">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center shrink-0">
              <Bot size={28} className="text-primary-text" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-text-primary">{agent.displayName}</h2>
                <Badge variant="info" size="sm">AI Agent</Badge>
              </div>
              <p className="text-sm text-text-muted font-mono">{formatAddress(agent.walletAddress)}</p>
              {agent.bio && <p className="text-sm text-text-secondary mt-1">{agent.bio}</p>}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mt-5">
            <div className="bg-white/[0.04] border border-glass-border rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-text-primary">{agent.submissions.length}</p>
              <p className="text-xs text-text-muted mt-0.5">Attempted</p>
            </div>
            <div className="bg-white/[0.04] border border-glass-border rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-400">{agent.reputation?.bountiesCompleted || 0}</p>
              <p className="text-xs text-text-muted mt-0.5">Won</p>
            </div>
            <div className="bg-white/[0.04] border border-glass-border rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-primary-text">{formatMON(agent.reputation?.totalEarned || '0')}</p>
              <p className="text-xs text-text-muted mt-0.5">MON Earned</p>
            </div>
          </div>
        </Card>
      )}

      {/* How it works */}
      <Card className="mb-4">
        <h3 className="font-semibold text-text-primary flex items-center gap-2 mb-3">
          <Zap size={16} className="text-yellow-400" />
          How it works
        </h3>
        <div className="space-y-2 text-sm text-text-secondary">
          <p>The AI agent automatically responds to every new bounty created on Monexus.</p>
          <ol className="list-decimal list-inside space-y-1.5 text-text-muted">
            <li>A user creates a new bounty</li>
            <li>The agent analyzes the bounty requirements</li>
            <li>It generates a high-quality submission using AI</li>
            <li>The submission is posted and registered on-chain</li>
            <li>The bounty creator can review, approve, and pay the agent</li>
          </ol>
        </div>
      </Card>

      {/* Submission History */}
      {agent && agent.submissions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4 text-text-primary">
            Submission History <span className="text-text-muted font-normal">({agent.submissions.length})</span>
          </h3>
          <div className="space-y-2">
            {agent.submissions.map((sub) => (
              <Card key={sub.id} className="hover:border-glass-border-hover transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/bounties/${sub.bounty.id}`}
                      className="text-sm font-medium text-text-primary hover:text-primary-text transition-colors"
                    >
                      {sub.bounty.title}
                    </Link>
                    <p className="text-xs text-text-muted mt-1">
                      {formatMON(sub.bounty.amount)} MON
                      {' · '}
                      {new Date(sub.createdAt).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-text-secondary mt-2 line-clamp-2">{sub.content}</p>
                  </div>
                  <Badge
                    variant={
                      sub.status === 'APPROVED' ? 'success' :
                      sub.status === 'REJECTED' ? 'danger' :
                      'warning'
                    }
                    size="sm"
                  >
                    {sub.status}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {agent && agent.submissions.length === 0 && (
        <Card>
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-white/[0.04] rounded-xl flex items-center justify-center mx-auto mb-3">
              <Trophy size={20} className="text-text-muted" />
            </div>
            <p className="text-text-secondary text-sm">
              No submissions yet. The agent will automatically submit when a new bounty is created.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
