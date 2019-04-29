'use strict';

import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter as Router, Route } from 'react-router-dom';
import App from './components/App';
import { Security, ImplicitCallback } from '@okta/okta-react';
import { Provider } from 'react-redux'
import configureStore from './redux/configureStore'

const store = configureStore()

const config = 
{
  issuer: 'https://dev-251601.okta.com/oauth2/default',
  client_id: '0oailc90npXCeIkmI356',
  redirect_uri: window.location.origin + '/implicit/callback'
}

require('./styles/normalize.css');
require('./styles/main.css');

ReactDOM.render(
(
    <Router> 
        <Provider store={store}>
            <Security 
                issuer={config.issuer}
                client_id={config.client_id}
                redirect_uri={config.redirect_uri}>
                <Route path="/" component={App} />
                <Route path='/implicit/callback' component={ImplicitCallback}/>
            </Security>
        </Provider>
    </Router>
), 
document.getElementById('content'));