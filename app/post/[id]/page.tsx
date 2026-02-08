'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/hooks/useAuth';
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Share2,
  Trophy,
  Send,
  Check,
} from 'lucide-react';
import Link from 'next/link';
import { formatAddress, formatMON, formatRelativeTime, getAvatarUrl } from '@/lib/utils';

interface PostData {
  id: string;
  content: string;
  type: 'REGULAR' | 'BOUNTY';
  createdAt: string;
  author: {
    id: string;
    walletAddress: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  media?: Array<{
    id: string;
    type: string;
    url: string;
  }>;
  bounty?: {
    id: string;
    title: string;
    amount: string;
    status: string;
    deadline: string;
  };
  _count: { likes: number; comments: number };
  isLiked: boolean;
}

interface CommentData {
  id: string;
  content: string;
  createdAt: string;
  author: {
    walletAddress: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

export default function PostDetailPage() {
  const params = useParams();
  const { walletAddress, isConnected } = useAuth();
  const postId = params.id as string;

  const [post, setPost] = useState<PostData | null>(null);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPost();
    fetchComments();
  }, [postId]);

  async function fetchPost() {
    try {
      const res = await fetch(`/api/posts/${postId}`);
      if (res.ok) {
        const data = await res.json();
        setPost(data);
        setLiked(data.isLiked);
        setLikeCount(data._count.likes);
      }
    } catch (err) {
      console.error('Failed to fetch post:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchComments() {
    try {
      const res = await fetch(`/api/posts/${postId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    }
  }

  async function handleLike() {
    if (!isConnected || !walletAddress) return;

    setLiked(!liked);
    setLikeCount((c) => (liked ? c - 1 : c + 1));

    try {
      const res = await fetch(`/api/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      });
      if (res.ok) {
        const data = await res.json();
        setLiked(data.liked);
        setLikeCount(data.count);
      }
    } catch (err) {
      console.error('Failed to toggle like:', err);
    }
  }

  async function handleComment() {
    if (!commentText.trim() || !walletAddress) return;
    setIsSubmittingComment(true);

    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, content: commentText.trim() }),
      });

      if (res.ok) {
        const newComment = await res.json();
        setComments((prev) => [...prev, newComment]);
        setCommentText('');
      }
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setIsSubmittingComment(false);
    }
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const handleCommentKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleComment();
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-8 h-8 border-2 border-gray-600 border-t-purple-400 rounded-full animate-spin mx-auto" />
        <p className="text-gray-500 text-sm mt-4">Loading post...</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <MessageCircle size={28} className="text-gray-600" />
        </div>
        <p className="text-gray-400 text-lg font-medium mb-2">Post not found</p>
        <p className="text-gray-600 text-sm mb-6">This post may have been deleted or doesn&apos;t exist.</p>
        <Link href="/feed">
          <Button variant="outline">
            <ArrowLeft size={16} className="mr-2" />
            Back to Feed
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Back button */}
      <Link
        href="/feed"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-5 transition-colors"
      >
        <ArrowLeft size={18} />
        <span className="text-sm">Back to feed</span>
      </Link>

      {/* Post */}
      <Card className="mb-6" padding="lg">
        <div className="flex items-start justify-between">
          <Link
            href={`/profile/${post.author.walletAddress}`}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <Avatar
              src={post.author.avatarUrl || getAvatarUrl(post.author.walletAddress)}
              size="md"
              alt={post.author.displayName || post.author.walletAddress}
            />
            <div>
              <p className="font-medium text-white">
                {post.author.displayName || formatAddress(post.author.walletAddress)}
              </p>
              <p className="text-sm text-gray-500">
                {formatRelativeTime(post.createdAt)}
              </p>
            </div>
          </Link>
          {post.type === 'BOUNTY' && (
            <Badge variant="purple">
              <Trophy size={12} className="mr-1" />
              Bounty
            </Badge>
          )}
        </div>

        <p className="mt-5 text-gray-200 whitespace-pre-wrap leading-relaxed text-base">
          {post.content}
        </p>

        {/* Post images */}
        {post.media && post.media.length > 0 && (
          <div className={`mt-4 grid gap-1.5 rounded-xl overflow-hidden ${
            post.media.length === 1 ? 'grid-cols-1' :
            post.media.length === 2 ? 'grid-cols-2' : 'grid-cols-2'
          }`}>
            {post.media.map((m, i) => (
              <a
                key={m.id}
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`block bg-gray-800 overflow-hidden ${
                  post.media!.length === 3 && i === 0 ? 'row-span-2' : ''
                }`}
              >
                <img
                  src={m.url}
                  alt=""
                  className={`w-full object-cover hover:opacity-90 transition-opacity ${
                    post.media!.length === 1 ? 'max-h-[500px]' : 'h-48'
                  }`}
                />
              </a>
            ))}
          </div>
        )}

        {post.bounty && (
          <Link href={`/bounties/${post.bounty.id}`}>
            <div className="mt-5 p-4 bg-purple-900/20 border border-purple-800/50 rounded-lg hover:bg-purple-900/30 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-purple-300">{post.bounty.title}</h4>
                <span className="text-lg font-bold text-purple-400">
                  {formatMON(post.bounty.amount)} MON
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <Badge
                  variant={post.bounty.status === 'OPEN' ? 'success' : 'warning'}
                  size="sm"
                >
                  {post.bounty.status}
                </Badge>
                <span className="text-gray-400">
                  Deadline: {new Date(post.bounty.deadline).toLocaleDateString()}
                </span>
              </div>
            </div>
          </Link>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-800">
          <div className="flex items-center space-x-1">
            <button
              onClick={handleLike}
              disabled={!walletAddress}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
                liked
                  ? 'text-red-500 bg-red-500/10'
                  : 'text-gray-400 hover:text-red-500 hover:bg-red-500/10'
              } ${!walletAddress ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Heart size={20} fill={liked ? 'currentColor' : 'none'} />
              <span className="text-sm font-medium">{likeCount}</span>
            </button>
            <button
              onClick={() => commentInputRef.current?.focus()}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
            >
              <MessageCircle size={20} />
              <span className="text-sm font-medium">{comments.length}</span>
            </button>
          </div>
          <button
            onClick={handleShare}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
              copied
                ? 'text-green-400 bg-green-500/10'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {copied ? <Check size={18} /> : <Share2 size={18} />}
            {copied && <span className="text-xs font-medium">Copied</span>}
          </button>
        </div>
      </Card>

      {/* Comments section */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-4">
          Comments
          {comments.length > 0 && (
            <span className="text-gray-500 font-normal ml-2">({comments.length})</span>
          )}
        </h3>

        {/* Comment input */}
        {isConnected ? (
          <div className="flex items-start gap-3 mb-6">
            <Avatar
              src={getAvatarUrl(walletAddress || '')}
              size="sm"
              alt="You"
            />
            <div className="flex-1 flex items-center bg-gray-800/60 rounded-lg border border-gray-700/50 focus-within:border-purple-500/50 transition-colors">
              <input
                ref={commentInputRef}
                type="text"
                placeholder="Write a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={handleCommentKeyDown}
                className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-500 px-4 py-3 outline-none"
              />
              <button
                onClick={handleComment}
                disabled={!commentText.trim() || isSubmittingComment}
                className="p-3 text-purple-400 hover:text-purple-300 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmittingComment ? (
                  <div className="w-4 h-4 border-2 border-gray-600 border-t-purple-400 rounded-full animate-spin" />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>
          </div>
        ) : (
          <Card className="mb-6 text-center" padding="md">
            <p className="text-gray-500 text-sm">Connect your wallet to join the conversation.</p>
          </Card>
        )}

        {/* Comments list */}
        <div className="space-y-3">
          {comments.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle size={24} className="text-gray-700 mx-auto mb-2" />
              <p className="text-gray-600 text-sm">No comments yet. Be the first!</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <Avatar
                  src={comment.author.avatarUrl || getAvatarUrl(comment.author.walletAddress)}
                  size="sm"
                  alt={comment.author.displayName || comment.author.walletAddress}
                />
                <div className="flex-1 min-w-0">
                  <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Link
                        href={`/profile/${comment.author.walletAddress}`}
                        className="font-medium text-sm text-gray-300 hover:text-purple-400 transition-colors"
                      >
                        {comment.author.displayName || formatAddress(comment.author.walletAddress)}
                      </Link>
                      <span className="text-xs text-gray-600">
                        {formatRelativeTime(comment.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed">{comment.content}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
