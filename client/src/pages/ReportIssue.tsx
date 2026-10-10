import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useReportIssue } from '../hooks/useReportIssue';

const ReportIssue: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<any>({
    category: '',
    description: '',
    lat: 12.835,
    lng: 80.145,
    location_source: 'device_gps',
    exif_lat: null,
    exif_lng: null,
    exif_timestamp: null,
    device_accuracy: null,
    manual_lat: null,
    manual_lng: null,
  });
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [_error, setError] = useState<string | null>(null);
  const [_success, setSuccess] = useState<string | null>(null);
  const { reportIssue } = useReportIssue();

  const categories = [
    { value: 'sewage_leak', label: 'Sewage Leak', department: 'Sewage & Water' },
    { value: 'sewage_blockage', label: 'Sewage Blockage', department: 'Sewage & Water' },
    { value: 'water_pipe_leak', label: 'Water Pipe Leak', department: 'Sewage & Water' },
    { value: 'drain_blockage', label: 'Drain Blockage', department: 'Storm Drainage' },
    { value: 'waterlogging', label: 'Waterlogging', department: 'Storm Drainage' },
    { value: 'live_wire', label: 'Live Wire', department: 'Electricity' },
    { value: 'streetlight_out', label: 'Streetlight Out', department: 'Electricity' },
    { value: 'transformer_issue', label: 'Transformer Issue', department: 'Electricity' },
    { value: 'cable_fault', label: 'Cable Fault', department: 'Telecom' },
    { value: 'open_trench_cable', label: 'Open Trench Cable', department: 'Telecom' },
    { value: 'pothole', label: 'Pothole', department: 'Roads' },
    { value: 'road_cave_in', label: 'Road Cave-in', department: 'Roads' },
    { value: 'damaged_road', label: 'Damaged Road', department: 'Roads' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setUploading(true);

    try {
      await reportIssue({ ...formData });
      setSuccess('Report submitted successfully!');
      setTimeout(() => navigate('/explore'), 2000);
    } catch (err) {
      setError('Failed to submit report. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const goToStep = (stepNum: number) => setStep(stepNum);

  if (!user) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-center py-12">
          <h2 className="text-2xl font-heading text-ink mb-4">Please Log In</h2>
          <p className="text-body text-ink-soft mb-6">You need to be logged in to report an issue.</p>
          <Link to="/login" className="bg-moss hover:bg-moss-light text-white px-6 py-3 rounded-md">Login</Link>
        </div>
      </div>
    );
  }

  const renderStep1 = () => (
    <div className="bg-white rounded-xl p-8 shadow-sm border border-hairline">
      <h2 className="text-xl font-heading text-ink mb-6">Step 1: Select Issue Type</h2>
      <p className="text-body text-ink-soft mb-6">Choose the category that best describes the issue you're reporting</p>
      <div className="space-y-4">
        {categories.map((category) => (
          <div
            key={category.value}
            className={`flex items-center gap-3 p-4 border border-hairline rounded-lg cursor-pointer hover:bg-moss/5 transition-colors ${formData.category === category.value ? 'border-moss bg-moss/10' : ''}`}
            onClick={() => setFormData((prev: any) => ({ ...prev, category: category.value }))}
          >
            <div className="flex-shrink-0">
              <div className="h-10 w-10 flex items-center justify-center bg-moss/20 rounded-lg">
                {category.value === 'pothole' ? <span className="text-moss">🕳️</span> :
                 category.value.includes('sewage') ? <span className="text-moss">💧</span> :
                 category.value.includes('water') ? <span className="text-moss">💦</span> :
                 category.value.includes('wire') || category.value.includes('transformer') ? <span className="text-moss">⚡</span> :
                 category.value.includes('cable') || category.value.includes('trench') ? <span className="text-moss">📡</span> :
                 <span className="text-moss">🛣️</span>}
              </div>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-ink mb-1">{category.label}</h3>
              <p className="text-sm text-ink-soft">{category.department}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6">
        <button onClick={() => goToStep(2)} disabled={!formData.category} className="w-full bg-moss hover:bg-moss-light text-white px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-transform transform hover:scale-105 disabled:opacity-50">
          {formData.category ? 'Next: Describe Issue' : 'Select Issue Type to Continue'}
        </button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="bg-white rounded-xl p-8 shadow-sm border border-hairline">
      <h2 className="text-xl font-heading text-ink mb-6">Step 2: Describe the Issue</h2>
      <p className="text-body text-ink-soft mb-6">Please provide a detailed description of the issue you're reporting</p>
      <div className="space-y-4">
        <div className="space-y-3">
          <label className="block text-sm font-medium text-ink mb-2">Description</label>
          <textarea value={formData.description} onChange={(_e) => setFormData((prev: any) => ({ ...prev, description: _e.target.value }))} rows={6} className="w-full px-3 py-2 rounded-border border-hairline focus:border-moss focus:ring-2 focus:ring-moss/20" placeholder="Describe the issue in detail (what, when, where you noticed it)" maxLength={2000} />
          <p className="text-xs text-ink-soft mt-1">{formData.description.length}/2000 characters</p>
        </div>
        <div className="flex justify-between">
          <button onClick={() => goToStep(1)} className="w-full px-3 py-2 rounded-border border-hairline text-sm font-medium text-ink">Previous</button>
          <button onClick={() => goToStep(3)} disabled={!formData.description.trim()} className="w-full bg-moss hover:bg-moss-light text-white px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-transform transform hover:scale-105">
            {formData.description.trim() ? 'Next: Location' : 'Enter Description to Continue'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="bg-white rounded-xl p-8 shadow-sm border border-hairline">
      <h2 className="text-xl font-heading text-ink mb-6">Step 3: Confirm Location</h2>
      <p className="text-body text-ink-soft mb-6">Please confirm or adjust the location of the issue</p>
      <div className="space-y-4">
        <div className="space-y-3">
          <label className="block text-sm font-medium text-ink mb-2">Location Source</label>
          <div className="flex space-x-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="radio" name="locationSource" value="device_gps" checked={formData.location_source === 'device_gps'} onChange={(_e) => setFormData((prev: any) => ({ ...prev, location_source: 'device_gps', exif_lat: null, exif_lng: null, exif_timestamp: null, manual_lat: null, manual_lng: null }))} /> Use Device GPS
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="radio" name="locationSource" value="manual_pin" checked={formData.location_source === 'manual_pin'} onChange={(_e) => setFormData((prev: any) => ({ ...prev, location_source: 'manual_pin', exif_lat: null, exif_lng: null, exif_timestamp: null }))} /> Place Pin on Map
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="radio" name="locationSource" value="exif" checked={formData.location_source === 'exif'} onChange={(_e) => setFormData((prev: any) => ({ ...prev, location_source: 'exif', device_accuracy: null, manual_lat: null, manual_lng: null }))} /> Use Photo EXIF Data
            </label>
          </div>
        </div>
        <div className="bg-moss/10 rounded-lg p-4">
          <div className="h-48 bg-white/50 rounded-lg flex items-center justify-center text-moss/50">
            <p>Map would appear here in a real implementation</p>
            <p className="mt-2 text-xs">Click to select location or use current GPS</p>
          </div>
        </div>
        <div className="mt-4 p-3 bg-white rounded-border border-hairline">
          <h3 className="font-semibold text-ink mb-2">Current Coordinates</h3>
          <p className="text-sm text-ink-soft">Latitude: {formData.lat.toFixed(6)}</p>
          <p className="text-sm text-ink-soft">Longitude: {formData.lng.toFixed(6)}</p>
          {formData.location_source === 'manual_pin' && <p className="text-xs text-ink-soft mt-1"><em>Note: Manual pin locations receive lower weight in verification</em></p>}
        </div>
      </div>
      <div className="flex justify-between">
        <button onClick={() => goToStep(2)} className="w-full px-3 py-2 rounded-border border-hairline text-sm font-medium text-ink">Previous</button>
        <button onClick={() => goToStep(4)} className="w-full bg-moss hover:bg-moss-light text-white px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-transform transform hover:scale-105">Next: Add Photos</button>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="bg-white rounded-xl p-8 shadow-sm border border-hairline">
      <h2 className="text-xl font-heading text-ink mb-6">Step 4: Add Photos (Optional)</h2>
      <p className="text-body text-ink-soft mb-6">Upload up to 3 photos to help verify the issue. Photos with EXIF GPS data receive higher trust weight.</p>
      <div className="space-y-4">
        <div className="flex justify-center">
          <div className="relative w-48 h-48 mb-4">
            {previewImage ? (
              <img src={previewImage} alt="Preview" className="w-full h-full object-cover rounded-lg" />
            ) : (
              <div className="flex items-center justify-center bg-moss/10 rounded-lg">
                <span className="text-moss">📷</span>
                <p className="mt-2 text-xs text-center">Click to upload</p>
              </div>
            )}
            <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => setPreviewImage(reader.result as string); reader.readAsDataURL(file); } }} />
          </div>
          <p className="text-xs text-ink-soft text-center">Maximum 3 photos, 5MB each</p>
        </div>
      </div>
      <div className="flex justify-between">
        <button onClick={() => goToStep(3)} className="w-full px-3 py-2 rounded-border border-hairline text-sm font-medium text-ink">Previous</button>
        <button onClick={handleSubmit} disabled={uploading} className="w-full bg-moss hover:bg-moss-light text-white px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-transform transform hover:scale-105">
          {uploading ? (
            <>
              <span className="animate-spin h-4 w-4 text-white mr-2"></span>
              Submitting...
            </>
          ) : (
            <>
              <span className="mr-2">→</span>
              Submit Report
            </>
          )}
        </button>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <div className="text-center py-12">
        <h2 className="text-2xl font-heading text-ink mb-4">Report Submitted!</h2>
        <p className="text-body text-ink-soft mb-6">Thank you for helping improve your community. Your report has been submitted and will be reviewed by the appropriate department.</p>
        <div className="mt-8 flex justify-center gap-4">
          <Link to="/explore" className="bg-moss hover:bg-moss-light text-white px-6 py-3 rounded-lg font-medium">View Map</Link>
          <Link to="/my-reports" className="bg-ink hover:bg-ink/90 text-white px-6 py-3 rounded-lg font-medium">My Reports</Link>
        </div>
      </div>
    </div>
  );

  if (step === 1) return <div className="min-h-screen bg-paper"><Header /><main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{renderStep1()}</main></div>;
  if (step === 2) return <div className="min-h-screen bg-paper"><Header /><main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{renderStep2()}</main></div>;
  if (step === 3) return <div className="min-h-screen bg-paper"><Header /><main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{renderStep3()}</main></div>;
  if (step === 4) return <div className="min-h-screen bg-paper"><Header /><main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{renderStep4()}</main></div>;
  if (step === 5) return <div className="min-h-screen bg-paper"><Header /><main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{renderStep5()}</main></div>;
  return <div className="min-h-screen bg-paper"><Header /><main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8"><div className="hidden">{renderStep1()}</div></main></div>;

  function Header() {
    return (
      <header className="bg-paper-2 border-b border-hairline">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between py-4">
            <div className="flex-1">
              <h1 className="text-2xl font-heading text-ink mb-2">Report an Issue</h1>
              <p className="text-body text-ink-soft">Help improve your community by reporting public works issues</p>
            </div>
            <div className="flex items-center space-x-3">
              <Link to="/" className="px-3 py-1 rounded-md text-sm font-medium text-ink hover:bg-paper-2">← Home</Link>
              <Link to="/explore" className="px-3 py-1 rounded-md text-sm font-medium text-ink hover:bg-paper-2">View Map</Link>
            </div>
          </div>
        </div>
      </header>
    );
  }
}

export default ReportIssue;