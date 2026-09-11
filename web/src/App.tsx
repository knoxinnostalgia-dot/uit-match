import { Navigate, Route, Routes } from 'react-router-dom';
import SerendipityBanner from './components/SerendipityBanner';
import BrandMark from './components/BrandMark';
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

export default function App() {
  const { ready, signedIn, profile } = useAuth();

  if (!ready) {
    return (
      <div className="boot">
        <BrandMark size={48} />
        <p>UIT Match</p>
        <div className="spinner" />
      </div>
    );
  }

  if (!signedIn) return <AuthPage />;
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
