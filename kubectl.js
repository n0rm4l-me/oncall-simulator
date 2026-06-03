// ═══════════════════════════════════════════════════════════════════════════
// KC — Virtual Kubernetes Cluster + kubectl / gcloud interpreter
// ═══════════════════════════════════════════════════════════════════════════
//
// Cluster state schema:
// {
//   namespaces: string[]
//   nodes: Node[]
//   pods: Pod[]
//   deployments: Deployment[]
//   statefulsets: StatefulSet[]
//   daemonsets: DaemonSet[]
//   services: Service[]
//   configmaps: ConfigMap[]
//   secrets: Secret[]
//   pvcs: PVC[]
//   events: Event[]
//   hpas: HPA[]
//   jobs: Job[]
//   logs: { "<pod-name>": string }          — pod stdout
//   metrics: { "<pod-name>": { cpu, mem } } — kubectl top pods
//   nodeMetrics: { "<node-name>": { cpu, mem, cpuPct, memPct } }
//   execOutputs: { "<pod-name>/<command-key>": string } — kubectl exec results
//   gcloud: {
//     logging: { "<filter-key>": string }  — gcloud logging read results
//     compute: { ssh: { "<node>": string } }
//   }
// }

const KC = (() => {
  let cluster = {};

  // ── Mount cluster state
  function mount(state) {
    cluster = JSON.parse(JSON.stringify(state || {}));
    // Defaults
    cluster.namespaces = cluster.namespaces || ['default','kube-system','prod'];
    cluster.nodes       = cluster.nodes       || [];
    cluster.pods        = cluster.pods        || [];
    cluster.deployments = cluster.deployments || [];
    cluster.statefulsets= cluster.statefulsets|| [];
    cluster.daemonsets  = cluster.daemonsets  || [];
    cluster.services    = cluster.services    || [];
    cluster.configmaps  = cluster.configmaps  || [];
    cluster.secrets     = cluster.secrets     || [];
    cluster.pvcs        = cluster.pvcs        || [];
    cluster.events      = cluster.events      || [];
    cluster.hpas        = cluster.hpas        || [];
    cluster.jobs        = cluster.jobs        || [];
    cluster.logs        = cluster.logs        || {};
    cluster.metrics     = cluster.metrics     || {};
    cluster.nodeMetrics = cluster.nodeMetrics || {};
    cluster.execOutputs = cluster.execOutputs || {};
    cluster.gcloud      = cluster.gcloud      || {};
  }

  // ── All tab-completable commands (based on current cluster)
  function allCommands(state) {
    const s = state || cluster;
    const ns = (s.namespaces || []);
    const base = [
      'kubectl get pods','kubectl get nodes','kubectl get namespaces','kubectl get ns',
      'kubectl get deployments','kubectl get daemonsets','kubectl get statefulsets',
      'kubectl get services','kubectl get configmaps','kubectl get secrets',
      'kubectl get events','kubectl get pvc','kubectl get hpa','kubectl get jobs',
      'kubectl top pods','kubectl top nodes',
      'kubectl cluster-info','kubectl version','help','hint','clear',
    ];
    ns.forEach(n => {
      base.push(`kubectl get pods -n ${n}`);
      base.push(`kubectl get events -n ${n}`);
      base.push(`kubectl get deployments -n ${n}`);
    });
    (s.pods||[]).forEach(p => {
      base.push(`kubectl logs ${p.name} -n ${p.namespace}`);
      base.push(`kubectl describe pod ${p.name} -n ${p.namespace}`);
    });
    (s.deployments||[]).forEach(d => {
      base.push(`kubectl describe deployment ${d.name} -n ${d.namespace}`);
      base.push(`kubectl rollout history deployment/${d.name} -n ${d.namespace}`);
      base.push(`kubectl rollout undo deployment/${d.name} -n ${d.namespace}`);
    });
    return base;
  }

  // ══════════════════════════════════════════════════════════════
  // MAIN ENTRY: parse and run a command string
  // Returns { text: string } or { error: string }
  // ══════════════════════════════════════════════════════════════
  function run(raw) {
    const parts = tokenize(raw);
    if (!parts.length) return ok('');
    const cmd = parts[0].toLowerCase();

    if (cmd === 'kubectl') return runKubectl(parts.slice(1));
    if (cmd === 'gcloud')  return runGcloud(parts.slice(1));
    if (cmd === 'df')      return runDf(parts.slice(1));

    return err(`${parts[0]}: command not found. Try kubectl or gcloud.`);
  }

  // ══════════════════════════════════════════════════════════════
  // kubectl
  // ══════════════════════════════════════════════════════════════
  function runKubectl(args) {
    const sub = (args[0]||'').toLowerCase();
    if (!sub) return err('kubectl: missing subcommand. Try: get, describe, logs, exec, top, scale, rollout, set, delete, apply');

    switch (sub) {
      case 'get':      return kGet(args.slice(1));
      case 'describe': return kDescribe(args.slice(1));
      case 'logs':     return kLogs(args.slice(1));
      case 'exec':     return kExec(args.slice(1));
      case 'top':      return kTop(args.slice(1));
      case 'scale':    return kScale(args.slice(1));
      case 'rollout':  return kRollout(args.slice(1));
      case 'set':      return kSet(args.slice(1));
      case 'delete':   return kDelete(args.slice(1));
      case 'apply':    return ok('[dry-run] apply: resource configured');
      case 'patch':    return ok('resource patched');
      case 'edit':     return ok('(editor not available in simulator — use kubectl set or kubectl patch)');
      case 'cluster-info': return ok(`Kubernetes control plane is running at https://cluster.k8s.local:6443\nCoreDNS is running at https://cluster.k8s.local/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy`);
      case 'version':  return ok(`Client Version: v1.28.4\nServer Version: v1.28.4\nKustomize Version: v5.0.4`);
      case 'config':   return kConfig(args.slice(1));
      case 'auth':     return kAuth(args.slice(1));
      default:         return err(`kubectl: unknown subcommand "${sub}"`);
    }
  }

  // ── kubectl get
  function kGet(args) {
    const flags = parseFlags(args);
    const resource = (flags._[0] || '').toLowerCase().replace(/s$/,''); // normalize plural
    const name = flags._[1] || null;
    const ns = flags.n || flags.namespace || 'default';
    const allNs = flags.A || flags['all-namespaces'];
    const wide = (flags.o || flags.output) === 'wide';
    const jsonOut = (flags.o || flags.output) === 'json';
    const jsonpath = flags.jsonpath || flags['output']?.startsWith('jsonpath') ? flags['output'] : null;

    switch (resource) {
      case 'pod':         return fmtPods(getPods(ns, allNs, name), wide, jsonOut, jsonpath);
      case 'node':        return fmtNodes(cluster.nodes, wide, jsonOut);
      case 'namespace':   return fmtNamespaces();
      case 'ns':          return fmtNamespaces();
      case 'deployment':  return fmtDeployments(getByNs(cluster.deployments, ns, allNs, name));
      case 'daemonset':   return fmtDaemonsets(getByNs(cluster.daemonsets, ns, allNs, name));
      case 'statefulset': return fmtStatefulsets(getByNs(cluster.statefulsets, ns, allNs, name));
      case 'service':     return fmtServices(getByNs(cluster.services, ns, allNs, name));
      case 'svc':         return fmtServices(getByNs(cluster.services, ns, allNs, name));
      case 'configmap':   return fmtConfigmaps(getByNs(cluster.configmaps, ns, allNs, name), jsonOut, jsonpath);
      case 'cm':          return fmtConfigmaps(getByNs(cluster.configmaps, ns, allNs, name), jsonOut, jsonpath);
      case 'secret':      return fmtSecrets(getByNs(cluster.secrets, ns, allNs, name));
      case 'persistentvolumeclaim': return fmtPvcs(getByNs(cluster.pvcs, ns, allNs, name));
      case 'pvc':         return fmtPvcs(getByNs(cluster.pvcs, ns, allNs, name));
      case 'event':       return fmtEvents(getByNs(cluster.events, ns, allNs, name));
      case 'hpa':         return fmtHpas(getByNs(cluster.hpas, ns, allNs, name), jsonOut, jsonpath);
      case 'job':         return fmtJobs(getByNs(cluster.jobs, ns, allNs, name));
      case 'all':         return fmtAll(ns);
      default:
        if (!resource) return err('kubectl get: specify a resource type (pods, nodes, deployments, ...)');
        return err(`error: the server doesn't have a resource type "${resource}"`);
    }
  }

  // ── kubectl describe
  function kDescribe(args) {
    const flags = parseFlags(args);
    // Support both "describe pod <name>" and "describe pod/<name>"
    let resource, nameArg;
    if ((flags._[0]||'').includes('/')) {
      const [r, n] = flags._[0].split('/');
      resource = r.toLowerCase().replace(/s$/, '');
      nameArg = n || null;
    } else {
      resource = (flags._[0]||'').toLowerCase().replace(/s$/, '');
      nameArg = flags._[1] || null;
    }
    const ns = flags.n || flags.namespace || 'default';

    switch(resource) {
      case 'pod':  {
        const pod = findByName(cluster.pods, nameArg, ns);
        if (!pod) return err(`Error from server (NotFound): pods "${nameArg}" not found`);
        return ok(describePod(pod));
      }
      case 'node': {
        const node = cluster.nodes.find(n=>n.name===nameArg||n.name?.startsWith(nameArg||''));
        if (!node) return err(`Error from server (NotFound): nodes "${nameArg}" not found`);
        return ok(describeNode(node));
      }
      case 'deployment': {
        const dep = findByName(cluster.deployments, nameArg, ns);
        if (!dep) return err(`Error from server (NotFound): deployments "${nameArg}" not found`);
        return ok(describeDeployment(dep));
      }
      case 'daemonset': {
        const ds = findByName(cluster.daemonsets, nameArg, ns);
        if (!ds) return err(`Error from server (NotFound): daemonsets "${nameArg}" not found`);
        return ok(describeDaemonset(ds));
      }
      case 'configmap': {
        const cm = findByName(cluster.configmaps, nameArg, ns);
        if (!cm) return err(`Error from server (NotFound): configmaps "${nameArg}" not found`);
        return ok(describeConfigmap(cm));
      }
      default:
        return err(`kubectl describe: unknown resource type "${resource}"`);
    }
  }

  // ── kubectl logs
  function kLogs(args) {
    const flags = parseFlags(args);
    const podName = flags._[0];
    const ns = flags.n || flags.namespace || 'default';
    const container = flags.c || flags.container;
    const tail = parseInt(flags.tail || '0');
    const prev = flags.p || flags.previous;

    if (!podName) return err('kubectl logs: pod name required');

    const pod = findByName(cluster.pods, podName, ns);
    if (!pod) return err(`Error from server (NotFound): pods "${podName}" not found`);

    const key = prev ? `${podName}:previous` : podName;
    let logText = cluster.logs[key] || cluster.logs[podName] || `(no logs available for ${podName})`;

    if (tail > 0) {
      logText = logText.split('\n').slice(-tail).join('\n');
    }

    return ok(logText);
  }

  // ── kubectl exec
  function kExec(args) {
    const flags = parseFlags(args);
    const podName = flags._[0];
    const ns = flags.n || flags.namespace || 'default';
    // Find command after --
    const raw = args.join(' ');
    const cmdPart = raw.includes('--') ? raw.split('--').slice(1).join('--').trim() : '';

    if (!podName) return err('kubectl exec: pod name required');
    const pod = findByName(cluster.pods, podName, ns);
    if (!pod) return err(`Error from server (NotFound): pods "${podName}" not found`);

    if (pod.status !== 'Running') return err(`error: pod "${podName}" not running (status: ${pod.status})`);

    // Look up exec output by pod + command keyword
    if (cmdPart) {
      // Try full command key
      const fullKey = `${podName}/${cmdPart}`;
      if (cluster.execOutputs[fullKey]) return ok(cluster.execOutputs[fullKey]);
      // Try partial match
      for (const [k,v] of Object.entries(cluster.execOutputs)) {
        if (k.startsWith(podName+'/') && cmdPart.includes(k.split('/').slice(1).join('/'))) {
          return ok(v);
        }
        // command keyword match
        const cmdKey = k.split('/').slice(1).join('/');
        if (cmdPart.toLowerCase().includes(cmdKey.toLowerCase())) return ok(v);
      }
      return ok(`(exec output not defined for: ${cmdPart})`);
    }
    return err('kubectl exec: provide command after --');
  }

  // ── kubectl top
  function kTop(args) {
    const flags = parseFlags(args);
    const resource = (flags._[0]||'pods').toLowerCase().replace(/s$/,'');
    const ns = flags.n || flags.namespace || 'default';
    const allNs = flags.A || flags['all-namespaces'];

    if (resource === 'node') {
      const lines = ['NAME                  CPU(cores)   CPU%   MEMORY(bytes)   MEMORY%'];
      cluster.nodes.forEach(n => {
        const m = cluster.nodeMetrics[n.name] || {};
        lines.push(pad(n.name,38) + pad(m.cpu||'<unknown>',13) + pad(m.cpuPct||'<unknown>',7) + pad(m.mem||'<unknown>',16) + (m.memPct||'<unknown>'));
      });
      return ok(lines.join('\n'));
    }
    // pods
    const pods = getPods(ns, allNs);
    if (!pods.length) return ok('No resources found.');
    const header = allNs
      ? 'NAMESPACE         NAME                           CPU(cores)   MEMORY(bytes)'
      : 'NAME                           CPU(cores)   MEMORY(bytes)';
    const lines = [header];
    pods.forEach(p => {
      const m = cluster.metrics[p.name] || {};
      if (allNs) lines.push(pad(p.namespace,18)+pad(p.name,31)+pad(m.cpu||'0m',13)+(m.mem||'0Mi'));
      else       lines.push(pad(p.name,31)+pad(m.cpu||'0m',13)+(m.mem||'0Mi'));
    });
    return ok(lines.join('\n'));
  }

  // ── kubectl scale
  function kScale(args) {
    const flags = parseFlags(args);
    const replicas = parseInt(flags.replicas || flags['replicas'] || '0');
    const target = flags._[0] || '';
    if (!target) return err('kubectl scale: specify resource (e.g. deployment/my-app)');
    if (!flags.replicas) return err('kubectl scale: --replicas required');

    const [kind, name] = target.includes('/') ? target.split('/') : ['deployment', target];
    const ns = flags.n || flags.namespace || 'default';

    let list = kind === 'deployment' ? cluster.deployments :
               kind === 'statefulset' ? cluster.statefulsets : [];
    const res = findByName(list, name, ns);
    if (!res) return err(`Error from server (NotFound): ${kind} "${name}" not found`);

    res.replicas = replicas;
    res.readyReplicas = replicas;
    return ok(`${kind}.apps/${name} scaled`);
  }

  // ── kubectl rollout
  function kRollout(args) {
    const sub = (args[0]||'').toLowerCase();
    const flags = parseFlags(args.slice(1));
    const target = flags._[0] || '';
    const ns = flags.n || flags.namespace || 'default';

    const [kind, name] = target.includes('/') ? target.split('/') : ['deployment', target];
    const dep = findByName(cluster.deployments, name, ns);

    if (sub === 'history') {
      if (!dep) return err(`Error from server (NotFound): deployments "${name}" not found`);
      const hist = dep.history || [];
      if (!hist.length) return ok(`deployments "${name}"\nREVISION  CHANGE-CAUSE\n1         <none>`);
      const revision = flags.revision ? parseInt(flags.revision) : null;
      if (revision) {
        const rev = hist.find(h=>h.revision===revision);
        if (!rev) return err(`error: unable to find specified revision ${revision}`);
        return ok(`Deployment revision ${revision}\n` + Object.entries(rev).map(([k,v])=>`  ${k}: ${v}`).join('\n'));
      }
      const lines = ['REVISION  CHANGE-CAUSE'];
      hist.forEach(h => lines.push(`${String(h.revision).padEnd(10)}${h['change-cause']||'<none>'}`));
      return ok(lines.join('\n'));
    }

    if (sub === 'status') {
      if (!dep) return err(`Error from server (NotFound): deployments "${name}" not found`);
      return ok(`deployment "${name}" successfully rolled out`);
    }

    if (sub === 'undo') {
      if (!dep) return err(`Error from server (NotFound): deployments "${name}" not found`);
      const hist = dep.history || [];
      if (hist.length >= 2) {
        const prev = hist[hist.length - 2];
        dep.image = prev.image || dep.image;
      }
      return ok(`deployment.apps/${name} rolled back`);
    }

    if (sub === 'restart') {
      // For daemonsets, deployments, statefulsets
      const kindMap = {deployment:cluster.deployments, daemonset:cluster.daemonsets, statefulset:cluster.statefulsets};
      const list = kindMap[kind] || cluster.deployments;
      const res = findByName(list, name, ns);
      if (!res) return err(`Error from server (NotFound): ${kind} "${name}" not found`);
      return ok(`${kind}.apps/${name} restarted`);
    }

    return err(`kubectl rollout: unknown subcommand "${sub}". Try: history, undo, restart, status`);
  }

  // ── kubectl set
  function kSet(args) {
    const sub = (args[0]||'').toLowerCase();
    if (sub === 'env') {
      const flags = parseFlags(args.slice(1));
      const target = flags._[0] || '';
      const ns = flags.n || flags.namespace || 'default';
      const [kind, name] = target.includes('/') ? target.split('/') : ['deployment', target];
      const dep = findByName(cluster.deployments, name, ns);
      if (!dep) return err(`Error from server (NotFound): ${kind} "${name}" not found`);
      // Apply env overrides to cluster state
      const envPairs = flags._.slice(1);
      if (!dep.env) dep.env = {};
      envPairs.forEach(p => {
        const [k,v] = p.split('=');
        if (k && v !== undefined) dep.env[k] = v;
      });
      return ok(`${kind}.apps/${name} env updated`);
    }
    if (sub === 'image') {
      return ok(`deployment updated`);
    }
    return err(`kubectl set: unknown subcommand "${sub}". Try: env, image`);
  }

  // ── kubectl delete
  function kDelete(args) {
    const flags = parseFlags(args);
    const resource = (flags._[0]||'').toLowerCase().replace(/s$/,'');
    const name = flags._[1];
    const ns = flags.n || flags.namespace || 'default';

    if (!resource) return err('kubectl delete: specify resource type and name');

    const listMap = {
      pod:cluster.pods, deployment:cluster.deployments,
      daemonset:cluster.daemonsets, statefulset:cluster.statefulsets,
      job:cluster.jobs,
    };
    const list = listMap[resource];
    if (list && name) {
      const idx = list.findIndex(r=>r.name===name && (r.namespace===ns||!r.namespace));
      if (idx !== -1) { list.splice(idx,1); return ok(`${resource} "${name}" deleted`); }
    }
    return ok(`${resource} "${name||'(all)'}" deleted`);
  }

  // ── kubectl config / auth
  function kConfig(args) {
    const sub = (args[0]||'').toLowerCase();
    if (sub === 'get-contexts') return ok(`CURRENT   NAME              CLUSTER           AUTHINFO\n*         prod-cluster      prod-cluster      prod-admin\n          staging-cluster   staging-cluster   staging-admin`);
    if (sub === 'current-context') return ok(`prod-cluster`);
    return ok(`kubectl config ${args.join(' ')}: ok`);
  }

  function kAuth(args) {
    const sub = (args[0]||'').toLowerCase();
    if (sub === 'can-i') return ok(`yes`);
    return ok(`auth: ok`);
  }

  // ══════════════════════════════════════════════════════════════
  // gcloud
  // ══════════════════════════════════════════════════════════════
  function runGcloud(args) {
    const g = cluster.gcloud || {};
    const sub = (args[0]||'').toLowerCase();

    if (sub === 'logging') {
      const logSub = (args[1]||'').toLowerCase();
      if (logSub === 'read') {
        // Try to match filter string against stored logging outputs
        const filterStr = args.slice(2).join(' ');
        const logs = g.logging || {};
        // Exact key match
        if (logs[filterStr]) return ok(logs[filterStr]);
        // Partial key match
        for (const [k,v] of Object.entries(logs)) {
          if (filterStr.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(filterStr.toLowerCase().slice(0,30))) {
            return ok(v);
          }
        }
        return ok('[]');
      }
      return err(`gcloud logging: unknown subcommand "${logSub}"`);
    }

    if (sub === 'compute') {
      const cSub = (args[1]||'').toLowerCase();
      if (cSub === 'ssh') {
        const node = args[2] || '';
        const ssh = (g.compute||{}).ssh || {};
        if (ssh[node]) return ok(ssh[node]);
        return ok(`Connected to ${node}.\n(ssh simulation — type 'exit' to disconnect)`);
      }
      if (cSub === 'instances') return ok(`NAME        ZONE              STATUS\nnode-1      asia-northeast1-a  RUNNING`);
      return err(`gcloud compute: unknown subcommand "${cSub}"`);
    }

    if (sub === 'container') {
      return ok(`gcloud container: ${args.slice(1).join(' ')}: ok`);
    }

    if (sub === 'auth') {
      const aSub = (args[1]||'').toLowerCase();
      if (aSub === 'print-access-token') return ok(`ya29.simulated-access-token-for-testing`);
      return ok(`authenticated`);
    }

    return err(`gcloud: unknown command "${sub}". Try: logging, compute, container, auth`);
  }

  // ── df (when called without kubectl exec context)
  function runDf(args) {
    return err(`df: use kubectl exec <pod> -n <ns> -- df -h instead`);
  }

  // ══════════════════════════════════════════════════════════════
  // FORMATTERS
  // ══════════════════════════════════════════════════════════════

  function fmtPods(pods, wide, json, jsonpath) {
    if (!pods.length) return ok('No resources found.');
    if (json) return ok(JSON.stringify({items: pods}, null, 2));
    if (jsonpath) return ok(extractJsonpath(pods, jsonpath));

    const showNs = pods.some((p,i) => i>0 && p.namespace !== pods[0].namespace);
    let hdr = showNs
      ? col('NAMESPACE',18)+col('NAME',46)+col('READY',8)+col('STATUS',24)+col('RESTARTS',12)+'AGE'
      : col('NAME',46)+col('READY',8)+col('STATUS',24)+col('RESTARTS',12)+'AGE';
    if (wide) hdr += col('  IP',16)+'NODE';

    const lines = [hdr];
    pods.forEach(p => {
      const ready = p.ready !== undefined ? p.ready : (p.status==='Running'?'1/1':'0/1');
      const restarts = p.restarts !== undefined ? String(p.restarts) : '0';
      const age = p.age || '1d';
      let line = showNs
        ? col(p.namespace,18)+col(p.name,46)+col(ready,8)+col(p.status||'Unknown',24)+col(restarts,12)+age
        : col(p.name,46)+col(ready,8)+col(p.status||'Unknown',24)+col(restarts,12)+age;
      if (wide) line += col(p.ip||'<none>',16)+(p.node||'<none>');
      lines.push(line);
    });
    return ok(lines.join('\n'));
  }

  function fmtNodes(nodes, wide, json) {
    if (!nodes.length) return ok('No resources found.');
    if (json) return ok(JSON.stringify({items:nodes},null,2));
    const hdr = col('NAME',46)+col('STATUS',14)+col('ROLES',14)+col('AGE',8)+'VERSION';
    const lines = [hdr];
    nodes.forEach(n => {
      const status = n.status || 'Ready';
      const roles = n.roles || '<none>';
      const pressure = n.pressure?.length ? ` (Pressure: ${n.pressure.join(',')})` : '';
      lines.push(col(n.name,46)+col(status+pressure,14)+col(roles,14)+col(n.age||'45d',8)+(n.version||'v1.28.4'));
    });
    return ok(lines.join('\n'));
  }

  function fmtNamespaces() {
    const lines = [col('NAME',24)+col('STATUS',10)+'AGE'];
    (cluster.namespaces||[]).forEach(n => {
      const age = typeof n === 'object' ? n.age : '45d';
      const name = typeof n === 'object' ? n.name : n;
      lines.push(col(name,24)+col('Active',10)+age);
    });
    return ok(lines.join('\n'));
  }

  function fmtDeployments(deps) {
    if (!deps.length) return ok('No resources found.');
    const hdr = col('NAME',36)+col('READY',8)+col('UP-TO-DATE',12)+col('AVAILABLE',12)+'AGE';
    const lines = [hdr];
    deps.forEach(d => {
      const r = d.readyReplicas !== undefined ? `${d.readyReplicas}/${d.replicas||1}` : `${d.replicas||1}/${d.replicas||1}`;
      lines.push(col(d.name,36)+col(r,8)+col(String(d.replicas||1),12)+col(String(d.readyReplicas||d.replicas||1),12)+(d.age||'45d'));
    });
    return ok(lines.join('\n'));
  }

  function fmtDaemonsets(dss) {
    if (!dss.length) return ok('No resources found.');
    const hdr = col('NAME',32)+col('DESIRED',9)+col('CURRENT',9)+col('READY',7)+col('NODE SELECTOR',18)+'AGE';
    const lines = [hdr];
    dss.forEach(d => {
      lines.push(col(d.name,32)+col(String(d.desired||0),9)+col(String(d.current||0),9)+col(String(d.ready||0),7)+col(d.nodeSelector||'<none>',18)+(d.age||'45d'));
    });
    return ok(lines.join('\n'));
  }

  function fmtStatefulsets(sss) {
    if (!sss.length) return ok('No resources found.');
    const hdr = col('NAME',36)+col('READY',8)+'AGE';
    const lines = [hdr];
    sss.forEach(s => {
      lines.push(col(s.name,36)+col(`${s.readyReplicas||s.replicas||0}/${s.replicas||0}`,8)+(s.age||'45d'));
    });
    return ok(lines.join('\n'));
  }

  function fmtServices(svcs) {
    if (!svcs.length) return ok('No resources found.');
    const hdr = col('NAME',28)+col('TYPE',14)+col('CLUSTER-IP',16)+col('PORT(S)',16)+'AGE';
    const lines = [hdr];
    svcs.forEach(s => {
      lines.push(col(s.name,28)+col(s.type||'ClusterIP',14)+col(s.clusterIP||'<none>',16)+col(s.ports||'<none>',16)+(s.age||'45d'));
    });
    return ok(lines.join('\n'));
  }

  function fmtConfigmaps(cms, json, jsonpath) {
    if (!cms.length) return ok('No resources found.');
    if (json) return ok(JSON.stringify({items:cms},null,2));
    if (jsonpath) return ok(extractJsonpath(cms,jsonpath));
    // If single item and -o yaml-like requested, show data
    if (cms.length === 1 && cms[0].data) {
      const cm = cms[0];
      let out = `apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: ${cm.name}\n  namespace: ${cm.namespace||'default'}\ndata:\n`;
      Object.entries(cm.data||{}).forEach(([k,v]) => out += `  ${k}: "${v}"\n`);
      return ok(out);
    }
    const hdr = col('NAME',36)+col('DATA',8)+'AGE';
    const lines = [hdr];
    cms.forEach(c => lines.push(col(c.name,36)+col(String(Object.keys(c.data||{}).length),8)+(c.age||'45d')));
    return ok(lines.join('\n'));
  }

  function fmtSecrets(secrets) {
    if (!secrets.length) return ok('No resources found.');
    const hdr = col('NAME',36)+col('TYPE',20)+col('DATA',8)+'AGE';
    const lines = [hdr];
    secrets.forEach(s => lines.push(col(s.name,36)+col(s.type||'Opaque',20)+col(String(Object.keys(s.data||{}).length),8)+(s.age||'45d')));
    return ok(lines.join('\n'));
  }

  function fmtPvcs(pvcs) {
    if (!pvcs.length) return ok('No resources found.');
    const hdr = col('NAME',32)+col('STATUS',10)+col('VOLUME',24)+col('CAPACITY',12)+col('STORAGECLASS',16)+'AGE';
    const lines = [hdr];
    pvcs.forEach(p => lines.push(col(p.name,32)+col(p.status||'Bound',10)+col(p.volume||'pvc-xxx',24)+col(p.capacity||'10Gi',12)+col(p.storageClass||'standard',16)+(p.age||'45d')));
    return ok(lines.join('\n'));
  }

  function fmtEvents(events) {
    if (!events.length) return ok('No resources found.');
    const hdr = col('LAST SEEN',12)+col('TYPE',10)+col('REASON',22)+col('OBJECT',34)+'MESSAGE';
    const lines = [hdr];
    events.forEach(e => {
      const msg = (e.message||'').length > 60 ? e.message.slice(0,57)+'...' : (e.message||'');
      lines.push(col(e.lastSeen||'1m',12)+col(e.type||'Normal',10)+col(e.reason||'',22)+col(`${e.kind||'Pod'}/${e.object||''}`,34)+msg);
    });
    return ok(lines.join('\n'));
  }

  function fmtHpas(hpas, json, jsonpath) {
    if (!hpas.length) return ok('No resources found.');
    if (json) return ok(JSON.stringify({items:hpas},null,2));
    const hdr = col('NAME',40)+col('REFERENCE',34)+col('TARGETS',18)+col('MINPODS',9)+col('MAXPODS',9)+'REPLICAS';
    const lines = [hdr];
    hpas.forEach(h => {
      const target = h.target || `${h.name}`;
      const targets = h.targets || `${h.currentCPU||'<unknown>'}%/${h.targetCPU||'80'}%`;
      lines.push(col(h.name,40)+col(target,34)+col(targets,18)+col(String(h.minReplicas||1),9)+col(String(h.maxReplicas||10),9)+String(h.currentReplicas||1));
    });
    return ok(lines.join('\n'));
  }

  function fmtJobs(jobs) {
    if (!jobs.length) return ok('No resources found.');
    const hdr = col('NAME',36)+col('COMPLETIONS',13)+col('DURATION',12)+'AGE';
    const lines = [hdr];
    jobs.forEach(j => lines.push(col(j.name,36)+col(`${j.succeeded||0}/${j.total||1}`,13)+col(j.duration||'1m',12)+(j.age||'1d')));
    return ok(lines.join('\n'));
  }

  function fmtAll(ns) {
    const parts = [];
    const deps = getByNs(cluster.deployments, ns);
    if (deps.length) parts.push(fmtDeployments(deps).text);
    const pods = getPods(ns);
    if (pods.length) parts.push(fmtPods(pods).text);
    const svcs = getByNs(cluster.services, ns);
    if (svcs.length) parts.push(fmtServices(svcs).text);
    return ok(parts.join('\n\n') || 'No resources found.');
  }

  // ── describe helpers
  function describePod(pod) {
    const conditions = pod.conditions || [{type:'Ready',status:pod.status==='Running'?'True':'False'}];
    const containers = pod.containers || [{name:pod.name,image:pod.image||'unknown:latest',ready:pod.status==='Running'}];
    const events = (cluster.events||[]).filter(e=>e.object===pod.name);

    let out = `Name:         ${pod.name}
Namespace:    ${pod.namespace||'default'}
Node:         ${pod.node||'<none>'}/${pod.nodeIP||'<none>'}
Status:       ${pod.status||'Unknown'}
IP:           ${pod.ip||'<none>'}

Containers:
${containers.map(c=>`  ${c.name}:
    Image:          ${c.image||pod.image||'unknown'}
    Ready:          ${c.ready?'True':'False'}
    Restart Count:  ${c.restarts||pod.restarts||0}
    Limits:         ${JSON.stringify(c.limits||pod.limits||{cpu:'500m',memory:'512Mi'})}
    Requests:       ${JSON.stringify(c.requests||pod.requests||{cpu:'100m',memory:'256Mi'})}
    ${c.lastState?`Last State:     Terminated
      Reason:       ${c.lastState.reason||'Error'}
      Exit Code:    ${c.lastState.exitCode||1}
      Started:      ${c.lastState.startedAt||'unknown'}
      Finished:     ${c.lastState.finishedAt||'unknown'}`:''}
    ${c.state?`State:          ${JSON.stringify(c.state)}`:`State:          ${pod.status==='Running'?'Running':'Waiting'}`}`).join('\n')}

Conditions:
${conditions.map(c=>`  ${String(c.type).padEnd(22)} ${c.status}`).join('\n')}

${pod.message?`Message: ${pod.message}\n`:''}Events:
${events.length ? events.map(e=>`  ${e.type||'Normal'}  ${e.reason||''}  ${e.lastSeen||''}  ${e.message||''}`).join('\n') : '  <none>'}`;
    return out;
  }

  function describeNode(node) {
    const conditions = node.conditions || [{type:'Ready',status:node.status==='Ready'?'True':'False',reason:node.status==='Ready'?'KubeletReady':'KubeletNotReady'}];
    const taints = node.taints || [];
    return `Name:    ${node.name}
Roles:   ${node.roles||'<none>'}
Version: ${node.version||'v1.28.4'}

Conditions:
${conditions.map(c=>`  ${String(c.type).padEnd(24)} ${String(c.status).padEnd(8)} ${c.reason||''}
  Message: ${c.message||''}`).join('\n')}

Taints: ${taints.length ? taints.join(', ') : '<none>'}

Capacity:
  cpu:    ${node.cpuCapacity||'8'}
  memory: ${node.memCapacity||'32Gi'}

${node.pressureMsg?`\n${node.pressureMsg}\n`:''}`;
  }

  function describeDeployment(dep) {
    const hist = dep.history || [];
    return `Name:               ${dep.name}
Namespace:          ${dep.namespace||'default'}
Replicas:           ${dep.readyReplicas||dep.replicas||1} desired | ${dep.replicas||1} updated | ${dep.replicas||1} total
Image:              ${dep.image||'unknown'}
${hist.length?`\nRevision History Limit: ${hist.length}`:''}
${dep.env?`\nEnvironment:\n${Object.entries(dep.env).map(([k,v])=>`  ${k}: ${v}`).join('\n')}`:''}
Resources:
  Limits:   ${JSON.stringify(dep.limits||{cpu:'500m',memory:'512Mi'})}
  Requests: ${JSON.stringify(dep.requests||{cpu:'100m',memory:'256Mi'})}`;
  }

  function describeDaemonset(ds) {
    return `Name:           ${ds.name}
Namespace:      ${ds.namespace||'default'}
Desired:        ${ds.desired||0}
Current:        ${ds.current||0}
Ready:          ${ds.ready||0}
Node-Selector:  ${ds.nodeSelector||'<none>'}
Image:          ${ds.image||'unknown'}`;
  }

  function describeConfigmap(cm) {
    let out = `Name:         ${cm.name}\nNamespace:    ${cm.namespace||'default'}\n\nData\n====\n`;
    Object.entries(cm.data||{}).forEach(([k,v]) => { out += `${k}:\n----\n${v}\n\n`; });
    return out;
  }

  // ══════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════

  function getPods(ns, allNs, name) {
    let pods = cluster.pods || [];
    if (name) pods = pods.filter(p => p.name === name || p.name.startsWith(name));
    if (!allNs && ns) pods = pods.filter(p => p.namespace === ns);
    return pods;
  }

  function getByNs(list, ns, allNs, name) {
    let items = list || [];
    if (name) items = items.filter(i => i.name === name || i.name?.startsWith(name));
    if (!allNs && ns) items = items.filter(i => i.namespace === ns);
    return items;
  }

  function findByName(list, name, ns) {
    if (!name) return null;
    return (list||[]).find(i =>
      (i.name === name || i.name?.startsWith(name)) &&
      (!ns || !i.namespace || i.namespace === ns)
    ) || null;
  }

  function parseFlags(args) {
    const flags = { _: [] };
    let i = 0;
    while (i < args.length) {
      const a = args[i];
      if (a === '--') { i++; flags._ = flags._.concat(args.slice(i)); break; }
      if (a.startsWith('--')) {
        const key = a.slice(2);
        if (key.includes('=')) {
          const [k,v] = key.split('=');
          flags[k] = v;
        } else if (i+1 < args.length && !args[i+1].startsWith('-')) {
          flags[key] = args[++i];
        } else {
          flags[key] = true;
        }
      } else if (a.startsWith('-') && a.length === 2) {
        const k = a.slice(1);
        if (i+1 < args.length && !args[i+1].startsWith('-')) {
          flags[k] = args[++i];
        } else {
          flags[k] = true;
        }
      } else {
        flags._.push(a);
      }
      i++;
    }
    return flags;
  }

  function tokenize(raw) {
    const tokens = [];
    let cur = '';
    let inQ = false;
    let qChar = '';
    for (const c of raw) {
      if (inQ) {
        if (c === qChar) inQ = false;
        else cur += c;
      } else if (c === '"' || c === "'") {
        inQ = true; qChar = c;
      } else if (c === ' ' || c === '\t') {
        if (cur) { tokens.push(cur); cur = ''; }
      } else {
        cur += c;
      }
    }
    if (cur) tokens.push(cur);
    return tokens;
  }

  function extractJsonpath(items, jsonpathExpr) {
    // Simple jsonpath: {.items[*].metadata.name} or {.spec.replicas}
    const match = jsonpathExpr.match(/\{([^}]+)\}/);
    if (!match) return '';
    const path = match[1].replace(/^\./,'').split('.').filter(Boolean);
    const data = Array.isArray(items) ? items : [items];
    try {
      return data.map(item => {
        let v = item;
        for (const k of path) {
          if (k === 'items[*]') { v = v.items || []; continue; }
          v = v?.[k];
        }
        return v ?? '';
      }).join(' ');
    } catch { return ''; }
  }

  function col(s, width) {
    const str = String(s);
    return str.length >= width ? str.slice(0, width-1) + ' ' : str + ' '.repeat(width - str.length);
  }

  function ok(text) { return { text: text || '' }; }
  function err(msg) { return { error: msg }; }

  return { mount, run, allCommands };
})();
