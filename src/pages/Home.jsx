import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Zap, Crown, Check, ArrowRight, Play, Shield, Globe, Clock, Loader2, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function getCookie(name) {
  return document.cookie.split('; ').reduce((acc, c) => {
    const [k, v] = c.split('=');
    return k === name ? decodeURIComponent(v) : acc;
  }, null);
}

function isValidInstagramUrl(url) {
  return /instagram\.com\/(reel|p|tv)\/[A-Za-z0-9_-]+/.test(url);
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [wrongPasteUrl, setWrongPasteUrl] = useState(false);
  const urlInputRef = useRef(null);
  const [apiKey, setApiKey] = useState(() => getCookie('reels2link_apikey') || '');
  const [userTier, setUserTier] = useState('free');
  const [slotIndex, setSlotIndex] = useState(0);
  const [slotAnim, setSlotAnim] = useState('idle'); // 'idle' | 'out' | 'in'
  const [slotPaused, setSlotPaused] = useState(false);

  useEffect(() => {
    if (!apiKey) { setUserTier('free'); return; }
    fetch(`${API}/api/me`, { headers: { 'Authorization': `Bearer ${apiKey}` } })
      .then(r => r.json())
      .then(data => { if (data.tier) setUserTier(data.tier); })
      .catch(() => {});
  }, [apiKey]);

  const slotItems = [
    { label: userTier === 'free' ? 'Upgrade' : 'My Plan', href: '/app' },
    { label: 'Sign out', href: null, action: () => { document.cookie = 'reels2link_apikey=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'; setApiKey(''); setUserTier('free'); } },
    { label: 'Check API', href: '/app' },
  ];

  useEffect(() => {
    if (!apiKey) return;
    const interval = setInterval(() => {
      if (slotPaused) return;
      setSlotAnim('out');
      setTimeout(() => {
        setSlotIndex(i => (i + 1) % slotItems.length);
        setSlotAnim('in');
        setTimeout(() => setSlotAnim('idle'), 300);
      }, 300);
    }, 3000);
    return () => clearInterval(interval);
  }, [apiKey, slotPaused]);

  const handleConvert = async (e) => {
    e.preventDefault();
    if (!isValidInstagramUrl(url)) { setError('Invalid Instagram URL'); return; }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API}/api/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Conversion failed');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">

      {/* Nav */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-100 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Instagram className="w-6 h-6 text-pink-600" />
            <span className="font-bold text-xl">Reels2Link</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="#features" className="hover:text-gray-900 transition">Features</a>
            <a href="#pricing" className="hover:text-gray-900 transition">Pricing</a>
            <a href="#api" className="hover:text-gray-900 transition">API</a>
          </div>
          {apiKey ? (
            <div
              className="relative overflow-hidden flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-xl cursor-pointer select-none transition-all duration-100"
              style={{ background: 'linear-gradient(160deg, #ec4899, #9333ea)', boxShadow: '0 4px 0 #7e22ce, 0 6px 10px rgba(236,72,153,0.3)', width: '130px', justifyContent: 'center' }}
              onMouseEnter={() => setSlotPaused(true)}
              onMouseLeave={e => { setSlotPaused(false); e.currentTarget.style.boxShadow = '0 4px 0 #7e22ce, 0 6px 10px rgba(236,72,153,0.3)'; e.currentTarget.style.transform = ''; }}
              onMouseDown={e => { e.currentTarget.style.boxShadow = '0 1px 0 #7e22ce, 0 2px 4px rgba(236,72,153,0.2)'; e.currentTarget.style.transform = 'translateY(3px)'; }}
              onMouseUp={e => { e.currentTarget.style.boxShadow = '0 4px 0 #7e22ce, 0 6px 10px rgba(236,72,153,0.3)'; e.currentTarget.style.transform = ''; }}
              onClick={() => {
                const item = slotItems[slotIndex];
                if (item.action) item.action();
                else if (item.href) window.location.href = item.href;
              }}
            >
              <span className="absolute inset-0 rounded-xl pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 60%)' }} />
              <span
                className="relative flex items-center gap-2 transition-all duration-300"
                style={{
                  transform: slotAnim === 'out' ? 'translateY(100%)' : slotAnim === 'in' ? 'translateY(-100%)' : 'translateY(0)',
                  opacity: slotAnim === 'idle' ? 1 : 0,
                }}
              >
                {slotItems[slotIndex].label} <ArrowRight className="w-4 h-4" />
              </span>
            </div>
          ) : (
            <Link
              to="/app"
              className="relative overflow-hidden flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-xl transition-all duration-100 active:translate-y-0.5"
              style={{ background: 'linear-gradient(160deg, #ec4899, #9333ea)', boxShadow: '0 4px 0 #7e22ce, 0 6px 10px rgba(236,72,153,0.3)' }}
            >
              <span className="absolute inset-0 rounded-xl pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 60%)' }} />
              <span className="relative flex items-center gap-2">Get Started <ArrowRight className="w-4 h-4" /></span>
            </Link>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6 bg-gradient-to-br from-purple-50 via-white to-pink-50">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded-full mb-6">
            <Zap className="w-3 h-3" /> Instant Instagram Reel Conversion
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight text-gray-900 mb-6">
            Convert Reels.<br />
            <span className="bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
              Host Anywhere.
            </span>
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10">
            Turn any Instagram Reel into a fast, hosted video link in seconds. 
            Built for developers, creators, and AI agents.
          </p>

          {/* Convert Form or CTA */}
          {apiKey ? (
            <form onSubmit={handleConvert} className="max-w-xl mx-auto mb-6 space-y-3">
              <div
                className="relative rounded-2xl overflow-hidden"
                style={{
                  background: 'linear-gradient(145deg, #e8e8e8, #f5f5f5)',
                  boxShadow: 'inset 3px 3px 7px #d0d0d0, inset -2px -2px 5px #ffffff',
                  border: '1px solid #e0e0e0',
                }}
              >
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-400">
                  <Instagram className="w-4 h-4" />
                </span>
                <input
                  ref={urlInputRef}
                  type="url"
                  value={url}
                  onChange={(e) => {
                    const val = e.target.value;
                    const trimmed = val.trim();
                    const delta = trimmed.length - url.trim().length;
                    if (delta > 5) {
                      const clean = trimmed.replace(/[\r\n\t\u200B\u00A0]/g, '');
                      const isInstagram = /^https?:\/\/(www\.)?instagram\.com\/([A-Za-z0-9_.]+\/)?(reel|reels|p|tv)\/[A-Za-z0-9_-]+/i.test(clean);
                      if (!isInstagram || trimmed.length >= 200) {
                        setUrl(val);
                        setTimeout(() => { setUrl(''); setWrongPasteUrl(true); setTimeout(() => setWrongPasteUrl(false), 2500); }, 0);
                        return;
                      }
                    }
                    setUrl(val);
                  }}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData('text').trim();
                    const isInstagram = /^https?:\/\/(www\.)?instagram\.com\/([A-Za-z0-9_.]+\/)?(reel|reels|p|tv)\/[A-Za-z0-9_-]+/i.test(pasted);
                    if (!isInstagram || pasted.length >= 200) {
                      e.preventDefault();
                      setWrongPasteUrl(true);
                      setTimeout(() => setWrongPasteUrl(false), 2500);
                    }
                  }}
                  placeholder="https://www.instagram.com/reel/..."
                  required
                  className="w-full bg-transparent pl-10 pr-28 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none"
                />
                {!url && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        const trimmed = text.trim();
                        const isInstagram = /^https?:\/\/(www\.)?instagram\.com\/([A-Za-z0-9_.]+\/)?(reel|reels|p|tv)\/[A-Za-z0-9_-]+/i.test(trimmed);
                        if (isInstagram && trimmed.length < 200) { setUrl(trimmed); setWrongPasteUrl(false); }
                        else { setWrongPasteUrl(true); setTimeout(() => setWrongPasteUrl(false), 2500); }
                      } catch {}
                    }}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 transition-colors text-xs font-medium ${wrongPasteUrl ? 'text-red-400' : 'text-gray-400 hover:text-pink-500'}`}
                  >
                    {wrongPasteUrl ? (
                      <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg><span>Wrong URL</span></>
                    ) : (
                      <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg><span>Paste URL</span></>
                    )}
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="relative overflow-hidden w-full flex items-center justify-center gap-2 px-6 py-3 text-white font-semibold text-sm rounded-2xl transition-all duration-100 active:translate-y-1 disabled:opacity-50"
                style={{ background: 'linear-gradient(160deg, #ec4899, #9333ea)', boxShadow: '0 6px 0 #7e22ce, 0 8px 14px rgba(236,72,153,0.35)' }}
              >
                <span className="absolute inset-0 rounded-2xl pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 60%)' }} />
                <span className="relative flex items-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {loading ? 'Converting...' : 'Convert'}
                </span>
              </button>
              {error && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
              {result && (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <a href={result.viewer_url || result.url || result.link} target="_blank" rel="noopener noreferrer" className="underline font-mono truncate">{result.viewer_url || result.url || result.link}</a>
                </div>
              )}
            </form>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto mb-6 justify-center">
              <Link
                to="/app"
                className="relative overflow-hidden flex items-center justify-center gap-2 px-8 py-3 text-white font-semibold text-sm rounded-2xl whitespace-nowrap transition-all duration-100 active:translate-y-1"
                style={{ background: 'linear-gradient(160deg, #ec4899, #9333ea)', boxShadow: '0 6px 0 #7e22ce, 0 8px 14px rgba(236,72,153,0.35)' }}
              >
                <span className="absolute inset-0 rounded-2xl pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 60%)' }} />
                <span className="relative flex items-center gap-2"><Play className="w-4 h-4" /> Try it free</span>
              </Link>
            </div>
          )}
          {apiKey && (userTier === 'pro' || userTier === 'ultra') ? (
            <div className="flex items-center justify-center gap-2">
              {userTier === 'pro' && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #9333ea, #7c3aed)' }}>
                  <Zap className="w-3.5 h-3.5" /> PRO
                </span>
              )}
              {userTier === 'ultra' && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #1f2937, #111827)' }}>
                  <Crown className="w-3.5 h-3.5" /> ULTRA
                </span>
              )}
              <span className="text-sm text-gray-500">You're signed in</span>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No credit card required · 10 free conversions/day</p>
          )}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16">Everything you need</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Zap className="w-6 h-6 text-purple-600" />,
                title: "Lightning Fast",
                desc: "Parallel conversion queue with smart caching. Most reels ready in under 30 seconds."
              },
              {
                icon: <Globe className="w-6 h-6 text-pink-600" />,
                title: "Global CDN",
                desc: "Videos served from Bunny.net's 119 PoPs worldwide. 25ms average latency globally."
              },
              {
                icon: <Shield className="w-6 h-6 text-green-600" />,
                title: "Secure by Default",
                desc: "API key auth, rate limiting, adaptive trust system, and disposable email filtering."
              },
              {
                icon: <Clock className="w-6 h-6 text-blue-600" />,
                title: "Flexible TTL",
                desc: "Set link expiry from 1 hour to 2 years. Auto-cleanup keeps storage costs low."
              },
              {
                icon: <Crown className="w-6 h-6 text-yellow-600" />,
                title: "Developer API",
                desc: "RESTful JSON API with Bearer auth. One endpoint, one response. Simple."
              },
              {
                icon: <Play className="w-6 h-6 text-red-600" />,
                title: "AI Agent Ready",
                desc: "x402 protocol support — AI agents can discover and pay for conversions autonomously."
              }
            ].map((f) => (
              <div key={f.title} className="p-6 rounded-xl border border-gray-100 hover:border-purple-200 hover:shadow-md transition">
                <div className="mb-4">{f.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Simple Pricing</h2>
          <p className="text-center text-gray-500 mb-16">Start free. Scale when you need to.</p>
          <div className="grid md:grid-cols-3 gap-6">

            {/* Free */}
            <div className="bg-white rounded-2xl border border-gray-200 p-8 flex flex-col">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Free</p>
              <p className="text-4xl font-black mb-1">$0</p>
              <p className="text-gray-400 text-sm mb-8">Forever free</p>
              <ul className="space-y-3 flex-1 mb-8">
                {["10 conversions / day", "100 conversions / month", "Links up to 30 days", "Standard queue", "API access"].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/app"
                className="relative overflow-hidden block text-center py-2.5 text-gray-700 text-sm font-semibold rounded-xl transition-all duration-100 active:translate-y-0.5"
                style={{ background: 'linear-gradient(145deg, #f5f5f5, #e8e8e8)', boxShadow: '0 4px 0 #c0c0c0, 0 6px 10px rgba(0,0,0,0.1)', border: '1px solid #ddd' }}
              >
                <span className="absolute inset-0 rounded-xl pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 55%)' }} />
                <span className="relative">Get started</span>
              </Link>
            </div>

            {/* Pro */}
            <div className="bg-gradient-to-b from-purple-600 to-purple-700 rounded-2xl p-8 flex flex-col relative shadow-xl shadow-purple-200">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-pink-500 text-white text-xs px-3 py-1 rounded-full font-semibold">Most Popular</span>
              <p className="text-sm font-semibold text-purple-200 uppercase tracking-wide mb-2">Pro</p>
              <p className="text-4xl font-black text-white mb-1">$9</p>
              <p className="text-purple-300 text-sm mb-8">per month</p>
              <ul className="space-y-3 flex-1 mb-8">
                {["200 conversions / day", "5,000 conversions / month", "Links up to 1 year", "Priority queue", "API access", "Usage analytics"].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-white">
                    <Check className="w-4 h-4 text-purple-300 flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/app"
                className="relative overflow-hidden block text-center py-2.5 text-purple-700 text-sm font-semibold rounded-xl transition-all duration-100 active:translate-y-0.5"
                style={{ background: 'linear-gradient(145deg, #ffffff, #f0ebff)', boxShadow: '0 4px 0 #c4b5fd, 0 6px 10px rgba(124,58,237,0.2)', border: '1px solid #e9d5ff' }}
              >
                <span className="absolute inset-0 rounded-xl pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 55%)' }} />
                <span className="relative">Upgrade to Pro</span>
              </Link>
            </div>

            {/* Ultra */}
            <div className="bg-white rounded-2xl border border-gray-200 p-8 flex flex-col">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Ultra</p>
              <p className="text-4xl font-black mb-1">$29</p>
              <p className="text-gray-400 text-sm mb-8">per month</p>
              <ul className="space-y-3 flex-1 mb-8">
                {["Unlimited / day", "50,000 conversions / month", "Links up to 2 years", "Dedicated queue", "API access", "Full analytics", "Priority support"].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/app"
                className="relative overflow-hidden block text-center py-2.5 text-white text-sm font-semibold rounded-xl transition-all duration-100 active:translate-y-0.5"
                style={{ background: 'linear-gradient(145deg, #1f2937, #111827)', boxShadow: '0 4px 0 #030712, 0 6px 10px rgba(0,0,0,0.3)', border: '1px solid #374151' }}
              >
                <span className="absolute inset-0 rounded-xl pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 55%)' }} />
                <span className="relative">Upgrade to Ultra</span>
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* API Section */}
      <section id="api" className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h2 className="text-3xl font-bold mb-4">Built for Developers</h2>
              <p className="text-gray-500 mb-6">One API call. Get a hosted video link back. That's it.</p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <Check className="w-4 h-4 text-purple-500" /> RESTful JSON API
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <Check className="w-4 h-4 text-purple-500" /> API Key auth
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <Check className="w-4 h-4 text-purple-500" /> Usage statistics
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-400">
                  <span className="text-xs font-semibold px-1.5 py-0.5 bg-yellow-100 text-yellow-600 rounded">Soon</span> x402 AI agent payments
                </li>
              </ul>

              {/* API Key Section */}
              {apiKey ? (
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Your API Key</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(apiKey);
                        // You could add a toast notification here
                      }}
                      className="text-xs bg-purple-500 text-white px-2 py-1 rounded hover:bg-purple-600 transition"
                    >
                      Copy
                    </button>
                  </div>
                  <code className="text-xs text-gray-600 break-all font-mono">{apiKey}</code>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-yellow-800">
                    <strong>No API key?</strong> <Link to="/app" className="underline">Sign in</Link> to get your API key and start building.
                  </p>
                </div>
              )}

              {/* Quick API Example */}
              <div className="bg-gray-900 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-400">Quick Example</span>
                  <button
                    onClick={() => {
                      const code = `curl -X POST https://reels2link.onrender.com/api/convert \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://instagram.com/reel/ABC123/"}'`;
                      navigator.clipboard.writeText(code);
                    }}
                    className="text-xs bg-gray-700 text-white px-2 py-1 rounded hover:bg-gray-600 transition"
                  >
                    Copy
                  </button>
                </div>
                <pre className="text-xs text-green-400 font-mono overflow-x-auto">
{`curl -X POST https://reels2link.onrender.com/api/convert \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://instagram.com/reel/ABC123/"}'`}
                </pre>
              </div>
            </div>

            {/* MCP Server Section */}
            <div>
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-5 h-5 text-purple-600" />
                  <h3 className="text-xl font-bold text-gray-900">MCP Server Available</h3>
                </div>
                <p className="text-gray-600 mb-4">
                  Connect Reels2Link to AI agents with our Model Context Protocol (MCP) server. 
                  Enable Claude, Cursor, and other AI tools to convert Instagram Reels directly.
                </p>
                
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-green-500" />
                    Natural language video conversion
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-green-500" />
                    Built-in authentication handling
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-green-500" />
                    Usage statistics and history
                  </div>
                </div>

                <div className="bg-white rounded-lg p-3 mb-4">
                  <p className="text-xs font-medium text-gray-700 mb-1">Installation</p>
                  <code className="text-xs text-gray-600 font-mono">git clone https://github.com/Keepgettingup/reels2link.git</code>
                  <p className="text-xs text-gray-500 mt-1">cd reels2link/mcp && npm install && npm run build</p>
                </div>

                <a
                  href="https://github.com/Keepgettingup/reels2link/tree/main/mcp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  View MCP Documentation
                </a>
              </div>

              {/* API Endpoints Quick Reference */}
              <div className="mt-6 bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-3">API Endpoints</h4>
                <div className="space-y-2 text-xs">
                  <div className="font-mono">
                    <span className="text-purple-600">POST</span> /api/convert
                  </div>
                  <div className="font-mono">
                    <span className="text-blue-600">GET</span> /api/me
                  </div>
                  <div className="font-mono">
                    <span className="text-blue-600">GET</span> /api/stats
                  </div>
                  <div className="font-mono">
                    <span className="text-blue-600">GET</span> /api/my-conversions
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Instagram className="w-5 h-5 text-pink-500" />
                <span className="font-bold text-white">Reels2Link</span>
              </div>
              <p className="text-sm leading-relaxed">Instagram Reel Converter & hosting service. Fast, reliable, developer-friendly.</p>
            </div>
            <div>
              <p className="font-semibold text-white mb-4">Product</p>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition">Pricing</a></li>
                <li><a href="#api" className="hover:text-white transition">API Docs</a></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-white mb-4">Company</p>
              <ul className="space-y-2 text-sm">
                <li><Link to="/about" className="hover:text-white transition">About</Link></li>
                <li><a href="mailto:contact@reels2link.link" className="hover:text-white transition">Contact</a></li>
                <li><a href="mailto:privacy@reels2link.link" className="hover:text-white transition">DMCA</a></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-white mb-4">Legal</p>
              <ul className="space-y-2 text-sm">
                <li><Link to="/tos" className="hover:text-white transition">Terms of Service</Link></li>
                <li><Link to="/privacy" className="hover:text-white transition">Privacy Policy</Link></li>
                <li><Link to="/imprint" className="hover:text-white transition">Imprint</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
            <p>© {new Date().getFullYear()} Reels2Link. All rights reserved.</p>
            <p>Not affiliated with Instagram or Meta.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
