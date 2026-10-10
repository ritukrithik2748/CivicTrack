import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { useAuth } from './contexts/AuthContext';
import Home from './pages/Home';
import Explore from './pages/Explore';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import ReportIssue from './pages/ReportIssue';
import MyReports from './pages/MyReports';
import VerifyProgress from './pages/VerifyProgress';
import AboutDemo from './pages/AboutDemo';
import BudgetTransparency from './pages/BudgetTransparency';
import ProjectDetail from './pages/ProjectDetail';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { ErrorBoundary } from './components/ErrorBoundary';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <NotificationProvider>
              <div className="min-h-screen bg-paper flex flex-col">
                <Header />
                <main className="flex-1">
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/explore" element={<Explore />} />
                    <Route path="/projects/:id" element={<ProjectDetail />} />
                    <Route path="/reports/:id" element={<ProjectDetail />} />
                    <Route path="/budget" element={<BudgetTransparency />} />
                    <Route path="/report" element={<ReportIssue />} />
                    <Route path="/my-reports" element={<MyReports />} />
                    <Route path="/verify" element={<VerifyProgress />} />
                    <Route path="/about" element={<AboutDemo />} />
                    <Route path="/privacy" element={<PrivacyPolicy />} />
                    <Route path="/terms" element={<TermsOfService />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </main>
                <Footer />
                <ToastContainer
                  position="top-right"
                  autoClose={5000}
                  hideProgressBar={false}
                  newestOnTop={false}
                  closeOnClick
                  rtl={false}
                  pauseOnFocusLoss
                  draggable
                  pauseOnHover
                />
              </div>
            </NotificationProvider>
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

function Header() {
  const { user, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <header className="bg-paper-2 border-b border-hairline">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between py-4">
            <div className="flex-1 flex flex-col">
              <h1 className="text-2xl font-heading text-ink tracking-tighter">
                CivicTrack
              </h1>
              <p className="mt-1 text-sm text-ink-soft hidden md:block">
                Transparency and Coordination in Public Works
              </p>
            </div>
            <div className="animate-pulse space-x-4 mt-4 md:mt-0">
              <div className="h-8 w-24 rounded bg-ink-soft/20"></div>
              <div className="h-8 w-32 rounded bg-ink-soft/20"></div>
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="bg-paper-2 border-b border-hairline sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-4 gap-4">
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-10 h-10 bg-moss rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-5.447L12 10.893l5.447 5.447L21 21l-9-9" />
              </svg>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-heading text-ink tracking-tighter">CivicTrack</h1>
              <p className="text-xs text-ink-soft -mt-1">Transparency & Coordination</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            <Link to="/" className="px-3 py-2 rounded-lg text-sm font-medium text-ink hover:bg-paper-2 transition-colors">Home</Link>
            <Link to="/explore" className="px-3 py-2 rounded-lg text-sm font-medium text-ink hover:bg-paper-2 transition-colors">Explore</Link>
            <Link to="/report" className="px-3 py-2 rounded-lg text-sm font-medium text-white bg-moss hover:bg-moss-light transition-colors">Report Issue</Link>
          </nav>

          <div className="flex items-center gap-3 ml-auto flex-shrink-0">
            {user ? (
              <>
                <Link to="/my-reports" className="hidden sm:inline-flex px-3 py-2 rounded-lg text-sm font-medium text-ink hover:bg-paper-2 transition-colors">My Reports</Link>
                <Link to="/verify" className="hidden sm:inline-flex px-3 py-2 rounded-lg text-sm font-medium text-ink hover:bg-paper-2 transition-colors">Verify Progress</Link>
                <Link to="/about" className="hidden sm:inline-flex px-3 py-2 rounded-lg text-sm font-medium text-ink hover:bg-paper-2 transition-colors">About</Link>
                <div className="relative">
                  <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-ink hover:bg-paper-2 transition-colors">
                    <span className="w-8 h-8 bg-moss/20 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-moss" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </span>
                    <span className="hidden sm:inline font-medium text-ink">{user.name}</span>
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-moss/20 text-moss capitalize">{user.role}</span>
                    <svg className="w-4 h-4 text-ink-soft" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                </div>
                <button onClick={logout} className="px-4 py-2 rounded-lg text-sm font-medium text-ink hover:bg-paper-2 transition-colors">Logout</button>
              </>
            ) : (
              <Link to="/login" className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-moss hover:bg-moss-light transition-colors">Login</Link>
            )}
          </div>
        </div>

        <div className="md:hidden mt-4 pt-4 border-t border-hairline">
          <nav className="flex flex-col gap-2">
            <Link to="/" className="px-3 py-2 rounded-lg text-sm font-medium text-ink hover:bg-paper-2">Home</Link>
            <Link to="/explore" className="px-3 py-2 rounded-lg text-sm font-medium text-ink hover:bg-paper-2">Explore</Link>
            <Link to="/report" className="px-3 py-2 rounded-lg text-sm font-medium text-white bg-moss hover:bg-moss-light">Report Issue</Link>
{user ? (
              <>
                <Link to="/my-reports" className="px-3 py-2 rounded-lg text-sm font-medium text-ink hover:bg-paper-2">My Reports</Link>
                <Link to="/verify" className="px-3 py-2 rounded-lg text-sm font-medium text-ink hover:bg-paper-2">Verify Progress</Link>
                <Link to="/about" className="px-3 py-2 rounded-lg text-sm font-medium text-ink hover:bg-paper-2">About</Link>
                <button onClick={logout} className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-brick hover:bg-brick/10">Logout</button>
              </>
            ) : (
              <Link to="/login" className="px-3 py-2 rounded-lg text-sm font-medium text-white bg-moss hover:bg-moss-light">Login</Link>
            )}
            </nav>
          </div>
        </div>
      </header>
    );
  };

function Footer() {
  return (
    <footer className="bg-paper-2 border-t border-hairline">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4 text-center">
          <div>
            <h3 className="font-semibold text-ink mb-2">About</h3>
            <ul className="space-y-1 text-sm text-ink-soft">
              <li><Link to="/about" className="hover:text-moss">About This Demo</Link></li>
              <li><Link to="/privacy" className="hover:text-moss">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-moss">Terms of Service</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-ink mb-2">Resources</h3>
            <ul className="space-y-1 text-sm text-ink-soft">
              <li><Link to="/budget" className="hover:text-moss">Budget Transparency</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-ink mb-2">Departments</h3>
            <ul className="space-y-1 text-sm text-ink-soft">
              <li><a href="#" className="hover:text-moss">Sewage & Water</a></li>
              <li><a href="#" className="hover:text-moss">Storm Drainage</a></li>
              <li><a href="#" className="hover:text-moss">Electricity</a></li>
              <li><a href="#" className="hover:text-moss">Telecom</a></li>
              <li><a href="#" className="hover:text-moss">Roads</a></li>
            </ul>
          </div>
          <div className="space-y-1 text-sm text-ink-soft">
            <h3 className="font-semibold text-ink mb-2">Follow</h3>
            <div className="flex justify-center space-x-3">
              <a href="#" className="text-ink-soft hover:text-moss">Twitter</a>
              <a href="#" className="text-ink-soft hover:text-moss">Facebook</a>
              <a href="#" className="text-ink-soft hover:text-moss">Instagram</a>
            </div>
            <p className="mt-2 text-xs text-ink-soft">© 2026 CivicTrack. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default App;