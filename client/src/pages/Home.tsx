import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';

const Home: React.FC = () => {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const [stats, setStats] = useState({
    activeProjects: 0,
    openProblems: 0,
    budgetTracked: 0,
    delayedCount: 0,
  });

  useEffect(() => {
    // Fetch dashboard stats
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/projects', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          // Calculate stats from projects data
          const projects = data.data || [];
          const activeProjects = projects.filter(
            (p: any) => p.status === 'in_progress'
          ).length;
          const delayedCount = projects.filter(
            (p: any) => p.status === 'delayed'
          ).length;
          const budgetTracked = projects.reduce(
            (sum: number, p: any) => sum + (p.sanctioned_budget || 0),
            0
          );

          // Get open problems count
          const problemsResponse = await fetch(
            '/api/groups?status=open&limit=1',
            {
              credentials: 'include',
            }
          );
          if (problemsResponse.ok) {
            const problemsData = await problemsResponse.json();
            const openProblems =
              problemsData.pagination?.total || problemsData.data?.length || 0;

            setStats({
              activeProjects,
              openProblems,
              budgetTracked,
              delayedCount,
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-paper">
      {/* Hero Section */}
      <section className="relative bg-moss/5 py-20 md:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-paper-grain opacity-20 pointer-events-none"></div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-ink mb-6">
              CivicTrack
            </h1>
            <p className="text-xl font-body text-ink-soft max-w-2xl mx-auto mb-8">
              Improving Transparency and Coordination in Public Works Projects
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                to="/explore"
                className="bg-moss hover:bg-moss-light text-white px-6 py-3 rounded-md font-medium transition-transform transform hover:scale-105"
              >
                Explore Projects
              </Link>
              <Link
                to="/report"
                className="bg-ink hover:bg-ink/90 text-white px-6 py-3 rounded-md font-medium transition-transform transform hover:scale-105"
              >
                Report an Issue
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-paper-2 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-heading text-ink mb-10 text-center">
            Live Statistics
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-hairline">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-ink-soft">Active Projects</p>
                  <p className="text-3xl font-bold text-moss">
                    {stats.activeProjects.toLocaleString()}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <div className="h-12 w-12 bg-moss/10 rounded-lg flex items-center justify-center">
                    <span className="text-moss">🏗️</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-hairline">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-ink-soft">Open Problems</p>
                  <p className="text-3xl font-bold text-saffron">
                    {stats.openProblems.toLocaleString()}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <div className="h-12 w-12 bg-saffron/10 rounded-lg flex items-center justify-center">
                    <span className="text-saffron">⚠️</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-hairline">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-ink-soft">Budget Tracked</p>
                  <p className="text-3xl font-bold text-ink">
                    ₹{stats.budgetTracked.toLocaleString()}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <div className="h-12 w-12 bg-ink/10 rounded-lg flex items-center justify-center">
                    <span className="text-ink">💰</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-hairline">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-ink-soft">Delayed Projects</p>
                  <p className="text-3xl font-bold text-brick">
                    {stats.delayedCount.toLocaleString()}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <div className="h-12 w-12 bg-brick/10 rounded-lg flex items-center justify-center">
                    <span className="text-brick">🚨</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-paper py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-heading text-ink mb-12 text-center">
            How CivicTrack Works
          </h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {/* Transparency */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-hairline flex flex-col h-full">
              <div className="flex-shrink-0 h-16 w-16 bg-moss/10 rounded-lg flex items-center justify-center mb-4">
                <span className="text-moss">👁️</span>
              </div>
              <h3 className="text-xl font-heading text-ink mb-4">Transparency</h3>
              <p className="text-body text-ink-soft flex-1">
                Every public work is visible on our interactive map with complete details about purpose, timeline, budget, and responsible authorities.
              </p>
              <Link
                to="/explore"
                className="mt-4 inline-flex items-center text-sm font-medium text-moss hover:text-moss/80"
              >
                See How It Works
                <span className="ml-2">→</span>
              </Link>
            </div>

            {/* Coordination */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-hairline flex flex-col h-full">
              <div className="flex-shrink-0 h-16 w-16 bg-saffron/10 rounded-lg flex items-center justify-center mb-4">
                <span className="text-saffron">🔗</span>
              </div>
              <h3 className="text-xl font-heading text-ink mb-4">Coordination</h3>
              <p className="text-body text-ink-soft flex-1">
                Departments are automatically sequenced to prevent duplicate digging, with automatic notifications when one department finishes and another should start.
              </p>
              <Link
                to="/dashboard"
                className="mt-4 inline-flex items-center text-sm font-medium text-saffron hover:text-saffron/80"
              >
                See Coordination
                <span className="ml-2">→</span>
              </Link>
            </div>

            {/* Verification */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-hairline flex flex-col h-full">
              <div className="flex-shrink-0 h-16 w-16 bg-lagoon/10 rounded-lg flex items-center justify-center mb-4">
                <span className="text-lagoon">✅</span>
              </div>
              <h3 className="text-xl font-heading text-ink mb-4">Verification</h3>
              <p className="text-body text-ink-soft flex-1">
                Citizens can verify work progress with geotagged photos and GPS verification, ensuring accountability and preventing false completion claims.
              </p>
              <Link
                to="/verify"
                className="mt-4 inline-flex items-center text-sm font-medium text-lagoon hover:text-lagoon/80"
              >
                Verify Progress
                <span className="ml-2">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="bg-moss/5 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-heading text-ink mb-6">
            Get Started Today
          </h2>
          <p className="text-lg text-ink-soft mb-8">
            Join thousands of citizens using CivicTrack to make their communities better informed and more coordinated.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {!user ? (
              <>
                <Link
                  to="/login"
                  className="bg-moss hover:bg-moss-light text-white px-6 py-3 rounded-md font-medium"
                >
                  Login
                </Link>
                <Link
                  to="/report"
                  className="bg-ink hover:bg-ink/90 text-white px-6 py-3 rounded-md font-medium ml-2"
                >
                  Report Issue
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/explore"
                  className="bg-moss hover:bg-moss-light text-white px-6 py-3 rounded-md font-medium"
                >
                  Explore Map
                </Link>
                <Link
                  to="/my-reports"
                  className="bg-ink hover:bg-ink/90 text-white px-6 py-3 rounded-md font-medium ml-2"
                >
                  My Reports
                </Link>
              </>
            )}
          </div>
          {user && (
            <div className="mt-6 flex justify-center space-x-3">
              <span className="text-sm text-ink-soft">
                Logged in as {user.name} ({user.role === 'citizen' ? 'Citizen' : user.role === 'officer' ? 'Officer' : 'Admin'})
              </span>
              {unreadCount > 0 && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-xs bg-saffron/20 text-saffron font-medium">
                  {unreadCount} new notifications
                </span>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Home;