'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Textarea } from '@/components/ui/Textarea';
import { useAuth } from '@/hooks/useAuth';
import { useContract } from '@/hooks/useContract';
import { useUploadThing } from '@/lib/uploadthing-components';
import {
  ArrowLeft,
  Trophy,
  Clock,
  FileText,
  ExternalLink,
  Check,
  Loader2,
  Send,
  Sparkles,
  Image,
  Paperclip,
  X,
  LinkIcon,
  Plus,
  Download,
} from 'lucide-react';
import Link from 'next/link';
import { formatAddress, formatMON, formatRelativeTime, getAvatarUrl } from '@/lib/utils';

interface AttachmentData {
  id: string;
  type: string;
  url: string;
  filename: string | null;
}

interface BountyData {
  id: string;
  title: string;
  description: string;
  requirements: string;
  amount: string;
  status: string;
  deadline: string;
  tags: string[];
  contractBountyId: string | null;
  txHash: string | null;
  maxWinners: number;
  post: { id: string; content: string; createdAt: string };
  creator: {
    id: string;
    walletAddress: string;
    displayName: string | null;
    avatarUrl: string | null;
    reputation: { bountiesCreated: number; totalSpent: string } | null;
  };
  submissions: Array<{
    id: string;
    content: string;
    status: string;
    createdAt: string;
    attachments?: AttachmentData[];
    contributor: {
      id: string;
      walletAddress: string;
      displayName: string | null;
      avatarUrl: string | null;
      reputation: { bountiesCompleted: number; totalEarned: string } | null;
    };
  }>;
  winners: Array<{
    id: string;
    amount: string;
    txHash: string | null;
    submission: {
      contributor: { walletAddress: string; displayName: string | null };
    };
  }>;
  _count: { submissions: number };
}

