import { Link } from 'react-router-dom';
import { Instagram } from 'lucide-react';

export default function Tos() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-100 px-6 h-16 flex items-center">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <img src="/logo.png" alt="Reels2Link" className="w-7 h-7 object-contain" />
          <span className="font-bold text-xl">Reels2Link</span>
        </Link>
      </nav>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
        <p className="text-gray-400 text-sm mb-12">Last updated: May 2025</p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-600 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using Reels2Link ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Description of Service</h2>
            <p>Reels2Link is a video conversion and hosting service that allows users to convert publicly accessible Instagram Reels into hosted video links for personal and commercial use within the bounds of applicable law.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Permitted Use</h2>
            <p>You may use the Service only for lawful purposes. You agree not to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Convert or distribute content you do not have the right to use</li>
              <li>Use the Service to infringe on any third-party intellectual property rights</li>
              <li>Attempt to circumvent rate limits, authentication, or security measures</li>
              <li>Use the Service for any automated scraping at scale without a paid plan</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Intellectual Property</h2>
            <p>Reels2Link does not claim ownership of any content processed through the Service. You are solely responsible for ensuring you have the right to convert and use any content you submit. Reels2Link is not affiliated with Instagram or Meta Platforms, Inc.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. DMCA & Copyright</h2>
            <p>We respect intellectual property rights. If you believe content hosted via Reels2Link infringes your copyright, please contact us at <a href="mailto:privacy@reels2link.link" className="text-purple-600 hover:underline">privacy@reels2link.link</a>. We will respond within 24 hours and remove infringing content promptly.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Billing & Refunds</h2>
            <p>Subscription plans are billed monthly. Credit top-ups are non-refundable once consumed. Unused credits expire after 12 months. You may cancel your subscription at any time; access continues until the end of the billing period.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Limitation of Liability</h2>
            <p>The Service is provided "as is" without warranties of any kind. Reels2Link shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Termination</h2>
            <p>We reserve the right to suspend or terminate accounts that violate these Terms, with or without notice.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Contact</h2>
            <p>Questions? Email us at <a href="mailto:contact@reels2link.link" className="text-purple-600 hover:underline">contact@reels2link.link</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
