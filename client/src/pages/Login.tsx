import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const { demoLogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const demoAccounts = [
    { email: 'citizen@demo.com', role: 'Citizen' },
    { email: 'citizen2@demo.com', role: 'Citizen' },
    { email: 'citizen3@demo.com', role: 'Citizen' },
    { email: 'sewage@demo.com', role: 'Sewage Officer' },
    { email: 'drainage@demo.com', role: 'Drainage Officer' },
    { email: 'electricity@demo.com', role: 'Electricity Officer' },
    { email: 'telecom@demo.com', role: 'Telecom Officer' },
    { email: 'roads@demo.com', role: 'Roads Officer' },
    { email: 'admin@demo.com', role: 'Admin' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await demoLogin(email);
      navigate('/', { replace: true });
    } catch (err) {
      setError('Invalid email or demo account not found');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <div className="w-full max-w-md px-4 sm:px-6 lg:px-8">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-8 shadow-lg border border-hairline">
          <div className="mb-8">
            <h2 className="text-2xl font-heading text-ink mb-4">
              Welcome to CivicTrack
            </h2>
            <p className="text-body text-ink-soft">
              Login with one of our demo accounts to explore the platform
            </p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-ink mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-border border-hairline focus:border-moss focus:ring-2 focus:ring-moss/20 focus:ring-offset-0 disabled:opacity-50"
              placeholder="Enter your demo email"
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-brick/10 rounded-border text-brick text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-moss hover:bg-moss-light text-white px-4 py-3 rounded-border font-medium flex items-center justify-center gap-2 transition-transform transform hover:scale-105 disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="animate-spin h-4 w-4 text-white mr-2"></span>
                Logging in...
              </>
            ) : (
              <>
                <span className="mr-2">→</span>
                Login with Demo Account
              </>
            )}
          </button>
        </form>
      </div>

      <div className="mt-8">
        <h3 className="text-xl font-heading text-ink mb-4 text-center">
          Demo Accounts
        </h3>
        <div className="space-y-2">
          {demoAccounts.map((account) => (
            <div
              key={account.email}
              className="flex items-center justify-between p-3 bg-white rounded-border border-hairline cursor-pointer hover:bg-moss/5"
              onClick={() => {
                setEmail(account.email);
              }}
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 flex items-center justify-center bg-moss/20 rounded-md">
                  {account.role === 'Citizen' ? (
                    <span className="text-moss">👤</span>
                  ) : account.role.includes('Officer') ? (
                    <span className="text-moss">🏢</span>
                  ) : (
                    <span className="text-moss">⚙️</span>
                  )}
                </div>
                <div>
                  <p className="font-medium text-ink">{account.email}</p>
                  <p className="text-xs text-ink-soft">{account.role}</p>
                </div>
              </div>
              <span className="text-sm text-moss font-medium">
                →
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 text-center text-sm text-ink-soft">
        Password for all demo accounts: <code className="bg-moss/20 px-2 rounded">demo1234</code>
      </div>
    </div>
  );
};

export default Login;