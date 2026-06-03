// Scenario: etcd-wal
const SCENARIO_ETCD_WAL =
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
  };
