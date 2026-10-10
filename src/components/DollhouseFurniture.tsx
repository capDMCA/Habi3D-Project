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
  bed: '#3B6A82',
  wardrobe: '#6E5268',
  armchair: '#3B597B',
  appliance: '#546E7A',
  electrical: '#37474F',
  mirror: '#78909C',
  plant: '#2E7D32',
  bathroom_fixture: '#00838F',
  storage_rack: '#8D6E63',
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

function ArmchairModel({ length, width, height, color }: ModelDimensions) {
  const seatHeight = height * 0.45;
  const backDepth = width * 0.18;
  const armWidth = length * 0.18;

  return (
    <group>
      <BoxPart
        size={[length * 0.85, seatHeight, width * 0.8]}
        position={[0, seatHeight / 2, -width * 0.05]}
        color={color}
      />
      <BoxPart
        size={[length, height, backDepth]}
        position={[0, height / 2, width / 2 - backDepth / 2]}
        color={color}
      />
      <BoxPart
        size={[armWidth, height * 0.65, width * 0.78]}
        position={[-length / 2 + armWidth / 2, height * 0.32, -width * 0.05]}
        color={color}
      />
      <BoxPart
        size={[armWidth, height * 0.65, width * 0.78]}
        position={[length / 2 - armWidth / 2, height * 0.32, -width * 0.05]}
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

  // Plant: Pot + foliage cluster
  if (item.category === 'plant' || item.label.toLowerCase().includes('plant')) {
    const potHeight = height * 0.42;
    const potRadius = Math.min(length, width) * 0.38;
    return (
      <group>
        <mesh position={[0, potHeight / 2, 0]}>
          <cylinderGeometry args={[potRadius * 1.05, potRadius * 0.85, potHeight, 18]} />
          <meshStandardMaterial color="#8D6E63" roughness={0.8} />
        </mesh>
        <mesh position={[0, height * 0.75, 0]}>
          <sphereGeometry args={[Math.min(length, width) * 0.45, 16, 16]} />
          <meshStandardMaterial color="#2E7D32" roughness={0.7} />
        </mesh>
      </group>
    );
  }

  // Pedestal Fan or Floor Lamp
  if (item.category === 'electrical' || item.label.toLowerCase().includes('fan')) {
    const baseRadius = Math.min(length, width) * 0.42;
    const poleHeight = height * 0.82;
    const headRadius = Math.min(length, width) * 0.45;
    return (
      <group>
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[baseRadius, baseRadius, 0.04, 20]} />
          <meshStandardMaterial color={color} roughness={0.5} metalness={0.2} />
        </mesh>
        <mesh position={[0, poleHeight / 2, 0]}>
          <cylinderGeometry args={[0.025, 0.025, poleHeight, 12]} />
          <meshStandardMaterial color="#90A4AE" roughness={0.3} metalness={0.6} />
        </mesh>
        <mesh position={[0, height * 0.85, 0]}>
          <cylinderGeometry args={[headRadius, headRadius, 0.12, 20]} />
          <meshStandardMaterial color={color} roughness={0.5} />
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

function BedModel({ length, width, height, color }: ModelDimensions) {
  const headboardThickness = Math.min(0.12, width * 0.08);
  const headboardHeight = height;
  const mattressHeight = height * 0.55;
  const mattressDepth = width - headboardThickness;

  return (
    <group>
      <BoxPart
        size={[length, headboardHeight, headboardThickness]}
        position={[0, headboardHeight / 2, -width / 2 + headboardThickness / 2]}
        color={color}
      />
      <BoxPart
        size={[length * 0.96, mattressHeight, mattressDepth]}
        position={[0, mattressHeight / 2, headboardThickness / 2]}
        color="#DCE3EC"
      />
    </group>
  );
}

function ApplianceModel({ length, width, height, color, item }: ModelDimensions & { item: FurnitureItem }) {
  const label = item.label.toLowerCase();

  // Refrigerator
  if (label.includes('refrigerator') || label.includes('fridge')) {
    const freezerHeight = height * 0.35;
    const fridgeHeight = height * 0.62;
    return (
      <group>
        <BoxPart size={[length, height, width]} position={[0, height / 2, 0]} color={color} />
        {/* Upper freezer door handle */}
        <BoxPart size={[0.04, freezerHeight * 0.35, 0.04]} position={[length * 0.38, height - freezerHeight * 0.5, width / 2 + 0.02]} color="#CFD8DC" />
        {/* Lower fridge door handle */}
        <BoxPart size={[0.04, fridgeHeight * 0.45, 0.04]} position={[length * 0.38, fridgeHeight * 0.55, width / 2 + 0.02]} color="#CFD8DC" />
      </group>
    );
  }

  // Washing Machine
  if (label.includes('wash') || label.includes('laundry')) {
    return (
      <group>
        <BoxPart size={[length, height, width]} position={[0, height / 2, 0]} color={color} />
        {/* Front drum door */}
        <mesh position={[0, height * 0.48, width / 2 + 0.015]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[Math.min(length, height) * 0.28, Math.min(length, height) * 0.28, 0.03, 24]} />
          <meshStandardMaterial color="#37474F" roughness={0.2} metalness={0.7} />
        </mesh>
      </group>
    );
  }

  // Microwave / Countertop Oven
  if (label.includes('microwave') || label.includes('oven')) {
    return (
      <group>
        <BoxPart size={[length, height, width]} position={[0, height / 2, 0]} color={color} />
        {/* Front glass window */}
        <BoxPart size={[length * 0.65, height * 0.65, 0.02]} position={[-length * 0.1, height * 0.5, width / 2 + 0.01]} color="#263238" />
      </group>
    );
  }

  // Default Appliance
  return <BoxPart size={[length, height, width]} position={[0, height / 2, 0]} color={color} />;
}

function ElectricalModel({ length, width, height, color, item }: ModelDimensions & { item: FurnitureItem }) {
  const label = item.label.toLowerCase();

  // Television
  if (label.includes('tv') || label.includes('television')) {
    const isWall = item.placementType === 'wall';
    return (
      <group>
        {/* Screen */}
        <BoxPart size={[length, height, Math.max(0.04, width * 0.15)]} position={[0, height / 2, 0]} color="#1E293B" />
        <BoxPart size={[length * 0.94, height * 0.9, 0.01]} position={[0, height / 2, 0.025]} color="#0F172A" />
        {/* Base stand if floor/console-standing */}
        {!isWall && (
          <BoxPart size={[length * 0.45, 0.03, width * 0.8]} position={[0, 0.015, 0]} color="#64748B" />
        )}
      </group>
    );
  }

  // Air Conditioner
  if (label.includes('air') || label.includes('ac')) {
    return (
      <group>
        <BoxPart size={[length, height, width]} position={[0, height / 2, 0]} color="#ECEFF1" />
        {/* Airflow vent */}
        <BoxPart size={[length * 0.85, height * 0.2, 0.02]} position={[0, height * 0.2, width / 2 + 0.01]} color="#B0BEC5" />
      </group>
    );
  }

  return <BoxPart size={[length, height, width]} position={[0, height / 2, 0]} color={color} />;
}

function MirrorModel({ length, width, height, color, item }: ModelDimensions & { item: FurnitureItem }) {
  const isWall = item.placementType === 'wall';
  const frameThickness = 0.04;

  return (
    <group>
      {/* Outer frame */}
      <BoxPart size={[length, height, width]} position={[0, height / 2, 0]} color={color} />
      {/* Reflective glass surface */}
      <BoxPart
        size={[length - frameThickness * 2, height - frameThickness * 2, 0.015]}
        position={[0, height / 2, width / 2 + 0.005]}
        color="#E2E8F0"
      />
      {/* Easel rear leg for standing mirror */}
      {!isWall && (
        <BoxPart
          size={[length * 0.4, height * 0.8, 0.03]}
          position={[0, height * 0.4, -width * 0.35]}
          color={color}
        />
      )}
    </group>
  );
}

function StorageRackModel({ length, width, height, color }: ModelDimensions) {
  const tierCount = 3;
  const legSize = 0.035;

  return (
    <group>
      {/* Vertical corner uprights */}
      {[
        [-length / 2 + legSize, -width / 2 + legSize],
        [length / 2 - legSize, -width / 2 + legSize],
        [-length / 2 + legSize, width / 2 - legSize],
        [length / 2 - legSize, width / 2 - legSize],
      ].map(([x, z], idx) => (
        <BoxPart key={idx} size={[legSize, height, legSize]} position={[x, height / 2, z]} color={color} />
      ))}
      {/* Horizontal Shelves */}
      {Array.from({ length: tierCount }).map((_, idx) => {
        const shelfY = (height / (tierCount + 1)) * (idx + 1);
        return (
          <BoxPart
            key={idx}
            size={[length, 0.025, width]}
            position={[0, shelfY, 0]}
            color={color}
          />
        );
      })}
    </group>
  );
}

function BathroomFixtureModel({ length, width, height, color, item }: ModelDimensions & { item: FurnitureItem }) {
  const label = item.label.toLowerCase();

  // Laundry basket / hamper
  if (label.includes('basket') || label.includes('hamper')) {
    return (
      <group>
        <BoxPart size={[length, height * 0.95, width]} position={[0, height * 0.475, 0]} color={color} />
        <BoxPart size={[length * 1.05, height * 0.06, width * 1.05]} position={[0, height * 0.97, 0]} color="#78909C" />
      </group>
    );
  }

  // Vanity unit with washbasin
  return (
    <group>
      <BoxPart size={[length, height, width]} position={[0, height / 2, 0]} color={color} />
      {/* Basin sink top */}
      <BoxPart size={[length * 0.65, 0.04, width * 0.65]} position={[0, height + 0.02, 0]} color="#FFFFFF" />
    </group>
  );
}

function RectangularModel({ item, ...dimensions }: ModelDimensions & { item: FurnitureItem }) {
  switch (item.category) {
    case 'sofa':
      return <SofaModel {...dimensions} />;
    case 'armchair':
      return <ArmchairModel {...dimensions} />;
    case 'bed':
      return <BedModel {...dimensions} />;
    case 'coffee_table':
    case 'dining_table':
    case 'side_table':
    case 'work_desk':
      return <TableModel {...dimensions} />;
    case 'dining_chair':
      return <ChairModel {...dimensions} />;
    case 'appliance':
      return <ApplianceModel {...dimensions} item={item} />;
    case 'electrical':
      return <ElectricalModel {...dimensions} item={item} />;
    case 'mirror':
      return <MirrorModel {...dimensions} item={item} />;
    case 'storage_rack':
      return <StorageRackModel {...dimensions} />;
    case 'bathroom_fixture':
      return <BathroomFixtureModel {...dimensions} item={item} />;
    case 'tv_stand':
    case 'cabinet':
    case 'wardrobe':
    case 'plant':
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
    color: CATEGORY_COLORS[item.category] ?? '#69727A',
  };
  const x = Number.isFinite(item.posX) ? item.posX : 0;
  const z = Number.isFinite(item.posZ) ? item.posZ : 0;
  const rotationY = Number.isFinite(item.rotationY) ? item.rotationY : 0;

  // Elevate wall-mounted furniture to its configured installation height
  const y = item.placementType === 'wall'
    ? Math.max(0.1, (item.mountHeightCm ?? 120) / 100)
    : 0.025;

  return (
    <group position={[x, y, z]} rotation={[0, rotationY, 0]}>
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
