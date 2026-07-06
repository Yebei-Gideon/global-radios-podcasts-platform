import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Radio, Compass, Library, Sun, Moon, Mic, Play, Tv } from 'lucide-react';
import { HomePage } from '@/modules/radio/pages/HomePage';
import RadioExplorerPage from './modules/radio/pages/RadioExplorerPage';
import { PodcastsPage } from '@/modules/podcast/pages/PodcastsPage';
import LiveTvPage from '@/modules/tv/pages/LiveTvPage';
import { LibraryPage } from '@/modules/library/pages/LibraryPage';
import PlayerPage from '@/modules/shared/pages/PlayerPage';
import { GlobalAudioManagerProvider } from '@/modules/shared/context/GlobalAudioManager';
import { AudioProvider } from '@/modules/radio/context/AudioContext';
import { RadioExplorerProvider } from '@/modules/radio/context/RadioExplorerContext';
import { PodcastPlayerProvider } from '@/modules/podcast/context/PodcastPlayerContext';
import { useAudio } from '@/modules/radio/context/AudioContext';
import { usePodcastPlayer } from '@/modules/podcast/context/PodcastPlayerContext';
import { Button } from '@/modules/shared/components/ui';

type Page = 'home' | 'radio' | 'tv' | 'podcasts' | 'library';

/**
 * Modern App Component with unified Player Page
 * Modular architecture with feature-based organization
 */
function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);

  // Get playback states from contexts
  const { currentStation, isPlaying: radioPlaying } = useAudio();
  const { currentPodcast, currentEpisode, isPlaying: podcastPlaying } = usePodcastPlayer();

  // Show player button if any source is selected (even if paused) to let users resume
  const hasActivePlayback = Boolean(currentStation || (currentPodcast && currentEpisode));

  console.log('[App] Playback state:', {
    currentStation: currentStation?.name,
    radioPlaying,
    currentPodcast: currentPodcast?.title,
    podcastPlaying,
    hasActivePlayback,
  });

  useEffect(() => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage />;
      case 'radio':
        return <RadioExplorerPage />;
      case 'tv':
        return <LiveTvPage />;
      case 'podcasts':
        return <PodcastsPage />;
      case 'library':
        return <LibraryPage />;
      default:
        return <HomePage />;
    }
  };

  const navItems = [
    { label: 'Home', page: 'home' as Page, icon: Compass },
    { label: 'Radio', page: 'radio' as Page, icon: Radio },
    { label: 'TV', page: 'tv' as Page, icon: Tv },
    { label: 'Podcasts', page: 'podcasts' as Page, icon: Mic },
    { label: 'Library', page: 'library' as Page, icon: Library },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-slate-50 dark:from-slate-950 dark:to-slate-900 text-slate-900 dark:text-slate-50">
      {/* Modern Navigation Bar */}
      <nav className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                {/* Logo */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3"
                >
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
                    <Radio className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-bold text-xl bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent">
                    RadioHub
                  </span>
                </motion.div>

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center gap-1">
                  {navItems.map(({ label, page, icon: Icon }) => (
                    <motion.button
                      key={page}
                      onClick={() => {
                        setCurrentPage(page);
                        setIsMobileMenuOpen(false);
                      }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                        currentPage === page
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{label}</span>
                    </motion.button>
                  ))}
                </div>

                {/* Right Controls */}
                <div className="flex items-center gap-4">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={toggleDarkMode}
                    className="hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {isDarkMode ? (
                      <Sun className="w-5 h-5" />
                    ) : (
                      <Moon className="w-5 h-5" />
                    )}
                  </Button>

                  {/* Mobile Menu Button */}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="md:hidden hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {isMobileMenuOpen ? (
                      <X className="w-5 h-5" />
                    ) : (
                      <Menu className="w-5 h-5" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Mobile Navigation */}
              {isMobileMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="md:hidden pb-4 border-t border-slate-200 dark:border-slate-800"
                >
                  <div className="flex flex-col gap-2">
                    {navItems.map(({ label, page, icon: Icon }) => (
                      <motion.button
                        key={page}
                        onClick={() => {
                          setCurrentPage(page);
                          setIsMobileMenuOpen(false);
                        }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all w-full text-left ${
                          currentPage === page
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{label}</span>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          </nav>

          {/* Main Content */}
          <main className="relative z-0">
            {renderPage()}
          </main>

          {/* Floating Player Trigger Button */}
          <AnimatePresence>
            {hasActivePlayback && (
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                onClick={() => setShowPlayer(true)}
                className="fixed bottom-8 right-8 w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-full shadow-2xl flex items-center justify-center group transition-all hover:scale-110 z-40"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-0 rounded-full"
                >
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 via-transparent to-cyan-400 opacity-0 group-hover:opacity-50 transition-opacity" />
                </motion.div>
                <Play className="w-7 h-7 ml-1 relative z-10" />
              </motion.button>
            )}
          </AnimatePresence>

          {/* Unified Player Page */}
          <AnimatePresence>
            {showPlayer && <PlayerPage onClose={() => setShowPlayer(false)} />}
          </AnimatePresence>
        </div>
  );
}

function App() {
  return (
    <GlobalAudioManagerProvider>
      <AudioProvider>
        <PodcastPlayerProvider>
          <RadioExplorerProvider>
            <AppContent />
          </RadioExplorerProvider>
        </PodcastPlayerProvider>
      </AudioProvider>
    </GlobalAudioManagerProvider>
  );
}

export default App;
