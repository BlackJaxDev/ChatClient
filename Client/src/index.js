'use strict';

import React from 'react';
import ReactDOM from 'react-dom';
import App from './components/App';
import * as serviceWorker from './logic/serviceWorker';

ReactDOM.render(<App />, document.getElementById('content'));
serviceWorker.unregister();