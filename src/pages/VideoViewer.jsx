import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Instagram, Eye, Clock, HardDrive, ArrowLeft, Loader2, AlertCircle, Volume2, VolumeX, Copy, Check } from 'lucide-react';

const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function VideoViewer() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState('');
  const [muted, setMuted] = useState(isMobile);
  const [copied, setCopied] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    fetch(`${API}/api/v/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!data?.expires_at) return;
    const expires = new Date(data.expires_at);
    if (expires < new Date()) return;
    const tick = () => {
      const diff = expires - new Date();
      if (diff <= 0) { setCountdown('Expired'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (d > 1) setCountdown(`${d}d ${h}h`);
      else if (d === 1) setCountdown(`1d ${h}h ${m}m`);
      else if (h > 0) setCountdown(`${h}h ${m}m ${s}s`);
      else setCountdown(`${m}m ${s}s`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [data]);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
      <AlertCircle className="w-12 h-12 text-red-400" />
      <p className="text-gray-600">{error}</p>
      <Link to="/" className="text-purple-600 underline text-sm">Back to Home</Link>
    </div>
  );

  const expires = data.expires_at ? new Date(data.expires_at) : null;
  const isExpired = expires && expires < new Date();

  return (
    <div className="min-h-screen bg-black flex items-stretch overflow-hidden">
      {/* Left panel */}
      <div className="hidden md:flex md:w-36 lg:w-52 xl:w-64 flex-col justify-between md:p-4 lg:p-6 xl:p-8 flex-shrink transition-all duration-300 min-w-0">
        <Link to="/" className="inline-flex items-center gap-1.5 md:text-sm lg:text-base text-gray-400 hover:text-white transition truncate">
          <ArrowLeft className="md:w-4 md:h-4 lg:w-5 lg:h-5 flex-shrink-0" /> <span className="truncate">Back</span>
        </Link>
        <div className="flex flex-col md:gap-3 lg:gap-5">
          <div className="flex items-center md:gap-2 lg:gap-3 text-gray-400">
            <Eye className="md:w-4 md:h-4 lg:w-6 lg:h-6 text-purple-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="md:text-lg lg:text-2xl font-black text-white leading-none truncate">{data.views.toLocaleString()}</p>
              <p className="md:text-xs lg:text-sm mt-0.5">{data.views === 1 ? 'view' : 'views'}</p>
            </div>
          </div>
          {data.size_mb && (
            <div className="flex items-center md:gap-2 lg:gap-3 text-gray-400">
              <HardDrive className="md:w-4 md:h-4 lg:w-6 lg:h-6 text-blue-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="md:text-lg lg:text-2xl font-black text-white leading-none truncate">{data.size_mb}</p>
                <p className="md:text-xs lg:text-sm mt-0.5">MB</p>
              </div>
            </div>
          )}
          {expires && (
            <div className="flex items-center md:gap-2 lg:gap-3 text-gray-400">
              <Clock className={`md:w-4 md:h-4 lg:w-6 lg:h-6 flex-shrink-0 ${isExpired ? 'text-red-400' : 'text-yellow-400'}`} />
              <div className="min-w-0">
                <p className={`md:text-sm lg:text-lg font-bold leading-none truncate font-mono ${isExpired ? 'text-red-400' : 'text-white'}`}>
                  {isExpired ? 'Expired' : countdown}
                </p>
                <p className="md:text-xs lg:text-sm mt-0.5">remaining</p>
              </div>
            </div>
          )}
        </div>
        <p className="md:text-xs lg:text-sm text-gray-600 truncate">
          Converted with{' '}
          <Link to="/" className="text-gray-400 hover:text-purple-400 transition font-medium">Reels2Link</Link>
        </p>
        {/* Left ad slot — only on wide desktop */}
        <div className="hidden xl:flex flex-col items-center mt-4">
          <div className="w-full max-w-[160px] h-[600px] bg-gray-900/50 border border-gray-800 rounded-lg flex items-center justify-center text-gray-600 text-xs">
            <span>Ad</span>
          </div>
        </div>
      </div>

      {/* Video — center, full height, relative for arc overlay */}
      <div className="flex-1 relative flex items-center justify-center bg-black">
        {isExpired ? (
          <div className="flex flex-col items-center gap-3 text-gray-500">
            <Clock className="w-10 h-10" />
            <p>This link has expired</p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              src={data.cdn_url}
              controls
              autoPlay
              muted={muted}
              playsInline
              className="max-h-screen max-w-full w-auto h-screen object-contain"
            />
            {/* Mute toggle */}
            <button
              onClick={() => {
                setMuted(m => {
                  const next = !m;
                  if (videoRef.current) videoRef.current.muted = next;
                  return next;
                });
              }}
              className="absolute top-4 left-4 bg-black/60 hover:bg-black/80 backdrop-blur rounded-full p-2.5 text-white transition z-10"
              title={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            {/* Copy link button */}
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="absolute top-4 left-16 bg-black/60 hover:bg-black/80 backdrop-blur rounded-full p-2.5 text-white transition z-10"
              title="Copy link"
            >
              {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
            </button>
          </>
        )}

        {/* Arc Instagram button — right edge of video */}
        <a
          href={data.instagram_url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute right-0 top-1/2 -translate-y-1/2 group hidden md:flex"
          style={{ height: '85%' }}
        >
          {/* Arc shape: wide rounded-left pill, very narrow at rest, expands on hover */}
          <div
            className="h-full flex flex-col items-center justify-center gap-3 transition-all duration-500 ease-out"
            style={{
              width: '28px',
              borderRadius: '40px 0 0 40px',
              background: 'linear-gradient(180deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
              opacity: 0.25,
              paddingLeft: '6px',
              overflow: 'hidden',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.width = '110px';
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.paddingLeft = '16px';
              e.currentTarget.style.paddingRight = '12px';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.width = '28px';
              e.currentTarget.style.opacity = '0.25';
              e.currentTarget.style.paddingLeft = '6px';
              e.currentTarget.style.paddingRight = '0';
            }}
          >
            <Instagram className="w-5 h-5 text-white flex-shrink-0" />
            <span
              className="text-white font-semibold text-xs text-center leading-tight"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', opacity: 1 }}
            >
              Original on Instagram
            </span>
          </div>
        </a>
      </div>

      {/* Right ad panel — only on wide desktop */}
      <div className="hidden xl:flex w-44 2xl:w-56 flex-col items-center justify-center p-4 flex-shrink-0">
        <div className="w-full max-w-[160px] h-[600px] bg-gray-900/50 border border-gray-800 rounded-lg flex items-center justify-center text-gray-600 text-xs">
          <span>Ad</span>
        </div>
      </div>

      {/* Mobile bottom bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur border-t border-gray-800 flex items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-1 text-gray-400 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="flex items-center gap-3 text-gray-400 text-xs">
          <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {data.views.toLocaleString()}</span>
          {data.size_mb && <span className="flex items-center gap-1"><HardDrive className="w-3.5 h-3.5" /> {data.size_mb}MB</span>}
        </div>
        <a
          href={data.instagram_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-semibold rounded-xl"
          style={{ background: 'linear-gradient(135deg, #f09433, #dc2743, #bc1888)' }}
        >
          <Instagram className="w-3.5 h-3.5" /> Original
        </a>
      </div>
    </div>
  );
}
