// Scenario: kafka-lag
const SCENARIO_KAFKA_LAG =
{
    id: 'kafka-lag',
    title: '🟡 HIGH: order-processor 4h behind — Kafka lag 2.8M',
    desc: 'order-processor consumer group falling behind. Orders delayed 4h from real-time.',
    meta: 'Topic: order-events | Lag: 2,847,293 | Partitions: 24 | Replicas: 3',
    timeLimit: 100,
    hint: 'Consumers are slow. Check what they do per message — look at query patterns in logs. Then think about partition count vs replica count.',
    solution: ['scale deployment order-processor', 'replicas=24', 'kubectl scale', '--replicas=24'],
    successMsg: '✅ Scaled to 24 replicas (1 per partition). Lag: 2.8M → 1.2M → 180K. Catch-up ETA: 18 min.',
    diagnosis: '3 replicas × 24 partitions + ALLOW FILTERING on Cassandra (~5s/message) = consumers can\'t keep up. Scale replicas to match partition count.',
    points: 280,
    cluster: {
      namespaces: ['default','kube-system','prod','pipeline'],
      nodes: [
        { name:'node-pool-1', status:'Ready', age:'45d' },
        { name:'node-pool-2', status:'Ready', age:'45d' },
        { name:'node-pool-3', status:'Ready', age:'45d' },
      ],
      nodeMetrics: {
        'node-pool-1': { cpu:'5800m', cpuPct:'73%', mem:'24Gi', memPct:'75%' },
        'node-pool-2': { cpu:'6200m', cpuPct:'78%', mem:'26Gi', memPct:'81%' },
        'node-pool-3': { cpu:'4100m', cpuPct:'51%', mem:'18Gi', memPct:'56%' },
      },
      pods: [
        { name:'order-processor-7f4d-x2kp', namespace:'prod', status:'Running', ready:'1/1', restarts:0, age:'2d', node:'node-pool-1', image:'order-processor:v1.8.0' },
        { name:'order-processor-7f4d-m9nw', namespace:'prod', status:'Running', ready:'1/1', restarts:0, age:'2d', node:'node-pool-2', image:'order-processor:v1.8.0' },
        { name:'order-processor-7f4d-k2mx', namespace:'prod', status:'Running', ready:'1/1', restarts:0, age:'2d', node:'node-pool-3', image:'order-processor:v1.8.0' },
        { name:'kafka-0', namespace:'pipeline', status:'Running', ready:'1/1', restarts:0, age:'45d' },
        { name:'kafka-1', namespace:'pipeline', status:'Running', ready:'1/1', restarts:0, age:'45d' },
        { name:'kafka-2', namespace:'pipeline', status:'Running', ready:'1/1', restarts:0, age:'45d' },
      ],
      deployments: [
        { name:'order-processor', namespace:'prod', replicas:3, readyReplicas:3, image:'order-processor:v1.8.0', age:'45d',
          limits:{cpu:'1500m',memory:'2Gi'}, requests:{cpu:'500m',memory:'1Gi'} },
      ],
      configmaps: [
        { name:'order-processor-config', namespace:'prod', age:'45d',
          data:{ KAFKA_CONSUMER_THREADS:'3', CASSANDRA_QUERY_TIMEOUT:'30000',
                 ALLOW_FILTERING_ENABLED:'true', KAFKA_TOPIC:'order-events',
                 KAFKA_GROUP_ID:'order-processor-cg', KAFKA_BOOTSTRAP:'kafka.pipeline.svc:9092' }},
      ],
      logs: {
        'order-processor-7f4d-x2kp': `2026-06-03T05:00:01Z INFO  Consumer started, partitions: [0,1,2,3,4,5,6,7]
2026-06-03T05:00:02Z DEBUG Executing: SELECT * FROM order_history WHERE user_id=? ALLOW FILTERING
2026-06-03T05:00:07Z DEBUG Query execution time: 4821ms
2026-06-03T05:00:07Z WARN  Thread vertx-eventloop-thread-0 has been blocked 4823ms, time limit is 2000ms
2026-06-03T05:00:07Z DEBUG Executing: SELECT * FROM order_history WHERE user_id=? ALLOW FILTERING
2026-06-03T05:00:12Z DEBUG Query execution time: 5102ms
2026-06-03T05:00:12Z WARN  Thread vertx-eventloop-thread-1 has been blocked 5102ms, time limit is 2000ms
2026-06-03T05:00:12Z WARN  io.vertx.core.impl.BlockedThreadChecker: Thread blocked
2026-06-03T05:00:18Z DEBUG Query execution time: 4677ms
2026-06-03T05:00:18Z WARN  Thread vertx-eventloop-thread-2 has been blocked 4677ms, time limit is 2000ms`,
      },
      metrics: {
        'order-processor-7f4d-x2kp': { cpu:'1490m', mem:'1946Mi' },
        'order-processor-7f4d-m9nw': { cpu:'1495m', mem:'1946Mi' },
        'order-processor-7f4d-k2mx': { cpu:'1498m', mem:'1946Mi' },
        'kafka-0': { cpu:'890m', mem:'3Gi' },
        'kafka-1': { cpu:'920m', mem:'3Gi' },
      },
      execOutputs: {
        'order-processor-7f4d-x2kp/curl localhost:8080/metrics': `kafka_consumer_lag{partition="0"} 118638
kafka_consumer_lag{partition="1"} 117920
kafka_consumer_lag{partition="2"} 118491
kafka_consumer_group_lag_sum{group="order-processor-cg"} 2847293`,
      },
    },
  };
