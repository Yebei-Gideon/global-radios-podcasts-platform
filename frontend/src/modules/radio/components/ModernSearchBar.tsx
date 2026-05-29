import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { Input } from '@/modules/shared/components/ui';

interface ModernSearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

/**
 * Modern Search Bar with animations
 */
export const ModernSearchBar: React.FC<ModernSearchBarProps> = ({
  onSearch,
  placeholder = 'Search radio stations, podcasts...',
}) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleClear = () => {
    setQuery('');
    onSearch('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full"
    >
      <div className="relative">
        <motion.div
          animate={{
            boxShadow: isFocused
              ? '0 0 0 3px rgba(6, 182, 212, 0.1)'
              : '0 0 0 0px rgba(6, 182, 212, 0)',
          }}
          className="relative rounded-lg transition-all"
        >
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            className="pl-12 pr-10 py-3 text-base rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
          />

          <button
            type="submit"
            className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            aria-label="Search"
          >
            <Search className="w-4 h-4" />
            Search
          </button>

          {query && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              type="button"
              onClick={handleClear}
              className="absolute right-24 top-1/2 transform -translate-y-1/2"
              aria-label="Clear search"
            >
              <X className="w-5 h-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" />
            </motion.button>
          )}
        </motion.div>

        {/* Suggestions Dropdown */}
        {isFocused && query && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full mt-2 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10 p-2"
          >
            <div className="text-xs text-slate-500 px-3 py-2">
              Click Search or press Enter to search
            </div>
          </motion.div>
        )}
      </div>
    </motion.form>
  );
};
