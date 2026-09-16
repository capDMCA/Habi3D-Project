import type { FurnitureCategory, FurnitureItem } from '../types';

interface ModelDimensions {
  length: number;
  width: number;
  height: number;
  color: string;
}

const CATEGORY_COLORS: Record<FurnitureCategory, string> = {
  sofa: '#315B7D',
  coffee_table: '#A06B3B',
  tv_stand: '#424A55',
  dining_table: '#795A42',
  dining_chair: '#3F786D',
  cabinet: '#865D69',
  side_table: '#A87943',
  work_desk: '#526B7A',
  other: '#69727A',
};

function toWorldDimension(valueCm: number): number {
  return Math.max(valueCm / 100, 0.02);
}

function BoxPart({
  size,
  position,
  color,
}: {
  size: [number, number, number];
  position: [number, number, number];
  color: string;
}) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.68} metalness={0.02} />
    </mesh>
  );
}

function TableModel({ length, width, height, color }: ModelDimensions) {
  const topThickness = Math.max(height * 0.1, Math.min(0.06, height * 0.25));
  const legHeight = height - topThickness;
  const legSize = Math.min(length, width) * 0.09;
  const legX = Math.max(0, length / 2 - legSize);
  const legZ = Math.max(0, width / 2 - legSize);

  return (
    <group>
      <BoxPart
        size={[length, topThickness, width]}
        position={[0, height - topThickness / 2, 0]}
        color={color}
      />
      {legHeight > 0 && [
        [-legX, -legZ],
        [legX, -legZ],
        [-legX, legZ],
        [legX, legZ],
      ].map(([x, z], index) => (
        <BoxPart
          key={index}
          size={[legSize, legHeight, legSize]}
          position={[x, legHeight / 2, z]}
          color={color}
        />
      ))}
    </group>
  );
}

function SofaModel({ length, width, height, color }: ModelDimensions) {
  const seatHeight = height * 0.45;
  const backDepth = width * 0.16;
  const armWidth = Math.min(length * 0.1, width * 0.16);

  return (
    <group>
      <BoxPart
        size={[length, seatHeight, width * 0.82]}
        position={[0, seatHeight / 2, -width * 0.05]}
        color={color}
      />
      <BoxPart
        size={[length, height, backDepth]}
        position={[0, height / 2, width / 2 - backDepth / 2]}
        color={color}
      />
      <BoxPart
        size={[armWidth, height * 0.68, width * 0.8]}
        position={[-length / 2 + armWidth / 2, height * 0.34, -width * 0.06]}
        color={color}
      />
      <BoxPart
        size={[armWidth, height * 0.68, width * 0.8]}
        position={[length / 2 - armWidth / 2, height * 0.34, -width * 0.06]}
        color={color}
      />
    </group>
  );
}

function ChairModel({ length, width, height, color }: ModelDimensions) {
  const seatThickness = height * 0.12;
  const seatHeight = height * 0.46;
  const legHeight = Math.max(seatHeight - seatThickness / 2, height * 0.15);
  const legSize = Math.min(length, width) * 0.1;
  const legX = Math.max(0, length * 0.38);
  const legZ = Math.max(0, width * 0.34);

  return (
    <group>
      <BoxPart
        size={[length * 0.86, seatThickness, width * 0.82]}
        position={[0, seatHeight, 0]}
        color={color}
      />
      <BoxPart
        size={[length * 0.86, height * 0.48, width * 0.1]}
        position={[0, height * 0.75, width * 0.4]}
        color={color}
      />
      {[
        [-legX, -legZ],
        [legX, -legZ],
        [-legX, legZ],
        [legX, legZ],
      ].map(([x, z], index) => (
        <BoxPart
          key={index}
          size={[legSize, legHeight, legSize]}
          position={[x, legHeight / 2, z]}
          color={color}
        />
      ))}
    </group>
  );
}

function LShapeModel({ length, width, height, color }: ModelDimensions) {
  const isLow = height < 1.2;
  const horizontalHeight = isLow ? height * 0.5 : height;
  const horizontalDepth = width * 0.55;
  const returnLength = length * 0.42;

  return (
    <group>
      <BoxPart
        size={[length, horizontalHeight, horizontalDepth]}
        position={[0, horizontalHeight / 2, width / 2 - horizontalDepth / 2]}
        color={color}
      />
      <BoxPart
        size={[returnLength, horizontalHeight, width]}
        position={[-length / 2 + returnLength / 2, horizontalHeight / 2, 0]}
        color={color}
      />
      {isLow && (
        <BoxPart
          size={[length, height, width * 0.13]}
          position={[0, height / 2, width / 2 - width * 0.065]}
          color={color}
        />
      )}
    </group>
  );
}

function CurvedModel({
  item,
  length,
  width,
  height,
  color,
}: ModelDimensions & { item: FurnitureItem }) {
  const isTable = [
    'coffee_table',
    'dining_table',
    'side_table',
  ].includes(item.category);

  if (isTable) {
    const topThickness = Math.max(height * 0.1, Math.min(0.07, height * 0.24));
    const supportHeight = height - topThickness;
    const supportRadius = Math.min(length, width) * 0.11;

    return (
      <group>
        <mesh
          position={[0, height - topThickness / 2, 0]}
          scale={[length, 1, width]}
        >
          <cylinderGeometry args={[0.5, 0.5, topThickness, 24]} />
          <meshStandardMaterial color={color} roughness={0.68} metalness={0.02} />
        </mesh>
        <mesh position={[0, supportHeight / 2, 0]}>
          <cylinderGeometry args={[supportRadius, supportRadius, supportHeight, 16]} />
          <meshStandardMaterial color={color} roughness={0.68} metalness={0.02} />
        </mesh>
      </group>
    );
  }

  return (
    <mesh position={[0, height / 2, 0]} scale={[length, 1, width]}>
      <cylinderGeometry args={[0.5, 0.5, height, 24]} />
      <meshStandardMaterial color={color} roughness={0.68} metalness={0.02} />
    </mesh>
  );
}

function RectangularModel({ item, ...dimensions }: ModelDimensions & { item: FurnitureItem }) {
  switch (item.category) {
    case 'sofa':
      return <SofaModel {...dimensions} />;
    case 'coffee_table':
    case 'dining_table':
    case 'side_table':
    case 'work_desk':
      return <TableModel {...dimensions} />;
    case 'dining_chair':
      return <ChairModel {...dimensions} />;
    case 'tv_stand':
    case 'cabinet':
    case 'other':
    default:
      return (
        <BoxPart
          size={[dimensions.length, dimensions.height, dimensions.width]}
          position={[0, dimensions.height / 2, 0]}
          color={dimensions.color}
        />
      );
  }
}

export default function DollhouseFurniture({ item }: { item: FurnitureItem }) {
  const dimensions = {
    length: toWorldDimension(item.lengthCm),
    width: toWorldDimension(item.widthCm),
    height: toWorldDimension(item.heightCm),
    color: CATEGORY_COLORS[item.category],
  };
  const x = Number.isFinite(item.posX) ? item.posX : 0;
  const z = Number.isFinite(item.posZ) ? item.posZ : 0;
  const rotationY = Number.isFinite(item.rotationY) ? item.rotationY : 0;

  return (
    <group position={[x, 0.025, z]} rotation={[0, rotationY, 0]}>
      {item.shape === 'round' || item.shape === 'oval' ? (
        <CurvedModel item={item} {...dimensions} />
      ) : item.shape === 'l-shape' ? (
        <LShapeModel {...dimensions} />
      ) : (
        <RectangularModel item={item} {...dimensions} />
      )}
    </group>
  );
}
