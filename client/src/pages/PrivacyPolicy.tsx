import React from 'react';
import { Link } from 'react-router-dom';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-paper-2 border-b border-hairline">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link to="/" className="inline-flex items-center text-moss hover:text-moss-light mb-4">
            ← Back to Home
          </Link>
          <h1 className="text-3xl font-heading text-ink">Privacy Policy</h1>
          <p className="text-sm text-ink-soft mt-2">Last updated: October 10, 2026</p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl p-8 shadow-sm border border-hairline space-y-6">
          <section>
            <h2 className="text-xl font-heading text-ink mb-3">1. Information We Collect</h2>
            <p className="text-body text-ink-soft mb-3">
              CivicTrack collects information you provide directly when you:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-body text-ink-soft">
              <li>Create an account (name, email, phone number)</li>
              <li>Submit issue reports (location, photos, descriptions)</li>
              <li>Verify project progress (GPS location, photos)</li>
              <li>Subscribe to area alerts</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-heading text-ink mb-3">2. Location Data</h2>
            <p className="text-body text-ink-soft mb-3">
              We collect precise location data when you report issues or verify projects. Location data is used to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-body text-ink-soft">
              <li>Map reported issues accurately</li>
              <li>Verify that you are near project sites when verifying progress</li>
              <li>Send relevant notifications about work in your area</li>
            </ul>
            <p className="text-body text-ink-soft mt-3">
              You can control location permissions through your device settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-heading text-ink mb-3">3. Photo Privacy</h2>
            <p className="text-body text-ink-soft">
              When you upload photos, we automatically remove EXIF metadata (including GPS coordinates,
              device information, and timestamps) before storing them. Only the visual image content is retained.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-heading text-ink mb-3">4. How We Use Your Information</h2>
            <p className="text-body text-ink-soft mb-3">Your information is used to:</p>
            <ul className="list-disc pl-6 space-y-2 text-body text-ink-soft">
              <li>Operate and improve the CivicTrack platform</li>
              <li>Route reports to appropriate municipal departments</li>
              <li>Send notifications about projects you're following</li>
              <li>Generate public transparency reports and analytics</li>
              <li>Prevent fraud and ensure system integrity</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-heading text-ink mb-3">5. Information Sharing</h2>
            <p className="text-body text-ink-soft mb-3">
              We share your information with:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-body text-ink-soft">
              <li><strong>Municipal departments:</strong> To respond to reported issues</li>
              <li><strong>Public display:</strong> Your name appears with reports you submit (by design, for transparency)</li>
              <li><strong>Aggregated data:</strong> Anonymous statistics for public analytics</li>
            </ul>
            <p className="text-body text-ink-soft mt-3">
              We do not sell your personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-heading text-ink mb-3">6. Your Rights</h2>
            <p className="text-body text-ink-soft mb-3">You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2 text-body text-ink-soft">
              <li>Access your personal data</li>
              <li>Correct inaccurate information</li>
              <li>Delete your account and associated data</li>
              <li>Opt out of notifications</li>
              <li>Export your submitted reports</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-heading text-ink mb-3">7. Data Security</h2>
            <p className="text-body text-ink-soft">
              We implement industry-standard security measures including encryption in transit (HTTPS),
              secure password hashing (bcrypt), and regular security audits. However, no system is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-heading text-ink mb-3">8. Children's Privacy</h2>
            <p className="text-body text-ink-soft">
              CivicTrack is not intended for users under 13 years of age. We do not knowingly collect
              information from children under 13.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-heading text-ink mb-3">9. Contact Us</h2>
            <p className="text-body text-ink-soft">
              For privacy questions or requests, contact us at:{' '}
              <a href="mailto:privacy@civictrack.demo" className="text-moss hover:underline">
                privacy@civictrack.demo
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
