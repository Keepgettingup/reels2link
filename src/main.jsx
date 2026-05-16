import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import UpgradeSuccess from './pages/UpgradeSuccess.jsx';
import App from './App.jsx';
import Tos from './pages/Tos.jsx';
import Privacy from './pages/Privacy.jsx';
import Imprint from './pages/Imprint.jsx';
import About from './pages/About.jsx';
import VideoViewer from './pages/VideoViewer.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/app" element={<App />} />
        <Route path="/tos" element={<Tos />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/imprint" element={<Imprint />} />
        <Route path="/about" element={<About />} />
        <Route path="/upgrade/success" element={<UpgradeSuccess />} />
        <Route path="/v/:id" element={<VideoViewer />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
