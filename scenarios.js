// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT_SCENARIOS — each incident defines a full cluster state
//
// Scenario schema:
// {
//   id, title, desc, meta, timeLimit, hint, solution, successMsg, diagnosis, points,
//   cluster: {
//     namespaces, nodes, pods, deployments, daemonsets, statefulsets,
//     services, configmaps, secrets, pvcs, events, hpas, jobs,
//     logs:        { "<pod-name>": "log text" }
//     metrics:     { "<pod-name>": { cpu, mem } }
//     nodeMetrics: { "<node-name>": { cpu, cpuPct, mem, memPct } }
//     execOutputs: { "<pod-name>/<cmd-keyword>": "output" }
//     gcloud:      { logging: { "<filter>": "output" }, compute: { ssh: {} } }
//   }
// }
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_SCENARIOS = [

  // ── 1. etcd WAL disk full ──────────────────────────────────────────────
  {
    id: 'etcd-wal',
    title: '🔴 CRITICAL: payment-service CrashLoopBackOff',
    desc: 'payment-service (3 pods) crashing on startup. 47 restarts. Payments are DOWN.',
    meta: 'Namespace: prod | Restarts: 47 | Revenue impact: active',
    timeLimit: 120,
    hint: 'Check pod logs — it fails to connect to etcd. Then check etcd pod health and disk usage.',
    solution: ['etcdctl defrag', 'kubectl delete pod etcd-node-3'],
    successMsg: '✅ etcd defrag complete. WAL reduced 9.8G → 1.1G. etcd-node-3 rejoined cluster. payment-service pods recovering...',
    diagnosis: 'etcd WAL disk 98% full → fsync timeout → leader re-election → all etcd clients get io exception',
    points: 300,
    cluster: {
      namespaces: ['default','kube-system','prod','monitoring'],
      nodes: [
        { name:'node-pool-1', status:'Ready', roles:'<none>', age:'45d', version:'v1.28.4' },
        { name:'node-pool-2', status:'Ready', roles:'<none>', age:'45d', version:'v1.28.4' },
        { name:'node-pool-3', status:'Ready', roles:'<none>', age:'45d', version:'v1.28.4' },
      ],
      nodeMetrics: {
        'node-pool-1': { cpu:'1200m', cpuPct:'15%', mem:'8Gi',  memPct:'25%' },
        'node-pool-2': { cpu:'2100m', cpuPct:'26%', mem:'12Gi', memPct:'38%' },
        'node-pool-3': { cpu:'800m',  cpuPct:'10%', mem:'6Gi',  memPct:'19%' },
      },
      pods: [
        { name:'payment-service-7d9f4b-xk2p', namespace:'prod', status:'CrashLoopBackOff', ready:'0/1', restarts:47, age:'2h',
          node:'node-pool-1', image:'payment-service:v2.4.1',
          conditions:[{type:'Ready',status:'False',reason:'ContainersNotReady'}],
          containers:[{name:'payment-service',image:'payment-service:v2.4.1',ready:false,restarts:47,
            lastState:{reason:'Error',exitCode:1,startedAt:'3m ago',finishedAt:'2m ago'}}]},
        { name:'payment-service-7d9f4b-m8nq', namespace:'prod', status:'CrashLoopBackOff', ready:'0/1', restarts:45, age:'2h', node:'node-pool-2', image:'payment-service:v2.4.1' },
        { name:'payment-service-7d9f4b-r3wv', namespace:'prod', status:'CrashLoopBackOff', ready:'0/1', restarts:46, age:'2h', node:'node-pool-3', image:'payment-service:v2.4.1' },
        { name:'etcd-node-1', namespace:'kube-system', status:'Running',  ready:'1/1', restarts:0, age:'45d', node:'node-pool-1' },
        { name:'etcd-node-2', namespace:'kube-system', status:'Running',  ready:'1/1', restarts:0, age:'45d', node:'node-pool-2' },
        { name:'etcd-node-3', namespace:'kube-system', status:'Error',    ready:'0/1', restarts:8, age:'3m',  node:'node-pool-3',
          message:'wal: fsync took too long',
          conditions:[{type:'Ready',status:'False',reason:'KubeletNotReady',message:'wal: fsync took too long'}],
          containers:[{name:'etcd',image:'etcd:3.5.9',ready:false,restarts:8,
            lastState:{reason:'Error',exitCode:2,startedAt:'4m ago',finishedAt:'3m ago'}}]},
        { name:'kube-apiserver-node-1', namespace:'kube-system', status:'Running', ready:'1/1', restarts:0, age:'45d' },
        { name:'coredns-6d8f9b9c4-x2kp',  namespace:'kube-system', status:'Running', ready:'1/1', restarts:0, age:'45d' },
      ],
      deployments: [
        { name:'payment-service', namespace:'prod', replicas:3, readyReplicas:0, image:'payment-service:v2.4.1', age:'45d',
          history:[
            {revision:1,'change-cause':'v2.3.0 stable release'},
            {revision:2,'change-cause':'v2.4.0 new checkout flow'},
            {revision:3,'change-cause':'v2.4.1 fix payment icons',image:'payment-service:v2.4.1'},
          ]},
      ],
      events: [
        { namespace:'prod', type:'Warning', reason:'BackOff',       object:'payment-service-7d9f4b-xk2p', lastSeen:'2m', message:'Back-off restarting failed container' },
        { namespace:'prod', type:'Warning', reason:'BackOff',       object:'payment-service-7d9f4b-m8nq', lastSeen:'2m', message:'Back-off restarting failed container' },
        { namespace:'kube-system', type:'Warning', reason:'BackOff',object:'etcd-node-3', lastSeen:'3m', message:'Back-off restarting failed container' },
        { namespace:'kube-system', type:'Warning', reason:'Unhealthy',object:'etcd-node-3', lastSeen:'2m', message:'Liveness probe failed: connection refused' },
      ],
      logs: {
        'payment-service-7d9f4b-xk2p': `2026-06-03T03:14:22Z INFO  Starting payment-service v2.4.1
2026-06-03T03:14:22Z INFO  Connecting to etcd cluster at etcd:2379...
2026-06-03T03:14:23Z ERROR io.etcd.jetcd.common.exception.EtcdException: io exception
2026-06-03T03:14:23Z ERROR   at io.etcd.jetcd.ClientBuilder.connect(ClientBuilder.java:142)
2026-06-03T03:14:23Z ERROR   at com.payment.EtcdConfig.init(EtcdConfig.java:38)
2026-06-03T03:14:23Z FATAL Failed to initialize etcd client. Shutting down.`,
        'payment-service-7d9f4b-m8nq': `2026-06-03T03:14:31Z INFO  Starting payment-service v2.4.1
2026-06-03T03:14:32Z ERROR io.etcd.jetcd.common.exception.EtcdException: io exception
2026-06-03T03:14:32Z FATAL Failed to initialize etcd client. Shutting down.`,
        'etcd-node-3': `{"level":"info","msg":"starting etcd","version":"3.5.9"}
{"level":"warn","msg":"failed to commit proposal","took":"3.2s","err":"leader changed"}
{"level":"warn","msg":"failed to commit proposal","took":"5.1s"}
{"level":"error","msg":"WAL sync duration too long","took":"12.4s","expected":"1s"}
{"level":"panic","msg":"wal: fsync took too long","took":"12.4s"}
{"level":"warn","msg":"etcd member might have overloaded disk"}`,
      },
      metrics: {
        'payment-service-7d9f4b-xk2p': { cpu:'0m',   mem:'0Mi' },
        'payment-service-7d9f4b-m8nq': { cpu:'0m',   mem:'0Mi' },
        'etcd-node-1': { cpu:'120m',  mem:'512Mi' },
        'etcd-node-2': { cpu:'115m',  mem:'498Mi' },
        'etcd-node-3': { cpu:'5m',    mem:'48Mi'  },
      },
      execOutputs: {
        'etcd-node-3/df -h /var/lib/etcd': `Filesystem      Size  Used Avail Use% Mounted on
/dev/sdb         10G   9.8G  200M  98% /var/lib/etcd`,
        'etcd-node-3/df -h': `Filesystem      Size  Used Avail Use%
/dev/sda         50G   12G   38G  24% /
/dev/sdb         10G  9.8G  200M  98% /var/lib/etcd`,
        'etcd-node-3/etcdctl endpoint health': `{"endpoint":"https://etcd-node-3:2380","health":false,"error":"context deadline exceeded"}`,
        'etcd-node-3/etcdctl defrag': `Finished defragmenting etcd member[etcd-node-3:2380]\nTotal size after defrag: 1.1 GB`,
      },
    },
  },

  // ── 2. OOMKilled batch ────────────────────────────────────────────────
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
  },

  // ── 3. Wrong date format ──────────────────────────────────────────────
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
  },

  // ── 4. Nodes NotReady — CNI stuck ─────────────────────────────────────
  {
    id: 'node-cni',
    title: '🔴 CRITICAL: 127 pods Pending — mass scheduling failure',
    desc: 'Mass scheduling failure after node pool update. 127 pods stuck Pending.',
    meta: 'Namespace: prod | Pending pods: 127 | Node pool: app-pool (8 new nodes) | Started: 8 min ago',
    timeLimit: 110,
    hint: 'New nodes are NotReady. Find out why — check node conditions then look at CNI pods in kube-system.',
    solution: ['rollout restart daemonset', 'rollout restart daemonset/calico', 'delete pod -l k8s-app=calico', 'kubectl delete pod calico'],
    successMsg: '✅ calico-node DaemonSet restarted. CNI binaries installing. Nodes transitioning to Ready. 127 pending pods scheduling...',
    diagnosis: 'Node pool upgrade provisioned 8 new nodes but calico-node stuck in Init — CNI binaries not copied → nodes stay NotReady → all pods Pending',
    points: 350,
    cluster: {
      namespaces: ['default','kube-system','prod'],
      nodes: [
        { name:'app-pool-node-1', status:'NotReady', roles:'<none>', age:'12m', version:'v1.28.4',
          taints:['node.kubernetes.io/not-ready:NoSchedule'],
          conditions:[{type:'Ready',status:'False',reason:'KubeletNotReady',message:'container runtime network not ready: NetworkPlugin kubenet does not have required CNI plugins'}]},
        { name:'app-pool-node-2', status:'NotReady', roles:'<none>', age:'12m', version:'v1.28.4',
          taints:['node.kubernetes.io/not-ready:NoSchedule'],
          conditions:[{type:'Ready',status:'False',reason:'KubeletNotReady',message:'container runtime network not ready: NetworkPlugin kubenet does not have required CNI plugins'}]},
        { name:'app-pool-node-3', status:'NotReady', roles:'<none>', age:'12m', version:'v1.28.4',
          taints:['node.kubernetes.io/not-ready:NoSchedule'],
          conditions:[{type:'Ready',status:'False',reason:'KubeletNotReady',message:'container runtime network not ready'}]},
        { name:'app-pool-node-4', status:'NotReady', roles:'<none>', age:'12m', version:'v1.28.4', taints:['node.kubernetes.io/not-ready:NoSchedule'] },
        { name:'system-pool-node-1', status:'Ready', roles:'<none>', age:'45d', version:'v1.28.4' },
        { name:'system-pool-node-2', status:'Ready', roles:'<none>', age:'45d', version:'v1.28.4' },
        { name:'system-pool-node-3', status:'Ready', roles:'<none>', age:'45d', version:'v1.28.4' },
        { name:'system-pool-node-4', status:'Ready', roles:'<none>', age:'45d', version:'v1.28.4' },
      ],
      pods: [
        { name:'api-server-7f4d-x2kp', namespace:'prod', status:'Pending', ready:'0/1', restarts:0, age:'8m' },
        { name:'api-server-7f4d-m9nw', namespace:'prod', status:'Pending', ready:'0/1', restarts:0, age:'8m' },
        { name:'worker-6d8f-k2mx',     namespace:'prod', status:'Pending', ready:'0/1', restarts:0, age:'8m' },
        { name:'worker-6d8f-p9nw',     namespace:'prod', status:'Pending', ready:'0/1', restarts:0, age:'8m' },
        { name:'calico-node-n1', namespace:'kube-system', status:'Init:0/2', ready:'0/1', restarts:0, age:'12m', node:'app-pool-node-1', image:'calico/node:v3.26.1' },
        { name:'calico-node-n2', namespace:'kube-system', status:'Init:0/2', ready:'0/1', restarts:0, age:'12m', node:'app-pool-node-2', image:'calico/node:v3.26.1' },
        { name:'calico-node-n3', namespace:'kube-system', status:'Init:0/2', ready:'0/1', restarts:0, age:'12m', node:'app-pool-node-3', image:'calico/node:v3.26.1' },
        { name:'calico-node-n4', namespace:'kube-system', status:'Init:0/2', ready:'0/1', restarts:0, age:'12m', node:'app-pool-node-4', image:'calico/node:v3.26.1' },
        { name:'calico-node-s1', namespace:'kube-system', status:'Running',  ready:'1/1', restarts:0, age:'45d', node:'system-pool-node-1' },
        { name:'calico-node-s2', namespace:'kube-system', status:'Running',  ready:'1/1', restarts:0, age:'45d', node:'system-pool-node-2' },
        { name:'coredns-x2kp',   namespace:'kube-system', status:'Running',  ready:'1/1', restarts:0, age:'45d' },
        { name:'kube-proxy-k2mx',namespace:'kube-system', status:'Running',  ready:'1/1', restarts:0, age:'45d' },
      ],
      daemonsets: [
        { name:'calico-node', namespace:'kube-system', desired:8, current:8, ready:4, nodeSelector:'kubernetes.io/os=linux', image:'calico/node:v3.26.1', age:'45d' },
        { name:'kube-proxy',  namespace:'kube-system', desired:8, current:8, ready:8, nodeSelector:'kubernetes.io/os=linux', age:'45d' },
      ],
      events: [
        { namespace:'prod', type:'Warning', reason:'FailedScheduling', object:'api-server-7f4d-x2kp', lastSeen:'5m',
          message:'0/8 nodes available: 4 node(s) had untolerated taint {node.kubernetes.io/not-ready: NoSchedule}, 4 node(s) didn\'t match Pod\'s node affinity/selector.' },
        { namespace:'prod', type:'Warning', reason:'FailedScheduling', object:'worker-6d8f-k2mx', lastSeen:'5m',
          message:'0/8 nodes available: 4 node(s) had untolerated taint {node.kubernetes.io/not-ready: NoSchedule}' },
        { namespace:'kube-system', type:'Warning', reason:'Failed', object:'calico-node-n1', lastSeen:'11m',
          message:'Error: failed to create containerd task: CNI binary not found' },
      ],
      logs: {
        'calico-node-n1': `Copying CNI binaries to /host/opt/cni/bin/
Waiting for /host/opt/cni/bin/calico-ipam...
Waiting for /host/opt/cni/bin/calico-ipam...
Waiting for /host/opt/cni/bin/calico-ipam...
Error: CNI binary not found after 120s timeout. Retrying...`,
        'calico-node-n2': `Copying CNI binaries to /host/opt/cni/bin/
Waiting for /host/opt/cni/bin/calico-ipam...
Error: CNI binary not found after 120s timeout. Retrying...`,
      },
      metrics: {
        'calico-node-s1': { cpu:'45m',  mem:'180Mi' },
        'calico-node-s2': { cpu:'42m',  mem:'175Mi' },
        'system-pool-node-1': { cpu:'800m', cpuPct:'10%', mem:'4Gi', memPct:'12%' },
      },
    },
  },

  // ── 5. Kafka consumer lag ─────────────────────────────────────────────
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
  },

];
