'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Card } from '@/components/ui/Card';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useAuth } from '@/hooks/useAuth';
import { useContract } from '@/hooks/useContract';
import { ArrowLeft, Trophy, Loader2, Check, Coins, Calendar, Tag, FileText, AlertTriangle, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { parseTags } from '@/lib/utils';

export default function CreateBountyPage() {
  return (
    <AuthGuard>
      <CreateBountyForm />
    </AuthGuard>
  );
}

function CreateBountyForm() {
  const router = useRouter();
  const { walletAddress } = useAuth();
  const { createBounty, txState } = useContract();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [amount, setAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [step, setStep] = useState<'form' | 'confirm' | 'processing' | 'done'>('form');
  const [error, setError] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);

  const isValid = title.trim() && description.trim() && amount && parseFloat(amount) > 0 && deadline;

  const handleSubmit = async () => {
    if (!isValid || !walletAddress) return;
    setStep('confirm');
  };

  const handleAIEnhance = async () => {
    if (!description.trim()) return;
    setIsEnhancing(true);
    try {
      const res = await fetch('/api/ai/enhance-bounty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          title: title || undefined,
          requirements: requirements || undefined,
          amount: amount || undefined,
        }),
      });
      if (!res.ok) throw new Error('AI enhancement failed');
      const data = await res.json();
      setTitle(data.title);
      setDescription(data.description);
      setRequirements(data.requirements);
      setTagsInput(data.tags.join(', '));
      if (!amount && data.suggestedAmount) {
        setAmount(data.suggestedAmount);
      }
    } catch (err: any) {
      console.error('AI enhance error:', err);
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleConfirmAndPay = async () => {
    if (!walletAddress) return;
    setError('');
    setStep('processing');

    try {
      const deadlineDate = new Date(deadline);
      const result = await createBounty(deadlineDate, 1, true, amount);

      if (!result) {
        throw new Error('Transaction failed');
      }

      const tags = parseTags(tagsInput);
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          content: description,
          type: 'BOUNTY',
          bounty: {
            title,
            description,
            requirements: requirements || 'See description',
            amount,
            deadline: deadlineDate.toISOString(),
            tags,
            contractBountyId: result.bountyId.toString(),
            txHash: result.txHash,
            maxWinners: 1,
            splitEqually: true,
            status: 'OPEN',
          },
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to save bounty');
      }

      setStep('done');
      setTimeout(() => router.push('/bounties'), 2000);
    } catch (err: any) {
      console.error('Bounty creation failed:', err);
      setError(err.message || 'Failed to create bounty');
      setStep('confirm');
    }
  };

  if (step === 'done') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 bg-green-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Check size={40} className="text-green-400" />
        </div>
        <h2 className="text-2xl font-bold mb-3 text-text-primary">Bounty Created!</h2>
        <p className="text-text-secondary mb-2 text-lg">
          Your bounty has been created and <span className="text-primary-text font-semibold">{amount} MON</span> is locked in escrow.
        </p>
        <p className="text-sm text-text-muted">Redirecting to bounties...</p>
      </div>
    );
  }

  if (step === 'processing') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 bg-primary-soft rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Loader2 size={36} className="animate-spin text-primary-text" />
        </div>
        <h2 className="text-xl font-bold mb-3 text-text-primary">Creating Bounty...</h2>
        <p className="text-text-secondary">
          {txState.status === 'pending' && 'Confirm the transaction in your wallet...'}
          {txState.status === 'confirming' && 'Waiting for confirmation on Monad...'}
        </p>
        {txState.hash && (
          <p className="text-sm text-text-faint mt-3 font-mono">
            Tx: {txState.hash.slice(0, 10)}...{txState.hash.slice(-8)}
          </p>
        )}
      </div>
    );
  }

  if (step === 'confirm') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => setStep('form')} className="p-2 text-text-secondary hover:text-text-primary hover:bg-white/[0.06] rounded-lg transition-colors">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-2xl font-bold text-text-primary">Confirm Bounty</h1>
        </div>

        <Card className="border-glass-border">
          <div className="space-y-5">
            <div>
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">Title</p>
              <p className="font-semibold text-text-primary text-lg">{title}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">Description</p>
              <p className="text-text-secondary leading-relaxed">{description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 py-4 border-y border-glass-border">
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">Reward</p>
                <p className="text-3xl font-bold text-primary-text">{amount}</p>
                <p className="text-sm text-text-muted">MON</p>
              </div>
              <div className="bg-white/[0.04] border border-glass-border rounded-xl p-4 text-center">
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">Deadline</p>
                <p className="text-lg font-semibold text-text-primary">{new Date(deadline).toLocaleDateString()}</p>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-start gap-3 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl text-yellow-400/80 text-sm">
              <Coins size={18} className="flex-shrink-0 mt-0.5" />
              <span>This will lock <strong>{amount} MON</strong> in the smart contract escrow. The funds will be released to the approved submission.</span>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep('form')} className="flex-1">
                Back
              </Button>
              <Button onClick={handleConfirmAndPay} className="flex-1 glow-purple">
                <Trophy size={18} className="mr-2" />
                Deposit {amount} MON & Create
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/bounties">
          <button className="p-2 text-text-secondary hover:text-text-primary hover:bg-white/[0.06] rounded-lg transition-colors">
            <ArrowLeft size={18} />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Create Bounty</h1>
          <p className="text-sm text-text-muted mt-0.5">Post a task and reward contributors with MON</p>
        </div>
      </div>

      <Card className="border-glass-border">
        <div className="space-y-6">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-text-secondary mb-2">
              <Trophy size={14} className="text-primary-text" />
              Bounty Title <span className="text-red-400">*</span>
            </label>
            <Input
              placeholder="e.g., Build a Token Swap UI Component"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-text-secondary mb-2">
              <FileText size={14} className="text-primary-text" />
              Description <span className="text-red-400">*</span>
            </label>
            <Textarea
              placeholder="Describe the work that needs to be done..."
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <button
              type="button"
              onClick={handleAIEnhance}
              disabled={!description.trim() || isEnhancing}
              className="mt-2 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-indigo-500/10 to-cyan-500/10 border border-indigo-500/30 text-primary-text hover:from-indigo-500/20 hover:to-cyan-500/20 hover:text-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isEnhancing ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Enhancing with AI...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  AI Enhance
                </>
              )}
            </button>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-text-secondary mb-2">
              <FileText size={14} className="text-text-muted" />
              Requirements <span className="text-text-faint text-xs font-normal">(optional)</span>
            </label>
            <Textarea
              placeholder="List specific requirements or deliverables..."
              rows={3}
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-text-secondary mb-2">
                <Coins size={14} className="text-primary-text" />
                Reward (MON) <span className="text-red-400">*</span>
              </label>
              <Input
                type="number"
                placeholder="0.00"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-text-secondary mb-2">
                <Calendar size={14} className="text-primary-text" />
                Deadline <span className="text-red-400">*</span>
              </label>
              <Input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-text-secondary mb-2">
              <Tag size={14} className="text-text-muted" />
              Tags <span className="text-text-faint text-xs font-normal">(comma-separated)</span>
            </label>
            <Input
              placeholder="e.g., frontend, react, solidity"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
          </div>

          <Button onClick={handleSubmit} disabled={!isValid} className="w-full glow-purple">
            <Trophy size={18} className="mr-2" />
            Review & Create Bounty
          </Button>
        </div>
      </Card>
    </div>
  );
}
