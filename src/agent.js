
import merge from './util/merge.js';

import axios from 'axios';


const optionsDefaults = {
    baseUrl: undefined,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        //'Authorization': '...',
    },
    
    // Whether to send browser cookies along with the request
    withCredentials: false,
};

export default (options = {}) =>
    axios.create(merge(optionsDefaults, options));
