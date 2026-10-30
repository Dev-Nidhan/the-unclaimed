"use client";

import { useMemo, useState, type CSSProperties } from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { EvidenceTimeline } from "@/components/investigation/evidence-timeline";
import { buttonClass } from "@/components/ui/panel";
import {
  edgeKindLabels,
  edgeKinds,
  formatRecordedDate,
  nodeKindLabels,
  nodeKinds,
  nodeStateLabels,
  nodeStates,
  type EdgeKind,
  type EvidenceGraphEdge,
  type EvidenceModel,
  type EvidenceNodeData,
  type NodeKind,
  type NodeState,
} from "@/lib/investigations/graph";

const stateColors: Record<NodeState, string> = {
  accessible: "#8aa58a",
  archived: "#b08958",
  inaccessible: "#c4897c",
  unresolved: "#a39b90",
  historical: "#d7c4a3",
};

function allKinds(): Record<NodeKind, boolean> {
  return Object.fromEntries(nodeKinds.map((kind) => [kind, true])) as Record<NodeKind, boolean>;
}

function allStates(): Record<NodeState, boolean> {
  return Object.fromEntries(nodeStates.map((state) => [state, true])) as Record<NodeState, boolean>;
}

function allEdges(): Record<EdgeKind, boolean> {
  return Object.fromEntries(edgeKinds.map((kind) => [kind, true])) as Record<EdgeKind, boolean>;
}

