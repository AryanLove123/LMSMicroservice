const { NodeSDK } = require('@opentelemetry/sdk-node');
const {OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const otelApi = require('@opentelemetry/api');

const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { MongooseInstrumentation } = require('@opentelemetry/instrumentation-mongoose');
const { AmqplibInstrumentation } = require('@opentelemetry/instrumentation-amqplib');

let sdk = null;
let sdkStarted = null;

const initTracer = (serviceName) => {
    if (sdkStarted) return;
    try {
        const jaegerHost = process.env.JAEGER_HOST || 'localhost';
        const jaegerPort = process.env.JAEGER_OTLP_PORT || '4318';

        sdk = new NodeSDK({
            // Tag every span with the service name so Jaeger shows it in the service dropdown
            resource: resourceFromAttributes({
                'service.name': serviceName
            }),

            // Ship spans to Jaeger over OTLP HTTP (Jaeger all-in-one listens on :4318)
            traceExporter: new OTLPTraceExporter({
                url: `http://${jaegerHost}:${jaegerPort}/v1/traces`,
            }),
            instrumentations: [
                new HttpInstrumentation({
                    //Ignore Health Check Spans to reduce noise in Jaeger UI. Adjust as needed for your app's health check endpoints.
                    ignoreIncomingRequestHook: (req) => req.url === '/health',
                    ignoreOutgoingRequestHook: (opts) =>
                        typeof opts.path === 'string' && opts.path === '/health',
                }),
                new ExpressInstrumentation(),
                new MongooseInstrumentation({
                    dbStatementSerializer: (operation, payload) =>
                        JSON.stringify(payload).substring(0, 200),
                }),
                new AmqplibInstrumentation({
                    publishHook: (span, { exchange, routingKey }) => {
                        span.setAttribute('messaging.rabbitmq.exchange', exchange || '');
                        span.setAttribute('messaging.rabbitmq.routing_key', routingKey || '');
                    },
                    // consumeHook receives the raw amqplib ConsumeMessage as the second argument,
                    // NOT an object with a queue property.  Use msg.fields for routing info.
                    consumeHook: (span, msg) => {
                        if (msg?.fields) {
                            span.setAttribute('messaging.rabbitmq.routing_key', msg.fields.routingKey || '');
                            span.setAttribute('messaging.rabbitmq.exchange',    msg.fields.exchange    || '');
                        }
                    },
                }),
            ],
        });
        sdk.start();
        sdkStarted = true;

        console.log(`[Tracer] OpenTelemetry started for "${serviceName}" → Jaeger at http://${jaegerHost}:${jaegerPort}`);
    } catch (error) {
        console.error('Error initializing tracer:', error);
    }
}

// Flush all pending spans and shut down the SDK.
// Called explicitly by each service during graceful shutdown.
const shutdownTracer = async () => {
    if (!sdk) return;
    try {
        await sdk.shutdown();
        console.log('[Tracer] Shutdown complete');
    } catch (err) {
        console.error('[Tracer] Shutdown error:', err.message);
    } finally {
        sdk = null;
        sdkStarted = false;
    }
};

//Add Business Level spans 
/**
 * The span is set as the active context inside fn(), so:
 *   - Any logger.info() call inside fn() will have traceId/spanId attached (via logger.js)
 *   - Any child spans (auto-instrumentation or nested withSpan) appear as children of this span in Jaeger, giving you a clear view of the business operation and its sub-operations.
 * 
 * Example  
 *   withSpan('processOrder', { orderId: 123 }, async (span) => {
 *    // Your business logic here. Any logs or auto-instrumented spans will be children of 'processOrder' in Jaeger.
 *  });
 */

const withSpan = async (tracerName, spanName, attributes, fn) => {
    const { trace, context, SpanStatusCode } = otelApi;
    const tracer = trace.getTracer(tracerName);
    const span = tracer.startSpan(spanName, { attributes });
    // context.with() ensures that the span is active during the execution of fn, so any logs or child spans will be associated with it in Jaeger. It also handles proper propagation of context across async calls.
    return context.with(trace.setSpan(context.active(), span), async () => {
        try {
            const result = await fn(span);
            span.setStatus({ code: SpanStatusCode.OK });
            return result;
        } catch (err) {
            span.recordException(err);
            span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
            throw err;
        } finally {
            span.end();
        }
    });
};


//Get the traceId and spanId from the currently active span.
const getActiveTraceIds = () => {
    const span = otelApi.trace.getActiveSpan();
    if (!span) return {};
    const spanContext = span.spanContext();
    //only attached Ids for sampled spans
    if (spanContext.traceFlags === 0) return {};
    return {
        traceId: spanContext.traceId,
        spanId: spanContext.spanId,
    };
};

//Injcet the current active trace context 
const injectTraceContext = (carrierHeaders) => {
    const { propagation, context } = otelApi;
    propagation.inject(context.active(), carrierHeaders);
}

//exctract trace context from incoming request headers
const extractTraceContext = (carrierHeaders) => {
    const { propagation, context } = otelApi;
    return propagation.extract(context.active(), carrierHeaders);
}

//Run an async function with the previous extracted context
const runWithExtractedContext = async (extractedContext, fn) => {
    const { context } = otelApi;
    return context.with(extractedContext, async () => {
        return await fn();
    });
}

module.exports = { initTracer, shutdownTracer, withSpan, injectTraceContext, extractTraceContext, getActiveTraceIds, runWithExtractedContext };