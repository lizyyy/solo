
import { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3-force';
import { Wallet, Transaction, ForceParams, Node3D, Edge3D } from '../types';

interface SimulationNode extends d3.SimulationNodeDatum {
  id: string;
  wallet: Wallet;
  isSelected: boolean;
  isHighlighted: boolean;
}

interface SimulationLink extends d3.SimulationLinkDatum<SimulationNode> {
  source: string | SimulationNode;
  target: string | SimulationNode;
  transaction: Transaction;
  isAnomaly: boolean;
}

export const useForceSimulation = (
  wallets: Wallet[],
  transactions: Transaction[],
  forceParams: ForceParams,
  selectedWalletId: string | null,
  highlightedPath: string[]
) => {
  const nodesRef = useRef<SimulationNode[]>([]);
  const linksRef = useRef<SimulationLink[]>([]);
  const simulationRef = useRef<d3.Simulation<SimulationNode, SimulationLink> | null>(null);
  const nodePositionsRef = useRef<Map<string, Node3D>>(new Map());
  const edgesRef = useRef<Map<string, Edge3D>>(new Map());

  const { nodes, edges } = useMemo(() => {
    const txMap = new Set(transactions.map(t => `${t.from}-${t.to}`));
    
    const nodes: SimulationNode[] = wallets.map((wallet) => ({
      id: wallet.id,
      wallet,
      isSelected: wallet.id === selectedWalletId,
      isHighlighted: highlightedPath.includes(wallet.id),
    }));

    const edges: SimulationLink[] = transactions.map((tx) => ({
      source: tx.from,
      target: tx.to,
      transaction: tx,
      isAnomaly: tx.isAnomaly,
    }));

    return { nodes, edges };
  }, [wallets, transactions, selectedWalletId, highlightedPath]);

  useEffect(() => {
    nodesRef.current = nodes;
    linksRef.current = edges;

    if (nodes.length === 0) return;

    nodes.forEach((n) => {
      if (!nodePositionsRef.current.has(n.id)) {
        nodePositionsRef.current.set(n.id, {
          id: n.id,
          x: (Math.random() - 0.5) * 400,
          y: (Math.random() - 0.5) * 400,
          z: (Math.random() - 0.5) * 400,
          vx: 0,
          vy: 0,
          vz: 0,
          wallet: n.wallet,
          isSelected: n.isSelected,
          isHighlighted: n.isHighlighted,
        });
      }
    });

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    edges.forEach((e) => {
      const sourceId = typeof e.source === 'string' ? e.source : e.source.id;
      const targetId = typeof e.target === 'string' ? e.target : e.target.id;
      const edgeId = `${sourceId}-${targetId}`;
      edgesRef.current.set(edgeId, {
        id: edgeId,
        source: sourceId,
        target: targetId,
        transaction: e.transaction,
        isHighlighted: false,
        isAnomaly: e.isAnomaly,
      });
    });

    simulationRef.current = d3
      .forceSimulation(nodesRef.current)
      .force(
        'link',
        d3
          .forceLink<SimulationNode, SimulationLink>(linksRef.current)
          .id((d) => d.id)
          .distance(forceParams.linkDistance)
          .strength(forceParams.linkStrength)
      )
      .force('charge', d3.forceManyBody().strength(forceParams.charge))
      .force('center', d3.forceCenter(0, 0).strength(forceParams.centerStrength))
      .force('collision', d3.forceCollide().radius(35))
      .alphaDecay(0.02)
      .on('tick', () => {
        nodesRef.current.forEach((node) => {
          const existing = nodePositionsRef.current.get(node.id);
          if (existing) {
            existing.x = node.x || 0;
            existing.y = node.y || 0;
            existing.vx = node.vx || 0;
            existing.vy = node.vy || 0;
            existing.isSelected = node.isSelected;
            existing.isHighlighted = node.isHighlighted;
          }
        });
      });

    return () => {
      simulationRef.current?.stop();
    };
  }, [nodes.length, edges.length, forceParams]);

  useEffect(() => {
    if (simulationRef.current) {
      simulationRef.current
        .force<d3.ForceLink<SimulationNode, SimulationLink>>('link')
        ?.distance(forceParams.linkDistance)
        .strength(forceParams.linkStrength);
      simulationRef.current
        .force<d3.ForceManyBody<SimulationNode>>('charge')
        ?.strength(forceParams.charge);
      simulationRef.current
        .force<d3.ForceCenter<SimulationNode>>('center')
        ?.strength(forceParams.centerStrength);
      simulationRef.current.alpha(0.3).restart();
    }
  }, [forceParams]);

  useEffect(() => {
    if (simulationRef.current && nodes.length > 0) {
      nodesRef.current.forEach((n) => {
        n.isSelected = n.id === selectedWalletId;
        n.isHighlighted = highlightedPath.includes(n.id);
      });
    }
  }, [selectedWalletId, highlightedPath]);

  return {
    getNodes: () => Array.from(nodePositionsRef.current.values()),
    getEdges: () => Array.from(edgesRef.current.values()),
    reheat: () => simulationRef.current?.alpha(0.5).restart(),
  };
};
