import { cn } from '@/lib/utils';

interface AvatarProps {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function Avatar({ src, alt, fallback, size = 'md', className }: AvatarProps) {
  const sizes = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-xl',
  };

  const getFallbackInitials = () => {
    if (fallback) {
      return fallback.slice(0, 2).toUpperCase();
    }
    if (alt) {
      return alt.slice(0, 2).toUpperCase();
    }
    return '?';
  };

  if (src) {
    return (
      <img
        src={src}
        alt={alt || 'Avatar'}
        className={cn(
          'rounded-full object-cover bg-white/[0.06]',
          sizes[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center font-medium text-white',
        sizes[size],
        className
      )}
    >
      {getFallbackInitials()}
    </div>
  );
}

export default Avatar;
