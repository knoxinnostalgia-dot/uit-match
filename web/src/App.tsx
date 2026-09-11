import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import SerendipityBanner from './components/SerendipityBanner';
import StageLoader from './components/StageLoader';
import NavBar from './components/NavBar';
import AdmirersPage from './pages/AdmirersPage';
import AuthPage from './pages/AuthPage';
import ChatPage from './pages/ChatPage';
import DiscoverPage from './pages/DiscoverPage';
import FreeTimePage from './pages/FreeTimePage';
import MatchesPage from './pages/MatchesPage';
import OnboardingPage from './pages/OnboardingPage';
import ProfilePage from './pages/ProfilePage';
import { useAuth } from './state';

const Entrance = lazy(() => import('./entrance/Entrance'));

export default function App() {
  const { ready, signedIn, profile } = useAuth();

  if (!ready) {
    return (
      <div className="boot">
        <StageLoader label="UIT Match" />
      </div>
    );
  }

  if (!signedIn) {
    return (
      <Suspense
        fallback={
          <div className="boot">
            <StageLoader label="Opening UIT Match…" />
          </div>
        }
      >
        <Entrance>
          <AuthPage />
        </Entrance>
      </Suspense>
    );
  }
  if (!profile?.isComplete) return <OnboardingPage />;

  return (
    <div className="site">
      <NavBar />
      <SerendipityBanner />
      <main className="stage">
        <Routes>
          <Route path="/" element={<Navigate to="/discover" replace />} />
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/admirers" element={<AdmirersPage />} />
          <Route path="/matches" element={<MatchesPage />} />
          <Route path="/matches/:id" element={<ChatPage />} />
          <Route path="/free-time" element={<FreeTimePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/discover" replace />} />
        </Routes>
      </main>
    </div>
  );
}
