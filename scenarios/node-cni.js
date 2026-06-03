// Scenario: node-cni
const SCENARIO_NODE_CNI =
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
  };
