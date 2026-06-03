# 📟 On-Call Simulator

Your pager goes off at 3am. Can you fix prod before SLA breaches?

A browser-based kubectl simulator with real production incidents, a fully virtual Kubernetes cluster, and a timer that judges you.

**[▶ Play now](https://n0rm4l-me.github.io/oncall-simulator)** ← add GitHub Pages after enabling

---

## How it works

- Each incident spawns a full virtual Kubernetes cluster
- Type real `kubectl` commands to investigate
- Find the root cause, run the fix command, score points
- Faster resolution = higher score. Hint = -50% penalty
- Scenarios shuffle every run

```
sre@oncall:~$ kubectl get pods -n prod
NAME                          READY   STATUS             RESTARTS
payment-service-7d9f4b-xk2p   0/1     CrashLoopBackOff   47
payment-service-7d9f4b-m8nq   0/1     CrashLoopBackOff   45

sre@oncall:~$ kubectl logs payment-service-7d9f4b-xk2p -n prod
ERROR io.etcd.jetcd.common.exception.EtcdException: io exception
FATAL Failed to initialize etcd client. Shutting down.

sre@oncall:~$ kubectl get pods -n kube-system | grep etcd
etcd-node-3   0/1   Error   8   3m  ← 👀

sre@oncall:~$ kubectl exec etcd-node-3 -n kube-system -- df -h /var/lib/etcd
/dev/sdb   10G   9.8G   200M   98%   ← 💀

sre@oncall:~$ kubectl exec etcd-node-3 -n kube-system -- etcdctl defrag
✅ WAL reduced 9.8G → 1.1G. Cluster healthy.
```

## Supported commands

| Command | Supported |
|---------|-----------|
| `kubectl get` pods/nodes/ns/deployments/daemonsets/services/configmaps/secrets/pvcs/events/hpa/jobs | ✅ |
| `kubectl describe` pod/node/deployment/daemonset/configmap | ✅ |
| `kubectl logs <pod> -n <ns> [--tail=N] [--previous]` | ✅ |
| `kubectl exec <pod> -n <ns> -- <cmd>` | ✅ |
| `kubectl top` pods/nodes | ✅ |
| `kubectl scale deployment/<name> --replicas=N` | ✅ |
| `kubectl rollout` history/undo/restart/status | ✅ |
| `kubectl set env` | ✅ |
| `kubectl delete` | ✅ |
| `gcloud logging read` | ✅ |
| `gcloud compute ssh` | ✅ |
| Flags: `-n`, `-A`, `-o json/wide`, `--jsonpath`, `--tail`, `--previous` | ✅ |
| `↑↓` history, `Tab` autocomplete, `hint`, `clear` | ✅ |

---

## Built-in incidents

| # | Incident | Root cause |
|---|----------|-----------|
| 1 | payment-service CrashLoopBackOff | etcd WAL disk 98% full |
| 2 | batch-processor OOMKilled | BATCH_SIZE=0 loads 48M records into memory |
| 3 | checkout-api HTTP 400 | frontend changed date format yyyy-MM-dd |
| 4 | 127 pods Pending | Node pool upgrade — CNI not installed on new nodes |
| 5 | Kafka consumer lag 2.8M | 3 replicas vs 24 partitions + ALLOW FILTERING |

---

## Writing custom scenarios

Each scenario is a JS file in `scenarios/` that defines a single `const SCENARIO_*` object.

### 1. Create the scenario file

```js
// scenarios/my-incident.js
const SCENARIO_MY_INCIDENT = {
  id: 'my-incident',
  title: '🔴 CRITICAL: my-service is down',
  desc: 'Short description shown in the alert banner.',
  meta: 'Namespace: prod | Impact: active',
  timeLimit: 120,   // seconds before SLA breach
  hint: 'Check the logs, then look at the configmap.',
  points: 300,

  // Solution: any of these strings in the typed command = solved
  solution: ['kubectl rollout undo', 'kubectl scale --replicas'],

  successMsg: '✅ Fixed! Brief explanation of what happened.',
  diagnosis: 'Root cause in one sentence — shown after solve or breach.',

  // Full cluster state — everything kubectl can query comes from here
  cluster: {
    namespaces: ['default', 'kube-system', 'prod'],

    nodes: [
      { name: 'node-1', status: 'Ready',    roles: '<none>', age: '45d', version: 'v1.28.4' },
      { name: 'node-2', status: 'NotReady', roles: '<none>', age: '5m',  version: 'v1.28.4',
        taints: ['node.kubernetes.io/not-ready:NoSchedule'],
        conditions: [{ type: 'Ready', status: 'False', reason: 'KubeletNotReady', message: 'disk pressure' }] },
    ],

    // kubectl top nodes
    nodeMetrics: {
      'node-1': { cpu: '1200m', cpuPct: '15%', mem: '8Gi', memPct: '25%' },
    },

    pods: [
      {
        name: 'my-service-abc123',
        namespace: 'prod',
        status: 'CrashLoopBackOff',  // shown in kubectl get pods
        ready: '0/1',
        restarts: 12,
        age: '30m',
        node: 'node-1',
        image: 'my-service:v1.2.0',
        // shown in kubectl describe pod
        conditions: [{ type: 'Ready', status: 'False', reason: 'ContainersNotReady' }],
        containers: [{
          name: 'my-service',
          image: 'my-service:v1.2.0',
          ready: false,
          restarts: 12,
          limits: { cpu: '500m', memory: '512Mi' },
          requests: { cpu: '100m', memory: '256Mi' },
          lastState: { reason: 'OOMKilled', exitCode: 137, startedAt: '5m ago', finishedAt: '3m ago' }
        }],
      },
    ],

    deployments: [
      {
        name: 'my-service',
        namespace: 'prod',
        replicas: 3,
        readyReplicas: 0,
        image: 'my-service:v1.2.0',
        age: '45d',
        // shown in kubectl rollout history
        history: [
          { revision: 1, 'change-cause': 'v1.1.0 stable', image: 'my-service:v1.1.0' },
          { revision: 2, 'change-cause': 'v1.2.0 new feature', image: 'my-service:v1.2.0' },
        ],
      },
    ],

    daemonsets: [],
    statefulsets: [],
    services: [],
    pvcs: [],
    hpas: [],
    jobs: [],

    configmaps: [
      {
        name: 'my-service-config',
        namespace: 'prod',
        age: '45d',
        data: { MAX_CONNECTIONS: '0', TIMEOUT: '30000' },
      },
    ],

    secrets: [
      { name: 'my-service-secret', namespace: 'prod', type: 'Opaque', data: { key: '***' }, age: '45d' },
    ],

    events: [
      {
        namespace: 'prod',
        type: 'Warning',
        reason: 'BackOff',
        object: 'my-service-abc123',
        lastSeen: '2m',
        message: 'Back-off restarting failed container',
      },
    ],

    // kubectl logs <pod-name> -n <ns>
    logs: {
      'my-service-abc123': `2026-01-01T00:00:01Z INFO  Starting my-service v1.2.0
2026-01-01T00:00:02Z ERROR Connection refused: db:5432
2026-01-01T00:00:02Z FATAL Startup failed.`,

      // kubectl logs --previous
      'my-service-abc123:previous': `2026-01-01T00:00:01Z FATAL OOMKilled`,
    },

    // kubectl top pods
    metrics: {
      'my-service-abc123': { cpu: '0m', mem: '0Mi' },
    },

    // kubectl exec <pod> -- <cmd>
    // key format: "<pod-name>/<command-keyword>"
    execOutputs: {
      'my-service-abc123/df -h': `Filesystem  Size  Used Avail Use%
/dev/sda     50G   49G  1.0G  98%  /`,
      'my-service-abc123/env': `MAX_CONNECTIONS=0\nTIMEOUT=30000`,
    },

    // gcloud logging read "<filter>"
    gcloud: {
      logging: {
        'resource.type="k8s_container" AND resource.labels.pod_name="my-service"': `[
  {"timestamp": "2026-01-01T00:00:02Z", "severity": "ERROR", "message": "Connection refused"}
]`,
      },
      compute: {
        ssh: {
          'node-2': `Connected to node-2.\n$ df -h\n/dev/sda  50G  49G  1G  98%  /`,
        },
      },
    },
  },
};
```

### 2. Register the scenario

Add to `index.html` (before `scenarios/index.js`):
```html
<script src="scenarios/my-incident.js"></script>
```

Add to `scenarios/index.js`:
```js
const all = [
  SCENARIO_ETCD_WAL,
  SCENARIO_OOM_BATCH,
  // ...
  SCENARIO_MY_INCIDENT,  // ← add here
];
```

### 3. Or drag & drop

Create a JSON file with the same structure (single object or array of objects) and drag it onto the game page. It will replace the default scenarios immediately.

---

## Project structure

```
oncall-simulator/
├── index.html          — UI shell + game controller
├── kubectl.js          — virtual kubectl / gcloud interpreter
├── scenarios/
│   ├── index.js        — registry + shuffle
│   ├── etcd-wal.js
│   ├── oom-batch.js
│   ├── date-format.js
│   ├── node-cni.js
│   └── kafka-lag.js
└── README.md
```

## Grades

| Score | Grade | |
|-------|-------|-|
| 90%+  | S | Principal SRE material 🏆 |
| 70%+  | A | Ready for prod on-call 💪 |
| 50%+  | B | Solid debugging skills 👍 |
| 30%+  | C | Keep practicing 📖 |
| <30%  | D | Your pager gave up on you 📟 |
