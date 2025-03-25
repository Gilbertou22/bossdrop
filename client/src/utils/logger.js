import axios from 'axios';

const BASE_URL = 'http://localhost:5000';

const logToBackend = async (level, message, metadata = {}) => {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.warn('No token found, logging as anonymous');
            metadata.userId = 'anonymous';
        }
        const response = await axios.post(
            `${BASE_URL}/api/logs`,
            {
                level,
                message,
                metadata: {
                    ...metadata,
                    timestamp: new Date().toISOString(),
                    userAgent: navigator.userAgent,
                },
            },
            {
                headers: { 'x-auth-token': token || '' },
            }
        );
        console.log('Log sent to backend:', response.data);
    } catch (err) {
        console.error('Failed to log to backend:', err.message);
    }
};

const logger = {
    info: (message, metadata = {}) => {
        //console.log(`[INFO] ${message}`, metadata);
        logToBackend('info', message, metadata);
    },
    error: (message, metadata = {}) => {
        //console.error(`[ERROR] ${message}`, metadata);
        logToBackend('error', message, metadata);
    },
    warn: (message, metadata = {}) => {
        //console.warn(`[WARN] ${message}`, metadata);
        logToBackend('warn', message, metadata);
    },
    log: (message, metadata = {}) => {
        //console.warn('[DEPRECATION WARNING] logger.log is deprecated, use logger.info instead');
        logger.info(message, metadata);
    },
    debug: (message, metadata = {}) => {
        //console.debug(`[DEBUG] ${message}`, metadata);
        logToBackend('debug', message, metadata);
    },
};

export default logger;