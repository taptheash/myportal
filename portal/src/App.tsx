import { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';
import Weather from './components/widgets/Weather';
import Calendar from './components/widgets/Calendar';
import Notes from './components/widgets/Notes';
import QuickLinks from './components/widgets/QuickLinks';
import Sports from './components/widgets/Sports';
import NewsWidget from './components/widgets/NewsWidget';

const QUOTES = [
  'The only way to do great work is to love what you do.',
  'Innovation distinguishes between a leader and a follower.',
  'Life is what happens when you\'re busy making other plans.',
  'The future belongs to those who believe in the beauty of their dreams.',
  'It is during our darkest moments that we must focus to see the light.',
  'The way to get started is to quit talking and begin doing.',
  'Don\'t let yesterday take up too much of today.',
  'You learn more from failure than from success.',
  'It\'s not whether you get knocked down, it\'s whether you get up.',
  'Believe you can and you\'re halfway there.',
  'The best time to plant a tree was 20 years ago. The second best time is now.',
  'Success is not final, failure is not fatal.',
  'You are never too old to set another goal or dream a new dream.',
  'What lies behind us and what lies before us are tiny matters.',
  'The only impossible journey is the one you never begin.',
  'You can\'t use up creativity. The more you use, the more you have.',
  'A successful person is one who can lay a firm foundation with the bricks others have thrown at him.',
  'Do what you feel in your heart to be right.',
  'The greatest glory in living lies not in never falling, but in rising every time we fall.',
  'Your time is limited, don\'t waste it living someone else\'s life.',
  'The way to get started is to quit talking and begin doing.',
  'Don\'t let today\'s disappointments cast a shadow on tomorrow\'s dreams.',
  'Whether you think you can, or you think you can\'t – you\'re right.',
  'The man who moves a mountain begins by carrying away small stones.',
  'The journey of a thousand miles begins with a single step.',
  'Good things take time.',
  'Progress is more important than perfection.',
  'Your limitation—it\'s only your imagination.',
  'Do something today that your future self will thank you for.',
  'Little things make big days.',
  'It\'s going to be hard, but hard does not mean impossible.',
  'Don\'t stop when you\'re tired. Stop when you\'re done.',
  'Wake up with determination. Go to bed with satisfaction.',
  'Do it now. Sometimes "later" becomes never.',
  'Great things never came from comfort zones.',
  'Dream it. Wish it. Do it.',
  'Success doesn\'t just find you. You have to go out and get it.',
  'The harder you work for something, the greater you\'ll feel when you achieve it.',
  'Dream bigger. Do bigger.',
  'Don\'t wait for opportunity. Create it.',
  'Sometimes we\'re tested not to show our weaknesses, but to discover our strengths.',
  'The key to success is to focus on goals, not obstacles.',
  'Dream it. Believe it. Build it.',
  'Do something great.',
  'Greatness is the result of small, consistent actions.'
];

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode !== null) {
      setDarkMode(JSON.parse(savedDarkMode));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    const timer = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % QUOTES.length);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex-1 text-center">
              <p className="text-sm font-light italic opacity-90">{QUOTES[quoteIndex]}</p>
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="ml-4 p-2 rounded-lg bg-white bg-opacity-20 hover:bg-opacity-30 transition"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>

        {/* Main Grid */}
        <main className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-12 gap-4 items-start">
            {/* Weather - Col 1 */}
            <div className="col-span-3 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h2 className="font-semibold text-lg mb-4 text-gray-900 dark:text-gray-100">Weather</h2>
              <Weather />
            </div>

            {/* Calendar - Col 2 */}
            <div className="col-span-3 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h2 className="font-semibold text-lg mb-4 text-gray-900 dark:text-gray-100">Calendar</h2>
              <Calendar />
            </div>

            {/* Notes - Col 3 */}
            <div className="col-span-3 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h2 className="font-semibold text-lg mb-4 text-gray-900 dark:text-gray-100">Notes</h2>
              <Notes />
            </div>

            {/* Quick Links - Col 4 */}
            <div className="col-span-3 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h2 className="font-semibold text-lg mb-4 text-gray-900 dark:text-gray-100">Quick Links</h2>
              <QuickLinks />
            </div>

            {/* Sports - Col 5 */}
            <div className="col-span-3 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h2 className="font-semibold text-lg mb-4 text-gray-900 dark:text-gray-100">NE Sports Scores</h2>
              <Sports />
            </div>

            {/* NE Sports News - Col 6 */}
            <div className="col-span-3 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h2 className="font-semibold text-lg mb-4 text-gray-900 dark:text-gray-100">NE Sports News</h2>
              <NewsWidget
                feedUrl="https://www.boston.com/feed"
                defaultArticleCount={3}
              />
            </div>

            {/* Top Headlines - Col 7 */}
            <div className="col-span-3 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h2 className="font-semibold text-lg mb-4 text-gray-900 dark:text-gray-100">Top Headlines</h2>
              <NewsWidget
                feedUrl="https://feeds.nytimes.com/services/xml/rss/nyt/homepage.xml"
                defaultArticleCount={5}
              />
            </div>

            {/* Tech & AI - Col 8 */}
            <div className="col-span-3 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h2 className="font-semibold text-lg mb-4 text-gray-900 dark:text-gray-100">Tech & AI</h2>
              <NewsWidget
                feedUrl="https://techcrunch.com/feed/"
                defaultArticleCount={4}
              />
            </div>

            {/* NH Local - Col 9 */}
            <div className="col-span-3 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h2 className="font-semibold text-lg mb-4 text-gray-900 dark:text-gray-100">NH Local</h2>
              <NewsWidget
                feedUrl="https://www.unionleader.com/feed/"
                defaultArticleCount={4}
              />
            </div>

            {/* Other News - Col 10 */}
            <div className="col-span-3 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h2 className="font-semibold text-lg mb-4 text-gray-900 dark:text-gray-100">Other News</h2>
              <NewsWidget
                feedUrl="https://www.upi.com/api/rss/news/Odd.xml"
                defaultArticleCount={4}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
