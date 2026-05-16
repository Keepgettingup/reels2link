import { Link } from 'react-router-dom';
import { Instagram } from 'lucide-react';

export default function Imprint() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-100 px-6 h-16 flex items-center">
        <Link to="/" className="flex items-center gap-2">
          <Instagram className="w-6 h-6 text-pink-600" />
          <span className="font-bold text-xl">Reels2Link</span>
        </Link>
      </nav>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold mb-2">Imprint</h1>
        <p className="text-gray-400 text-sm mb-12">Angaben gemäß § 5 TMG</p>

        <div className="space-y-8 text-gray-600 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Responsible for Content</h2>
            <p className="text-gray-500 italic">
              Max Bryant<br />
              Hohenzollerndamm 129<br />
              14199 Berlin<br />
              Germany
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Contact</h2>
            <p>Email: <a href="mailto:contact@reels2link.link" className="text-purple-600 hover:underline">contact@reels2link.link</a></p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Disclaimer</h2>
            <p>Reels2Link is not affiliated with, endorsed by, or connected to Instagram, Meta Platforms Inc., or any of their subsidiaries. All product names, logos, and brands are property of their respective owners.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
