import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Download, Loader2, CheckCircle2, AlertCircle, Zap, Crown, ExternalLink, Eye, Copy, Check } from 'lucide-react';
import { getFingerprint } from './fingerprint.js';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function getCookie(name) {
  return document.cookie.split('; ').reduce((acc, c) => {
    const [k, v] = c.split('=');
    return k === name ? decodeURIComponent(v) : acc;
  }, null);
}

function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function App() {
  const [url, setUrl] = useState('');
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkUrls, setBulkUrls] = useState('');
  const [bulkResults, setBulkResults] = useState(null);
  const [apiKey, setApiKeyState] = useState(() => getCookie('reels2link_apikey') || '');
  
  // Helper to set API key and persist to cookie
  const setApiKey = (key) => {
    setApiKeyState(key);
    if (key) {
      setCookie('reels2link_apikey', key, 90); // 90 days
    } else {
      // Delete cookie when signing out
      document.cookie = 'reels2link_apikey=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    }
  };
  const [ttl, setTtl] = useState('1mo');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [userTier, setUserTier] = useState('free');
  const [pasteHeld, setPasteHeld] = useState(false);
  const [wrongPasteUrl, setWrongPasteUrl] = useState(false);
  const [wrongPasteKey, setWrongPasteKey] = useState(false);
  const [lastProvider, setLastProvider] = useState(() => getCookie('reels2link_provider') || null);

  // Restore TTL preference from cookie
  useEffect(() => {
    const savedTtl = getCookie('reels2link_ttl');
    if (savedTtl) setTtl(savedTtl);
  }, []);

  const [conversionStats, setConversionStats] = useState(null);
  const [myConversions, setMyConversions] = useState([]);
  const [linkFilter, setLinkFilter] = useState('all');
  const [subscriptionEndsAt, setSubscriptionEndsAt] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const urlInputRef = useRef(null);
  const apiKeyInputRef = useRef(null);
  const [sliderMinutes, setSliderMinutes] = useState(60);
  const [showSlider, setShowSlider] = useState(false);
  const sliderHoverRef = useRef(null);

  // Fetch user tier + stats when apiKey changes
  useEffect(() => {
    if (!apiKey) { setUserTier('free'); setConversionStats(null); setMyConversions([]); return; }
    fetch(`${API}/api/me`, { headers: { 'Authorization': `Bearer ${apiKey}` } })
      .then(r => r.json())
      .then(data => { if (data.tier) setUserTier(data.tier); if (data.subscription_ends_at) setSubscriptionEndsAt(data.subscription_ends_at); })
      .catch(() => {});
    fetch(`${API}/api/stats`, { headers: { 'Authorization': `Bearer ${apiKey}` } })
      .then(r => r.json())
      .then(data => { if (!data.error) setConversionStats(data); })
      .catch(() => {});
    fetch(`${API}/api/my-conversions`, { headers: { 'Authorization': `Bearer ${apiKey}` } })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setMyConversions(data); })
      .catch(() => {});
  }, [apiKey]);

  // Redeem OTP token from URL (OAuth callback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      window.history.replaceState({}, document.title, window.location.pathname);
      fetch(`${API}/auth/redeem?token=${encodeURIComponent(token)}`)
        .then(r => r.json())
        .then(data => {
          console.log('[redeem]', data);
          if (data.apiKey) setApiKey(data.apiKey);
          else setAuthError('Token invalid or expired - please sign in again.');
        })
        .catch((err) => {
          console.error('[redeem error]', err);
          setAuthError('Login failed - please try again.');
        });
    }
  }, []);

  const handleOAuth = async (provider) => {
    const fp = await getFingerprint();
    setCookie('reels2link_provider', provider, 90);
    setLastProvider(provider);
    const base = API;
    window.location.href = `${base}/auth/${provider}?fp=${encodeURIComponent(fp)}`;
  };

  const handleUpgrade = async (tier) => {
    if (!apiKey) {
      alert('Bitte zuerst einloggen');
      return;
    }
    setCheckoutLoading(tier);
    try {
      const response = await fetch(`${API}/api/billing/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ tier }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Checkout failed');
      window.location.href = data.url;
    } catch (err) {
      alert(err.message);
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!apiKey) {
      alert('Bitte zuerst einloggen');
      return;
    }
    if (!confirm('Subscription wirklich kündigen?')) return;
    setCancelLoading(true);
    try {
      const response = await fetch(`${API}/api/billing/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Cancel failed');
      alert('Subscription gekündigt! Du behältst den Zugriff bis zum Ende der Laufzeit.');
    } catch (err) {
      alert(err.message);
    } finally {
      setCancelLoading(false);
    }
  };

  const handleDowngrade = async () => {
    if (!apiKey) return;
    if (!confirm('Downgrade to Pro? Your Ultra plan will be cancelled and you will be subscribed to Pro.')) return;
    setCancelLoading(true);
    try {
      const cancelRes = await fetch(`${API}/api/billing/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      });
      if (!cancelRes.ok) throw new Error('Cancel failed');
      setCheckoutLoading('pro');
      const checkoutRes = await fetch(`${API}/api/billing/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ tier: 'pro' }),
      });
      const data = await checkoutRes.json();
      if (!checkoutRes.ok) throw new Error(data.error || 'Checkout failed');
      window.location.href = data.url;
    } catch (err) {
      alert(err.message);
    } finally {
      setCancelLoading(false);
      setCheckoutLoading(null);
    }
  };

  const handleTtlChange = (val) => {
    setTtl(val);
    setCookie('reels2link_ttl', val, 90);
  };

  const handleConvert = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setBulkResults(null);

    try {
      if (bulkMode) {
        // Parse bulk URLs (split by newlines, commas, or spaces)
        const urls = bulkUrls
          .split(/[\n\r,]+/)
          .map(u => u.trim())
          .filter(u => u.length > 0);

        if (urls.length === 0) {
          throw new Error('Please enter at least one Instagram URL');
        }

        if (urls.length > 10) {
          throw new Error('Maximum 10 URLs per bulk conversion');
        }

        const response = await fetch(`${API}/api/convert/bulk`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ urls, ttl }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Bulk conversion failed');
        }

        setBulkResults(data);
        setSliderMinutes(60);
        if (ttl.endsWith('m')) handleTtlChange('1h');
        fetch(`${API}/api/my-conversions`, { headers: { 'Authorization': `Bearer ${apiKey}` } })
          .then(r => r.json()).then(d => { if (Array.isArray(d)) setMyConversions(d); }).catch(() => {});
      } else {
        // Single conversion
        const response = await fetch(`${API}/api/convert`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ url, ttl }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Conversion failed');
        }

        setResult(data);
        setSliderMinutes(60);
        if (ttl.endsWith('m')) handleTtlChange('1h');
        fetch(`${API}/api/my-conversions`, { headers: { 'Authorization': `Bearer ${apiKey}` } })
          .then(r => r.json()).then(d => { if (Array.isArray(d)) setMyConversions(d); }).catch(() => {});
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center justify-center gap-3 mb-4 hover:opacity-80 transition-opacity">
            <Instagram className="w-12 h-12 text-pink-600" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
              Reels2Link
            </h1>
          </Link>
          <p className="text-gray-600">Instagram Reel Converter</p>
        </div>

        {/* Auth Section */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-1">Authentication</h2>

          {apiKey ? (
            <div className="flex items-center gap-3 mt-3 p-3 bg-green-50 rounded-xl border border-green-200">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-green-700">Signed in</p>
                  {userTier === 'pro' && (
                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #9333ea, #7c3aed)' }}>
                      <Zap className="w-3 h-3" /> PRO
                    </span>
                  )}
                  {userTier === 'ultra' && (
                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #1f2937, #111827)' }}>
                      <Crown className="w-3 h-3" /> ULTRA
                    </span>
                  )}
                </div>
                <p className="text-xs text-green-500 font-mono">{apiKey.slice(0, 18)}…</p>
              </div>
              <button onClick={() => setApiKey('')} className="ml-auto text-xs text-gray-400 hover:text-red-400 transition">Sign out</button>
            </div>
          ) : (
          <>
          <p className="text-sm text-gray-400 mb-4 text-center">Two-click sign-in</p>
          {/* Social Login Buttons */}
          <div className="flex flex-col gap-4">
            {/* Google Button */}
            <button
              onClick={() => handleOAuth('google')}
              className="relative w-full overflow-hidden rounded-2xl font-semibold text-gray-800 transition-all duration-150 active:scale-95 active:translate-y-0.5"
              style={{
                padding: '14px 24px',
                background: 'linear-gradient(160deg, #f8f8f8 0%, #e8e8e8 100%)',
                boxShadow: lastProvider === 'google'
                  ? '0 6px 0 #4285F4, 0 8px 14px rgba(66,133,244,0.35)'
                  : '0 6px 0 #b0b0b0, 0 8px 12px rgba(0,0,0,0.15)',
                border: lastProvider === 'google' ? '1px solid #4285F4' : '1px solid #ddd',
              }}
              onMouseDown={e => { e.currentTarget.style.boxShadow = '0 2px 0 #b0b0b0, 0 3px 6px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(4px)'; }}
              onMouseUp={e => { e.currentTarget.style.boxShadow = '0 6px 0 #b0b0b0, 0 8px 12px rgba(0,0,0,0.15)'; e.currentTarget.style.transform = ''; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 6px 0 #b0b0b0, 0 8px 12px rgba(0,0,0,0.15)'; e.currentTarget.style.transform = ''; }}
            >
              {/* Glass shine overlay */}
              <span className="absolute inset-0 rounded-2xl pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 60%)'}} />
              <span className="relative flex items-center justify-center gap-3">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </span>
            </button>

            {/* GitHub Button */}
            <button
              onClick={() => handleOAuth('github')}
              className="relative w-full overflow-hidden rounded-2xl font-semibold text-white transition-all duration-150 active:scale-95"
              style={{
                padding: '14px 24px',
                background: 'linear-gradient(160deg, #3a3a3a 0%, #1a1a1a 100%)',
                boxShadow: lastProvider === 'github'
                  ? '0 6px 0 #6e40c9, 0 8px 14px rgba(110,64,201,0.4)'
                  : '0 6px 0 #0a0a0a, 0 8px 12px rgba(0,0,0,0.3)',
                border: lastProvider === 'github' ? '1px solid #6e40c9' : '1px solid #444',
              }}
              onMouseDown={e => { e.currentTarget.style.boxShadow = '0 2px 0 #0a0a0a, 0 3px 6px rgba(0,0,0,0.2)'; e.currentTarget.style.transform = 'translateY(4px)'; }}
              onMouseUp={e => { e.currentTarget.style.boxShadow = '0 6px 0 #0a0a0a, 0 8px 12px rgba(0,0,0,0.3)'; e.currentTarget.style.transform = ''; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 6px 0 #0a0a0a, 0 8px 12px rgba(0,0,0,0.3)'; e.currentTarget.style.transform = ''; }}
            >
              {/* Glass shine overlay */}
              <span className="absolute inset-0 rounded-2xl pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 60%)' }} />
              <span className="relative flex items-center justify-center gap-3">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                Continue with GitHub
              </span>
            </button>
          </div>

          {/* Auth Error */}
          {authError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
                <p className="text-sm text-red-700">{authError}</p>
              </div>
            </div>
          )}

          {/* API Key Input */}
          <div className="mt-5 pt-5 border-t border-gray-100">
            <div className="flex items-center justify-center gap-2 mb-3">
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400">
                API Key
              </label>
              {userTier === 'pro' && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #9333ea, #7c3aed)' }}>
                  <Zap className="w-3 h-3" /> PRO
                </span>
              )}
              {userTier === 'ultra' && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #1f2937, #111827)' }}>
                  <Crown className="w-3 h-3" /> ULTRA
                </span>
              )}
            </div>

            {apiKey ? (
              <div
                className="relative rounded-2xl overflow-hidden"
                style={{
                  background: 'linear-gradient(145deg, #e8e8e8, #f5f5f5)',
                  boxShadow: 'inset 3px 3px 7px #d0d0d0, inset -2px -2px 5px #ffffff',
                  border: '1px solid #e0e0e0',
                }}
              >
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </span>
                <input
                  ref={apiKeyInputRef}
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData('text').trim();
                    if (!pasted.startsWith('spool_live_') || pasted.length >= 120) {
                      e.preventDefault();
                      setWrongPasteKey(true);
                      setTimeout(() => setWrongPasteKey(false), 2500);
                    }
                  }}
                  className="w-full bg-transparent pl-10 pr-4 py-3 text-sm text-gray-700 focus:outline-none"
                />
              </div>
            ) : (
              <div className="relative flex justify-center">
                <input
                  ref={apiKeyInputRef}
                  type="text"
                  className="absolute inset-0 opacity-0 cursor-default w-full"
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData('text').trim();
                    if (pasted.startsWith('spool_live_') && pasted.length < 120) {
                      setApiKey(pasted);
                      setWrongPasteKey(false);
                    } else {
                      setWrongPasteKey(true);
                      setTimeout(() => setWrongPasteKey(false), 2500);
                    }
                    e.preventDefault();
                  }}
                  readOnly
                  tabIndex={-1}
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      const trimmed = text.trim();
                      if (trimmed.startsWith('spool_live_') && trimmed.length < 120) {
                        setApiKey(trimmed);
                        setWrongPasteKey(false);
                      } else {
                        setWrongPasteKey(true);
                        setTimeout(() => setWrongPasteKey(false), 2500);
                      }
                    } catch {}
                  }}
                  onMouseEnter={e => e.currentTarget.previousSibling.focus()}
                  className="relative overflow-hidden rounded-2xl font-semibold text-gray-600 transition-all duration-100 select-none active:translate-y-1"
                  style={{
                    padding: '12px 32px',
                    background: 'linear-gradient(145deg, #f5f5f5, #e8e8e8)',
                    boxShadow: '0 5px 0 #c0c0c0, 0 7px 10px rgba(0,0,0,0.1)',
                    border: '1px solid #ddd',
                  }}
                >
                  <span className="absolute inset-0 rounded-2xl pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 55%)' }} />
                  <span className="relative flex items-center gap-2">
                    {wrongPasteKey ? (
                      <>
                        <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        <span className="text-red-400">Wrong paste</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Paste API Key
                      </>
                    )}
                  </span>
                </button>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-2 text-center">Auto-filled after sign-in</p>
          </div>
          </>
          )}
        </div>

        {/* Stats Section */}
        {conversionStats && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Your Stats</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-purple-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-purple-700">{conversionStats.total}</p>
                <p className="text-xs text-purple-500 mt-0.5">Total Conversions</p>
              </div>
              <div className="bg-pink-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-pink-700">{conversionStats.total_views}</p>
                <p className="text-xs text-pink-500 mt-0.5">Total Views</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-blue-700">{conversionStats.daily}</p>
                <p className="text-xs text-blue-500 mt-0.5">Today</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-green-700">{conversionStats.monthly}</p>
                <p className="text-xs text-green-500 mt-0.5">This Month</p>
              </div>
            </div>
          </div>
        )}

        {/* My Links */}
        {myConversions.length > 0 && (() => {
          const now = new Date();
          const filterMs = { today: 864e5, week: 7*864e5, month: 30*864e5, '2m': 60*864e5, '3m': 90*864e5, '4m': 120*864e5, '6m': 180*864e5, '12m': 365*864e5, all: Infinity };
          const filtered = linkFilter === 'all' ? myConversions : myConversions.filter(c => now - new Date(c.created_at) <= filterMs[linkFilter]);
          const filters = [
            { key: 'today', label: 'Today' },
            { key: 'week', label: 'This Week' },
            { key: 'month', label: 'This Month' },
            { key: '2m', label: '2 Months' },
            { key: '3m', label: '3 Months' },
            { key: '4m', label: '4 Months' },
            { key: '6m', label: '6 Months' },
            { key: '12m', label: '12 Months' },
            { key: 'all', label: 'All Time' },
          ];
          return (
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">My Links</h2>
                <span className="text-xs text-gray-400">{filtered.length} link{filtered.length !== 1 ? 's' : ''}</span>
              </div>
              {/* Filter tabs */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {filters.map(f => (
                  <button
                    key={f.key}
                    onClick={() => setLinkFilter(f.key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      linkFilter === f.key
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >{f.label}</button>
                ))}
              </div>
              {filtered.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No links in this period</p>
              ) : (
                <div className="flex flex-col divide-y divide-gray-100">
                  {filtered.map(c => {
                    const expired = c.expires_at && new Date(c.expires_at) < new Date();
                    const shortUrl = c.instagram_url?.replace('https://www.instagram.com/', '').replace('https://instagram.com/', '').split('?')[0];
                    const viewerUrl = `${window.location.origin}/v/${c.id}`;
                    return (
                      <div key={c.id} className="flex items-center gap-3 py-3">
                        <div className="flex-1 min-w-0">
                          <a href={viewerUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-sm font-medium text-purple-700 hover:text-purple-900 truncate">
                            <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{shortUrl || c.id}</span>
                          </a>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(c.created_at).toLocaleDateString()} · {c.size_mb ? `${c.size_mb} MB` : ''}
                            {expired ? <span className="text-red-400 ml-1">· Expired</span> : ''}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(viewerUrl);
                            setCopiedId(c.id);
                            setTimeout(() => setCopiedId(null), 2000);
                          }}
                          className="flex-shrink-0 p-1.5 rounded-lg hover:bg-purple-50 transition"
                          title="Copy link"
                        >
                          {copiedId === c.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                        </button>
                        <div className="flex items-center gap-1 text-sm flex-shrink-0">
                          <Eye className="w-3.5 h-3.5 text-purple-400" />
                          <span className="font-semibold text-gray-700">{c.views || 0}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Pricing Section */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-1">Pricing</h2>
          <p className="text-sm text-gray-500 mb-4">Upgrade for more conversions & longer links</p>
          <div className="grid grid-cols-3 gap-3">
            {/* Free */}
            <div className="border border-gray-200 rounded-lg p-4 flex flex-col">
              <p className="font-semibold text-gray-700">Free</p>
              <p className="text-2xl font-bold mt-1">€0</p>
              <ul className="text-xs text-gray-500 mt-3 space-y-1 flex-1">
                <li>✓ 10 Conversions/Day</li>
                <li>✓ 100 Conversions/Month</li>
                <li>✓ Links up to 30 days</li>
                <li>✓ Standard Queue</li>
              </ul>
              <div className="mt-4 h-8">
                {(userTier === 'pro' || userTier === 'ultra') && (
                  <button
                    onClick={handleCancel}
                    disabled={cancelLoading}
                    className="text-xs text-gray-400 hover:text-red-500 underline disabled:opacity-50"
                  >
                    {cancelLoading ? 'Cancelling...' : 'Cancel Subscription'}
                  </button>
                )}
              </div>
            </div>
            {/* Pro */}
            <div className="border-2 border-purple-500 rounded-lg p-4 flex flex-col relative">
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-purple-500 text-white text-xs px-2 py-0.5 rounded-full">Popular</span>
              <p className="font-semibold text-purple-700">Pro</p>
              <p className="text-2xl font-bold mt-1">€9<span className="text-sm font-normal text-gray-500">/mo</span></p>
              <ul className="text-xs text-gray-500 mt-3 space-y-1 flex-1">
                <li>✓ 200 Conversions/Day</li>
                <li>✓ 5,000 Conversions/Month</li>
                <li>✓ Links up to 1 year</li>
                <li>✓ Priority Queue</li>
              </ul>
              {(userTier === 'pro' || userTier === 'ultra') ? (
                <div className="mt-4 flex flex-col items-center gap-1">
                  <div className="w-full flex items-center justify-center gap-1 py-2 text-purple-700 text-sm font-semibold rounded-xl bg-purple-50 border border-purple-200">
                    <Zap className="w-3 h-3" /> Current Plan
                  </div>
                  {subscriptionEndsAt && new Date(subscriptionEndsAt) > new Date() && (
                    <p className="text-xs text-red-500 text-center">Cancels {new Date(subscriptionEndsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  )}
                  {userTier === 'ultra' && (
                    <button
                      onClick={handleDowngrade}
                      disabled={cancelLoading}
                      className="text-xs text-gray-400 hover:text-orange-500 underline disabled:opacity-50"
                    >
                      {cancelLoading ? 'Processing...' : 'Downgrade to Pro'}
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => handleUpgrade('pro')}
                  disabled={checkoutLoading === 'pro'}
                  className="relative mt-4 w-full overflow-hidden flex items-center justify-center gap-1 py-2 text-white text-sm font-semibold rounded-xl transition-all duration-100 disabled:opacity-50"
                  style={{ background: 'linear-gradient(160deg, #9333ea, #7c3aed)', boxShadow: '0 4px 0 #5b21b6, 0 6px 10px rgba(124,58,237,0.4)' }}
                  onMouseDown={e => { if (!e.currentTarget.disabled) { e.currentTarget.style.boxShadow = '0 1px 0 #5b21b6, 0 2px 4px rgba(124,58,237,0.3)'; e.currentTarget.style.transform = 'translateY(3px)'; }}}
                  onMouseUp={e => { e.currentTarget.style.boxShadow = '0 4px 0 #5b21b6, 0 6px 10px rgba(124,58,237,0.4)'; e.currentTarget.style.transform = ''; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 0 #5b21b6, 0 6px 10px rgba(124,58,237,0.4)'; e.currentTarget.style.transform = ''; }}
                >
                  <span className="absolute inset-0 rounded-xl pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 60%)' }} />
                  <span className="relative flex items-center gap-1">
                    {checkoutLoading === 'pro' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                    Upgrade
                  </span>
                </button>
              )}
            </div>
            {/* Ultra */}
            <div className="border border-gray-200 rounded-lg p-4 flex flex-col">
              <p className="font-semibold text-gray-700">Ultra</p>
              <p className="text-2xl font-bold mt-1">€29<span className="text-sm font-normal text-gray-500">/mo</span></p>
              <ul className="text-xs text-gray-500 mt-3 space-y-1 flex-1">
                <li>✓ Unlimited/Day</li>
                <li>✓ 50,000 Conversions/Month</li>
                <li>✓ Links up to 2 years</li>
                <li>✓ Dedicated Queue</li>
              </ul>
              {userTier === 'ultra' ? (
                <div className="mt-4 flex flex-col items-center gap-1">
                  <div className="w-full flex items-center justify-center gap-1 py-2 text-gray-700 text-sm font-semibold rounded-xl bg-gray-100 border border-gray-300">
                    <Crown className="w-3 h-3" /> Current Plan
                  </div>
                  {subscriptionEndsAt && new Date(subscriptionEndsAt) > new Date() && (
                    <p className="text-xs text-red-500 text-center">Cancels {new Date(subscriptionEndsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => handleUpgrade('ultra')}
                  disabled={checkoutLoading === 'ultra'}
                  className="relative mt-4 w-full overflow-hidden flex items-center justify-center gap-1 py-2 text-white text-sm font-semibold rounded-xl transition-all duration-100 disabled:opacity-50"
                  style={{ background: 'linear-gradient(160deg, #1f2937, #111827)', boxShadow: '0 4px 0 #030712, 0 6px 10px rgba(0,0,0,0.35)' }}
                  onMouseDown={e => { if (!e.currentTarget.disabled) { e.currentTarget.style.boxShadow = '0 1px 0 #030712, 0 2px 4px rgba(0,0,0,0.25)'; e.currentTarget.style.transform = 'translateY(3px)'; }}}
                  onMouseUp={e => { e.currentTarget.style.boxShadow = '0 4px 0 #030712, 0 6px 10px rgba(0,0,0,0.35)'; e.currentTarget.style.transform = ''; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 0 #030712, 0 6px 10px rgba(0,0,0,0.35)'; e.currentTarget.style.transform = ''; }}
                >
                  <span className="absolute inset-0 rounded-xl pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 60%)' }} />
                  <span className="relative flex items-center gap-1">
                    {checkoutLoading === 'ultra' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Crown className="w-3 h-3" />}
                    Upgrade
                  </span>
                </button>
              )}
            </div>
          </div>
          
        </div>

        {/* Conversion Form */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Convert Reel</h2>
            <button
              type="button"
              onClick={() => {
                setBulkMode(!bulkMode);
                setUrl('');
                setBulkUrls('');
                setResult(null);
                setBulkResults(null);
                setError(null);
              }}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
                bulkMode
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {bulkMode ? '🔄 Single Mode' : '📋 Bulk Mode'}
            </button>
          </div>
          <form onSubmit={handleConvert} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                {bulkMode ? 'Instagram Reel URLs (one per line)' : 'Instagram Reel URL'}
              </label>
              <div
                className="relative rounded-2xl overflow-hidden"
                style={{
                  background: 'linear-gradient(145deg, #e8e8e8, #f5f5f5)',
                  boxShadow: 'inset 3px 3px 7px #d0d0d0, inset -2px -2px 5px #ffffff',
                  border: '1px solid #e0e0e0',
                }}
              >
                <span className="absolute left-4 text-pink-400" style={{ top: bulkMode ? '12px' : '50%', transform: bulkMode ? 'none' : 'translateY(-50%)' }}>
                  <Instagram className="w-4 h-4" />
                </span>
                {bulkMode ? (
                  <textarea
                    value={bulkUrls}
                    onChange={(e) => setBulkUrls(e.target.value)}
                    placeholder="https://www.instagram.com/reel/ABC123&#10;https://www.instagram.com/reel/DEF456&#10;(max 10 URLs)"
                    rows={6}
                    required
                    className="w-full bg-transparent pl-10 pr-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none resize-none"
                  />
                ) : (
                  <>
                    <input
                      ref={urlInputRef}
                      type="url"
                      value={url}
                      onChange={(e) => {
                        const val = e.target.value;
                        const trimmed = val.trim();
                        const delta = trimmed.length - url.trim().length;
                        // Looks like a paste: jumped by more than 5 chars at once
                        if (delta > 5) {
                          const clean = trimmed.replace(/[\r\n\t\u200B\u00A0]/g, '');
                          const isInstagram = /^https?:\/\/(www\.)?instagram\.com\/([A-Za-z0-9_.]+\/)?(reel|reels|p|tv)\/[A-Za-z0-9_-]+/i.test(clean);
                          if (!isInstagram || trimmed.length >= 200) {
                            // Let React render the invalid value briefly, then clear it
                            setUrl(val);
                            setTimeout(() => {
                              setUrl('');
                              setWrongPasteUrl(true);
                              setTimeout(() => setWrongPasteUrl(false), 2500);
                            }, 0);
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
                      className="w-full bg-transparent pl-10 pr-12 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none"
                    />
                    {!url && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const text = await navigator.clipboard.readText();
                            const trimmed = text.trim();
                            const isInstagram = /^https?:\/\/(www\.)?instagram\.com\/([A-Za-z0-9_.]+\/)?(reel|reels|p|tv)\/[A-Za-z0-9_-]+/i.test(trimmed);
                            if (isInstagram && trimmed.length < 200) {
                              setUrl(trimmed);
                              setWrongPasteUrl(false);
                            } else {
                              setWrongPasteUrl(true);
                              setTimeout(() => setWrongPasteUrl(false), 2500);
                            }
                          } catch {}
                        }}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 transition-colors text-xs font-medium ${wrongPasteUrl ? 'text-red-400' : 'text-gray-400 hover:text-pink-500'}`}
                      >
                        {wrongPasteUrl ? (
                          <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg><span>Wrong</span></>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        )}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Link Expiry
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: '1h',  label: ttl.endsWith('m') ? (sliderMinutes < 60 ? `${sliderMinutes}m` : sliderMinutes === 60 ? '1h' : `${Math.floor(sliderMinutes/60)}h${sliderMinutes%60 ? ` ${sliderMinutes%60}m` : ''}`) : '1 Hour', slider: true, tier: null },
                  { value: '24h', label: '24 Hours', tier: null },
                  { value: '7d',  label: '7 Days',    tier: null },
                  { value: '1mo', label: '1 Month',   tier: null },
                  { value: '6mo', label: '6 Months',  tier: 'pro' },
                  { value: '1y',  label: '1 Year',    tier: 'pro' },
                  { value: '2y',  label: '2 Years',   tier: 'ultra' },
                ].map(opt => {
                  const locked = opt.tier === 'ultra' ? userTier !== 'ultra' : opt.tier === 'pro' ? (userTier !== 'pro' && userTier !== 'ultra') : false;
                  const active = opt.slider ? ttl.endsWith('m') || ttl === '1h' : ttl === opt.value;
                  if (opt.slider) return (
                    <div
                      key={opt.value}
                      ref={sliderHoverRef}
                      className="relative"
                      onMouseEnter={() => setShowSlider(true)}
                      onMouseLeave={() => setShowSlider(false)}
                    >
                      <button
                        type="button"
                        onClick={() => { handleTtlChange(`${sliderMinutes}m`); }}
                        className={`relative flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          active ? 'bg-purple-600 text-white border-purple-600' :
                          'bg-white text-gray-600 border-gray-300 hover:border-purple-400 hover:text-purple-600'
                        }`}
                      >
                        {opt.label}
                      </button>
                      {showSlider && (
                        <>
                          <div className="absolute top-full left-0 h-2 w-full" />
                          <div className="absolute top-full left-0 pt-2 z-50 w-52">
                            <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-3">
                              <div className="flex justify-between text-xs text-gray-500 mb-1">
                                <span>Duration</span>
                                <span className="font-semibold text-purple-600">
                                  {sliderMinutes < 60 ? `${sliderMinutes} min` : sliderMinutes === 60 ? '1h' : `${Math.floor(sliderMinutes/60)}h${sliderMinutes%60 ? ` ${sliderMinutes%60}m` : ''}`}
                                </span>
                              </div>
                              <input
                                type="range"
                                min={1}
                                max={180}
                                step={1}
                                value={sliderMinutes}
                                onChange={e => {
                                  const v = Number(e.target.value);
                                  setSliderMinutes(v);
                                  handleTtlChange(`${v}m`);
                                }}
                                className="w-full accent-purple-600"
                              />
                              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                                <span>1m</span><span>3h</span>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={locked}
                      onClick={() => !locked && handleTtlChange(opt.value)}
                      className={`relative flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        active ? 'bg-purple-600 text-white border-purple-600' :
                        locked ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed' :
                        'bg-white text-gray-600 border-gray-300 hover:border-purple-400 hover:text-purple-600'
                      }`}
                    >
                      {opt.label}
                      {opt.tier === 'pro' && (
                        <span className={`flex items-center gap-0.5 text-xs font-bold ${active ? 'text-purple-200' : locked ? 'text-gray-300' : 'text-purple-500'}`}>
                          <Zap className="w-2.5 h-2.5" />Pro
                        </span>
                      )}
                      {opt.tier === 'ultra' && (
                        <span className={`flex items-center gap-0.5 text-xs font-bold ${active ? 'text-yellow-200' : locked ? 'text-gray-300' : 'text-yellow-500'}`}>
                          <Crown className="w-2.5 h-2.5" />Ultra
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || !apiKey}
              className="relative w-full overflow-hidden flex items-center justify-center gap-2 px-4 py-3 text-white font-semibold rounded-2xl transition-all duration-100 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(160deg, #ec4899, #9333ea)', boxShadow: '0 6px 0 #7e22ce, 0 8px 14px rgba(236,72,153,0.35)' }}
              onMouseDown={e => { if (!e.currentTarget.disabled) { e.currentTarget.style.boxShadow = '0 2px 0 #7e22ce, 0 3px 6px rgba(236,72,153,0.2)'; e.currentTarget.style.transform = 'translateY(4px)'; }}}
              onMouseUp={e => { e.currentTarget.style.boxShadow = '0 6px 0 #7e22ce, 0 8px 14px rgba(236,72,153,0.35)'; e.currentTarget.style.transform = ''; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 6px 0 #7e22ce, 0 8px 14px rgba(236,72,153,0.35)'; e.currentTarget.style.transform = ''; }}
            >
              <span className="absolute inset-0 rounded-2xl pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 60%)' }} />
              <span className="relative flex items-center gap-2">
                {loading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" />Converting...</>
                ) : (
                  <><Download className="w-5 h-5" />Convert</>
                )}
              </span>
            </button>
          </form>

          {/* Result */}
          {result && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-green-900">Conversion successful!</p>
                  <p className="text-sm text-green-700 mt-1 flex items-center gap-2">
                    <a href={result.viewer_url || result.link} target="_blank" rel="noopener noreferrer" className="underline hover:text-green-800 truncate">
                      {result.viewer_url || result.link}
                    </a>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(result.viewer_url || result.link);
                        setCopiedId('result');
                        setTimeout(() => setCopiedId(null), 2000);
                      }}
                      className="flex-shrink-0 p-1 rounded hover:bg-green-200 transition"
                      title="Copy link"
                    >
                      {copiedId === 'result' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-green-600" />}
                    </button>
                  </p>
                  <p className="text-sm text-green-700 mt-1">
                    Size: {result.size_mb} MB • Expires: {new Date(result.expires).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Bulk Results */}
          {bulkResults && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3 mb-4">
                <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-blue-900">Bulk conversion complete!</p>
                  <p className="text-sm text-blue-700">
                    {bulkResults.successful} of {bulkResults.total} conversions successful
                  </p>
                </div>
              </div>
              
              {bulkResults.results && bulkResults.results.length > 0 && (
                <div className="space-y-2 mt-4">
                  <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Successful conversions:</p>
                  {bulkResults.results.map((r, idx) => (
                    <div key={idx} className="bg-white rounded-lg p-3 border border-blue-100">
                      <p className="text-xs text-gray-500 truncate mb-1">{r.url}</p>
                      <a href={r.viewer_url || r.link} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                        {r.viewer_url || r.link}
                      </a>
                      <p className="text-xs text-gray-400 mt-1">Size: {r.size_mb} MB</p>
                    </div>
                  ))}
                </div>
              )}

              {bulkResults.errors && bulkResults.errors.length > 0 && (
                <div className="space-y-2 mt-4">
                  <p className="text-xs font-semibold text-red-800 uppercase tracking-wide">Failed conversions:</p>
                  {bulkResults.errors.map((err, idx) => (
                    <div key={idx} className="bg-red-50 rounded-lg p-3 border border-red-100">
                      <p className="text-xs text-gray-500 truncate mb-1">{err.url}</p>
                      <p className="text-xs text-red-600">{err.error}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