export default function BountyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { walletAddress, isConnected } = useAuth();
  const { selectWinners, executePayout, txState } = useContract();
  const { startUpload } = useUploadThing('submissionAttachment');

  const [bounty, setBounty] = useState<BountyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submissionContent, setSubmissionContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApproving, setIsApproving] = useState<string | null>(null);

  // File attachments
  const [files, setFiles] = useState<{ file: File; preview: string; type: 'IMAGE' | 'PDF' }[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Links
  const [links, setLinks] = useState<string[]>([]);
  const [linkInput, setLinkInput] = useState('');

  const bountyId = params.id as string;
  const isCreator = bounty?.creator.walletAddress?.toLowerCase() === walletAddress?.toLowerCase();
  const isExpired = bounty ? new Date(bounty.deadline) < new Date() : false;
  const canSubmit = isConnected && !isCreator && bounty?.status === 'OPEN' && !isExpired;

  useEffect(() => {
    fetchBounty();
  }, [bountyId]);

  async function fetchBounty() {
    try {
      const res = await fetch(`/api/bounties/${bountyId}`);
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      setBounty(data);
    } catch {
      router.push('/bounties');
    } finally {
      setLoading(false);
    }
  }

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const newFiles = selected.map((file) => {
      const isPdf = file.type === 'application/pdf';
      return {
        file,
        preview: isPdf ? '' : URL.createObjectURL(file),
        type: (isPdf ? 'PDF' : 'IMAGE') as 'IMAGE' | 'PDF',
      };
    });
    setFiles((prev) => [...prev, ...newFiles].slice(0, 6));
    e.target.value = '';
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => {
      if (prev[index].preview) URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const addLink = useCallback(() => {
    const url = linkInput.trim();
    if (!url || links.length >= 5) return;
    // Basic URL validation
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setLinkInput('https://' + url);
      return;
    }
    setLinks((prev) => [...prev, url]);
    setLinkInput('');
  }, [linkInput, links.length]);

  const removeLink = useCallback((index: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  }, []);

  async function handleSubmitWork() {
    if (!submissionContent.trim() || !walletAddress) return;
    setIsSubmitting(true);

    try {
      let attachments: { url: string; type: string; filename: string }[] = [];

      // Upload files if any
      if (files.length > 0) {
        setIsUploading(true);
        const uploadResult = await startUpload(files.map((f) => f.file));
        setIsUploading(false);

        if (!uploadResult) throw new Error('File upload failed');

        attachments = uploadResult.map((r, i) => ({
          url: r.ufsUrl,
          type: files[i].type === 'PDF' ? 'IMAGE' : files[i].type, // Schema only supports IMAGE/VIDEO/GIF
          filename: files[i].file.name,
        }));
      }

      const res = await fetch(`/api/bounties/${bountyId}/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          content: submissionContent,
          attachments: attachments.length > 0 ? attachments : undefined,
          links: links.length > 0 ? links : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to submit');
      }

      // Cleanup
      files.forEach((f) => { if (f.preview) URL.revokeObjectURL(f.preview); });
      setSubmissionContent('');
      setFiles([]);
      setLinks([]);
      setLinkInput('');
      await fetchBounty();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  }

  async function handleApprove(submissionId: string, contributorAddress: string) {
    if (!walletAddress || !bounty?.contractBountyId) return;
    setIsApproving(submissionId);

    try {
      const contractId = parseInt(bounty.contractBountyId);
      const txHash = await selectWinners(
        contractId,
        [contributorAddress],
        [bounty.amount]
      );
      await executePayout(contractId);

      await fetch(`/api/bounties/${bountyId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          submissionId,
          txHash,
        }),
      });

      await fetchBounty();
    } catch (err: any) {
      alert('Approval failed: ' + err.message);
    } finally {
      setIsApproving(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mx-auto">
          <Loader2 size={24} className="animate-spin text-purple-400" />
        </div>
      </div>
    );
  }

  if (!bounty) return null;

  const daysLeft = Math.ceil(
    (new Date(bounty.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const imageFiles = files.filter((f) => f.type === 'IMAGE');
  const pdfFiles = files.filter((f) => f.type === 'PDF');

  const getStatusBadge = () => {
    switch (bounty.status) {
      case 'OPEN':
        return <Badge variant="success">Open</Badge>;
      case 'COMPLETED':
        return <Badge variant="info">Completed</Badge>;
      case 'IN_REVIEW':
        return <Badge variant="warning">In Review</Badge>;
      case 'CANCELLED':
        return <Badge variant="default">Cancelled</Badge>;
      default:
        return <Badge variant="default">{bounty.status}</Badge>;
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/bounties">
            <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
              <ArrowLeft size={18} />
            </button>
          </Link>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            <span className="text-sm text-gray-500">
              {isExpired ? 'Expired' : `${daysLeft}d left`}
            </span>
          </div>
        </div>

        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-white">{bounty.title}</h1>
          <div className="text-right flex-shrink-0">
            <p className="text-3xl md:text-4xl font-bold text-purple-400">
              {formatMON(bounty.amount)}
            </p>
            <p className="text-sm text-gray-500">MON</p>
          </div>
        </div>
      </div>

      {/* Creator info */}
      <Card className="mb-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Link
            href={`/profile/${bounty.creator.walletAddress}`}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <Avatar
              src={bounty.creator.avatarUrl || getAvatarUrl(bounty.creator.walletAddress)}
              size="md"
              alt={bounty.creator.displayName || bounty.creator.walletAddress}
            />
            <div>
              <p className="font-medium text-white">
                {bounty.creator.displayName || formatAddress(bounty.creator.walletAddress)}
              </p>
              <p className="text-sm text-gray-500">
                {bounty.creator.reputation?.bountiesCreated || 0} bounties created
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1.5">
              <Clock size={14} />
              <span>{new Date(bounty.deadline).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FileText size={14} />
              <span>{bounty._count.submissions} submissions</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Description */}
      <Card className="mb-4">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Description</h3>
        <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{bounty.description}</p>
        {bounty.requirements && bounty.requirements !== 'See description' && (
          <>
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mt-5 mb-3">Requirements</h3>
            <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{bounty.requirements}</p>
          </>
        )}
        {bounty.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-5 pt-4 border-t border-gray-800/50">
            {bounty.tags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 text-xs bg-gray-800/80 text-gray-400 rounded-lg border border-gray-700/50"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* Winners section */}
      {bounty.winners.length > 0 && (
        <Card className="mb-4 border-green-500/20">
          <h3 className="font-semibold mb-4 flex items-center gap-2 text-white">
            <div className="w-7 h-7 bg-green-500/10 rounded-lg flex items-center justify-center">
              <Trophy size={14} className="text-green-400" />
            </div>
            Winner
          </h3>
          <div className="space-y-2">
            {bounty.winners.map((winner) => (
              <div key={winner.id} className="flex items-center justify-between p-4 bg-green-500/5 border border-green-500/10 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-green-500/10 rounded-lg flex items-center justify-center">
                    <Check size={16} className="text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">
                      {winner.submission.contributor.displayName ||
                        formatAddress(winner.submission.contributor.walletAddress)}
                    </p>
                    <p className="text-sm text-gray-400">Won <span className="text-green-400 font-medium">{formatMON(winner.amount)} MON</span></p>
                  </div>
                </div>
                {winner.txHash && (
                  <a
                    href={`${process.env.NEXT_PUBLIC_MONAD_EXPLORER_URL}/tx/${winner.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-purple-500/10 transition-colors"
                  >
                    View Tx <ExternalLink size={14} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Submit work */}
      {canSubmit && (
        <Card className="mb-4 border-purple-500/20">
          <h3 className="font-semibold mb-4 flex items-center gap-2 text-white">
            <div className="w-7 h-7 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <Send size={14} className="text-purple-400" />
            </div>
            Submit Work
          </h3>

          {/* Description */}
          <Textarea
            placeholder="Describe your work, what you built, and how it meets the requirements..."
            rows={4}
            value={submissionContent}
            onChange={(e) => setSubmissionContent(e.target.value)}
          />

          {/* Image previews */}
          {imageFiles.length > 0 && (
            <div className={`mt-3 grid gap-2 ${imageFiles.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {imageFiles.map((f, i) => {
                const globalIdx = files.indexOf(f);
                return (
                  <div key={i} className="relative group rounded-xl overflow-hidden bg-gray-800">
                    <img src={f.preview} alt={f.file.name} className="w-full h-32 object-cover" />
                    <button
                      onClick={() => removeFile(globalIdx)}
                      className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-black/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                    <span className="absolute bottom-1.5 left-1.5 text-[10px] bg-black/60 text-gray-300 px-1.5 py-0.5 rounded">
                      {f.file.name}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* PDF chips */}
          {pdfFiles.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {pdfFiles.map((f, i) => {
                const globalIdx = files.indexOf(f);
                return (
                  <div key={i} className="flex items-center gap-2 bg-gray-800/80 border border-gray-700/50 rounded-lg px-3 py-2 text-sm">
                    <FileText size={14} className="text-red-400 shrink-0" />
                    <span className="text-gray-300 truncate max-w-[180px]">{f.file.name}</span>
                    <button onClick={() => removeFile(globalIdx)} className="text-gray-500 hover:text-white transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Links */}
          {links.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {links.map((link, i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-800/50 border border-gray-700/30 rounded-lg px-3 py-2 text-sm">
                  <LinkIcon size={14} className="text-blue-400 shrink-0" />
                  <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 truncate flex-1">
                    {link}
                  </a>
                  <button onClick={() => removeLink(i)} className="text-gray-500 hover:text-white transition-colors shrink-0">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Link input */}
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 flex items-center bg-gray-800/50 border border-gray-700/30 rounded-lg focus-within:border-purple-500/40 transition-colors">
              <LinkIcon size={14} className="text-gray-500 ml-3 shrink-0" />
              <input
                type="url"
                placeholder="Paste a link (GitHub, Figma, demo URL...)"
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
                className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-600 px-2 py-2.5 outline-none"
              />
            </div>
            <button
              onClick={addLink}
              disabled={!linkInput.trim() || links.length >= 5}
              className="p-2.5 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg disabled:text-gray-600 disabled:hover:bg-transparent transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Action row */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <label className={`p-2 rounded-lg cursor-pointer transition-colors ${
                files.length >= 6 ? 'text-gray-600 cursor-not-allowed' : 'text-gray-500 hover:text-purple-400 hover:bg-purple-500/10'
              }`} title="Attach images">
                <Image size={18} />
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  disabled={files.length >= 6}
                  className="hidden"
                />
              </label>
              <label className={`p-2 rounded-lg cursor-pointer transition-colors ${
                pdfFiles.length >= 2 ? 'text-gray-600 cursor-not-allowed' : 'text-gray-500 hover:text-purple-400 hover:bg-purple-500/10'
              }`} title="Attach PDF">
                <Paperclip size={18} />
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  disabled={pdfFiles.length >= 2}
                  className="hidden"
                />
              </label>
              {(files.length > 0 || links.length > 0) && (
                <span className="text-xs text-gray-500 ml-2">
                  {files.length > 0 && `${files.length} file${files.length > 1 ? 's' : ''}`}
                  {files.length > 0 && links.length > 0 && ' · '}
                  {links.length > 0 && `${links.length} link${links.length > 1 ? 's' : ''}`}
                </span>
              )}
            </div>
            <Button
              onClick={handleSubmitWork}
              isLoading={isSubmitting}
              disabled={!submissionContent.trim() || isUploading}
              className="glow-purple"
            >
              {isUploading ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Send size={16} className="mr-2" />
                  Submit Work
                </>
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* Submissions list */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-white">
          Submissions <span className="text-gray-500 font-normal">({bounty.submissions.length})</span>
        </h3>
        {bounty.submissions.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-gray-800/50 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Sparkles size={20} className="text-gray-500" />
              </div>
              <p className="text-gray-400 text-sm">
                No submissions yet. Be the first to submit work!
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {bounty.submissions.map((sub) => (
              <Card key={sub.id} className="hover:border-gray-700 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <Link
                    href={`/profile/${sub.contributor.walletAddress}`}
                    className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                  >
                    <Avatar
                      src={sub.contributor.avatarUrl || getAvatarUrl(sub.contributor.walletAddress)}
                      size="sm"
                      alt={sub.contributor.displayName || sub.contributor.walletAddress}
                    />
                    <div>
                      <p className="font-medium text-sm text-white">
                        {sub.contributor.displayName || formatAddress(sub.contributor.walletAddress)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {sub.contributor.reputation?.bountiesCompleted || 0} completed
                        {' · '}
                        {formatRelativeTime(sub.createdAt)}
                      </p>
                    </div>
                  </Link>
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

                {(() => {
                  // Split content from appended links
                  const linkSeparator = '\n\n---\nLinks:\n';
                  const sepIdx = sub.content.indexOf(linkSeparator);
                  const mainContent = sepIdx !== -1 ? sub.content.slice(0, sepIdx) : sub.content;
                  const parsedLinks = sepIdx !== -1
                    ? sub.content.slice(sepIdx + linkSeparator.length).split('\n').map(l => l.replace(/^- /, '').trim()).filter(Boolean)
                    : [];

                  return (
                    <>
                      <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed mb-3">{mainContent}</p>
                      {parsedLinks.length > 0 && (
                        <div className="mb-3 space-y-1.5">
                          {parsedLinks.map((link, i) => (
                            <a
                              key={i}
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 bg-gray-800/50 border border-gray-700/30 rounded-lg px-3 py-2 text-sm hover:border-blue-500/30 transition-colors group"
                            >
                              <LinkIcon size={14} className="text-blue-400 shrink-0" />
                              <span className="text-blue-400 group-hover:text-blue-300 truncate flex-1">{link}</span>
                              <ExternalLink size={12} className="text-gray-500 shrink-0" />
                            </a>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Submission attachments */}
                {sub.attachments && sub.attachments.length > 0 && (
                  <div className="mb-3">
                    {/* Images */}
                    {sub.attachments.filter((a) => !a.filename?.endsWith('.pdf')).length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-2">
                        {sub.attachments.filter((a) => !a.filename?.endsWith('.pdf')).map((att) => (
                          <a
                            key={att.id}
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block rounded-lg overflow-hidden bg-gray-800 hover:opacity-90 transition-opacity"
                          >
                            <img src={att.url} alt={att.filename || ''} className="w-full h-28 object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                    {/* PDFs / other files */}
                    {sub.attachments.filter((a) => a.filename?.endsWith('.pdf')).map((att) => (
                      <a
                        key={att.id}
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 bg-gray-800/50 border border-gray-700/30 rounded-lg px-3 py-2 text-sm hover:border-gray-600 transition-colors mb-1.5"
                      >
                        <FileText size={14} className="text-red-400 shrink-0" />
                        <span className="text-gray-300 truncate flex-1">{att.filename || 'Document'}</span>
                        <Download size={14} className="text-gray-500 shrink-0" />
                      </a>
                    ))}
                  </div>
                )}

                {isCreator && bounty.status === 'OPEN' && sub.status === 'PENDING' && (
                  <Button
                    size="sm"
                    onClick={() => handleApprove(sub.id, sub.contributor.walletAddress)}
                    isLoading={isApproving === sub.id}
                    className="glow-purple"
                  >
                    <Check size={16} className="mr-1.5" />
                    Approve & Pay
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