function EvidenceNodeView({ data, selected }: NodeProps<Node<EvidenceNodeData>>) {
  return (
    <div className={`evidence-node w-[220px] ${selected ? "is-selected" : ""}`} style={{ "--node-state": stateColors[data.state] } as CSSProperties & { "--node-state": string }}>
      <Handle type="target" position={Position.Left} />
      <p className="evidence-node-kind">{nodeKindLabels[data.kind]}</p>
      <p className="evidence-node-title line-clamp-2 break-words">{data.label}</p>
      <p className="evidence-node-status">{nodeStateLabels[data.state]} <span>·</span> {data.observations.length} read</p>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { evidence: EvidenceNodeView };

function RecordInspector({
  model,
  nodes,
  selectedId,
  onSelect,
}: {
  model: EvidenceModel;
  nodes: EvidenceModel["nodes"];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { fitView } = useReactFlow();
  const node = model.nodes.find((item) => item.id === selectedId) ?? null;
  const connections = node
    ? model.edges.filter((edge) => edge.source === node.id || edge.target === node.id)
    : [];

  function center(id: string) {
    onSelect(id);
    void fitView({ nodes: [{ id }], duration: 400, padding: 0.4 });
  }

  return (
    <aside className="min-w-0 rounded-lg border border-line bg-surface px-4 py-4">
      <p className="text-[0.68rem] tracking-[0.16em] text-amber uppercase">Record</p>
      <h2 className="font-serif text-lg">Inspection</h2>
      <label className="mt-3 block text-sm">
        <span className="text-xs tracking-[0.14em] text-muted uppercase">Jump to</span>
        <select
          className="mt-1 w-full rounded-md border border-line bg-raised px-3 py-2 text-sm"
          value={selectedId ?? ""}
          onChange={(event) => {
            if (event.target.value) {
              center(event.target.value);
            }
          }}
        >
          <option value="">Select a stored record</option>
          {nodes.map((item) => (
            <option key={item.id} value={item.id}>
              {nodeKindLabels[item.data.kind]}: {item.data.label}
            </option>
          ))}
        </select>
      </label>
      {node ? (
        <div className="mt-4 space-y-4 text-sm leading-6">
          <div>
            <p className="font-serif text-xl">{node.data.label}</p>
            <p className="text-muted">
              {nodeKindLabels[node.data.kind]} · {nodeStateLabels[node.data.state]}
            </p>
            <button type="button" className={`${buttonClass("quiet")} mt-2`} onClick={() => center(node.id)}>
              Center on record
            </button>
          </div>
          <div>
            <h3 className="text-xs tracking-[0.14em] text-muted uppercase">Source URL</h3>
            {node.data.url ? <p className="break-all">{node.data.url}</p> : <p className="text-muted">No URL is stored for this record.</p>}
          </div>
          <div>
            <h3 className="text-xs tracking-[0.14em] text-muted uppercase">Observation timestamps</h3>
            {node.data.observations.length === 0 ? (
              <p className="text-muted">No observation is stored.</p>
            ) : (
              <ul className="space-y-2">
                {node.data.observations.map((observation) => (
                  <li key={observation.id}>
                    <p>{formatRecordedDate(observation.observedAt)}</p>
                    <p className="text-muted">Observed by this investigation. Observation {observation.id}.</p>
                    {observation.pageTitle ? <p>{observation.pageTitle}</p> : null}
                    {observation.httpStatus ? <p className="text-muted">HTTP {observation.httpStatus}</p> : null}
                    {observation.excerpt ? (
                      <blockquote className="evidence-excerpt">“{observation.excerpt}{observation.excerpt.length >= 420 ? "…" : ""}”</blockquote>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="text-xs tracking-[0.14em] text-muted uppercase">Archive captures</h3>
            {node.data.historicalCaptures.length === 0 ? (
              <p className="text-muted">No archive capture is stored.</p>
            ) : (
              <ul className="space-y-2">
                {node.data.historicalCaptures.map((capture) => (
                  <li key={capture.id}>
                    <p>{formatRecordedDate(capture.capturedAt)}</p>
                    <p className="text-muted">Historical capture date. Availability {capture.availabilityStatus}.</p>
                    {capture.archiveUrl ? (
                      <a className="text-amber underline" href={capture.archiveUrl} target="_blank" rel="noreferrer">
                        Open stored snapshot
                      </a>
                    ) : (
                      <p>The snapshot was not recovered, so there is no archive link.</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="text-xs tracking-[0.14em] text-muted uppercase">Related findings</h3>
            {node.data.findings.length === 0 ? (
              <p className="text-muted">No finding cites this source.</p>
            ) : (
              <ul className="space-y-2">
                {node.data.findings.map((finding) => (
                  <li key={finding.id}>
                    <p className="font-serif">{finding.title}</p>
                    <p className="text-muted">{finding.classification}</p>
                    <p>{finding.explanation}</p>
                    <p className="text-muted">Observations {finding.observationIds.join(", ")}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="text-xs tracking-[0.14em] text-muted uppercase">Supporting evidence</h3>
            <ul className="space-y-2">
              {node.data.evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
              {connections.map((edge) => (
                <li key={edge.id}>
                  {edgeKindLabels[edge.kind]}. {edge.evidence}
                </li>
              ))}
              {node.data.withheldRelationships.map((item) => (
                <li key={`${item.id}-${item.otherName}`}>
                  Stored relationship {item.relationshipType} with {item.otherName} cites source {item.evidenceSourceId}.
                  That wording is not an evidence edge, so the graph leaves it unconnected.
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-muted">
          Select a record to see its URL, observation times, findings, and any available archive capture.
        </p>
      )}
    </aside>
  );
}

export function EvidenceBoard({ model }: { model: EvidenceModel }) {
  return (
    <ReactFlowProvider>
      <Board model={model} />
    </ReactFlowProvider>
  );
}

function Board({ model }: { model: EvidenceModel }) {
  const [kinds, setKinds] = useState(allKinds);
  const [states, setStates] = useState(allStates);
  const [edgesOn, setEdgesOn] = useState(allEdges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const visibleNodes = useMemo(
    () => model.nodes.filter((node) => kinds[node.data.kind] && states[node.data.state]),
    [kinds, model.nodes, states],
  );
  const visibleIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const visibleEdges = useMemo(
    () =>
      model.edges.filter(
        (edge) => edgesOn[edge.kind] && visibleIds.has(edge.source) && visibleIds.has(edge.target),
      ),
    [edgesOn, model.edges, visibleIds],
  );
  const activeId = selectedId && visibleIds.has(selectedId) ? selectedId : null;
  const flowNodes: Node<EvidenceNodeData>[] = visibleNodes.map((node) => ({
    id: node.id,
    type: "evidence",
    position: node.position,
    data: node.data,
    selected: node.id === activeId,
    connectable: false,
    style: { background: "transparent", border: "none", boxShadow: "none", padding: 0, width: 220 },
  }));
  const flowEdges: Edge[] = visibleEdges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edgeKindLabels[edge.kind],
    style: { stroke: "#b08958" },
    labelStyle: { fill: "#e7e1d6", fontSize: 11 },
    labelBgStyle: { fill: "#1c1a17" },
    labelBgPadding: [4, 2],
    labelBgBorderRadius: 4,
  }));
  const filterKey = `${visibleNodes.map((node) => node.id).join("|")}::${visibleEdges.map((edge) => edge.id).join("|")}`;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-3">
          <FilterBar
            kinds={kinds}
            states={states}
            edgesOn={edgesOn}
            counts={countNodes(model)}
            edgeCounts={countEdges(model.edges)}
            onKind={(kind) => setKinds((current) => ({ ...current, [kind]: !current[kind] }))}
            onState={(state) => setStates((current) => ({ ...current, [state]: !current[state] }))}
            onEdge={(kind) => setEdgesOn((current) => ({ ...current, [kind]: !current[kind] }))}
          />
          <div className="evidence-graph h-[min(70vh,720px)] min-h-80 overflow-hidden rounded-lg border border-line">
            {visibleNodes.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">No stored records match these filters.</p>
            ) : (
              <ReactFlow
                key={filterKey}
                nodes={flowNodes}
                edges={flowEdges}
                nodeTypes={nodeTypes}
                colorMode="dark"
                fitView
                minZoom={0.2}
                maxZoom={2}
                nodesConnectable={false}
                elementsSelectable
                panOnDrag
                zoomOnScroll
                zoomOnPinch
                zoomOnDoubleClick
                proOptions={{ hideAttribution: false }}
                onNodeClick={(_event, node) => setSelectedId(node.id)}
                aria-label="Evidence graph"
              >
                <Background />
                <Controls showInteractive={false} />
                <MiniMap
                  pannable
                  zoomable
                  ariaLabel="Evidence graph overview"
                  bgColor="#141311"
                  maskColor="rgba(20, 19, 17, 0.65)"
                  nodeStrokeWidth={2}
                  nodeColor={(node) => stateColors[(node.data as EvidenceNodeData).state]}
                />
              </ReactFlow>
            )}
          </div>
        </div>
        <RecordInspector model={model} nodes={visibleNodes} selectedId={activeId} onSelect={setSelectedId} />
      </div>
      <EvidenceTimeline events={model.events} />
    </div>
  );
}

function countNodes(model: EvidenceModel): Record<NodeKind, number> {
  const counts = Object.fromEntries(nodeKinds.map((kind) => [kind, 0])) as Record<NodeKind, number>;
  for (const node of model.nodes) {
    counts[node.data.kind] += 1;
  }
  return counts;
}

function countEdges(edges: EvidenceGraphEdge[]): Record<EdgeKind, number> {
  const counts = Object.fromEntries(edgeKinds.map((kind) => [kind, 0])) as Record<EdgeKind, number>;
  for (const edge of edges) {
    counts[edge.kind] += 1;
  }
  return counts;
}

function FilterBar({
  kinds,
  states,
  edgesOn,
  counts,
  edgeCounts,
  onKind,
  onState,
  onEdge,
}: {
  kinds: Record<NodeKind, boolean>;
  states: Record<NodeState, boolean>;
  edgesOn: Record<EdgeKind, boolean>;
  counts: Record<NodeKind, number>;
  edgeCounts: Record<EdgeKind, number>;
  onKind: (kind: NodeKind) => void;
  onState: (state: NodeState) => void;
  onEdge: (kind: EdgeKind) => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-line bg-surface px-4 py-3 md:grid-cols-3">
      <fieldset>
        <legend className="text-xs tracking-[0.14em] text-muted uppercase">Records</legend>
        <div className="mt-2 space-y-1">
          {nodeKinds.map((kind) => (
            <label key={kind} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={kinds[kind]} onChange={() => onKind(kind)} />
              {nodeKindLabels[kind]} ({counts[kind]})
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-xs tracking-[0.14em] text-muted uppercase">States</legend>
        <div className="mt-2 space-y-1">
          {nodeStates.map((state) => (
            <label key={state} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={states[state]} onChange={() => onState(state)} />
              <span style={{ color: stateColors[state] }}>{nodeStateLabels[state]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-xs tracking-[0.14em] text-muted uppercase">Edges</legend>
        <div className="mt-2 space-y-1">
          {edgeKinds.map((kind) => (
            <label key={kind} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={edgesOn[kind]} onChange={() => onEdge(kind)} />
              {edgeKindLabels[kind]} ({edgeCounts[kind]})
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
