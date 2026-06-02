const axios = require('axios');
const AppError = require('../../../../shared/utils/AppError');
const CircuitBreaker = require('../../../../shared/utils/CircuitBreaker');
const ConsulClient = require('../../../../shared/utils/ConsulClient');
class ServiceHttpClient {
  constructor(baseURL, serviceName, logger) {
    // this.client = axios.create({ baseURL, timeout: 5000 });
    this.logger = logger;
    this.serviceName = serviceName;
    this.staticBaseURL = baseURL || null;
    this.consul = new ConsulClient(logger);

    this.cb = new CircuitBreaker((config) => axios.request(config), {
      threshold: 5,
      timeout: 30_000,
      logger,
    });
  }

  async _resolveBaseURL() {
    // If running locally with hardcoded URL, use it directly
    if (this.staticBaseURL) return this.staticBaseURL;

    // Otherwise discover via Consul
    try {
      return await this.consul.discover(this.serviceName);
    } catch (err) {
      this.logger.warn(
        `[ServiceHttpClient] Consul discovery failed for ${this.serviceName}, ` +
        `falling back to Docker DNS`,
        { error: err.message }
      );
      // Fallback to Docker DNS if Consul unavailable
      return `http://${this.serviceName}`;
    }
  }

  async get(path, token) {
    const baseURL = await this._resolveBaseURL();
    return this._call({ method: 'GET', url: `${baseURL}${path}` }, { userToken: token });
  }

  async post(path, data, token) {
    const baseURL = await this._resolveBaseURL();
    return this._call({ method: 'POST', url: `${baseURL}${path}`, data }, { userToken: token });
  }

  async internalGet(path) {
    const baseURL = await this._resolveBaseURL();
    return this._call({ method: 'GET', url: `${baseURL}${path}` }, { isInternal: true });
  }

  async internalPost(path, data) {
    const baseURL = await this._resolveBaseURL();
    return this._call({ method: 'POST', url: `${baseURL}${path}`, data }, { isInternal: true });
  }

  async _call(cfg, { userToken, isInternal } = {}) {
    try {
      const headers = this._buildHeaders(userToken, isInternal);
      const res = await this.cb.fire({ ...cfg, headers });
      return res.data;
    } catch (err) {
      if (err.message.includes('Circuit breaker OPEN')) {
        throw AppError.serviceUnavailable(
          `${this.serviceName} is unavailable (circuit open)`,
        );
      }
      if (err.response) {
        const { status, data } = err.response;
        throw new AppError(
          data?.message || 'Upstream service error',
          status,
          'UPSTREAM_ERROR',
        );
      }
      this.logger.error(
        `[ServiceHttpClient] ${this.serviceName} call failed`,
        { error: err.message },
      );
      throw AppError.serviceUnavailable(`Failed to reach ${this.serviceName}`);
    }
  }

  _buildHeaders(userToken, isInternal) {
    if (isInternal) {
      const secret = process.env.INTERNAL_SERVICE_SECRET;
      if (!secret) {
        throw new Error('INTERNAL_SERVICE_SECRET is not set in environment');
      }
      return {
        'x-service-token': secret,
        'x-service-name': process.env.SERVICE_NAME || 'unknown-service',
      };
    }

    return userToken ? { Authorization: `Bearer ${userToken}` } : {};
  }
}

module.exports = ServiceHttpClient;