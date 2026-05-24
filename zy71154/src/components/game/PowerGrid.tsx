import { useMemo } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { isUserNode } from '../../game/engine';
import { Substation } from './Substation';
import { PowerLine } from './PowerLine';
import { UserNode } from './UserNode';
import { RepairTeamMarker } from './RepairTeamMarker';

export function PowerGrid() {
  const { nodes, teams, selectedNode, selectedTeam, selectNode, selectTeam, assignTeamToNode } = useGameStore();

  const connectedNodeMap = useMemo(() => {
    const map: Record<string, typeof nodes> = {};
    for (const node of nodes) {
      map[node.id] = node.connectedTo
        .map(id => nodes.find(n => n.id === id))
        .filter(Boolean) as typeof nodes;
    }
    return map;
  }, [nodes]);

  const handleNodeClick = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    if (selectedTeam && node.type !== 'user') {
      const team = teams.find(t => t.id === selectedTeam);
      if (team && team.status === 'idle') {
        assignTeamToNode(selectedTeam, nodeId);
        return;
      }
    }

    if (selectedNode === nodeId) {
      selectNode(null);
    } else {
      selectNode(nodeId);
    }
  };

  const handleTeamClick = (teamId: string) => {
    if (selectedTeam === teamId) {
      selectTeam(null);
    } else {
      selectTeam(teamId);
    }
  };

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>

      <gridHelper args={[100, 50, '#334155', '#334155']} position={[0, 0.01, 0]} />

      {nodes.map(node => {
        const connectedNodes = connectedNodeMap[node.id] || [];
        const isSelected = selectedNode === node.id;

        if (node.type === 'substation') {
          return (
            <Substation
              key={node.id}
              node={node}
              isSelected={isSelected}
              onClick={() => handleNodeClick(node.id)}
            />
          );
        }

        if (node.type === 'powerline') {
          return (
            <PowerLine
              key={node.id}
              node={node}
              connectedNodes={connectedNodes}
              isSelected={isSelected}
              onClick={() => handleNodeClick(node.id)}
            />
          );
        }

        if (isUserNode(node)) {
          return (
            <UserNode
              key={node.id}
              node={node}
              isSelected={isSelected}
              onClick={() => handleNodeClick(node.id)}
            />
          );
        }

        return null;
      })}

      {teams.map(team => (
        <RepairTeamMarker
          key={team.id}
          team={team}
          isSelected={selectedTeam === team.id}
          onClick={() => handleTeamClick(team.id)}
        />
      ))}
    </group>
  );
}
