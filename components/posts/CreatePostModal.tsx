'use client';

import { useState, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Image, Send, AlertCircle, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getAvatarUrl, formatAddress } from '@/lib/utils';
import { useUploadThing } from '@/lib/uploadthing-components';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export function CreatePostModal({ isOpen, onClose, onCreated }: CreatePostModalProps) {
  const { isConnected, walletAddress } = useAuth();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const { startUpload } = useUploadThing('postImage');

  const charProgress = Math.min((content.length / 5000) * 100, 100);
  const isOverLimit = content.length > 5000;
  const isNearLimit = content.length > 4500;

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = 4 - images.length;
    const newFiles = files.slice(0, remaining);

    const newImages = newFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    setImages((prev) => [...prev, ...newImages]);
    e.target.value = '';
  }, [images.length]);

  const removeImage = useCallback((index: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleSubmit = async () => {
    if (!content.trim() || !walletAddress) return;

    setIsSubmitting(true);
    setError(null);
    try {
      let imageUrls: string[] = [];

      if (images.length > 0) {
        setIsUploading(true);
        const uploadResult = await startUpload(images.map((img) => img.file));
        setIsUploading(false);

        if (!uploadResult) {
          throw new Error('Image upload failed');
        }
        imageUrls = uploadResult.map((r) => r.ufsUrl);
      }

      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          content: content.trim(),
          type: 'REGULAR',
          images: imageUrls,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create post');
      }

      images.forEach((img) => URL.revokeObjectURL(img.preview));
      setContent('');
      setImages([]);
      onClose();
      onCreated?.();
    } catch (err: any) {
      console.error('Failed to create post:', err);
      setError(err.message || 'Failed to create post');
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isConnected) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Create Post">
        <div className="text-center py-6">
          <p className="text-text-secondary">Please connect your wallet to create a post.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Post" size="lg">
      <div className="space-y-4">
        {/* Author info */}
        <div className="flex items-center gap-3">
          <Avatar
            src={getAvatarUrl(walletAddress || '')}
            size="md"
            alt="Your avatar"
          />
          <div>
            <p className="font-medium text-text-primary text-sm">
              {formatAddress(walletAddress || '')}
            </p>
            <p className="text-xs text-text-muted">Posting to feed</p>
          </div>
        </div>

        {/* Textarea */}
        <textarea
          placeholder="What's happening on Monad?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={5}
          className="w-full bg-transparent text-text-secondary placeholder-text-faint text-base leading-relaxed resize-none outline-none border-none p-0"
          autoFocus
        />

        {/* Image previews */}
        {images.length > 0 && (
          <div className={`grid gap-2 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {images.map((img, i) => (
              <div key={i} className="relative group rounded-xl overflow-hidden bg-white/[0.03]">
                <img
                  src={img.preview}
                  alt={`Upload ${i + 1}`}
                  className="w-full h-40 object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-black/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-glass-border" />

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1">
            <label
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                images.length >= 4
                  ? 'text-text-faint cursor-not-allowed'
                  : 'text-text-muted hover:text-primary-text hover:bg-primary-soft'
              }`}
              title={images.length >= 4 ? 'Max 4 images' : 'Add image'}
            >
              <Image size={20} />
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageSelect}
                disabled={images.length >= 4}
                className="hidden"
              />
            </label>
          </div>

          <div className="flex items-center space-x-3">
            <span className={`text-xs font-medium tabular-nums ${
              isOverLimit ? 'text-red-400' : isNearLimit ? 'text-yellow-400' : 'text-text-faint'
            }`}>
              {content.length > 0 && `${content.length}/5000`}
            </span>

            {/* Progress ring */}
            {content.length > 0 && (
              <svg width="24" height="24" viewBox="0 0 24 24" className="-rotate-90">
                <circle
                  cx="12" cy="12" r="10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-text-faint"
                />
                <circle
                  cx="12" cy="12" r="10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray={`${charProgress * 0.628} 62.8`}
                  strokeLinecap="round"
                  className={isOverLimit ? 'text-red-400' : isNearLimit ? 'text-yellow-400' : 'text-primary-text'}
                />
              </svg>
            )}

            <Button
              onClick={handleSubmit}
              isLoading={isSubmitting}
              disabled={!content.trim() || isOverLimit || isUploading}
              size="sm"
              className="px-5"
            >
              {isUploading ? (
                <>
                  {/* <Loader2 size={14} className="mr-1.5 animate-spin" /> */}
                  Uploading...
                </>
              ) : (
                <>
                  <Send size={14} className="mr-1.5" />
                  Post
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default CreatePostModal;
