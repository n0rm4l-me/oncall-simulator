// Scenario: oom-batch
const SCENARIO_OOM_BATCH =
{
    id: 'oom-batch',
    title: '🔴 CRITICAL: batch-processor OOMKilled — pipeline 2h behind SLA',
    desc: 'batch-processor pods keep getting OOMKilled. Daily export stalled. Deadline in 30 min.',
    meta: 'Namespace: pipeline | OOMKilled: 3/3 | Memory limit: 2Gi | Restarts: 12',
    timeLimit: 90,
    hint: 'Check what the batch job loads into memory. Look at BATCH_SIZE and CASSANDRA_FETCH_SIZE in configmap.',
    solution: ['BATCH_SIZE=10000', 'batch_size', 'kubectl set env', 'kubectl edit configmap batch-config', 'kubectl patch configmap'],
    successMsg: '✅ BATCH_SIZE=10000 applied. Streaming mode active — 10K records per chunk. Memory stable at 780Mi. Pipeline resuming.',
    diagnosis: 'BATCH_SIZE=0 means full Cassandra table load into memory (48M records = 1.9GB) → exceeds 2Gi pod limit → OOMKilled on every attempt',
    points: 250,
    cluster: {
      namespaces: ['default','kube-system','pipeline','monitoring'],
      nodes: [
        { name:'node-pool-1', status:'Ready', age:'45d' },
        { name:'node-pool-2', status:'Ready', age:'45d' },
      ],
      nodeMetrics: {
        'node-pool-1': { cpu:'3200m', cpuPct:'40%', mem:'22Gi', memPct:'69%' },
        'node-pool-2': { cpu:'2800m', cpuPct:'35%', mem:'20Gi', memPct:'63%' },
      },
      pods: [
        { name:'batch-processor-6d8f-x2kp', namespace:'pipeline', status:'OOMKilled', ready:'0/1', restarts:12, age:'2h',
          node:'node-pool-1', image:'batch-processor:v1.2.0',
          conditions:[{type:'Ready',status:'False'}],
          containers:[{name:'batch-processor',image:'batch-processor:v1.2.0',ready:false,restarts:12,
            limits:{memory:'2Gi',cpu:'500m'}, requests:{memory:'512Mi',cpu:'100m'},
            lastState:{reason:'OOMKilled',exitCode:137,startedAt:'5m ago',finishedAt:'3m ago'}}]},
        { name:'batch-processor-6d8f-n9mw', namespace:'pipeline', status:'OOMKilled', ready:'0/1', restarts:11, age:'2h', node:'node-pool-2', image:'batch-processor:v1.2.0' },
        { name:'spark-worker-0', namespace:'pipeline', status:'Running', ready:'1/1', restarts:0, age:'45d', node:'node-pool-1' },
        { name:'spark-worker-1', namespace:'pipeline', status:'Running', ready:'1/1', restarts:0, age:'45d', node:'node-pool-2' },
      ],
      deployments: [
        { name:'batch-processor', namespace:'pipeline', replicas:2, readyReplicas:0, image:'batch-processor:v1.2.0', age:'45d',
          limits:{memory:'2Gi',cpu:'500m'}, requests:{memory:'512Mi',cpu:'100m'} },
      ],
      jobs: [
        { name:'daily-export-job', namespace:'pipeline', succeeded:0, total:1, duration:'2h15m', age:'2h15m' },
      ],
      configmaps: [
        { name:'batch-config', namespace:'pipeline', age:'45d',
          data:{ BATCH_SIZE:'0', CASSANDRA_FETCH_SIZE:'0', EXPORT_MODE:'full_load',
                 MAX_HEAP_SIZE:'1g', CASSANDRA_HOST:'cassandra.pipeline.svc' }},
      ],
      events: [
        { namespace:'pipeline', type:'Warning', reason:'OOMKilling', object:'batch-processor-6d8f-x2kp', lastSeen:'3m',
          message:'Out of memory: Kill process (java) total-vm:3145728kB, anon-rss:2097152kB' },
        { namespace:'pipeline', type:'Warning', reason:'BackOff', object:'batch-processor-6d8f-n9mw', lastSeen:'2m',
          message:'Back-off restarting failed container' },
      ],
      logs: {
        'batch-processor-6d8f-x2kp': `2026-06-03T04:00:01Z INFO  Starting batch export job: daily-user-history
2026-06-03T04:00:02Z INFO  Connecting to Cassandra cluster...
2026-06-03T04:00:03Z INFO  Loading full user history table into memory...
2026-06-03T04:00:45Z INFO  Loaded 48,291,033 records (1.9 GB)
2026-06-03T04:00:46Z INFO  Starting aggregation...
2026-06-03T04:00:47Z WARN  GC overhead limit exceeded
Killed`,
        'batch-processor-6d8f-x2kp:previous': `2026-06-03T03:45:01Z INFO  Loading full user history table into memory...
2026-06-03T03:45:43Z INFO  Loaded 48,291,033 records (1.9 GB)
2026-06-03T03:45:44Z WARN  GC overhead limit exceeded
Killed`,
      },
      metrics: {
        'batch-processor-6d8f-x2kp': { cpu:'0m',    mem:'0Mi'   },
        'batch-processor-6d8f-n9mw': { cpu:'0m',    mem:'0Mi'   },
        'spark-worker-0':             { cpu:'890m',  mem:'1836Mi' },
        'spark-worker-1':             { cpu:'1100m', mem:'1946Mi' },
      },
    },
  };
