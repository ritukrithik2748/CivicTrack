import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useReports } from '../hooks/useReports';

const MyReports: React.FC = () => {
  const { user: _user } = useAuth();
  const [filter, setFilter] = useState<'all' | 'mine'>('mine');
  const { data, isLoading, error } = useReports({
    status: filter === 'mine' ? undefined : 'open',
    limit: 20,
  });

  const handleFilterChange = (value: 'all' | 'mine') => {
    setFilter(value);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="animate-pulse space-y-2">
          <div className="h-4 w-24 rounded bg-ink-soft/20"></div>
          <div className="h-4 w-32 rounded bg-ink-soft/20"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-center py-12">
          <h2 className="text-2xl font-heading text-ink mb-4">Error Loading Reports</h2>
          <p className="text-body text-ink-soft">{String(error)}</p>
          <Link to="/" className="inline-block mt-6 bg-moss hover:bg-moss-light text-white px-4 py-2 rounded-md">Return Home</Link>
        </div>
      </div>
    );
  }

  const reports = data?.data || [];

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-paper-2 border-b border-hairline">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between py-4">
            <div className="flex-1">
              <h1 className="text-2xl font-heading text-ink mb-2">My Reports</h1>
              <p className="text-body text-ink-soft">Track the status of your submitted reports</p>
            </div>
            <div className="flex items-center space-x-3">
              <Link to="/" className="px-3 py-1 rounded-md text-sm font-medium text-ink hover:bg-paper-2">← Home</Link>
              <Link to="/report" className="bg-moss hover:bg-moss-light text-white px-4 py-2 rounded-md font-medium">+ Report Issue</Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="flex border-b pb-2">
            <button onClick={() => handleFilterChange('all')} className={`px-4 py-2 border-b-2 ${filter === 'all' ? 'border-moss text-moss' : 'border-transparent text-ink-soft'}`}>All Reports</button>
            <button onClick={() => handleFilterChange('mine')} className={`px-4 py-2 border-b-2 ${filter === 'mine' ? 'border-moss text-moss' : 'border-transparent text-ink-soft'}`}>My Reports</button>
          </div>
        </div>

        <div className="space-y-4">
          {reports.length > 0 ? (
            reports.map((report: any) => (
              <div key={report.id} className="bg-white rounded-xl p-6 shadow-sm border border-hairline">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-ink mb-1">{report.category.replace(/_/g, ' ').toUpperCase()}</h3>
                    <p className="text-sm text-ink-soft mb-2">{report.description || 'No description provided'}</p>
                    <div className="flex items-center gap-2 mb-2 text-xs">
                      <span className="text-xs text-ink">Reported by:</span>
                      <span className="font-medium">{report.user_name || 'Anonymous'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${report.status === 'open' ? 'bg-moss/20 text-moss' : report.status === 'acknowledged' ? 'bg-saffron/20 text-saffron' : report.status === 'in_progress' ? 'bg-lagoon/20 text-lagoon' : report.status === 'resolved' ? 'bg-disputed/20 text-disputed' : report.status === 'reopened' ? 'bg-brick/20 text-brick' : 'bg-white/20 text-ink'}`}>{report.status.replace(/_/g, ' ').toUpperCase()}</span>
                    {report.location_source && <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-ink/20 text-ink">{report.location_source.toUpperCase()}</span>}
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-hairline">
                  <p className="text-sm text-ink-soft"><strong>Location:</strong> {report.location_source === 'manual_pin' ? 'Manual Pin' : report.location_source === 'device_gps' ? 'Device GPS' : 'Photo EXIF'}</p>
                  {report.group_id && <div className="mt-2"><span className="text-xs text-ink-soft">Part of a {report.group_severity} severity group with {report.group_reports || 0} reports</span></div>}
                  <div className="mt-3"><Link to={`/reports/${report.id}`} className="text-sm font-medium text-moss hover:text-moss/80">View Details & Reply</Link></div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <p className="text-body text-ink-soft">You haven't reported any issues yet.</p>
              <Link to="/report" className="inline-block mt-6 bg-moss hover:bg-moss-light text-white px-4 py-2 rounded-md">+ Report First Issue</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyReports;