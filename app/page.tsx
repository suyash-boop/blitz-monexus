'use client';

import Link from 'next/link';
import { Trophy, Users, Zap, Shield, ArrowRight, Sparkles, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { isConnected, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && isConnected) {
      router.push('/feed');
    }
  }, [ready, isConnected, router]);

  return (
    <div className="min-h-screen overflow-hidden">
      {/* Hero Section */}
      <section className="relative py-24 md:py-32 px-4">
        {/* Background effects */}
        <div className="absolute inset-0 grid-bg" />
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/30 via-transparent to-cyan-900/20" />
        <div className="absolute top-20 left-1/4 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1.5s' }} />

        <div className="relative max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary-soft border border-indigo-500/20 rounded-full text-sm text-primary-text mb-8">
            {/* <Sparkles size={14} /> */}
            <span>Built on Monad</span>
            {/* <ChevronRight size={14} /> */}
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight tracking-tight">
            <span className="text-text-primary">Community Meets</span>
            <br />
            <span className="gradient-text">On-Chain Bounties</span>
          </h1>

          <p className="text-lg md:text-xl text-text-secondary mb-10 max-w-2xl mx-auto leading-relaxed">
            Post, connect, and earn on Monad. Create bounties with instant payouts,
            build your on-chain reputation, and turn community engagement into real rewards.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/feed">
              <Button size="lg" className="group px-8 py-3.5 text-base glow-purple hover:glow-purple-strong transition-shadow">
                Explore Feed
                <ArrowRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/bounties">
              <Button variant="outline" size="lg" className="px-8 py-3.5 text-base border-glass-border-hover hover:border-primary/50 hover:bg-primary/5">
                Browse Bounties
              </Button>
            </Link>
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-center gap-8 md:gap-16 mt-16 pt-8 border-t border-glass-border">
            <div className="text-center">
              <p className="text-2xl md:text-3xl font-bold text-text-primary">100%</p>
              <p className="text-sm text-text-muted mt-1">On-Chain</p>
            </div>
            <div className="w-px h-10 bg-glass-border" />
            <div className="text-center">
              <p className="text-2xl md:text-3xl font-bold text-text-primary">Instant</p>
              <p className="text-sm text-text-muted mt-1">Payouts</p>
            </div>
            <div className="w-px h-10 bg-glass-border" />
            <div className="text-center">
              <p className="text-2xl md:text-3xl font-bold text-text-primary">0%</p>
              <p className="text-sm text-text-muted mt-1">Platform Fee</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-sm font-medium text-primary-text mb-3 tracking-wide uppercase">Features</p>
            <h2 className="text-3xl md:text-4xl font-bold text-text-primary">
              Built for the Monad Community
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            <FeatureCard
              icon={<Trophy size={24} />}
              iconColor="text-primary-text"
              iconBg="bg-primary-soft"
              title="On-Chain Bounties"
              description="Create bounties with MON locked in escrow. Instant payouts when work is completed."
            />
            <FeatureCard
              icon={<Users size={24} />}
              iconColor="text-pink-400"
              iconBg="bg-pink-500/10"
              title="Social Feed"
              description="Share updates, connect with builders, and engage with the Monad community."
            />
            <FeatureCard
              icon={<Zap size={24} />}
              iconColor="text-yellow-400"
              iconBg="bg-yellow-500/10"
              title="Instant Payments"
              description="Leverage Monad's speed for micro-bounties and instant on-chain settlements."
            />
            <FeatureCard
              icon={<Shield size={24} />}
              iconColor="text-green-400"
              iconBg="bg-green-500/10"
              title="On-Chain Reputation"
              description="Build trust through completed bounties and verified contributions."
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative py-20 px-4">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a0f]/50 to-transparent" />
        <div className="relative max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-sm font-medium text-primary-text mb-3 tracking-wide uppercase">Getting Started</p>
            <h2 className="text-3xl md:text-4xl font-bold text-text-primary">
              How It Works
            </h2>
          </div>

          <div className="relative">
            {/* Connecting line */}
            <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-indigo-500/50 via-cyan-500/50 to-indigo-500/50 hidden md:block" />

            <div className="space-y-6">
              <Step
                number={1}
                title="Connect Your Wallet"
                description="Sign in with your wallet using Privy. Your wallet address is your identity — no email or password needed."
                color="from-indigo-500 to-indigo-600"
              />
              <Step
                number={2}
                title="Create or Claim Bounties"
                description="Post bounties with MON locked in smart contract escrow, or browse and claim existing bounties to start earning."
                color="from-cyan-500 to-cyan-600"
              />
              <Step
                number={3}
                title="Submit Work & Get Paid"
                description="Complete tasks, submit your work for review, and receive instant on-chain payments upon approval."
                color="from-purple-500 to-indigo-600"
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 px-4">
        <div className="absolute inset-0 grid-bg opacity-50" />
        <div className="relative max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-soft rounded-2xl mb-6">
            <Trophy size={32} className="text-primary-text" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-text-primary">
            Ready to Get Started?
          </h2>
          <p className="text-text-secondary mb-8 text-lg">
            Join the Monad community and start earning through bounties today.
          </p>
          <Link href="/bounties">
            <Button size="lg" className="group px-8 py-3.5 text-base glow-purple hover:glow-purple-strong transition-shadow">
              Explore Bounties
              <ArrowRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  iconColor,
  iconBg,
  title,
  description,
}: {
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
}) {
  return (
    <div className="group p-6 glass rounded-2xl transition-all card-hover">
      <div className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center ${iconColor} mb-4 group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2 text-text-primary">{title}</h3>
      <p className="text-text-secondary text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function Step({
  number,
  title,
  description,
  color,
}: {
  number: number;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <div className="flex items-start gap-5 group">
      <div className={`relative z-10 flex-shrink-0 w-12 h-12 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center font-bold text-white text-lg shadow-lg group-hover:scale-110 transition-transform`}>
        {number}
      </div>
      <div className="pt-1 flex-1">
        <h3 className="text-lg font-semibold mb-1.5 text-text-primary group-hover:text-primary-text transition-colors">{title}</h3>
        <p className="text-text-secondary leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
