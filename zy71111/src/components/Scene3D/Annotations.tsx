
import { AnnotationPoint } from './AnnotationPoint';
import { useInspectionStore } from '../../store/useInspectionStore';

const EMPTY_ARRAY: never[] = [];

export function Annotations() {
  const inspectionData = useInspectionStore((state) => state.inspectionData);
  const filterLevel = useInspectionStore((state) => state.filterLevel);
  const filterStatus = useInspectionStore((state) => state.filterStatus);
  const timeRange = useInspectionStore((state) => state.timeRange);
  const selectedAnnotation = useInspectionStore((state) => state.selectedAnnotation);
  const selectAnnotation = useInspectionStore((state) => state.selectAnnotation);

  const annotations = inspectionData?.annotations || EMPTY_ARRAY;
  const filteredAnnotations = annotations.filter(
    (ann) =>
      filterLevel.includes(ann.crackLevel) &&
      filterStatus.includes(ann.recheckStatus) &&
      ann.timestamp >= timeRange[0] &&
      ann.timestamp <= timeRange[1]
  );

  return (
    <group>
      {filteredAnnotations.map((ann) => (
        <AnnotationPoint
          key={ann.id}
          position={ann.position}
          crackLevel={ann.crackLevel}
          recheckStatus={ann.recheckStatus}
          isSelected={selectedAnnotation === ann.id}
          onClick={() => selectAnnotation(selectedAnnotation === ann.id ? null : ann.id)}
        />
      ))}
    </group>
  );
}
