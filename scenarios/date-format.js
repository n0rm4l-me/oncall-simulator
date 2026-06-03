// Scenario: date-format
const SCENARIO_DATE_FORMAT =
{
    id: 'date-format',
    title: '🟡 HIGH: checkout-api 12% HTTP 400 — failed orders',
    desc: 'checkout-api returning 400 errors since 20 min ago. Failed orders reported by e-commerce team.',
    meta: 'Namespace: prod | Error rate: 12% | Path: POST /api/checkout | Impact: ~$4K/min',
    timeLimit: 100,
    hint: 'Something changed 25 min ago. Check recent rollout history for services calling checkout-api.',
    solution: ['rollout undo', 'kubectl rollout undo', 'set image.*v2.7'],
    successMsg: '✅ frontend-service rolled back to v2.7.9. Date format restored. Error rate → 0%. Orders resuming.',
    diagnosis: 'frontend-service v2.8.0 changed delivery.date serialization from full ISO to date-only (yyyy-MM-dd) — checkout-api validation rejects it',
    points: 200,
    cluster: {
      namespaces: ['default','kube-system','prod'],
      nodes: [
        { name:'node-pool-1', status:'Ready', age:'45d' },
        { name:'node-pool-2', status:'Ready', age:'45d' },
      ],
      pods: [
        { name:'checkout-api-5f7d-k2mx',    namespace:'prod', status:'Running', ready:'1/1', restarts:0, age:'45d', node:'node-pool-1', image:'checkout-api:v3.1.2' },
        { name:'checkout-api-5f7d-p9nw',    namespace:'prod', status:'Running', ready:'1/1', restarts:0, age:'45d', node:'node-pool-2', image:'checkout-api:v3.1.2' },
        { name:'frontend-service-8b4c-x2kp',namespace:'prod', status:'Running', ready:'1/1', restarts:0, age:'25m', node:'node-pool-1', image:'frontend-service:v2.8.1' },
        { name:'frontend-service-8b4c-m9nw',namespace:'prod', status:'Running', ready:'1/1', restarts:0, age:'25m', node:'node-pool-2', image:'frontend-service:v2.8.1' },
        { name:'mobile-gateway-9c3d-k2mx',  namespace:'prod', status:'Running', ready:'1/1', restarts:0, age:'45d', node:'node-pool-1', image:'mobile-gateway:v1.4.3' },
      ],
      deployments: [
        { name:'checkout-api',    namespace:'prod', replicas:2, readyReplicas:2, image:'checkout-api:v3.1.2', age:'45d',
          history:[{revision:1,'change-cause':'v3.1.2 stable'}] },
        { name:'frontend-service',namespace:'prod', replicas:2, readyReplicas:2, image:'frontend-service:v2.8.1', age:'45d',
          history:[
            {revision:1,'change-cause':'v2.7.9 stable release',image:'frontend-service:v2.7.9'},
            {revision:2,'change-cause':'v2.8.0 new checkout flow — date format refactor',image:'frontend-service:v2.8.0'},
            {revision:3,'change-cause':'v2.8.1 fix payment icons',image:'frontend-service:v2.8.1'},
          ]},
        { name:'mobile-gateway',  namespace:'prod', replicas:1, readyReplicas:1, image:'mobile-gateway:v1.4.3',  age:'45d',
          history:[{revision:1,'change-cause':'v1.4.3 minor fix'}]},
      ],
      logs: {
        'checkout-api-5f7d-k2mx': `2026-06-03T05:50:36Z INFO  [REQUEST]  POST /api/checkout from frontend-service
2026-06-03T05:50:36Z ERROR [RESPONSE] status=400 path=/api/checkout
  field: delivery.date
  error: "Invalid date format. Expected: yyyy-MM-dd'T'HH:mm:ss.SSSZ, got: 2026-06-03"
  traceId: aaedff59-dc41-45b7-9be1-93c2f6a74d67
2026-06-03T05:50:36Z INFO  [REQUEST]  POST /api/checkout from mobile-gateway
2026-06-03T05:50:36Z INFO  [RESPONSE] status=200 path=/api/checkout
2026-06-03T05:50:37Z INFO  [REQUEST]  POST /api/checkout from frontend-service
2026-06-03T05:50:37Z ERROR [RESPONSE] status=400 field=delivery.date got="2026-06-03"
2026-06-03T05:50:37Z INFO  [REQUEST]  POST /api/checkout from mobile-gateway
2026-06-03T05:50:37Z INFO  [RESPONSE] status=200
2026-06-03T05:52:11Z ERROR [RESPONSE] status=400 field=delivery.date
  error: "The given value must match the date time format yyyy-MM-dd'T'HH:mm:ss.SSSZ"`,
        'frontend-service-8b4c-x2kp': `2026-06-03T05:49:01Z INFO  frontend-service v2.8.1 started
2026-06-03T05:50:36Z DEBUG Sending POST /api/checkout delivery.date="2026-06-03"
2026-06-03T05:50:36Z WARN  checkout-api returned 400 Bad Request
2026-06-03T05:50:37Z DEBUG Sending POST /api/checkout delivery.date="2026-06-03"
2026-06-03T05:50:37Z WARN  checkout-api returned 400 Bad Request`,
      },
      metrics: {
        'checkout-api-5f7d-k2mx':    { cpu:'320m', mem:'512Mi' },
        'checkout-api-5f7d-p9nw':    { cpu:'290m', mem:'498Mi' },
        'frontend-service-8b4c-x2kp':{ cpu:'180m', mem:'256Mi' },
      },
      events: [
        { namespace:'prod', type:'Normal', reason:'Pulled', object:'frontend-service-8b4c-x2kp', lastSeen:'25m', message:'Successfully pulled image frontend-service:v2.8.1' },
        { namespace:'prod', type:'Normal', reason:'Started', object:'frontend-service-8b4c-x2kp', lastSeen:'25m', message:'Started container frontend-service' },
      ],
    },
  };
