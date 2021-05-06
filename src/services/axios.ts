import axios from 'axios';
import config from '../config/config';

const instance = axios.create({
  baseURL: config.API_SERVER,
  timeout: 1000,
});

export default instance;
