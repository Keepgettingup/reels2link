import { Link } from 'react-router-dom';
import { Instagram, Zap, Heart } from 'lucide-react';

export default function About() {
  return (
    <div className="min-h-screen bg-white">

      {/* Nav */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-100 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Instagram className="w-6 h-6 text-pink-600" />
            <span className="font-bold text-xl">Reels2Link</span>
          </Link>
          <Link
            to="/app"
            className="relative overflow-hidden flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-xl transition-all duration-100 active:translate-y-0.5"
            style={{ background: 'linear-gradient(160deg, #ec4899, #9333ea)', boxShadow: '0 4px 0 #7e22ce, 0 6px 10px rgba(236,72,153,0.3)' }}
          >
            <span className="absolute inset-0 rounded-xl pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 60%)' }} />
            <span className="relative">Get Started</span>
          </Link>
        </div>
      </nav>

      <div className="pt-32 pb-24 px-6">
        <div className="max-w-2xl mx-auto">

          {/* Header */}
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded-full mb-6">
              <Heart className="w-3 h-3" /> Solo project
            </div>
            <h1 className="text-4xl font-black tracking-tight text-gray-900 mb-4">
              Built by one person.<br />
              <span className="bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                For everyone.
              </span>
            </h1>
            <p className="text-lg text-gray-500 leading-relaxed">
              Reels2Link started as a personal tool. I kept needing to share Instagram Reels somewhere they'd actually play — in chats, docs, apps — without Instagram's walls getting in the way.
            </p>
          </div>

          {/* Story */}
          <div className="space-y-6 text-gray-600 leading-relaxed mb-12">
            <p>
              So I built a converter. Then I added an API so other tools could use it. Then rate limiting, CDN hosting, expiring links, subscription tiers — and here we are.
            </p>
            <p>
              It's not backed by a company or a team. Just one person, trying to make something that works reliably and doesn't over-charge for it.
            </p>
            <p>
              If something is broken, confusing, or missing — I actually want to know. There's no support ticket queue. Just an email.
            </p>
          </div>

          {/* What it is */}
          <div className="bg-gray-50 rounded-2xl p-6 mb-12">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-500" /> What Reels2Link does
            </h2>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-0.5">→</span>
                Converts Instagram Reels into direct, playable video links
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-0.5">→</span>
                Hosts the video on a fast global CDN (Bunny.net)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-0.5">→</span>
                Links expire automatically — no permanent storage of your content
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-0.5">→</span>
                API-first, so developers and AI agents can use it programmatically
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="border-t border-gray-100 pt-8">
            <p className="text-gray-500 text-sm mb-2">Questions, feedback, or just want to say hi?</p>
            <a
              href="mailto:contact@reels2link.link"
              className="text-purple-600 hover:text-purple-700 font-medium transition"
            >
              contact@reels2link.link
            </a>
          </div>

        </div>
      </div>

    </div>
  );
}
