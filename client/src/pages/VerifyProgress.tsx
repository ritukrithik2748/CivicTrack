import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useVerifyProject } from '../hooks/useReports';

const VerifyProgress: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useNotifications();
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [verificationType, setVerificationType] = useState<'in_progress' | 'completed'>('in_progress');
  const [formData, setFormData] = useState({
    lat: 0,
    lng: 0,
    accuracy_m: 20,
    demo_lat: null as number | null,
    demo_lng: null as number | null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const verifyProjectMutation = useVerifyProject();

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/projects?status=in_progress,planned,completed', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setProjects(data.data || []);
        } else {
          setError('Failed to fetch projects');
        }
      } catch (err) {
        setError('Failed to fetch projects');
      } finally {
        setIsLoading(false);
      }
    };
    fetchProjects();
  }, []);

  const handleVerify = async (projectId: string, statusType: 'in_progress' | 'completed') => {
    setVerificationType(statusType);
    setSelectedProject(projects.find(p => p.id === projectId));
    setFormData({
      lat: selectedProject?.lat || 0,
      lng: selectedProject?.lng || 0,
      accuracy_m: 20,
      demo_lat: null,
      demo_lng: null,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !user) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await verifyProjectMutation.mutateAsync({
        projectId: selectedProject.id,
        statusType: verificationType,
        lat: formData.demo_lat ?? formData.lat,
        lng: formData.demo_lng ?? formData.lng,
        accuracy_m: formData.accuracy_m,
        demo_lat: formData.demo_lat,
        demo_lng: formData.demo_lng,
      });

      if (result.success) {
        notify('success', `Verification submitted! ${result.quorum_reached ? 'Quorum reached!' : 'Waiting for more verifications...'}`);
        setShowModal(false);
        setSelectedProject(null);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Verification failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-paper flex items-center justify-center"><div className="animate-pulse space-y-2"><div className="h-4 w-24 rounded bg-ink-soft/20"></div><div className="h-4 w-32 rounded bg-ink-soft/20"></div></div></div>;
  }

  if (error && !projects.length) {
    return <div className="min-h-screen bg-paper flex items-center justify-center"><div className="text-center py-12"><h2 className="text-2xl font-heading text-ink mb-4">Error Loading Projects</h2><p className="text-body text-ink-soft">{error}</p><Link to="/" className="inline-block mt-6 bg-moss hover:bg-moss-light text-white px-4 py-2 rounded-md">Return Home</Link></div></div>;
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-paper-2 border-b border-hairline">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between py-4">
            <div className="flex-1"><h1 className="text-2xl font-heading text-ink mb-2">Verify Progress</h1><p className="text-body text-ink-soft">Confirm work status with geotagged verification</p></div>
            <div className="flex items-center space-x-3"><Link to="/" className="px-3 py-1 rounded-md text-sm font-medium text-ink hover:bg-paper-2">← Home</Link></div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 p-4 bg-lagoon/10 rounded-lg border border-lagoon/20">
          <h3 className="font-semibold text-lagoon mb-2">How Verification Works</h3>
          <ul className="text-sm text-ink-soft space-y-1">
            <li>• You must be within 200m of the project site with GPS accuracy ≤50m</li>
            <li>• A geotagged photo is required (use "Use Demo Location" for testing)</li>
            <li>• Status becomes "Citizen-confirmed" after 3 verifications</li>
            <li>• Disputes are flagged for officer review, not auto-changed</li>
          </ul>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project: any) => (
            <div key={project.id} className="bg-white rounded-xl p-6 shadow-sm border border-hairline">
              <h3 className="font-semibold text-ink mb-2">{project.title}</h3>
              <p className="text-sm text-ink-soft mb-3">{project.purpose || 'No description'}</p>
              <div className="space-y-2 mb-4 text-xs">
                <div className="flex justify-between"><span className="text-ink-soft">Status:</span><span className={`font-medium ${project.status === 'in_progress' ? 'text-saffron' : project.status === 'completed' ? 'text-lagoon' : 'text-ink'}`}>{project.status.replace('_', ' ').toUpperCase()}</span></div>
                <div className="flex justify-between"><span className="text-ink-soft">Department:</span><span className="font-medium">{project.department_name || 'Unknown'}</span></div>
                <div className="flex justify-between"><span className="text-ink-soft">Contractor:</span><span className="font-medium">{project.contractor_name || 'Not Assigned'}</span></div>
              </div>
              <div className="space-y-2">
                <button onClick={() => handleVerify(project.id, 'in_progress')} disabled={isSubmitting} className="w-full bg-lagoon hover:bg-lagoon/90 text-white px-4 py-2 rounded-md font-medium">{isSubmitting ? 'Verifying...' : 'Verify as "In Progress"'}</button>
                <button onClick={() => handleVerify(project.id, 'completed')} disabled={isSubmitting} className="w-full bg-moss hover:bg-moss-light text-white px-4 py-2 rounded-md font-medium">{isSubmitting ? 'Verifying...' : 'Verify as "Completed"'}</button>
              </div>
            </div>
          ))}
        </div>

        {projects.length === 0 && <div className="text-center py-12"><p className="text-body text-ink-soft">No projects available for verification</p></div>}
      </div>

      {showModal && selectedProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-heading text-ink mb-4">Submit Verification</h2>
            <p className="text-body text-ink-soft mb-6">Verify <strong>{selectedProject.title}</strong> as <strong>{verificationType.replace('_', ' ')}</strong></p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3">
                <label className="block text-sm font-medium text-ink mb-2">Location Source</label>
                <div className="flex space-x-4">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input type="radio" name="locationSource" value="device" checked={formData.demo_lat === null} onChange={(_e) => setFormData(prev => ({ ...prev, demo_lat: null, demo_lng: null }))} /> Use Current GPS Location
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input type="radio" name="locationSource" value="demo" checked={formData.demo_lat !== null} onChange={(_e) => setFormData(prev => ({ ...prev, demo_lat: selectedProject.lat + (Math.random() - 0.5) * 0.01, demo_lng: selectedProject.lng + (Math.random() - 0.5) * 0.01 }))} /> Use Demo Location (for testing)
                  </label>
                </div>
              </div>
              <div className="space-y-3">
                <label className="block text-sm font-medium text-ink mb-2">GPS Accuracy (meters)</label>
                <input type="number" min="1" max="200" value={formData.accuracy_m} onChange={(_e) => setFormData(prev => ({ ...prev, accuracy_m: parseInt(_e.target.value) || 20 }))} className="w-full px-3 py-2 rounded-border border-hairline focus:border-moss focus:ring-2 focus:ring-moss/20" placeholder="Enter GPS accuracy" />
                <p className="text-xs text-ink-soft mt-1">Lower values indicate better accuracy. Values over 50m may not be accepted.</p>
              </div>
              {error && <div className="mt-4 p-4 bg-brick/10 rounded-border text-brick text-sm">{error}</div>}
              <div className="flex items-center gap-4">
                <button type="button" onClick={() => { setShowModal(false); setSelectedProject(null); }} className="flex-1 px-3 py-2 rounded-border border-hairline text-sm font-medium text-ink">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 bg-moss hover:bg-moss-light text-white px-4 py-3 rounded-md font-medium flex items-center justify-center gap-2">{isSubmitting ? (<> <span className="animate-spin h-4 w-4 text-white mr-2"></span> Submitting... </>) : (<> <span className="mr-2">✓</span> Submit Verification </>)}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerifyProgress;