import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { useProjects } from '../hooks/useProjects';
import { useProblemGroups } from '../hooks/useReports';
import { MAP_DEFAULTS } from '../lib/mapConfig';

import 'leaflet/dist/leaflet.css';

const severityColors = {
  major: { bg: '#C8412B', ring: '#C8412B', pulse: true },
  moderate: { bg: '#E9A23B', ring: '#E9A23B', pulse: false },
  minor: { bg: '#2A8C82', ring: '#2A8C82', pulse: false },
  planned: { bg: '#1F4D3F', ring: '#1F4D3F', pulse: false },
  in_progress: { bg: '#E9A23B', ring: '#E9A23B', pulse: false },
  completed: { bg: '#2A8C82', ring: '#2A8C82', pulse: false },
  delayed: { bg: '#C8412B', ring: '#C8412B', pulse: true },
  disputed: { bg: '#B4308B', ring: '#B4308B', pulse: false },
};

const LocateButton: React.FC = () => {
  const map = useMap();
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLocate = () => {
    setLocating(true);
    setError(null);
    
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        // Check if within India bounds
        if (lat < 6.5 || lat > 35.7 || lng < 68.0 || lng > 97.5) {
          setError('CivicTrack currently covers India only');
          setLocating(false);
          return;
        }
        
        // Fly to location
        map.flyTo([lat, lng], 14);
        
        setLocating(false);
      },
      (err) => {
        let message = 'Failed to get location';
        if (err.code === err.PERMISSION_DENIED) {
          message = 'Location permission denied. Please enable location access.';
        } else if (err.code === err.TIMEOUT) {
          message = 'Location request timed out';
        }
        setError(message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <div className="absolute top-4 right-4 z-10">
      <button
        onClick={handleLocate}
        disabled={locating}
        className={`bg-white rounded-lg shadow-lg border border-hairline p-2 transition-colors ${
          locating ? 'opacity-50 cursor-wait' : 'hover:bg-paper-2'
        }`}
        title={locating ? 'Locating...' : 'Locate me'}
        aria-label="Locate me"
      >
        {locating ? (
          <svg className="w-5 h-5 text-moss animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-moss" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )}
      </button>
      {error && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-hairline p-3 text-xs text-brick">
          {error}
        </div>
      )}
    </div>
  )
};

