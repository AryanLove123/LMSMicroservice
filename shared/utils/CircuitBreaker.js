class CircuitBreaker {
  constructor(fn, { threshold = 5, timeout = 30_000, successThreshold = 2, logger = console } = {}) {
    this.fn               = fn;
    this.threshold        = threshold;
    this.timeout          = timeout;
    this.successThreshold = successThreshold;
    this.logger           = logger;

    this.state     = 'CLOSED';
    this.failures  = 0;
    this.successes = 0;
    this.nextRetry = Date.now();
  }

  async fire(...args) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextRetry) throw new Error('Circuit breaker OPEN — service unavailable');
      this.state = 'HALF_OPEN';
      this.logger.info?.('[CircuitBreaker] → HALF_OPEN');
    }
    try {
      const result = await this.fn(...args);
      this._success();
      return result;
    } catch (err) {
      this._failure();
      throw err;
    }
  }

  _success() {
    this.failures = 0;
    if (this.state === 'HALF_OPEN') {
      this.successes += 1;
      if (this.successes >= this.successThreshold) {
        this.state     = 'CLOSED';
        this.successes = 0;
        this.logger.info?.('[CircuitBreaker] → CLOSED');
      }
    }
  }

  _failure() {
    this.failures += 1;
    if (this.state === 'HALF_OPEN' || this.failures >= this.threshold) {
      this.state     = 'OPEN';
      this.nextRetry = Date.now() + this.timeout;
      this.successes = 0;
      this.logger.warn?.(`[CircuitBreaker] → OPEN (failures: ${this.failures})`);
    }
  }

  getState() {
    return { state: this.state, failures: this.failures };
  }
}

module.exports = CircuitBreaker;
