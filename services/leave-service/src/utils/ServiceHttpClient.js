const axios = require('axios');
const AppError = require('../../../../shared/utils/AppError');
const CircuitBreaker = require('../../../../shared/utils/CircuitBreaker');

class ServiceHttpClient {
    constructor(baseURL, serviceName, logger) {
        this.client = axios.create({ baseURL, timeout: 5000 });
        this.logger = logger;
        this.serviceName = serviceName;
        this.cb = new CircuitBreaker((config) => this.client.request(config), {
            threshold: 5,
            timeout: 30_000,    
            logger,
        });    
    }

    async get(path, token) {
    return this._call({ method: 'GET', url: path }, token);
  }

  async post(path, data, token) {
    return this._call({ method: 'POST', url: path, data }, token);
  }

  async _call(cfg, token) {
    try {
      const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      const res = await this.cb.fire({ ...cfg, headers });
      return res.data;
    } catch (err) {
      if (err.message.includes('Circuit breaker OPEN')) {
        throw AppError.serviceUnavailable(`${this.serviceName} is unavailable (circuit open)`);
      }
      if (err.response) {
        const { status, data } = err.response;
        throw new AppError(data?.message || 'Upstream service error', status, 'UPSTREAM_ERROR');
      }
      this.logger.error(`[ServiceHttpClient] ${this.serviceName} call failed`, { error: err.message });
      throw AppError.serviceUnavailable(`Failed to reach ${this.serviceName}`);
    }
  }
}

module.exports = ServiceHttpClient;