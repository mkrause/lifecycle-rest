
import merge from './util/merge.js';

import axios, { AxiosRequestConfig, AxiosInstance } from 'axios';


const optionsDefaults : AxiosRequestConfig = {
    baseURL: undefined,
    
    headers: {
        //'User-Agent': undefined,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        //'Authorization': '...',
    },
    
    validateStatus(status) {
      return status >= 200 && status < 300;
    },
    
    // Whether to send browser cookies along with the request
    withCredentials: false,
};

export default (options : AxiosRequestConfig = {}) : AxiosInstance =>
    axios.create(merge(optionsDefaults, options) as AxiosRequestConfig);
