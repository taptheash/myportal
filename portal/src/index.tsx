import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import TrackPage from './components/flights/TrackPage';
import reportWebVitals from './reportWebVitals';
import { cleanUpOldCaches } from './lib/storageCleanup';

cleanUpOldCaches();

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
// /?track=DL1234 is a single flight in its own tab (see TrackPage).
const trackQuery = new URLSearchParams(window.location.search).get('track');

root.render(
  <React.StrictMode>
    {trackQuery ? <TrackPage query={trackQuery} /> : <App />}
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
