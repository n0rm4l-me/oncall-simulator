// ── Scenario registry
// To add a new scenario: create a new file in this folder and add it below.
// Scenarios are shuffled on every game start.

// prettier-ignore
const DEFAULT_SCENARIOS = (() => {
  const all = [
    SCENARIO_ETCD_WAL,
    SCENARIO_OOM_BATCH,
    SCENARIO_DATE_FORMAT,
    SCENARIO_NODE_CNI,
    SCENARIO_KAFKA_LAG,
  ];
  // Fisher-Yates shuffle
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all;
})();
