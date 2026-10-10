import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useVerifyProject } from '../hooks/useReports';
import { format } from 'date-fns';
import { INR } from '../utils/currency';

const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { notify: _notify } = useNotifications();
  const verifyProjectMutation = useVerifyProject();
  const [project, setProject] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showVerification, setShowVerification] = useState(false);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/projects/${id}`, {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error('Failed to fetch project');
        }
        const data = await response.json();
        setProject(data.project);
        setIsLoading(false);
      } catch (err) {
        setError('Failed to load project details');
        setIsLoading(false);
      }
    };
    fetchProject();
  }, [id]);
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

  if (error || !project) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-center py-12">
          <h2 className="text-2xl font-heading text-ink mb-4">Project Not Found</h2>
          <p className="text-body text-ink-soft">The project you're looking for doesn't exist or has been removed.</p>
          <Link to="/explore" className="inline-block mt-6 bg-moss hover:bg-moss-light text-white px-4 py-2 rounded-md">
            Browse Projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="bg-paper-2 border-b border-hairline">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-4">
            <Link to="/" className="text-sm text-ink-soft hover:text-moss">Home</Link>
            <span className="mx-2 text-ink-soft">/</span>
            <Link to="/explore" className="text-sm text-ink-soft hover:text-moss">Explore</Link>
            <span className="mx-2 text-ink-soft">/</span>
            <span className="text-sm font-medium text-ink">{project.title}</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
            <div>
              <h1 className="text-3xl font-heading text-ink mb-2">{project.title}</h1>
              <p className="text-body text-ink-soft">{project.purpose || 'No purpose specified'}</p>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  project.status === 'planned' ? 'bg-moss/20 text-moss' :
                  project.status === 'in_progress' ? 'bg-saffron/20 text-saffron' :
                  project.status === 'completed' ? 'bg-lagoon/20 text-lagoon' :
                  project.status === 'delayed' ? 'bg-brick/20 text-brick' :
                  'bg-disputed/20 text-disputed'
                }`}>
                  {project.status.replace('_', ' ').toUpperCase()}
                </span>
                {project.claimed_status !== project.status && (
                  <>
                    <span className="ml-2 inline-flex items-center gap-1">
                      <span className="text-xs font-medium bg-disputed/20 text-disputed">
                        CLAIMED: {project.claimed_status.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="ml-1">→</span>
                      <span className="text-xs font-medium bg-disputed/20 text-disputed">
                        {project.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 mt-6">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-hairline">
              <h3 className="font-semibold text-ink mb-2">Responsible Department</h3>
              <p className="text-lg font-medium text-ink">{project.department_name || 'Unknown'}</p>
              <p className="text-sm text-ink-soft mt-1">{project.department_code || ''}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-hairline">
              <h3 className="font-semibold text-ink mb-2">Contractor</h3>
              <p className="text-lg font-medium text-ink">{project.contractor_name || 'Not Assigned'}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-hairline">
              <h3 className="font-semibold text-ink mb-2">Location</h3>
              <p className="text-sm font-medium text-ink">{project.road_name || 'Unknown Road'}</p>
              <p className="text-sm text-ink-soft">Ward {project.ward || 'Unknown'}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-hairline">
              <h3 className="font-semibold text-ink mb-2">Timeline</h3>
              <p className="text-sm font-medium text-ink">
                {format(new Date(project.start_date || 0), 'MMM d, yyyy')} –{' '}
                {format(new Date(project.actual_end || project.planned_end || 0), 'MMM d, yyyy')}
              </p>
            </div>
          </div>
        </div>

        <div className="border-b border-hairline mb-8">
          <div className="flex border-b pb-2">
            <button
              onClick={() => setShowVerification(false)}
              className={`px-4 py-2 border-b-2 ${
                !showVerification ? 'border-brick text-brick' : 'border-transparent text-ink-soft'
              }`}
            >
              Details
            </button>
            {user && user.role === 'citizen' && (
              <button
                onClick={() => setShowVerification(true)}
                className={`px-4 py-2 border-b-2 ${
                  showVerification ? 'border-lagoon text-lagoon' : 'border-transparent text-ink-soft'
                }`}
              >
                Verify Progress
              </button>
            )}
          </div>
        </div>

{showVerification && user && user.role === 'citizen' && (
          <VerificationTab project={project} verifyProjectMutation={verifyProjectMutation} />
        )}
            <section className="mb-8">
              <h2 className="text-xl font-heading text-ink mb-4">Budget & Expenditure</h2>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-hairline">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <h3 className="font-semibold text-ink mb-2">Sanctioned Budget</h3>
                    <p className="text-2xl font-bold text-ink">{INR.format(project.sanctioned_budget || 0)}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-ink mb-2">Amount Spent</h3>
                    <p className="text-2xl font-bold text-ink">{INR.format(project.spent || 0)}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-ink mb-2">Variance</h3>
                    <p className={`text-2xl font-bold ${
                      project.spent > project.sanctioned_budget ? 'text-brick' :
                      project.spent < project.sanctioned_budget * 0.9 ? 'text-lagoon' :
                      'text-ink'
                    }`}>
                      {INR.format(Math.abs((project.spent || 0) - (project.sanctioned_budget || 0)))} {' '}
                      {project.spent > project.sanctioned_budget ? '(OVER)' :
                       project.spent < project.sanctioned_budget * 0.9 ? '(UNDER)' :
                       '(WITHIN)'}
                    </p>
                  </div>
                </div>
                <div className="mt-6">
                  <p className="text-sm font-medium text-ink mb-2">Budget Utilization</p>
                  <div className="w-full bg-moss/10 rounded-lg h-4">
                    <div className={`h-full bg-moss rounded-lg transition-all duration-500 ${
                      project.sanctioned_budget > 0
                        ? `width-${Math.min(100, Math.round(((project.spent || 0) / (project.sanctioned_budget || 1)) * 100))}%`
                        : 'width-0'
                    }`}></div>
                  </div>
                  <p className="mt-2 text-sm text-ink">
                    {project.sanctioned_budget > 0
                      ? Math.round(((project.spent || 0) / (project.sanctioned_budget || 1)) * 100) + '%'
                      : '0%'}
                  </p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-heading text-ink mb-4">Project Timeline</h2>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-hairline">
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="h-3 w-3 bg-moss/20 text-moss rounded-full flex-shrink-0 mt-1">
                      <span className="text-xs">●</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-ink mb-1">Work Commenced</h3>
                      <p className="text-sm text-ink-soft">{format(new Date(project.start_date || 0), 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="h-3 w-3 bg-saffron/20 text-saffron rounded-full flex-shrink-0 mt-1">
                      <span className="text-xs">●</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-ink mb-1">Expected Completion</h3>
                      <p className="text-sm text-ink-soft">{format(new Date(project.planned_end || 0), 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                  {project.actual_end && (
                    <div className="flex items-start gap-4">
                      <div className="h-3 w-3 bg-lagoon/20 text-lagoon rounded-full flex-shrink-0 mt-1">
                        <span className="text-xs">●</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-ink mb-1">Actual Completion</h3>
                        <p className="text-sm text-ink-soft">{format(new Date(project.actual_end || 0), 'MMM d, yyyy')}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {project.delay_history && project.delay_history.length > 0 && (
              <section className="mb-8">
                <h2 className="text-xl font-heading text-ink mb-4">Delay History</h2>
                <div className="bg-white rounded-xl p-6 shadow-sm border border-hairline">
                  <div className="space-y-4">
                    {project.delay_history.map((delay: any, index: number) => (
                      <div key={index} className="border-b pb-4 last:border-0">
                        <div className="flex justify-between mb-2">
                          <h3 className="font-semibold text-ink">Delay #{index + 1}</h3>
                          <span className="text-sm text-ink-soft">{format(new Date(delay.changed_at), 'MMM d, yyyy')}</span>
                        </div>
                        <p className="text-sm text-ink-soft mb-2"><strong>Original End Date:</strong> {format(new Date(delay.old_end), 'MMM d, yyyy')}</p>
                        <p className="text-sm text-ink-soft mb-2"><strong>New End Date:</strong> {format(new Date(delay.new_end), 'MMM d, yyyy')}</p>
                        <p className="text-sm text-ink-soft"><strong>Reason:</strong> {delay.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {project.work_order && (
              <section className="mb-8">
                <h2 className="text-xl font-heading text-ink mb-4">Work Order Sequence</h2>
                <div className="bg-white rounded-xl p-6 shadow-sm border border-hairline">
                  <div className="space-y-4">
                    {project.work_order.items.map((item: any, _index: number) => (
                      <div key={item.id} className="border-b pb-4 last:border-0">
                        <div className="flex items-start gap-3">
                          <div className={`h-8 w-8 flex items-center justify-center rounded-full ${
                            item.role === 'primary' ? 'bg-moss/20 text-moss' :
                            item.role === 'secondary' ? 'bg-saffron/20 text-saffron' :
                            'bg-lagoon/20 text-lagoon'
                          }`}>
                            <span className="text-xs font-medium">{item.sequence_no}</span>
                          </div>
                          <div className="flex-1 space-y-2">
                            <h3 className="font-semibold text-ink mb-1">{item.department_name}</h3>
                            <p className="text-sm text-ink-soft mb-1">{item.category.replace(/_/g, ' ').toUpperCase()}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-ink">Role:</span>
                              <span className="font-medium">{item.role.toUpperCase()}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-ink">Status:</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                item.status === 'pending' ? 'bg-white/20 text-ink' :
                                item.status === 'scheduled' ? 'bg-moss/20 text-moss' :
                                item.status === 'in_progress' ? 'bg-saffron/20 text-saffron' :
                                item.status === 'complete' ? 'bg-lagoon/20 text-lagoon' :
                                'bg-brick/20 text-brick'
                              }`}>
                                {item.status.toUpperCase()}
                              </span>
                              {item.delay_reason && (
                                <>
                                  <span className="ml-2 inline-flex items-center gap-1">
                                    <span className="text-xs font-medium bg-brick/20 text-brick">DELAYED</span>
                                    <span className="ml-1">→</span>
                                    <span className="text-xs">{item.delay_reason}</span>
                                  </span>
                                </>
                              )}
                            </div>
                            {item.expected_complete_at && (
                              <div className="mt-1">
                                <span className="text-xs text-ink">Expected Completion:</span>
                                <span className="font-medium">{format(new Date(item.expected_complete_at), 'MMM d, yyyy')}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {project.conflicts && project.conflicts.length > 0 && (
              <section className="mb-8">
                <h2 className="text-xl font-heading text-ink mb-4">Dig-Once Conflicts Detected</h2>
                <div className="bg-brick/10 rounded-xl p-6 border border-brick">
                  <p className="text-body text-ink-soft mb-4">
                    This project conflicts with other planned or recent work in the area. Coordinating these works could reduce costs and disruption.
                  </p>
                  <div className="space-y-3">
                    {project.conflicts.map((conflict: any, _index: number) => (
                      <div key={conflict.id} className="border-t pt-4 first:border-0">
                        <p className="font-medium text-ink mb-2">Conflict with: {conflict.project_b_title}</p>
                        <p className="text-sm text-ink-soft">{conflict.suggestion}</p>
                        {conflict.distance_m && <p className="text-xs text-ink-soft">Distance: {Math.round(conflict.distance_m)}m</p>}
                        {conflict.gap_days && <p className="text-xs text-ink-soft">Time Gap: {conflict.gap_days} days</p>}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4">
                    <Link to="/conflicts" className="inline-block bg-brick hover:bg-brick/90 text-white px-4 py-2 rounded-md">
                      View All Conflicts
                    </Link>
                  </div>
                </div>
</section>
            )}
            {showVerification && user && user.role === 'citizen' && (
          <VerificationTab project={project} verifyProjectMutation={verifyProjectMutation} />
        )}
      </div>
    </div>
  );
};

function VerificationTab({ project, verifyProjectMutation }: { project: any; verifyProjectMutation: any }) {
  const [formData, setFormData] = useState({
    lat: project.lat,
    lng: project.lng,
    accuracy_m: 20,
    demo_lat: null as number | null,
    demo_lng: null as number | null,
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent, statusType: 'in_progress' | 'completed') => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const result = await verifyProjectMutation.mutateAsync({
        projectId: project.id,
        statusType,
        lat: formData.demo_lat ?? formData.lat,
        lng: formData.demo_lng ?? formData.lng,
        accuracy_m: formData.accuracy_m,
        demo_lat: formData.demo_lat,
        demo_lng: formData.demo_lng,
      });

      if (result.success) {
        setSuccess(`Verification submitted! ${result.quorum_reached ? 'Quorum reached!' : 'Waiting for more verifications...'}`);
        setFormData({ lat: project.lat, lng: project.lng, accuracy_m: 20, demo_lat: null, demo_lng: null });
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Verification failed. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-heading text-ink mb-4">Submit Verification</h2>
      <p className="text-body text-ink-soft mb-6">
        To verify this project's progress, please provide your current location and a geotagged photo.
        Your verification will help ensure accountability and transparency.
      </p>
      <form onSubmit={(e) => handleSubmit(e, 'in_progress')} className="space-y-4">
        <div className="space-y-3">
          <label className="block text-sm font-medium text-ink mb-2">Location Source</label>
          <div className="flex space-x-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="radio"
                name="locationSource"
                value="device"
                checked={formData.demo_lat === null}
                onChange={(_e) => setFormData((prev) => ({ ...prev, demo_lat: null, demo_lng: null }))}
              />
              Use Current GPS Location
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="radio"
                name="locationSource"
                value="demo"
                checked={formData.demo_lat !== null}
onChange={(_e) => setFormData((prev) => ({
                  ...prev,
                  demo_lat: project.lat + (Math.random() - 0.5) * 0.01,
                  demo_lng: project.lng + (Math.random() - 0.5) * 0.01,
                }))}
              />
              Use Demo Location (for testing)
            </label>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-ink mb-2">GPS Accuracy (meters)</label>
          <input
            type="number"
            min="1"
            max="200"
            value={formData.accuracy_m}
            onChange={(e) => setFormData((prev) => ({ ...prev, accuracy_m: parseInt(e.target.value) || 20 }))}
            className="w-full px-3 py-2 rounded-border border-hairline focus:border-moss focus:ring-2 focus:ring-moss/20"
            placeholder="Enter GPS accuracy"
          />
          <p className="text-xs text-ink-soft mt-1">
            Lower values indicate better accuracy. Values over 50m may not be accepted for verification.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={verifyProjectMutation.isPending}
            className={`w-full bg-lagoon hover:bg-lagoon/90 text-white px-4 py-3 rounded-md font-medium flex items-center justify-center gap-2 ${verifyProjectMutation.isPending ? 'opacity-70' : ''}`}
          >
            {verifyProjectMutation.isPending ? (
              <>
                <span className="animate-spin h-4 w-4 text-white mr-2"></span>
                Submitting...
              </>
            ) : (
              <>
                <span className="mr-2">✓</span>
                Verify as "In Progress"
              </>
            )}
          </button>
<button
            type="submit"
            onClick={(e) => handleSubmit(e, 'completed')}
            disabled={verifyProjectMutation.isPending}
            className={`w-full bg-moss hover:bg-moss-light text-white px-4 py-3 rounded-md font-medium flex items-center justify-center gap-2 ${verifyProjectMutation.isPending ? 'opacity-70' : ''}`}
          >
            {verifyProjectMutation.isPending ? (
              <>
                <span className="animate-spin h-4 w-4 text-white mr-2"></span>
                Submitting...
              </>
            ) : (
              <>
                <span className="mr-2">✓</span>
                Verify as "Completed"
              </>
            )}
          </button>
        </div>
      </form>

      {error && <div className="mt-4 p-4 bg-brick/10 rounded-border text-brick text-sm">{error}</div>}
      {success && <div className="mt-4 p-4 bg-lagoon/10 rounded-border text-lagoon text-sm">{success}</div>}
    </div>
  );
}

export default ProjectDetail;