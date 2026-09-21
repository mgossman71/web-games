import { Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { GlobalStoreProvider } from './app/globalStore';
import { Navbar } from './components/Navbar';
import { AchievementToasts } from './components/AchievementToasts';
import { useAchievementToasts } from './hooks/useAchievementToasts';
import { HomePage } from './pages/HomePage';
import { GamePage } from './pages/GamePage';
import { StatsPage } from './pages/StatsPage';
import { AchievementsPage } from './pages/AchievementsPage';
import { SettingsPage } from './pages/SettingsPage';
import { audio } from './audio/engine';
import './styles/index.css';

/**
 * Router uses HashRouter so the app is fully static (no server rewrites
 * required) — which plays best with a plain nginx container.
 */
export function App() {
  const { toasts, dismiss } = useAchievementToasts();
  const location = useLocation();

  // Scroll top on page changes (except inside games).
  useEffect(() => {
    if (!location.pathname.startsWith('/play')) {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [location.pathname]);

  const inGame = location.pathname.startsWith('/play');

  return (
    <GlobalStoreProvider>
      <div className="gv-app">
        {!inGame && <Navbar />}
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/play/:id" element={<GamePage />} />
          <Route path="/random" element={<GamePage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/achievements" element={<AchievementsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route
            path="*"
            element={
              <div className="gv-page">
                <div className="gv-404">
                  <h2>404 — off the map</h2>
                  <p>That screen isn't in the vault.</p>
                  <a href="#/" className="gv-btn gv-primary">
                    Back to the arcade
                  </a>
                </div>
              </div>
            }
          />
        </Routes>
        <footer className="gv-app-foot">
          <span>
            GAMEVAULT · original games, no third-party assets · <a href="#/settings">settings</a>
          </span>
          <span>Audio starts after your first click</span>
        </footer>
      </div>
      <AchievementToasts toasts={toasts} dismiss={dismiss} />
    </GlobalStoreProvider>
  );
}

export { audio };
