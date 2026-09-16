import { CONDO_ROOMS } from '../data/condoLayout';

const CM_TO_WORLD = 0.01;
const UNIT_WIDTH_CM = Math.max(...CONDO_ROOMS.map((room) => room.x + room.width));
const UNIT_DEPTH_CM = Math.max(...CONDO_ROOMS.map((room) => room.y + room.height));
const WALL_THICKNESS = 0.07;
const livingRoom = CONDO_ROOMS.find((room) => room.id === 'living');
const diningRoom = CONDO_ROOMS.find((room) => room.id === 'dining');

const LIVING_DINING_DIVIDER = livingRoom && diningRoom
  ? {
      z: diningRoom.y,
      start: Math.max(livingRoom.x, diningRoom.x),
      end: Math.min(
        livingRoom.x + livingRoom.width,
        diningRoom.x + diningRoom.width,
      ),
    }
  : null;

const ROOM_COLORS: Record<string, string> = {
  balcony: '#B8C9CF',
  bedroom2: '#D8C8B8',
  bedroom1: '#D5D6DE',
  living: '#E5C5B8',
  storage: '#D8C29D',
  bathroom: '#B9D2D2',
  dining: '#BDD5BA',
  kitchen: '#C7CDD2',
};

interface Interval {
  start: number;
  end: number;
}

interface WallSegment {
  key: string;
  x: number;
  z: number;
  length: number;
  horizontal: boolean;
  exterior: boolean;
}

function addInterval(
  collection: Map<number, Interval[]>,
  line: number,
  start: number,
  end: number,
) {
  const intervals = collection.get(line) ?? [];
  intervals.push({ start: Math.min(start, end), end: Math.max(start, end) });
  collection.set(line, intervals);
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  const ordered = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];

  ordered.forEach((interval) => {
    const previous = merged.at(-1);
    if (!previous || interval.start > previous.end) {
      merged.push({ ...interval });
      return;
    }
    previous.end = Math.max(previous.end, interval.end);
  });

  return merged;
}

function buildWallSegments(): WallSegment[] {
  const horizontalEdges = new Map<number, Interval[]>();
  const verticalEdges = new Map<number, Interval[]>();

  CONDO_ROOMS.forEach((room) => {
    addInterval(horizontalEdges, room.y, room.x, room.x + room.width);
    addInterval(horizontalEdges, room.y + room.height, room.x, room.x + room.width);
    addInterval(verticalEdges, room.x, room.y, room.y + room.height);
    addInterval(verticalEdges, room.x + room.width, room.y, room.y + room.height);
  });

  const segments: WallSegment[] = [];

  horizontalEdges.forEach((intervals, z) => {
    mergeIntervals(intervals).forEach(({ start, end }) => {
      if (
        LIVING_DINING_DIVIDER
        && z === LIVING_DINING_DIVIDER.z
        && start === LIVING_DINING_DIVIDER.start
        && end === LIVING_DINING_DIVIDER.end
      ) {
        return;
      }
      segments.push({
        key: `h-${z}-${start}-${end}`,
        x: ((start + end) / 2) * CM_TO_WORLD,
        z: z * CM_TO_WORLD,
        length: (end - start) * CM_TO_WORLD,
        horizontal: true,
        exterior: z === 0 || z === UNIT_DEPTH_CM,
      });
    });
  });

  verticalEdges.forEach((intervals, x) => {
    mergeIntervals(intervals).forEach(({ start, end }) => {
      segments.push({
        key: `v-${x}-${start}-${end}`,
        x: x * CM_TO_WORLD,
        z: ((start + end) / 2) * CM_TO_WORLD,
        length: (end - start) * CM_TO_WORLD,
        horizontal: false,
        exterior: x === 0 || x === UNIT_WIDTH_CM,
      });
    });
  });

  return segments;
}

const WALL_SEGMENTS = buildWallSegments();

export default function DollhouseFloorPlan() {
  return (
    <group>
      <mesh position={[UNIT_WIDTH_CM * CM_TO_WORLD / 2, -0.11, UNIT_DEPTH_CM * CM_TO_WORLD / 2]}>
        <boxGeometry
          args={[
            UNIT_WIDTH_CM * CM_TO_WORLD + 0.18,
            0.16,
            UNIT_DEPTH_CM * CM_TO_WORLD + 0.18,
          ]}
        />
        <meshStandardMaterial color="#7A8286" roughness={0.92} />
      </mesh>

      {CONDO_ROOMS.map((room) => (
        <mesh
          key={room.id}
          position={[
            (room.x + room.width / 2) * CM_TO_WORLD,
            -0.015,
            (room.y + room.height / 2) * CM_TO_WORLD,
          ]}
        >
          <boxGeometry
            args={[
              room.width * CM_TO_WORLD - 0.025,
              0.05,
              room.height * CM_TO_WORLD - 0.025,
            ]}
          />
          <meshStandardMaterial
            color={ROOM_COLORS[room.id] ?? '#D3D6D8'}
            roughness={0.88}
          />
        </mesh>
      ))}

      {LIVING_DINING_DIVIDER && (
        <mesh
          position={[
            ((LIVING_DINING_DIVIDER.start + LIVING_DINING_DIVIDER.end) / 2) * CM_TO_WORLD,
            0.013,
            LIVING_DINING_DIVIDER.z * CM_TO_WORLD,
          ]}
        >
          <boxGeometry
            args={[
              (LIVING_DINING_DIVIDER.end - LIVING_DINING_DIVIDER.start) * CM_TO_WORLD,
              0.006,
              0.025,
            ]}
          />
          <meshStandardMaterial color="#8D9895" roughness={0.9} />
        </mesh>
      )}

      {WALL_SEGMENTS.map((wall) => {
        const height = wall.exterior ? 0.52 : 0.32;
        return (
          <mesh key={wall.key} position={[wall.x, height / 2, wall.z]}>
            <boxGeometry
              args={wall.horizontal
                ? [wall.length + WALL_THICKNESS, height, WALL_THICKNESS]
                : [WALL_THICKNESS, height, wall.length + WALL_THICKNESS]}
            />
            <meshStandardMaterial
              color={wall.exterior ? '#F8F7F3' : '#E8E6E0'}
              roughness={0.82}
            />
          </mesh>
        );
      })}
    </group>
  );
}
