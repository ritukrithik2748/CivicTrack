import React from 'react';
import { Link } from 'react-router-dom';

const TermsOfService: React.FC = () => {
  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-paper-2 border-b border-hairline">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link to="/" className="inline-flex items-center text-moss hover:text-moss-light mb-4">
            ← Back to Home
          </Link>
          <h1 className="text-3xl font-heading text-ink">Terms of Service</h1>
          <p className="text-sm text-ink-soft mt-2">Last updated: October 10, 2026</p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl p-8 shadow-sm border border-hairline space-y-6">
          <section>
            <h2 className="text-xl font-heading text-ink mb-3">1. Acceptance of Terms</h2>
            <p className="text-body text-ink-soft">
              By accessing and using CivicTrack, you accept and agree to be bound by these Terms of Service.
              If you do not agree, please do not use this platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-heading text-ink mb-3">2. Description of Service</h2>
            <p className="text-body text-ink-soft">
              CivicTrack is a public transparency platform that enables citizens to report infrastructure issues,
              track municipal projects, verify work progress, and access budget information. The platform facilitates
              coordination between residents and municipal departments.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-heading text-ink mb-3">3. User Accounts</h2>
            <p className="text-body text-ink-soft mb-3">
              To use certain features, you must create an account. You agree to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-body text-ink-soft">
              <li>Provide accurate, current information</li>
              <li>Maintain the security of your password</li>
              <li>Accept responsibility for all activities under your account</li>
              <li>Notify us immediately of unauthorized access</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-heading text-ink mb-3">4. Acceptable Use</h2>
            <p className="text-body text-ink-soft mb-3">You agree NOT to:</p>
            <ul className="list-disc pl-6 space-y-2 text-body text-ink-soft">
              <li>Submit false or misleading reports</li>
              <li>Upload inappropriate, offensive, or illegal content</li>
              <li>Spam the system with duplicate reports</li>
              <li>Attempt to game the verification system</li>
              <li>Harass other users or department staff</li>
              <li>Violate any applicable laws or regulations</li>
              <li>Interfere with the platform's operation</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-heading text-ink mb-3">5. Content and Reporting</h2>
            <p className="text-body text-ink-soft mb-3">
              When you submit reports or photos:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-body text-ink-soft">
              <li>Your content becomes publicly visible</li>
              <li>You retain ownership but grant us a license to display it</li>
              <li>You confirm you have the right to share the content</li>
              <li>You understand reports may be forwarded to municipal authorities</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-heading text-ink mb-3">6. Verification System</h2>
            <p className="text-body text-ink-soft">
              The citizen verification system requires GPS proximity to project sites. Attempts to circumvent
              location checks or coordinate fraudulent verifications will result in account suspension.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-heading text-ink mb-3">7. Disclaimers</h2>
            <p className="text-body text-ink-soft mb-3">
              CivicTrack is provided "as is" without warranties of any kind. We do not guarantee:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-body text-ink-soft">
              <li>That reports will result in action by authorities</li>
              <li>The accuracy of user-submitted content</li>
              <li>Uninterrupted or error-free service</li>
              <li>That the platform will meet your specific needs</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-heading text-ink mb-3">8. Limitation of Liability</h2>
            <p className="text-body text-ink-soft">
              CivicTrack and its operators shall not be liable for any indirect, incidental, special, or
              consequential damages arising from your use of the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-heading text-ink mb-3">9. Account Termination</h2>
            <p className="text-body text-ink-soft">
              We reserve the right to suspend or terminate accounts that violate these terms, engage in
              fraudulent activity, or abuse the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-heading text-ink mb-3">10. Changes to Terms</h2>
            <p className="text-body text-ink-soft">
              We may update these terms periodically. Continued use after changes constitutes acceptance
              of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-heading text-ink mb-3">11. Governing Law</h2>
            <p className="text-body text-ink-soft">
              These terms are governed by the laws of India. Any disputes shall be resolved in the courts
              of the jurisdiction where the service is provided.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-heading text-ink mb-3">12. Contact</h2>
            <p className="text-body text-ink-soft">
              For questions about these terms, contact:{' '}
              <a href="mailto:support@civictrack.demo" className="text-moss hover:underline">
                support@civictrack.demo
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
