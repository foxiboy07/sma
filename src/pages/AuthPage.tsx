import React, { useState } from 'react';
import { Wifi, Eye, EyeOff } from 'lucide-react';
import { Button, Input } from '../components/ui';
import { useAuth } from '../hooks/useAuth';

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password);
        if (error) setError(error.message);
      } else {
        const { error } = await signUp(email, password, name);
        if (error) setError(error.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0B0F] flex">
      {/* Left: Branding */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 bg-gradient-to-br from-[#0A0B0F] via-[#0d1117] to-[#111318] border-r border-[#1E2130]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Wifi className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-[#F0F2FF] tracking-tight">FlowPulse</span>
        </div>

        <div>
          <h1 className="text-4xl font-bold text-[#F0F2FF] leading-tight mb-4">
            Automate every DM.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
              Convert every intent.
            </span>
          </h1>
          <p className="text-[#8B90A7] text-lg leading-relaxed mb-8">
            The multi-channel DM automation platform that competes with ManyChat, Tidio, and Intercom — built for Instagram, Facebook, and TikTok.
          </p>

          <div className="grid grid-cols-2 gap-4">
            {[
              { stat: '50K', label: 'Webhooks/sec' },
              { stat: '95%', label: 'Attribution accuracy' },
              { stat: '60%', label: 'AI cost saved via cache' },
              { stat: '< 500ms', label: 'End-to-end latency' },
            ].map(item => (
              <div key={item.label} className="bg-[#1A1C24] border border-[#2A2E42] rounded-xl p-4">
                <p className="text-2xl font-bold text-blue-400 mb-1">{item.stat}</p>
                <p className="text-xs text-[#8B90A7]">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#4B5068]">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          <span>All systems operational</span>
        </div>
      </div>

      {/* Right: Auth form */}
      <div className="flex-1 flex items-center justify-center p-8 max-w-lg mx-auto w-full">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <Wifi className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-[#F0F2FF]">FlowPulse</span>
          </div>

          <h2 className="text-2xl font-bold text-[#F0F2FF] mb-1">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-sm text-[#8B90A7] mb-8">
            {mode === 'signin' ? 'Sign in to your FlowPulse account' : 'Start automating your DMs in minutes'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <Input
                label="Brand / Company name"
                type="text"
                placeholder="Acme Inc."
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            )}
            <Input
              label="Email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#8B90A7]">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder={mode === 'signup' ? 'Create a strong password' : 'Enter your password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="h-9 w-full rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-[#F0F2FF] placeholder:text-[#4B5068] px-3 pr-10 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4B5068] hover:text-[#8B90A7]"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                {error}
              </div>
            )}

            <Button variant="primary" size="lg" type="submit" loading={loading} className="w-full">
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
              className="text-sm text-[#8B90A7] hover:text-[#F0F2FF] transition-colors"
            >
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <span className="text-blue-400 font-medium">
                {mode === 'signin' ? 'Sign up free' : 'Sign in'}
              </span>
            </button>
          </div>

          <p className="mt-8 text-center text-xs text-[#4B5068]">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