const createSvgIcon = (color: string, ringColor: string, pulse = false) => {
  const pulseAnimation = pulse
    ? `<animate attributeName="r" from="10" to="16" dur="1.5s" repeatCount="indefinite" />
       <animate attributeName="opacity" from="0.6" to="0" dur="1.5s" repeatCount="indefinite" />`
    : '';
  
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 32 44">
      <circle cx="16" cy="16" r="10" fill="${ringColor}" fill-opacity="0.3" ${pulseAnimation} />
      <path d="M16 2 C10.477 2 6 6.477 6 12 C6 18.5 16 36 16 42 C16 36 26 18.5 26 12 C26 6.477 21.523 2 16 2 Z" fill="${color}" stroke="${ringColor}" stroke-width="2"/>
    </svg>
  `;
  
  return L.divIcon({
    className: 'custom-marker',
    html: svg,
    iconSize: [32, 44],
    iconAnchor: [16, 44],
    popupAnchor: [0, -44],
  });
};

const getProjectIcon = (status: string) => {
  if (status === 'delayed') return createSvgIcon('#C8412B', '#C8412B', true);
  if (status === 'disputed') return createSvgIcon('#B4308B', '#B4308B', false);
  if (status === 'in_progress') return createSvgIcon('#E9A23B', '#E9A23B', false);
  if (status === 'completed') return createSvgIcon('#2A8C82', '#2A8C82', false);
  return createSvgIcon('#1F4D3F', '#1F4D3F', false);
};

const getGroupIcon = (severity: string) => {
  const colors = severityColors[severity as keyof typeof severityColors] || severityColors.minor;
  return createSvgIcon(colors.bg, colors.ring, colors.pulse);
};

const Explore: React.FC = () => {
  const { user } = useAuth();
  const { data: projectsData, isLoading: projectsLoading, isError: projectsError } = useProjects();

  // Only fetch problem groups if user is officer/admin (has department_id)
  // This prevents 403 errors for citizens
  const shouldFetchGroups = user?.department_id != null;
  const { data: groupsData, isLoading: groupsLoading, isError: groupsError } = useProblemGroups({
    enabled: shouldFetchGroups
  });

  const [mapCenter, setMapCenter] = useState<[number, number]>([12.835, 80.145]);
  const [zoom, setZoom] = useState(14);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  const projects = projectsData?.data || [];
  const problemGroups = groupsData?.data || [];

  const handleMapReady = () => {
    if (mapRef.current) {
      mapRef.current.invalidateSize();
    }
  };

  const handleMapResize = () => {
    if (mapRef.current) {
      mapRef.current.invalidateSize();
    }
  };

  useEffect(() => {
    handleMapResize();
    window.addEventListener('resize', handleMapResize);
    return () => window.removeEventListener('resize', handleMapResize);
  }, []);

  if (projectsLoading || groupsLoading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="animate-pulse space-y-2">
          <div className="h-4 w-24 rounded bg-ink-soft/20"></div>
          <div className="h-4 w-32 rounded bg-ink-soft/20"></div>
          <div className="h-4 w-48 rounded bg-ink-soft/20"></div>
        </div>
      </div>
    );
  }

  if (projectsError || groupsError) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center p-8">
        <div className="w-16 h-16 bg-brick/10 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-brick" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-heading text-ink mb-2">Failed to load map data</h2>
        <p className="text-body text-ink-soft text-center max-w-md mb-6">
          Unable to load projects and issues. Please try refreshing the page.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-moss hover:bg-moss-light text-white px-6 py-3 rounded-md font-medium"
        >
          Refresh Page
        </button>
      </div>
    );
  }

  if (projects.length === 0 && problemGroups.length === 0) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center p-8">
        <div className="w-16 h-16 bg-lagoon/10 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-lagoon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-5.447L12 10.893l5.447 5.447L21 21l-9-9" />
          </svg>
        </div>
        <h2 className="text-xl font-heading text-ink mb-2">No data to display</h2>
        <p className="text-body text-ink-soft text-center max-w-md">
          No projects or reported issues found. Data will appear here once available.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      {/* Header */}
      <header className="bg-paper-2 border-b border-hairline">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between py-4">
            <div className="flex-1">
              <h1 className="text-2xl font-heading text-ink mb-2">
                Explore Public Works
              </h1>
              <p className="text-body text-ink-soft">
                View all public works projects and reported issues on the map
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Link
                to="/"
                className="px-3 py-1 rounded-md text-sm font-medium text-ink hover:bg-paper-2"
              >
                ← Home
              </Link>
              {!user?.department_id && (
                <Link
                  to="/report"
                  className="bg-moss hover:bg-moss-light text-white px-4 py-2 rounded-md font-medium"
                >
                  Report Issue
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Map and Controls */}
      <div className="flex-1 flex">
        {/* Sidebar Filters */}
        <aside className="w-64 bg-white border-r border-hairline flex-shrink-0 hidden lg:block">
          <div className="p-6 h-full overflow-y-auto">
            <h2 className="text-xl font-heading text-ink mb-4">
              Filters
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-2">
                  Status
                </label>
                <select
                  className="w-full px-3 py-2 rounded-border border-hairline focus:border-moss focus:ring-2 focus:ring-moss/20"
                >
                  <option value="">All Statuses</option>
                  <option value="planned">Planned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="delayed">Delayed</option>
                  <option value="disputed">Disputed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-2">
                  Department
                </label>
                <select
                  className="w-full px-3 py-2 rounded-border border-hairline focus:border-moss focus:ring-2 focus:ring-moss/20"
                >
                  <option value="">All Departments</option>
                  <option value="sewage_water">Sewage & Water</option>
                  <option value="storm_drainage">Storm Drainage</option>
                  <option value="electricity">Electricity</option>
                  <option value="telecom">Telecom</option>
                  <option value="roads">Roads</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-2">
                  Severity
                </label>
                <select
                  className="w-full px-3 py-2 rounded-border border-hairline focus:border-moss focus:ring-2 focus:ring-moss/20"
                >
                  <option value="">All Severities</option>
                  <option value="major">Major</option>
                  <option value="moderate">Moderate</option>
                  <option value="minor">Minor</option>
                </select>
              </div>
            </div>
            <div className="mt-6">
              <button
                onClick={() => {
                  setMapCenter([12.835, 80.145]);
                  setZoom(14);
                }}
                className="w-full bg-white hover:bg-paper-2 text-sm font-medium text-ink px-4 py-2 rounded-border border border-hairline"
              >
                Reset View
              </button>
            </div>
          </div>
        </aside>

        {/* Main Map */}
        <div className="flex-1 relative min-h-0" ref={mapContainerRef} style={{ minHeight: 'calc(100vh - 200px)' }}>
          <MapContainer
            center={mapCenter}
            zoom={zoom}
            scrollWheelZoom={true}
            className="h-full w-full rounded-card-lg shadow-paper-lg overflow-hidden"
            whenReady={handleMapReady}
            maxBounds={MAP_DEFAULTS.maxBounds}
            maxBoundsViscosity={MAP_DEFAULTS.maxBoundsViscosity}
            minZoom={MAP_DEFAULTS.minZoom}
            maxZoom={MAP_DEFAULTS.maxZoom}
          >
            <LocateButton />
            
            {/* Base Map Layer - Free tile server (no API key) */}
            <TileLayer
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              maxZoom={19}
            />

            {/* Project Markers */}
            {projects.map((project: any) => (
              project.lat && project.lng ? (
                <Marker
                  key={project.id}
                  position={[project.lat, project.lng]}
                  icon={getProjectIcon(project.status)}
                >
                  <Popup>
                    <div className="min-w-[200px]">
                      <h3 className="font-semibold text-ink mb-2">
                        {project.title}
                      </h3>
                      <p className="text-sm text-ink-soft mb-2">
                        {project.department_name || 'Unknown Department'}
                      </p>
                      <div className="flex items-center gap-2 mb-2 text-xs">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          project.status === 'planned'
                            ? 'bg-moss/20 text-moss'
                            : project.status === 'in_progress'
                            ? 'bg-saffron/20 text-saffron'
                            : project.status === 'completed'
                            ? 'bg-lagoon/20 text-lagoon'
                            : project.status === 'delayed'
                            ? 'bg-brick/20 text-brick'
                            : 'bg-disputed/20 text-disputed'
                        }`}>
                          {project.status.replace('_', ' ').toUpperCase()}
                        </span>
                        {project.claimed_status !== project.status && (
                          <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-disputed/20 text-disputed">
                            DISPUTED
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-ink mb-2">
                        <span className="font-medium">Budget:</span> ₹{
                          (project.sanctioned_budget || 0).toLocaleString()
                        }
                      </p>
                      <Link
                        to={`/projects/${project.id}`}
                        className="block w-full text-center bg-moss hover:bg-moss-light text-white px-3 py-2 rounded-md mt-4"
                      >
                        View Details
                      </Link>
                    </div>
                  </Popup>
                </Marker>
              ) : null
            ))}

            {/* Problem Group Markers */}
            {problemGroups.map((group: any) => (
              group.lat && group.lng ? (
                <Marker
                  key={group.id}
                  position={[group.lat, group.lng]}
                  icon={getGroupIcon(group.severity)}
                >
                  <Popup>
                    <div className="min-w-[200px]">
                      <h3 className="font-semibold text-ink mb-2">
                        {group.category.replace(/_/g, ' ').toUpperCase()}
                      </h3>
                      <p className="text-sm text-ink-soft mb-2">
                        {group.department_name || 'Unknown Department'}
                      </p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-ink">Reports:</span>
                          <span className="font-medium">
                            {group.report_count} ({group.weighted_count.toFixed(
                              1
                            )} weighted)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-ink">Severity:</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            group.severity === 'major'
                              ? 'bg-brick/20 text-brick'
                              : group.severity === 'moderate'
                              ? 'bg-saffron/20 text-saffron'
                              : 'bg-lagoon/20 text-lagoon'
                          }`}>
                            {group.severity.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-ink">Status:</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            group.status === 'open'
                              ? 'bg-moss/20 text-moss'
                              : group.status === 'acknowledged'
                              ? 'bg-saffron/20 text-saffron'
                              : group.status === 'in_progress'
                              ? 'bg-lagoon/20 text-lagoon'
                              : group.status === 'resolved'
                              ? 'bg-disputed/20 text-disputed'
                              : 'bg-white/20 text-ink'
                          }`}>
                            {group.status.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        </div>
                      </div>
                      {group.severity_reason && (
                        <div className="mt-3 p-3 bg-moss/10 rounded-border text-xs">
                          <strong>Reason:</strong> {group.severity_reason}
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ) : null
            ))}

          </MapContainer>

          {/* Map Attribution */}
          <div className="absolute bottom-2 left-2 w-full max-w-xs">
            <div className="text-xs text-ink/60">
              &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors
            </div>
          </div>

          {/* Legend inside map as floating card */}
          <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
            <div className="bg-white rounded-lg shadow-lg border border-hairline p-3 pointer-events-auto max-w-xs">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-ink">Legend</h4>
                <button
                  className="text-ink-soft hover:text-ink p-1 rounded"
                  title="Toggle legend"
                >
                  <svg className="w-4 h-4 text-ink-soft" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-ink mb-1">Severity</div>
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 bg-brick/20 text-brick rounded-full"></div>
                    <span className="text-xs text-ink">Major</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 bg-saffron/20 text-saffron rounded-full"></div>
                    <span className="text-xs text-ink">Moderate</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 bg-lagoon/20 text-lagoon rounded-full"></div>
                    <span className="text-xs text-ink">Minor</span>
                  </div>
                </div>
                <div className="text-xs font-medium text-ink mt-3 mb-1">Status</div>
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 bg-moss/20 text-moss rounded-full"></div>
                    <span className="text-xs text-ink">Open</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 bg-saffron/20 text-saffron rounded-full"></div>
                    <span className="text-xs text-ink">Acknowledged</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 bg-lagoon/20 text-lagoon rounded-full"></div>
                    <span className="text-xs text-ink">In Progress</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 bg-disputed/20 text-disputed rounded-full"></div>
                    <span className="text-xs text-ink">Disputed</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    );
  };

export default Explore;