'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { Heart, MessageCircle, Share2, Trophy, Send, ChevronDown, Check } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { formatRelativeTime, formatAddress, getAvatarUrl, formatMON } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

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

interface PostCardProps {
  post: {
    id: string;
    author: {
      walletAddress: string;
      displayName?: string | null;
      avatarUrl?: string | null;
    };
    content: string;
    type: 'REGULAR' | 'BOUNTY';
    createdAt: Date | string;
    _count: { likes: number; comments: number };
    isLiked: boolean;
    media?: Array<{
      id: string;
      type: string;
      url: string;
    }>;
    bounty?: {
      id?: string;
      title: string;
      amount: string;
      status: string;
      deadline: Date | string;
    } | null;
  };
}

export function PostCard({ post }: PostCardProps) {
  const { walletAddress, isConnected } = useAuth();
  const [liked, setLiked] = useState(post.isLiked);
  const [likeCount, setLikeCount] = useState(post._count.likes);
  const [isLiking, setIsLiking] = useState(false);
  const [copied, setCopied] = useState(false);

  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [commentCount, setCommentCount] = useState(post._count.comments);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);

  const handleLike = async () => {
    if (!walletAddress || isLiking) return;
    setIsLiking(true);
    setLiked(!liked);
    setLikeCount((c) => (liked ? c - 1 : c + 1));

    try {
      const res = await fetch(`/api/posts/${post.id}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      });
      if (res.ok) {
        const data = await res.json();
        setLiked(data.liked);
        setLikeCount(data.count);
      } else {
        setLiked(post.isLiked);
        setLikeCount(post._count.likes);
      }
    } catch {
      setLiked(post.isLiked);
      setLikeCount(post._count.likes);
    } finally {
      setIsLiking(false);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleComments = async () => {
    if (!showComments && comments.length === 0) {
      setLoadingComments(true);
      try {
        const res = await fetch(`/api/posts/${post.id}/comments`);
        if (res.ok) {
          const data = await res.json();
          setComments(data);
        }
      } catch (err) {
        console.error('Failed to load comments:', err);
      } finally {
        setLoadingComments(false);
      }
    }
    setShowComments(!showComments);
  };

  const handleCommentClick = () => {
    if (!showComments) {
      toggleComments();
    }
    setTimeout(() => commentInputRef.current?.focus(), 100);
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !walletAddress || isSubmittingComment) return;
    setIsSubmittingComment(true);

    try {
      const res = await fetch(`/api/posts/${post.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, content: commentText.trim() }),
      });
      if (res.ok) {
        const newComment = await res.json();
        setComments((prev) => [...prev, newComment]);
        setCommentCount((c) => c + 1);
        setCommentText('');
      }
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleCommentKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitComment();
    }
  };

  const bountyId = post.bounty?.id || post.id;

  return (
    <Card className="transition-all">
      {/* Author header */}
      <div className="flex items-start justify-between">
        <Link
          href={`/profile/${post.author.walletAddress}`}
          className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
        >
          <Avatar
            src={post.author.avatarUrl || getAvatarUrl(post.author.walletAddress)}
            size="md"
            alt={post.author.displayName || post.author.walletAddress}
          />
          <div>
            <p className="font-medium text-text-primary text-sm">
              {post.author.displayName || formatAddress(post.author.walletAddress)}
            </p>
            <p className="text-xs text-text-muted">
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

      {/* Content */}
      <Link href={`/post/${post.id}`}>
        <p className="mt-3 text-text-secondary whitespace-pre-wrap leading-relaxed text-[15px]">{post.content}</p>
      </Link>

      {/* Post images */}
      {post.media && post.media.length > 0 && (
        <div className={`mt-3 grid gap-1.5 rounded-xl overflow-hidden ${
          post.media.length === 1 ? 'grid-cols-1' :
          post.media.length === 2 ? 'grid-cols-2' :
          post.media.length === 3 ? 'grid-cols-2' : 'grid-cols-2'
        }`}>
          {post.media.map((m, i) => (
            <a
              key={m.id}
              href={m.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`block bg-white/[0.03] overflow-hidden ${
                post.media!.length === 3 && i === 0 ? 'row-span-2' : ''
              }`}
            >
              <img
                src={m.url}
                alt=""
                className={`w-full object-cover hover:opacity-90 transition-opacity ${
                  post.media!.length === 1 ? 'max-h-96' : 'h-48'
                }`}
              />
            </a>
          ))}
        </div>
      )}

      {/* Bounty preview */}
      {post.bounty && (
        <Link href={`/bounties/${bountyId}`}>
          <div className="mt-4 p-4 bg-primary-soft border border-indigo-500/20 rounded-xl hover:border-indigo-500/30 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-primary-text text-sm">{post.bounty.title}</h4>
              <span className="text-lg font-bold text-primary-text">
                {formatMON(post.bounty.amount)} <span className="text-xs font-normal text-text-muted">MON</span>
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <Badge
                variant={post.bounty.status === 'OPEN' ? 'success' : 'warning'}
                size="sm"
              >
                {post.bounty.status}
              </Badge>
              <span className="text-text-muted text-xs">
                Deadline: {new Date(post.bounty.deadline).toLocaleDateString()}
              </span>
            </div>
          </div>
        </Link>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-glass-border">
        <div className="flex items-center space-x-1">
          <button
            onClick={handleLike}
            disabled={!walletAddress || isLiking}
            className={`group flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
              liked
                ? 'text-red-400 bg-red-500/10'
                : 'text-text-muted hover:text-red-400 hover:bg-red-500/10'
            } ${!walletAddress ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Heart size={17} fill={liked ? 'currentColor' : 'none'} className={liked ? '' : 'group-hover:scale-110 transition-transform'} />
            <span className="text-sm font-medium tabular-nums">{likeCount}</span>
          </button>

          <button
            onClick={handleCommentClick}
            className="group flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-text-muted hover:text-blue-400 hover:bg-blue-500/10 transition-all"
          >
            <MessageCircle size={17} className="group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium tabular-nums">{commentCount}</span>
          </button>
        </div>

        <button
          onClick={handleShare}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
            copied
              ? 'text-green-400 bg-green-500/10'
              : 'text-text-muted hover:text-text-primary hover:bg-white/[0.06]'
          }`}
        >
          {copied ? <Check size={17} /> : <Share2 size={17} />}
          {copied && <span className="text-xs font-medium">Copied</span>}
        </button>
      </div>

      {/* Inline comments section */}
      {showComments && (
        <div className="mt-3 pt-3 border-t border-glass-border">
          {loadingComments ? (
            <div className="flex items-center justify-center py-4">
              <div className="w-5 h-5 border-2 border-glass-border border-t-primary rounded-full animate-spin" />
            </div>
          ) : comments.length > 0 ? (
            <div className="space-y-3 mb-3">
              {comments.slice(0, 3).map((comment) => (
                <div key={comment.id} className="flex gap-2.5">
                  <Avatar
                    src={comment.author.avatarUrl || getAvatarUrl(comment.author.walletAddress)}
                    size="sm"
                    alt={comment.author.displayName || comment.author.walletAddress}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="bg-white/[0.03] rounded-xl px-3 py-2">
                      <Link
                        href={`/profile/${comment.author.walletAddress}`}
                        className="text-xs font-medium text-text-secondary hover:text-primary-text transition-colors"
                      >
                        {comment.author.displayName || formatAddress(comment.author.walletAddress)}
                      </Link>
                      <p className="text-sm text-text-secondary mt-0.5 leading-relaxed">{comment.content}</p>
                    </div>
                    <span className="text-xs text-text-faint ml-3 mt-1 inline-block">
                      {formatRelativeTime(comment.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
              {comments.length > 3 && (
                <Link
                  href={`/post/${post.id}`}
                  className="flex items-center gap-1 text-sm text-primary-text hover:text-primary-hover ml-10 transition-colors"
                >
                  <span>View all {commentCount} comments</span>
                  <ChevronDown size={14} />
                </Link>
              )}
            </div>
          ) : (
            <p className="text-sm text-text-faint text-center py-3">No comments yet</p>
          )}

          {/* Comment input */}
          {isConnected && (
            <div className="flex items-center gap-2">
              <Avatar
                src={getAvatarUrl(walletAddress || '')}
                size="sm"
                alt="You"
              />
              <div className="flex-1 flex items-center bg-white/[0.03] rounded-xl border border-glass-border focus-within:border-primary/40 transition-colors">
                <input
                  ref={commentInputRef}
                  type="text"
                  placeholder="Write a comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={handleCommentKeyDown}
                  className="flex-1 bg-transparent text-sm text-text-secondary placeholder-text-faint px-3 py-2 outline-none"
                />
                <button
                  onClick={handleSubmitComment}
                  disabled={!commentText.trim() || isSubmittingComment}
                  className="p-2 text-primary-text hover:text-primary-hover disabled:text-text-faint disabled:cursor-not-allowed transition-colors"
                >
                  <Send size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default PostCard;
