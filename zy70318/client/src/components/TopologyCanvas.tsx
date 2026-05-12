import type { Service, Dependency, InjectedFault, TraceEvent } from '../types';

interface Props {
  services: Service[];
  dependencies: Dependency[];
  selectedService?: string;
  onSelect?: (id: string) => void;
  injectedFaults?: InjectedFault[];
  trace?: TraceEvent[];
}

export default function TopologyCanvas({
  services,
  dependencies,
  selectedService,
  onSelect,
  injectedFaults = [],
  trace = [],
}: Props) {
  const faultServices = new Set(injectedFaults.map((f) => f.serviceId));
  const degradedServices = new Set(
    trace
      .filter(
        (t) =>
          t.event === 'DEGRADE_CACHE' ||
          t.event === 'DEGRADE_FALLBACK' ||
          t.event === 'DEGRADE_BLOCK' ||
          t.event === 'CACHE_EXPIRED'
      )
      .map((t) => t.serviceId)
  );

  const getNodeCenter = (s: Service) => ({
    x: s.x + 60,
    y: s.y + 20,
  });

  const renderDependency = (dep: Dependency) => {
    const source = services.find((s) => s.id === dep.source);
    const target = services.find((s) => s.id === dep.target);
    if (!source || !target) return null;

    const start = getNodeCenter(source);
    const end = getNodeCenter(target);

    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2 - 20;

    const isFault = faultServices.has(target.id);
    const isDegraded = degradedServices.has(target.id);

    return (
      <svg
        key={dep.id}
        className="dependency-line"
        style={{ left: 0, top: 0, width: '100%', height: '100%' }}
      >
        <path
          d={`M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`}
          className={`dependency-line ${isFault ? 'fault' : isDegraded ? 'degraded' : ''}`}
          markerEnd="url(#arrow)"
        />
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
          </marker>
        </defs>
      </svg>
    );
  };

  const renderNode = (service: Service) => {
    const isFault = faultServices.has(service.id);
    const isDegraded = degradedServices.has(service.id);
    const isSelected = selectedService === service.id;

    let className = 'service-node';
    if (service.role === 'core') className += ' core';
    if (isSelected) className += ' selected';
    if (isFault) className += ' fault';
    else if (isDegraded) className += ' degraded';

    return (
      <div
        key={service.id}
        className={className}
        style={{ left: service.x, top: service.y }}
        onClick={() => onSelect?.(service.id)}
        title={service.description}
      >
        <div>{service.name}</div>
        {service.role === 'core' && (
          <span className="badge badge-core" style={{ marginTop: 4 }}>
            核心
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="topology-container">
      {dependencies.map(renderDependency)}
      {services.map(renderNode)}
    </div>
  );
}
