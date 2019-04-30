'use strict';

import React from 'react';
import ReactDOM from 'react-dom';

import App from './components/App';
import registerServiceWorker from './registerServiceWorker.js';

import './styles/normalize.css';
import './styles/main.css';

ReactDOM.render(<App />, document.getElementById('root'));
registerServiceWorker();