import { Link } from 'react-router-dom';
import { Instagram } from 'lucide-react';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-100 px-6 h-16 flex items-center">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <img src="/logo.png" alt="Reels2Link" className="w-7 h-7 object-contain" />
          <span className="font-bold text-xl">Reels2Link</span>
        </Link>
      </nav>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-gray-400 text-sm mb-12">Last updated: May 2026</p>

        <div className="space-y-8 text-gray-600 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. What We Collect</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Email address</strong> — used for OAuth authentication and billing</li>
              <li><strong>IP address</strong> — used for rate limiting and fraud prevention. The approximate country and city derived from your IP (via local GeoIP database) is stored alongside your login history to detect suspicious activity.</li>
              <li><strong>Device fingerprint</strong> — a non-reversible hash derived from browser and device characteristics (screen resolution, user agent, timezone etc.). Used solely for fraud prevention and account merging across OAuth providers. Legal basis: Legitimate Interest (Art. 6(1)(f) GDPR). Retained for 90 days.</li>
              <li><strong>Login history</strong> — timestamp, IP, country, and city per login event. Used to detect account takeover and multi-country fraud patterns. Retained for 90 days.</li>
              <li><strong>Usage data</strong> — conversion count, timestamps, API key tier (no video content metadata stored)</li>
              <li><strong>Payment data</strong> — processed entirely by Stripe; we never see your card details</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. What We Do NOT Collect</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Raw permanent IP logs (only approximate geolocation is stored)</li>
              <li>Video content, thumbnails, or creator metadata</li>
              <li>Tracking cookies or advertising identifiers</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Data Retention</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Converted videos: deleted after link expiry (max 2 years)</li>
              <li>Usage logs: 90 days</li>
              <li>Account data: retained until account deletion</li>
              <li>Billing records: 7 years (legal requirement)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Third-Party Services</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Stripe</strong> — payment processing (<a href="https://stripe.com/privacy" className="text-purple-600 hover:underline" target="_blank" rel="noopener noreferrer">stripe.com/privacy</a>)</li>
              <li><strong>Bunny.net</strong> — video CDN & storage</li>
              <li><strong>Resend</strong> — transactional email delivery</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Your Rights (GDPR)</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Access your personal data (Article 15)</li>
              <li>Request deletion of your account and data (Article 17)</li>
              <li>Export your data in machine-readable format (Article 20)</li>
              <li>Object to processing (Article 21)</li>
            </ul>
            <p className="mt-3">To exercise these rights, email <a href="mailto:privacy@reels2link.link" className="text-purple-600 hover:underline">privacy@reels2link.link</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Cookies</h2>
            <p className="mb-3">We use a small number of functional cookies. No tracking or advertising cookies are set by us.</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>reels2link_ttl</strong> — stores your last selected link expiry preference (e.g. 30 days). Purely functional. Expires after 90 days.</li>
              <li><strong>reels2link_provider</strong> — remembers whether you last signed in with Google or GitHub, to highlight the correct button on your next visit. Expires after 90 days.</li>
            </ul>
            <p className="mt-3">These cookies do not track you across other websites and contain no personal data. Legal basis: Legitimate Interest (Art. 6(1)(f) GDPR).</p>
            <p className="mt-3">Stripe may set its own cookies during checkout. By proceeding to payment you acknowledge this.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Contact</h2>
            <p>Data protection inquiries: <a href="mailto:privacy@reels2link.link" className="text-purple-600 hover:underline">privacy@reels2link.link</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
