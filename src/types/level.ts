export type HoopPattern = 'still' | 'linear' | 'linear_v' | 'rectangle' | 'circle' | 'circle_cw' | 'circle_ccw' | 'figure8';

export interface EditorHoop {
  id: string;
  baseX: number;
  baseY: number;
  pattern: HoopPattern;
  speed: number;
  innerHalf: number;
  rimThick: number;
  ampX: number;
  ampY: number;
  frameOffset: number;
  rotation?: number; // degrees (0 = horizontal, 90 = vertical, 180 = upside-down)
}

export interface EditorObstacle {
  id: string;
  x1: number; y1: number;
  x2: number; y2: number;
  type: 'metal' | 'trampoline';
  thick: number;
  restitution: number;
  friction: number;
}

export interface LevelData {
  name: string;
  makesNeeded: number;
  hoops: EditorHoop[];
  obstacles: EditorObstacle[];
}

// A user-created level stored in Firebase
export interface UserLevel extends LevelData {
  id: string;
  creatorName: string;
  creatorKey: string;
  createdAt: number;
  updatedAt: number;
}
