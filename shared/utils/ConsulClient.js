const axios = require('axios');

class ConsulClient {
    constructor(logger) {
        this.host = process.env.CONSUL_HOST || 'localhost';
        this.port = process.env.CONSUL_PORT || '8500';
        this.baseUrl = `http://${this.host}:${this.port}/v1`;
        this.logger = logger;
    }

    async register(serviceName, servicePort, serviceId = null) {
        const instanceSuffix = process.env.INSTANCE_ID || process.env.HOSTNAME || 'local';
        const id = serviceId || `${serviceName}-${instanceSuffix}`;
        const address = process.env.HOSTNAME || serviceName;
        const payload = {
            ID: id,
            Name: serviceName,
            Address: address,   // Docker container name = hostname
            Port: parseInt(servicePort),
            Tags: ['microservice', 'lms'],
            Check: {
                HTTP: `http://${address}:${servicePort}/health`,
                Interval: '15s',
                Timeout: '5s',
                DeregisterCriticalServiceAfter: '2m',
            },
        };

        try {
            await axios.put(`${this.baseUrl}/agent/service/register`, payload);
            this.logger.info(`[Consul] Registered ${serviceName} with ID ${id}`);
            return id;
        } catch (err) {
            this.logger.error(`[Consul] Registration failed for ${serviceName}`, { 
                error: err.message 
            });
            throw err;
        }
    }

    async deregister(serviceId) {
        try {
            await axios.put(`${this.baseUrl}/agent/service/deregister/${serviceId}`);
            this.logger.info(`[Consul] Deregistered service ${serviceId}`);
        } catch (err) {
            this.logger.error(`[Consul] Deregistration failed`, { error: err.message });
        }
    }

    async discover(serviceName) {
        try {
            const res = await axios.get(
                `${this.baseUrl}/health/service/${serviceName}?passing=true`
            );
            const instances = res.data;
            if (!instances || instances.length === 0) {
                throw new Error(`No healthy instances of ${serviceName} found`);
            }
            // Pick first healthy instance (can add load balancing here later)
            const instance = instances[0].Service;
            return `http://${instance.Address}:${instance.Port}`;
        } catch (err) {
            this.logger.error(`[Consul] Discovery failed for ${serviceName}`, { 
                error: err.message 
            });
            throw err;
        }
    }
}

module.exports = ConsulClient;