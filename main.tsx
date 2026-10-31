import React from 'react';
import ReactDOM from 'react-dom/client';
import QuizScreen from './QuizScreen';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <QuizScreen />
  </React.StrictMode>
);