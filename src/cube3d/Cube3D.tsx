// Placeholder until slice 1 lands: a soft glossy square standing in for the cube.
import type { CubeStageProps } from './CubeStage';
export default function Cube3D(_props: CubeStageProps) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
      <div style={{ width: '46vmin', height: '46vmin', maxWidth: 360, maxHeight: 360, borderRadius: '18%', background: 'linear-gradient(145deg,#3E7BE0,#3DBE72)', boxShadow: 'var(--gloss), var(--shadow-2)' }} />
    </div>
  );
}
