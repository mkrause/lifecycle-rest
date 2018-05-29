
import merge from './util/merge.js';

import axios from 'axios';


const optionsDefaults = {
    baseURL: undefined,
    
    headers: {
        'User-Agent': undefined,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        //'Authorization': '...',
    },
    
    // Whether to send browser cookies along with the request
    withCredentials: false,
};

export default (options = {}) =>
    axios.create(merge(optionsDefaults, options));
