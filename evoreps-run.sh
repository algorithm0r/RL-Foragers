#!/usr/bin/env bash
# Stage 6 v1b.7 — run all evo replicates in PARALLEL (bounded), writing to the `evoreps` collection.
# 8 conditions × 8 seeds = 64 runs; MAX at a time (keep it ~cores-2 so other work isn't starved).
# Then: node evoreps-agg.mjs  to aggregate.
set -u
CONDS="food hunt-scarce-on hunt-scarce-off hunt-dense-on hunt-dense-off shelter full full-pits"
SEEDS="101 102 103 104 105 106 107 108"
MAX="${1:-6}"
i=0
for c in $CONDS; do
  for s in $SEEDS; do
    node evoreps.mjs "$c" "$s" &
    i=$((i + 1))
    if [ $((i % MAX)) -eq 0 ]; then wait; fi
  done
done
wait
echo "all $i replicates done"
